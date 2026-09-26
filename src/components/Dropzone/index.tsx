"use client";

import { AnimatePresence, motion } from "motion/react";
import React, {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ACCEPT_ATTRIBUTE,
  MAX_FILES,
  describeRejections,
  filterFiles,
  isFileDrag,
} from "../../utils/verifyFile";
import ItemDropzone from "./ItemDropzone";
import OutputSettings from "./OutputSettings";
import { Image } from "@/components/ui/Image";
import { Counter } from "../Counter";
import { getEngine, limitsLine, type MediaOptions } from "@/media/registry";
import type { MediaKind, MediaOutcome } from "@/media/types";
import { DEFAULT_IMAGE_OPTIONS, type ImageOptions } from "@/media/image/options";
import {
  CubeParseError,
  isCubeFile,
  readCubeFile,
} from "@/media/image/lut/cube";
import { forgetLut, registerLut } from "@/media/image/lut/registry";
import { DEFAULT_AUDIO_OPTIONS } from "@/media/audio/options";
import { convertSizeFileAndUnit } from "@/utils/convertSizeFileAndUnit";
import { parallelJobBudget } from "@/utils/deviceBudget";
import { createStoredZip } from "@/utils/zipStore";
import { downloadBlob, uniqueName } from "@/utils/downloadBlob";
import { FILE_INPUT_ID, openFilePicker } from "@/utils/openFilePicker";
import {
  loadSettings,
  saveSettings,
  type StoredSettings,
} from "@/utils/settingsStorage";
import { Button } from "../ui/Button";

/** Seeds both kinds up front so the settings panel and `optionsRef` always
 *  have something to read, whether or not that kind has ever appeared in the
 *  queue yet. */
const INITIAL_OPTIONS: StoredSettings = {
  image: DEFAULT_IMAGE_OPTIONS,
  audio: DEFAULT_AUDIO_OPTIONS,
};

/** Cap the pool so a 16-core machine doesn't spawn 16 decoder workers at once.
 *  Each engine caps its own kind on top of this — see `MediaEngine.concurrency`. */
const MAX_CONCURRENCY = 8;

const ARTWORK_SOURCES = [
  {
    type: "image/avif",
    srcSet:
      "/artwork/poster-800.avif 800w, /artwork/poster-1312.avif 1312w, /artwork/poster-1672.avif 1672w",
    sizes: "(min-width: 768px) 50vw, 100vw",
  },
] as const;

interface QueueItem {
  id: string;
  file: File;
  /** Resolved once on accept, so the pool never re-sniffs a file it holds. */
  kind: MediaKind;
  /**
   * Set only on rows fanned out from "Additional sizes" — the same source
   * file, compressed again at this max dimension instead of the shared
   * setting. Frozen at drop time; see `addFiles`.
   */
  sizeOverride?: number;
}

/** `undefined` = still queued, `null` = failed. */
type ProcessResult = MediaOutcome | null | undefined;

type ResultMap = Record<string, ProcessResult>;

let idCounter = 0;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  idCounter += 1;
  return `file-${idCounter}`;
}

/**
 * Core count is the ceiling, not the answer. A phone reports four or six cores
 * and cannot afford four simultaneous full-resolution decodes — mobile Safari
 * responds to that by killing the tab, which loses the whole queue rather than
 * failing one file. `parallelJobBudget` is what decides how many lanes the
 * device can actually pay for.
 */
function getConcurrency() {
  return parallelJobBudget(MAX_CONCURRENCY);
}

/** Distinguishes the extra-size outputs of one source file from each other
 *  and from the base row — otherwise every fanned row shares one filename. */
function suffixFilename(name: string, suffix: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1
    ? `${name}-${suffix}`
    : `${name.slice(0, dot)}-${suffix}${name.slice(dot)}`;
}

export const Dropzone = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [results, setResults] = useState<ResultMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [notice, setNotice] = useState("");
  /** The archive is assembled without copying the files, but it still has to
   *  checksum every one of them — on a big batch that is long enough for a
   *  second click to arrive. */
  const [isZipping, setIsZipping] = useState(false);
  const [draftOptions, setDraftOptions] = useState<StoredSettings>(
    INITIAL_OPTIONS
  );
  const [appliedOptions, setAppliedOptions] = useState<StoredSettings>(
    INITIAL_OPTIONS
  );
  /** Per-row stage label, for jobs whose first run pays for a WASM download —
   *  a progress bar stuck at 0% during that reads as broken otherwise. */
  const [stage, setStage] = useState<Record<string, string>>({});

  const itemsRef = useRef<QueueItem[]>([]);
  const resultsRef = useRef<ResultMap>({});
  /** The draft, readable synchronously. A dropped `.cube` has to merge into
   *  whatever is currently in the panel, and taking `draftOptions` as a
   *  dependency of `addFiles` would rebuild the window drag listeners every
   *  time a slider moved. */
  const draftOptionsRef = useRef<StoredSettings>(INITIAL_OPTIONS);
  /** Options per kind, so a mixed queue never runs one kind's settings on
   *  another. */
  const optionsRef = useRef<StoredSettings>(INITIAL_OPTIONS);
  const isRunningRef = useRef(false);
  /** Read inside the pool loop so a stop takes effect between images. */
  const isPausedRef = useRef(false);
  const inFlightRef = useRef<Set<string>>(new Set());
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  /** Bumped whenever queued work becomes stale, so late results get dropped. */
  const runIdRef = useRef(0);
  /** Drag events bubble from children, so track depth instead of a boolean. */
  const dragDepthRef = useRef(0);
  const windowDragDepthRef = useRef(0);
  /** Progress ticks land here and are flushed to state once per frame. */
  const progressBufferRef = useRef<Record<string, number>>({});
  const progressFrameRef = useRef<number | null>(null);
  const queueRef = useRef<HTMLElement | null>(null);
  /** Set when files are accepted, consumed once the queue has rendered. */
  const shouldScrollRef = useRef(false);
  /** The engine-loading notice only ever needs to say its piece once. */
  const audioEngineNoticeShownRef = useRef(false);

  /** Which panels the settings shell shows. An empty queue defaults to the
   *  image panel (§6.2) rather than showing nothing. */
  const presentKinds = useMemo<MediaKind[]>(
    () =>
      items.length === 0
        ? ["image"]
        : [...new Set(items.map((item) => item.kind))],
    [items]
  );

  /** The photo the LUT preview is judged on: the first image in the queue.
   *  Picking one rather than offering a choice keeps the preview a single
   *  decision — the LUT applies to the whole batch either way, so a second
   *  control for "which one am I looking at" would only be a way to hesitate. */
  const sampleImage = useMemo(
    () => items.find((item) => item.kind === "image")?.file,
    [items]
  );

  const isDirty = useMemo(
    () =>
      presentKinds.some((kind) => {
        const engine = getEngine(kind);
        const draft = draftOptions[kind];
        const applied = appliedOptions[kind];

        return !!engine && !!draft && !!applied && !engine.isSame(draft, applied);
      }),
    [presentKinds, draftOptions, appliedOptions]
  );

  useEffect(() => {
    draftOptionsRef.current = draftOptions;
  }, [draftOptions]);

  const updateItems = useCallback((next: QueueItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const updateResults = useCallback((updater: (prev: ResultMap) => ResultMap) => {
    const next = updater(resultsRef.current);
    resultsRef.current = next;
    setResults(next);
  }, []);

  const syncProcessing = useCallback(() => {
    setProcessing(new Set(inFlightRef.current));
  }, []);

  /**
   * `browser-image-compression` reports progress far faster than a display can
   * show it, and eight workers do it at once. Committing each tick straight to
   * state re-rendered the whole queue hundreds of times a second; buffering into
   * a ref and flushing on a frame caps that at the refresh rate.
   */
  const flushProgress = useCallback(() => {
    progressFrameRef.current = null;

    const buffered = progressBufferRef.current;
    progressBufferRef.current = {};

    setProgress((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const [id, value] of Object.entries(buffered)) {
        if (next[id] === value) continue;
        next[id] = value;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, []);

  const reportProgress = useCallback(
    (id: string, value: number) => {
      progressBufferRef.current[id] = Math.round(value);

      if (progressFrameRef.current !== null) return;
      progressFrameRef.current = requestAnimationFrame(flushProgress);
    },
    [flushProgress]
  );

  /** A buffered tick for a file that is gone would resurrect its progress. */
  const forgetProgress = useCallback((id: string) => {
    delete progressBufferRef.current[id];

    setProgress((prev) => {
      if (!(id in prev)) return prev;

      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const clearProgress = useCallback(() => {
    progressBufferRef.current = {};
    setProgress({});
  }, []);

  const forgetStage = useCallback((id: string) => {
    setStage((prev) => {
      if (!(id in prev)) return prev;

      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const clearStage = useCallback(() => setStage({}), []);

  const cancelAll = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    runIdRef.current += 1;
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
  }, []);

  /**
   * "Pending" has to mean *the pool can do it*, not merely "has no result yet".
   * `runQueue` re-runs while this is true, so an item nothing can claim — a kind
   * with no registered engine — would spin that loop forever.
   */
  const isClaimable = useCallback(
    (item: QueueItem) =>
      resultsRef.current[item.id] === undefined &&
      !inFlightRef.current.has(item.id) &&
      !!getEngine(item.kind),
    []
  );

  const hasPending = useCallback(
    () => itemsRef.current.some(isClaimable),
    [isClaimable]
  );

  /**
   * Counted from the queue rather than kept in its own ref: a second source of
   * truth for what is running is a second thing that can drift out of sync, and
   * a hundred rows is nothing to walk.
   */
  const inFlightOfKind = useCallback(
    (kind: MediaKind) =>
      itemsRef.current.filter(
        (item) => item.kind === kind && inFlightRef.current.has(item.id)
      ).length,
    []
  );

  /**
   * One worker of the pool: keeps claiming the next queued file until nothing
   * is left, reading files and options from refs so appending files or applying
   * new settings mid-run is picked up instead of racing with it.
   *
   * A worker that can claim nothing returns rather than spinning. That is safe
   * because the only reason to be blocked is another worker holding this kind's
   * last slot — and that worker's own loop picks the rest up as it finishes.
   */
  const drain = useCallback(async () => {
    while (true) {
      // Checked here, not only on abort: aborting a single file would
      // otherwise just hand the worker the next one in the queue.
      if (isPausedRef.current) return;

      const next = itemsRef.current.find((item) => {
        if (!isClaimable(item)) return false;

        // Eight images at once is fine; eight videos is eight WASM heaps.
        const engine = getEngine(item.kind);
        return !!engine && inFlightOfKind(item.kind) < engine.concurrency;
      });

      if (!next) return;

      const engine = getEngine(next.kind);
      if (!engine) return;

      const runId = runIdRef.current;
      const baseOptions = optionsRef.current[next.kind] ?? engine.defaults;
      const options = next.sizeOverride
        ? { ...baseOptions, maxDimension: next.sizeOverride }
        : baseOptions;
      const controller = new AbortController();

      inFlightRef.current.add(next.id);
      controllersRef.current.set(next.id, controller);
      syncProcessing();

      // First audio job of the session pays for a ~30 MB WASM download — said
      // once, in the same warning surface a rejection would use.
      if (next.kind === "audio" && !audioEngineNoticeShownRef.current) {
        audioEngineNoticeShownRef.current = true;
        setNotice(
          "Preparing the media engine — a one-time ~30 MB download that stays on your device."
        );
      }

      let result: ProcessResult = null;
      let failure = "";

      try {
        result = await engine.run(next.file, options, {
          signal: controller.signal,
          onProgress: (value) => reportProgress(next.id, value),
          onStage: (value) =>
            setStage((prev) =>
              prev[next.id] === value ? prev : { ...prev, [next.id]: value }
            ),
        });

        // The engine has no notion of "extra sizes" — it only sees a
        // `maxDimension` — so the rename that keeps fanned rows from
        // colliding happens here. Skipped when the encode was a no-op: that
        // file is the untouched original, and a size suffix on it would claim
        // a resize that never happened.
        if (result && next.sizeOverride && !result.unchanged) {
          result = {
            ...result,
            file: new File(
              [result.file],
              suffixFilename(result.file.name, `${next.sizeOverride}px`),
              { type: result.file.type, lastModified: result.file.lastModified }
            ),
          };
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          failure = engine.describeError(error);
          console.error(`Error processing file ${next.file.name}:`, error);
        }
      } finally {
        inFlightRef.current.delete(next.id);
        controllersRef.current.delete(next.id);
        syncProcessing();
      }

      const stillQueued = itemsRef.current.some((item) => item.id === next.id);

      // Cancelled, settings re-applied, or the file was removed while running.
      if (controller.signal.aborted || runId !== runIdRef.current || !stillQueued) {
        continue;
      }

      if (!result) {
        setErrors((prev) => ({
          ...prev,
          [next.id]: failure || "Compression failed for an unknown reason.",
        }));
      }

      updateResults((prev) => ({ ...prev, [next.id]: result }));
    }
  }, [
    inFlightOfKind,
    isClaimable,
    reportProgress,
    syncProcessing,
    updateResults,
  ]);

  const runQueue = useCallback(async () => {
    if (isRunningRef.current) return;

    isRunningRef.current = true;
    setIsProcessing(true);

    try {
      // Re-check after the pool drains: files added while it was winding down
      // saw the lock held and returned early, so nobody else would pick them up.
      do {
        await Promise.all(Array.from({ length: getConcurrency() }, () => drain()));
      } while (hasPending() && !isPausedRef.current);
    } finally {
      inFlightRef.current.clear();
      syncProcessing();
      isRunningRef.current = false;
      setIsProcessing(false);
    }
  }, [drain, hasPending, syncProcessing]);

  useEffect(() => {
    if (items.length > 0 && !isPaused) {
      void runQueue();
    }
  }, [items, appliedOptions, isPaused, runQueue]);

  useEffect(
    () => () => {
      cancelAll();
      if (progressFrameRef.current !== null) {
        cancelAnimationFrame(progressFrameRef.current);
      }
    },
    [cancelAll]
  );

  /** Settings survive a reload — a returning user should not re-pick them.
   *  localStorage cannot be read while prerendering, so a lazy useState
   *  initialiser would hydrate against different markup; the mount effect is
   *  the only point where the stored value is safely available. */
  useEffect(() => {
    const stored = loadSettings();
    if (!stored) return;

    optionsRef.current = { ...optionsRef.current, ...stored };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftOptions((prev) => ({ ...prev, ...stored }));
    setAppliedOptions((prev) => ({ ...prev, ...stored }));
  }, []);

  /** Warns before a job in flight is lost to a closed tab — cheap, and worth
   *  having now that a job can meaningfully outlast an image compress. */
  useEffect(() => {
    if (!isProcessing) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isProcessing]);

  /**
   * A `.cube` dropped with the photos is a setting, not a file to compress, so
   * it never reaches the queue. Committing it goes through the same rule every
   * other setting follows (`changeOptions`): with an empty queue the draft *is*
   * the applied value, which is what makes "twenty photos and a LUT, dropped
   * together" grade on the first pass instead of needing a second click.
   *
   * Awaited before the photos are queued for exactly that reason — the queue
   * has to still be empty when the commit happens.
   */
  const loadDroppedCube = useCallback(async (file: File) => {
    const current =
      (draftOptionsRef.current.image as ImageOptions | undefined) ??
      DEFAULT_IMAGE_OPTIONS;

    try {
      const parsed = await readCubeFile(file);

      if (current.lut) forgetLut(current.lut.id);

      const next: ImageOptions = {
        ...current,
        lut: registerLut(parsed, current.lut?.intensity ?? 1, current.lut?.brightness ?? 1),
      };

      draftOptionsRef.current = { ...draftOptionsRef.current, image: next };
      setDraftOptions((prev) => ({ ...prev, image: next }));

      if (itemsRef.current.length === 0) {
        optionsRef.current = { ...optionsRef.current, image: next };
        setAppliedOptions((prev) => ({ ...prev, image: next }));
        saveSettings(optionsRef.current);
      }

      return "";
    } catch (cause) {
      return cause instanceof CubeParseError
        ? `${file.name} was not loaded — ${cause.message
            .charAt(0)
            .toLowerCase()}${cause.message.slice(1)}`
        : `${file.name} could not be read as a .cube LUT.`;
    }
  }, []);

  const addFiles = useCallback(
    async (incoming: File[]) => {
      // Last one wins, the same rule the settings panel follows when a LUT is
      // replaced: dropping two cubes means you meant the second.
      const cubes = incoming.filter(isCubeFile);
      const cubeNotice =
        cubes.length > 0 ? await loadDroppedCube(cubes[cubes.length - 1]) : "";

      const media = incoming.filter((file) => !isCubeFile(file));

      const { accepted, rejected } = filterFiles(
        media,
        itemsRef.current.length
      );

      setNotice(
        cubeNotice || (rejected.length > 0 ? describeRejections(rejected) : "")
      );

      if (accepted.length === 0) return;

      // Adding work is an instruction to run it, so a stopped queue restarts.
      isPausedRef.current = false;
      setIsPaused(false);

      // Extra sizes fan out into sibling rows at drop time, using whatever is
      // currently applied — not the draft — so this matches every other
      // setting a fresh drop picks up. The list is fixed for this batch: a
      // later change to "Additional sizes" governs the next batch, not rows
      // already queued (see `ImageOptions.extraSizes`).
      const queued: QueueItem[] = [];
      for (const { file, kind } of accepted) {
        queued.push({ id: createId(), file, kind });

        const extraSizes =
          kind === "image"
            ? (optionsRef.current.image as ImageOptions | undefined)
                ?.extraSizes ?? []
            : [];
        for (const sizeOverride of extraSizes) {
          queued.push({ id: createId(), file, kind, sizeOverride });
        }
      }
      shouldScrollRef.current = true;
      updateItems([...itemsRef.current, ...queued]);
    },
    [loadDroppedCube, updateItems]
  );

  /**
   * The queue renders below the fold, so dropping files would otherwise leave
   * the user staring at the panel while the work happens off screen. The scroll
   * waits for the commit that mounts the section, and `behavior` is left at
   * `auto` on purpose: it defers to `scroll-behavior` in globals.css, which
   * reduced-motion already turns off.
   */
  useEffect(() => {
    if (!shouldScrollRef.current || !queueRef.current) return;

    shouldScrollRef.current = false;

    // The queue takes the drop panel's place, so a drop made on the panel is
    // already looking at it — only a pick started from the nav or footer
    // needs bringing back.
    const { top } = queueRef.current.getBoundingClientRect();
    if (top < 0 || top > window.innerHeight * 0.6) {
      queueRef.current.scrollIntoView({ block: "start" });
    }
  }, [items]);

  /**
   * Dropping an image anywhere outside the panel makes the browser navigate to
   * it, which throws away the whole queue. The window owns the drop so a near
   * miss still works, and the panel keeps only its own highlight.
   */
  useEffect(() => {
    const onDragEnter = (event: globalThis.DragEvent) => {
      if (!isFileDrag(event.dataTransfer)) return;

      event.preventDefault();
      windowDragDepthRef.current += 1;
      setIsWindowDragging(true);
    };

    const onDragOver = (event: globalThis.DragEvent) => {
      // Without this the browser refuses the drop and no drop event fires.
      if (isFileDrag(event.dataTransfer)) event.preventDefault();
    };

    const onDragLeave = (event: globalThis.DragEvent) => {
      if (!isFileDrag(event.dataTransfer)) return;

      windowDragDepthRef.current = Math.max(0, windowDragDepthRef.current - 1);
      if (windowDragDepthRef.current === 0) setIsWindowDragging(false);
    };

    const onDrop = (event: globalThis.DragEvent) => {
      const dropped = Array.from(event.dataTransfer?.files ?? []);

      // Text dragged into a number field is somebody else's drop — only files
      // are claimed here, and only then is the browser's navigation cancelled.
      if (dropped.length === 0) return;

      event.preventDefault();
      windowDragDepthRef.current = 0;
      dragDepthRef.current = 0;
      setIsWindowDragging(false);
      setIsDragging(false);

      void addFiles(dropped);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  const clearFiles = useCallback(() => {
    cancelAll();
    resume();
    updateResults(() => ({}));
    updateItems([]);
    setErrors({});
    clearProgress();
    clearStage();
    setNotice("");
  }, [cancelAll, clearProgress, clearStage, resume, updateItems, updateResults]);

  /** Stops the queue and keeps every image that already finished. */
  const stopProcessing = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    cancelAll();
  }, [cancelAll]);

  /** Commits every kind's draft at once — "Apply to all files" is one action,
   *  not one per panel. A kind with nothing queued has nothing to recompress,
   *  so committing its draft too is harmless. */
  const applySettings = useCallback(() => {
    cancelAll();
    resume();
    optionsRef.current = { ...optionsRef.current, ...draftOptions };
    setAppliedOptions(draftOptions);
    saveSettings(optionsRef.current);
    updateResults(() => ({}));
    setErrors({});
    clearProgress();
  }, [cancelAll, clearProgress, draftOptions, resume, updateResults]);

  /**
   * With no files there is nothing to recompress, so the draft *is* the applied
   * setting — otherwise changing a value before dropping anything would silently
   * compress the first batch with the previous one.
   */
  const changeOptions = useCallback((kind: MediaKind, next: MediaOptions) => {
    setDraftOptions((prev) => ({ ...prev, [kind]: next }));

    if (itemsRef.current.length === 0) {
      optionsRef.current = { ...optionsRef.current, [kind]: next };
      setAppliedOptions((prev) => ({ ...prev, [kind]: next }));
      saveSettings(optionsRef.current);
    }
  }, []);

  const resetSettings = useCallback(() => {
    for (const kind of presentKinds) {
      const engine = getEngine(kind);
      if (engine) changeOptions(kind, engine.defaults);
    }
  }, [changeOptions, presentKinds]);

  const deleteFile = useCallback(
    (id: string) => {
      controllersRef.current.get(id)?.abort();
      controllersRef.current.delete(id);

      updateItems(itemsRef.current.filter((item) => item.id !== id));
      updateResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      forgetProgress(id);
      forgetStage(id);
    },
    [forgetProgress, forgetStage, updateItems, updateResults]
  );

  /** Puts one failed image back in the queue without touching the rest. */
  const retryFile = useCallback(
    (id: string) => {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      updateResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      forgetProgress(id);
      forgetStage(id);

      isPausedRef.current = false;
      setIsPaused(false);
      void runQueue();
    },
    [forgetProgress, forgetStage, runQueue, updateResults]
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const dragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const dragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  };

  // One pass over the queue rather than three: this runs on every progress
  // flush, so it is the hot path while a batch is compressing.
  const { doneResults, pendingCount, failedCount } = useMemo(() => {
    const done: MediaOutcome[] = [];
    let pending = 0;
    let failed = 0;

    for (const item of items) {
      const result = results[item.id];

      if (result === undefined) pending += 1;
      else if (result === null) failed += 1;
      else done.push(result);
    }

    return { doneResults: done, pendingCount: pending, failedCount: failed };
  }, [items, results]);

  const isFinished = items.length > 0 && pendingCount === 0;
  const doneCount = items.length - pendingCount;

  const totals = useMemo(() => {
    const before = doneResults.reduce((acc, cur) => acc + cur.originalSize, 0);
    const after = doneResults.reduce((acc, cur) => acc + cur.file.size, 0);

    return {
      before,
      after,
      percent: before === 0 ? 0 : Math.max(0, 100 - (after / before) * 100),
    };
  }, [doneResults]);

  const handleDownload = async () => {
    if (isZipping) return;

    // One file needs no archive around it.
    if (doneResults.length === 1) {
      const [{ file }] = doneResults;
      downloadBlob(file, file.name);
      return;
    }

    const taken = new Set<string>();
    setIsZipping(true);

    try {
      // Stored, not deflated: JPEG, PNG, WebP and AVIF are already compressed,
      // so DEFLATE would buy a fraction of a percent in exchange for pulling
      // the whole batch through memory. `createStoredZip` instead hands back a
      // Blob that points at the files it was given — which is the difference
      // between a download and a crashed tab on a phone that has just spent
      // its memory budget producing them.
      const archive = await createStoredZip(
        doneResults.map(({ file }) => ({
          name: uniqueName(file.name, taken),
          blob: file,
          lastModified: file.lastModified,
        }))
      );

      downloadBlob(archive, "tinymedia.zip");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The archive could not be built."
      );
    } finally {
      setIsZipping(false);
    }
  };

  const hasItems = items.length > 0;

  return (
    <>
      {/* Full-page target. `pointer-events-none` keeps the drag reaching the
          panel underneath, which owns the more specific highlight. */}
      <AnimatePresence>
        {isWindowDragging && !isDragging && (
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none fixed inset-4 z-overlay flex items-center justify-center rounded-hero border border-dashed border-action bg-action-subtle"
          >
            <p className="font-display text-h3 font-semibold text-action">
              Drop anywhere to add
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A workspace rather than a sequence of sections: files on the left,
          settings beside them, so nothing the user needs is below the fold or
          behind a toggle. Stacks on small screens with the files first. */}
      <div className="grid-page items-start">
        <div className="col-span-full lg:col-span-8">
          {notice && (
            <div
              role="status"
              className="mb-6 flex items-start gap-3 rounded-sm bg-warning-surface px-4 py-3 text-body-sm text-warning"
            >
              <svg
                className="mt-1 h-4 w-4 shrink-0"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 1.5 15 14H1L8 1.5Zm0 4.25a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0V6.5A.75.75 0 0 0 8 5.75Zm0 5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
              </svg>
              <p className="flex-1">{notice}</p>
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss this message"
                className="-my-1 -mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill transition-opacity duration-fast ease-standard hover:opacity-70"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          )}

          {!hasItems ? (
            /* Drop panel — the one piece of artwork on the page, and the whole
               surface is the file picker (§1.1, §7.2). The real control is the
               file input stretched over the panel; the pill inside is
               decorative and takes its states from that input via `.drop-*` in
               globals.css, so the affordance is visible without adding a
               second tab stop (§12.4). The drop itself is handled on `window`
               — see the effect above. */
            <div
              onDragEnter={dragEnter}
              onDragLeave={dragLeave}
              onDragOver={(event) => event.preventDefault()}
              className="relative select-none"
            >
              <input
                id={FILE_INPUT_ID}
                aria-label="Choose files to compress"
                onChange={handleFileSelect}
                type="file"
                multiple
                className="drop-input absolute inset-0 z-sticky h-full w-full cursor-pointer opacity-0"
                /* `.cube` is not a media kind and has no engine, so it is
                   appended here rather than in the registry — the panel takes
                   it, the queue never sees it. */
                accept={`${ACCEPT_ATTRIBUTE},.cube`}
                name="file"
              />

              <div
                data-dragging={isDragging || undefined}
                className="drop-panel flex cursor-pointer flex-col overflow-hidden rounded-hero border border-line bg-surface transition-[background-color,border-color,box-shadow] duration-fast ease-standard md:min-h-(--hero-panel-min) md:flex-row-reverse"
              >
                {/* Decorative (§12.7): the panel beside it carries every word
                    that matters, so an alt would only repeat the caption to a
                    screen reader. */}
                <Image
                  pictureClassName="relative block h-40 w-full shrink-0 md:h-auto md:w-5/12"
                  sources={ARTWORK_SOURCES}
                  src="/artwork/poster-1312.webp"
                  srcSet="/artwork/poster-800.webp 800w, /artwork/poster-1312.webp 1312w, /artwork/poster-1672.webp 1672w"
                  sizes="(min-width: 768px) 40vw, 100vw"
                  alt=""
                  width={1672}
                  height={941}
                  loading="eager"
                  fetchPriority="high"
                  className="absolute inset-0 h-full w-full object-cover"
                />

                <div className="flex flex-1 flex-col justify-center p-8 md:p-12">
                  <h2 className="font-display text-h3 font-semibold text-primary">
                    {isDragging ? "Release to add them" : "Drop files here"}
                  </h2>
                  <p className="mt-4 max-w-measure-intro text-body text-secondary">
                    Images (JPG, PNG, WebP, HEIC) and audio. They start
                    compressing as soon as you add them.
                  </p>

                  {/* Not a <button>: the input above owns the click and the
                      focus ring, and two controls for one action is one too
                      many. */}
                  <span
                    aria-hidden="true"
                    className="drop-cta mt-8 inline-flex h-12 items-center justify-center self-start rounded-pill bg-action px-6 font-display text-button font-semibold text-inverse transition-[background-color,transform] duration-fast ease-standard"
                  >
                    Choose files
                  </span>

                  <p
                    data-numeric
                    className="mt-6 font-mono text-caption text-muted"
                  >
                    {limitsLine(MAX_FILES)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <motion.section
              ref={queueRef}
              aria-labelledby="queue-heading"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
              className="scroll-mt-28"
            >
              {/* Same input, same id, so "Add files" and the nav CTA keep
                  reaching one picker once the panel has made way for the
                  queue. */}
              <input
                id={FILE_INPUT_ID}
                aria-label="Add more files"
                onChange={handleFileSelect}
                type="file"
                multiple
                tabIndex={-1}
                className="u-visually-hidden"
                accept={`${ACCEPT_ATTRIBUTE},.cube`}
                name="file"
              />

              {/* The actions sit above the list, not under it: with a long
                  batch the download would otherwise be a scroll away. */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2
                  id="queue-heading"
                  className="font-display text-h3 font-semibold text-primary"
                >
                  Your files
                </h2>

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="quiet" size="sm" onClick={clearFiles}>
                    Clear all
                  </Button>

                  {/* Stopping keeps every finished file — it is not a reset
                      (§9.1). */}
                  {isProcessing ? (
                    <Button variant="secondary" size="sm" onClick={stopProcessing}>
                      Stop
                    </Button>
                  ) : isPaused && pendingCount > 0 ? (
                    <Button variant="secondary" size="sm" onClick={resume}>
                      Resume {pendingCount}
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={openFilePicker}>
                      Add files
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={handleDownload}
                    disabled={!isFinished || isZipping || doneResults.length === 0}
                  >
                    {isZipping
                      ? "Preparing…"
                      : doneResults.length === 1 && items.length === 1
                      ? "Download"
                      : (
                        <>
                          Download all
                          <span className="hidden sm:inline"> (.zip)</span>
                        </>
                      )}
                  </Button>
                </div>
              </div>

              {/* Batch progress — a rule, not a bar with a box around it. */}
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={items.length}
                aria-valuenow={doneCount}
                aria-valuetext={`${doneCount} of ${items.length} files compressed`}
                aria-label="Batch progress"
                className="mt-6 h-1 w-full overflow-hidden rounded-pill bg-line"
              >
                <motion.div
                  aria-hidden="true"
                  className="h-full rounded-pill bg-action"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(doneCount / items.length) * 100}%`,
                  }}
                  transition={{ duration: 0.32, ease: [0.2, 0.6, 0.2, 1] }}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <p
                  data-numeric
                  role="status"
                  className="font-mono text-caption text-muted"
                >
                  {pendingCount > 0
                    ? `${doneCount} of ${items.length} compressed${
                        isPaused ? " · stopped" : ""
                      }`
                    : `All ${items.length} file${
                        items.length > 1 ? "s" : ""
                      } done`}
                  {failedCount > 0 ? ` · ${failedCount} failed` : ""}
                </p>

                {doneResults.length > 0 && totals.percent > 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.32 }}
                    className="flex flex-wrap items-baseline gap-2 text-body-sm text-secondary"
                  >
                    <span data-numeric>
                      {convertSizeFileAndUnit(totals.before)} →{" "}
                      {convertSizeFileAndUnit(totals.after)}
                    </span>
                    · saved
                    <span
                      data-numeric
                      className="inline-flex font-display text-h4 font-semibold text-success"
                    >
                      <Counter
                        from={0}
                        to={Number(totals.percent.toFixed(2))}
                        duration={1}
                      />
                      %
                    </span>
                  </motion.p>
                )}
              </div>

              <ul className="mt-4 max-h-128 overflow-y-auto overflow-x-hidden rounded-md border border-line bg-bg">
                {items.map((item, index) => (
                  <ItemDropzone
                    index={index}
                    key={item.id}
                    id={item.id}
                    file={item.file}
                    kind={item.kind}
                    deleteFile={deleteFile}
                    retryFile={retryFile}
                    actualItem={results[item.id] ?? undefined}
                    hasFailed={results[item.id] === null}
                    error={errors[item.id]}
                    isProcessing={processing.has(item.id)}
                    isPaused={isPaused}
                    progress={progress[item.id]}
                    stage={stage[item.id]}
                  />
                ))}
              </ul>

              <p className="mt-4 font-mono text-caption text-muted">
                Drop more files anywhere on this page to add them.
              </p>
            </motion.section>
          )}
        </div>

        <aside className="col-span-full lg:col-span-4">
          <OutputSettings
            presentKinds={presentKinds}
            options={draftOptions}
            onChange={changeOptions}
            onApply={applySettings}
            onReset={resetSettings}
            isDirty={isDirty}
            fileCount={items.length}
            isProcessing={isProcessing}
            sampleImage={sampleImage}
          />
        </aside>
      </div>
    </>
  );
};
