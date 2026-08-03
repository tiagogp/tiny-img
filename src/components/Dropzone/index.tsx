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
} from "../../utils/verifyFile";
import ItemDropzone from "./ItemDropzone";
import CompressionSettings, {
  CompressionOptions,
  DEFAULT_OPTIONS,
  isSameOptions,
} from "./CompressionSettings";
import JSZip from "jszip";
import { Counter } from "../Counter";
import {
  CompressionOutcome,
  compressImage,
  describeCompressionError,
} from "@/utils/compressImage";
import { convertSizeFileAndUnit } from "@/utils/convertSizeFileAndUnit";
import { downloadBlob, uniqueName } from "@/utils/downloadBlob";
import { FILE_INPUT_ID } from "@/utils/openFilePicker";
import { loadSettings, saveSettings } from "@/utils/settingsStorage";
import { Button } from "../ui/Button";

/** Cap the pool so a 16-core machine doesn't spawn 16 decoder workers at once. */
const MAX_CONCURRENCY = 8;

interface QueueItem {
  id: string;
  file: File;
}

/** `undefined` = still queued, `null` = failed. */
type ProcessResult = CompressionOutcome | null | undefined;

type ResultMap = Record<string, ProcessResult>;

let idCounter = 0;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  idCounter += 1;
  return `file-${idCounter}`;
}

function getConcurrency() {
  const cores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 0;

  return Math.max(1, Math.min(cores || 4, MAX_CONCURRENCY));
}

/** A drag only counts if it is carrying files — text selections drag too. */
function isFileDrag(transfer: DataTransfer | null) {
  return Array.from(transfer?.types ?? []).includes("Files");
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
  const [draftOptions, setDraftOptions] =
    useState<CompressionOptions>(DEFAULT_OPTIONS);
  const [appliedOptions, setAppliedOptions] =
    useState<CompressionOptions>(DEFAULT_OPTIONS);

  const itemsRef = useRef<QueueItem[]>([]);
  const resultsRef = useRef<ResultMap>({});
  const optionsRef = useRef<CompressionOptions>(DEFAULT_OPTIONS);
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

  const cancelAll = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    runIdRef.current += 1;
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
  }, []);

  const hasPending = useCallback(
    () =>
      itemsRef.current.some(
        (item) =>
          resultsRef.current[item.id] === undefined &&
          !inFlightRef.current.has(item.id)
      ),
    []
  );

  /**
   * One worker of the pool: keeps claiming the next queued image until nothing
   * is left, reading files and options from refs so appending files or applying
   * new settings mid-run is picked up instead of racing with it.
   */
  const drain = useCallback(async () => {
    while (true) {
      // Checked here, not only on abort: aborting a single image would
      // otherwise just hand the worker the next one in the queue.
      if (isPausedRef.current) return;

      const next = itemsRef.current.find(
        (item) =>
          resultsRef.current[item.id] === undefined &&
          !inFlightRef.current.has(item.id)
      );

      if (!next) return;

      const runId = runIdRef.current;
      const options = optionsRef.current;
      const controller = new AbortController();

      inFlightRef.current.add(next.id);
      controllersRef.current.set(next.id, controller);
      syncProcessing();

      let result: ProcessResult = null;
      let failure = "";

      try {
        result = await compressImage(next.file, options, {
          signal: controller.signal,
          onProgress: (value) => reportProgress(next.id, value),
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          failure = describeCompressionError(error);
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
  }, [reportProgress, syncProcessing, updateResults]);

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

    optionsRef.current = stored;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftOptions(stored);
    setAppliedOptions(stored);
  }, []);

  const addFiles = useCallback(
    (incoming: File[]) => {
      const { accepted, rejected } = filterFiles(
        incoming,
        itemsRef.current.length
      );

      setNotice(rejected.length > 0 ? describeRejections(rejected) : "");

      if (accepted.length === 0) return;

      // Adding work is an instruction to run it, so a stopped queue restarts.
      isPausedRef.current = false;
      setIsPaused(false);

      const queued = accepted.map((file) => ({ id: createId(), file }));
      updateItems([...itemsRef.current, ...queued]);
    },
    [updateItems]
  );

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

      addFiles(dropped);
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
    setNotice("");
  }, [cancelAll, clearProgress, resume, updateItems, updateResults]);

  /** Stops the queue and keeps every image that already finished. */
  const stopProcessing = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    cancelAll();
  }, [cancelAll]);

  const applySettings = useCallback(() => {
    cancelAll();
    resume();
    optionsRef.current = draftOptions;
    setAppliedOptions(draftOptions);
    saveSettings(draftOptions);
    updateResults(() => ({}));
    setErrors({});
    clearProgress();
  }, [cancelAll, clearProgress, draftOptions, resume, updateResults]);

  /**
   * With no files there is nothing to recompress, so the draft *is* the applied
   * setting — otherwise changing a value before dropping anything would silently
   * compress the first batch with the previous one.
   */
  const changeOptions = useCallback((next: CompressionOptions) => {
    setDraftOptions(next);

    if (itemsRef.current.length === 0) {
      optionsRef.current = next;
      setAppliedOptions(next);
      saveSettings(next);
    }
  }, []);

  const resetSettings = useCallback(() => {
    changeOptions(DEFAULT_OPTIONS);
  }, [changeOptions]);

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
    },
    [forgetProgress, updateItems, updateResults]
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

      isPausedRef.current = false;
      setIsPaused(false);
      void runQueue();
    },
    [forgetProgress, runQueue, updateResults]
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
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
    const done: CompressionOutcome[] = [];
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
    const zip = new JSZip();
    const taken = new Set<string>();

    doneResults.forEach(({ file }) => {
      zip.file(uniqueName(file.name, taken), file);
    });

    // JPEG, PNG and WebP are already compressed — DEFLATE buys a fraction of a
    // percent while holding a second copy of the whole batch in memory to do it.
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "STORE",
    });
    downloadBlob(zipBlob, "tinyimg.zip");
  };

  return (
    <>
      {/* Drop panel — the one piece of artwork on the page, and the whole
          surface is the file picker (§1.1, §7.2). The real control is the file
          input stretched over the panel; the pill inside is decorative and
          takes its states from that input via `.drop-*` in globals.css, so the
          affordance is visible without adding a second tab stop (§12.4).
          The drop itself is handled on `window` — see the effect above. */}
      <div
        onDragEnter={dragEnter}
        onDragLeave={dragLeave}
        onDragOver={(event) => event.preventDefault()}
        className="relative select-none"
      >
        <input
          id={FILE_INPUT_ID}
          aria-label="Choose images to compress"
          onChange={handleFileSelect}
          type="file"
          multiple
          className="drop-input absolute inset-0 z-sticky h-full w-full cursor-pointer opacity-0"
          accept={ACCEPT_ATTRIBUTE}
          name="file"
        />

        <div
          data-dragging={isDragging || undefined}
          className="drop-panel flex cursor-pointer flex-col overflow-hidden rounded-hero border border-line bg-surface transition-[background-color,border-color,box-shadow] duration-fast ease-standard md:min-h-(--hero-panel-min) md:flex-row-reverse"
        >
          {/* Decorative (§12.7): the panel beside it carries every word that
              matters, so an alt would only repeat the caption to a screen
              reader. Pre-encoded rather than run through next/image — `sharp`
              is not installed, and a compression tool shipping a 2.5 MB PNG
              would be a poor advertisement (source: assets/poster.png). */}
          <picture className="relative block h-48 w-full shrink-0 md:h-auto md:w-1/2">
            <source
              type="image/avif"
              srcSet="/artwork/poster-800.avif 800w, /artwork/poster-1312.avif 1312w, /artwork/poster-1672.avif 1672w"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
            <img
              src="/artwork/poster-1312.webp"
              srcSet="/artwork/poster-800.webp 800w, /artwork/poster-1312.webp 1312w, /artwork/poster-1672.webp 1672w"
              sizes="(min-width: 768px) 50vw, 100vw"
              alt=""
              width={1672}
              height={941}
              loading="eager"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>

          <div className="flex flex-1 flex-col justify-end p-8 md:p-12">
            <p className="font-mono text-eyebrow uppercase text-muted">
              Step 01
            </p>
            <h2 className="mt-3 font-display text-h3 font-semibold text-primary">
              {isDragging ? "Release to add them" : "Drop your images here"}
            </h2>
            <p className="mt-5 max-w-measure-intro text-body text-secondary">
              WebP, PNG and JPEG, read straight from disk. Drag them anywhere on
              this page, or use the button to browse.
            </p>

            {/* Not a <button>: the input above owns the click and the focus
                ring, and two controls for one action is one too many. */}
            <span
              aria-hidden="true"
              className="drop-cta mt-8 inline-flex h-12 items-center justify-center self-start rounded-pill bg-action px-6 font-display text-button font-semibold text-inverse transition-[background-color,transform] duration-fast ease-standard"
            >
              Browse files
            </span>

            <p data-numeric className="mt-6 font-mono text-caption text-muted">
              Up to {MAX_FILES} images · 100 MB each
            </p>
          </div>
        </div>
      </div>

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

      {notice && (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-sm bg-warning-surface px-4 py-3 text-body-sm text-warning"
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

      <CompressionSettings
        options={draftOptions}
        onChange={changeOptions}
        onApply={applySettings}
        onReset={resetSettings}
        isDirty={!isSameOptions(draftOptions, appliedOptions)}
        fileCount={items.length}
        isProcessing={isProcessing}
      />

      {items.length > 0 && (
        <motion.section
          aria-labelledby="queue-heading"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16"
        >
          {/* Step 03 is the download, so it carries the same heading rhythm as
              the two steps above it — the queue was previously an unlabelled
              block and the final action had no step at all. */}
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="font-mono text-eyebrow uppercase text-muted">
                Step 03
              </p>
              <h2
                id="queue-heading"
                className="mt-3 font-display text-h3 font-semibold text-primary"
              >
                Download your images
              </h2>
            </div>
            <p
              data-numeric
              role="status"
              className="font-mono text-caption text-muted"
            >
              {pendingCount > 0
                ? `${doneCount} of ${items.length} compressed${
                    isPaused ? " · stopped" : ""
                  }`
                : `All ${items.length} image${
                    items.length > 1 ? "s" : ""
                  } compressed`}
              {failedCount > 0 ? ` · ${failedCount} failed` : ""}
            </p>
          </div>

          {/* Batch progress — a rule, not a bar with a box around it. */}
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={doneCount}
            aria-valuetext={`${doneCount} of ${items.length} images compressed`}
            aria-label="Batch progress"
            className="mt-8 h-1 w-full overflow-hidden rounded-pill bg-line"
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

          <ul className="mt-6 overflow-hidden rounded-md border border-line bg-bg">
            {items.map((item, index) => (
              <ItemDropzone
                index={index}
                key={item.id}
                id={item.id}
                file={item.file}
                deleteFile={deleteFile}
                retryFile={retryFile}
                actualItem={results[item.id] ?? undefined}
                hasFailed={results[item.id] === null}
                error={errors[item.id]}
                isProcessing={processing.has(item.id)}
                isPaused={isPaused}
                progress={progress[item.id]}
              />
            ))}
          </ul>

          {doneResults.length > 0 && totals.percent > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.32 }}
              className="mt-6 flex flex-wrap items-baseline gap-2 text-body text-secondary"
            >
              <span data-numeric>
                {convertSizeFileAndUnit(totals.before)} →{" "}
                {convertSizeFileAndUnit(totals.after)}
              </span>
              — TinyImg saved
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

          <div className="mt-8 flex flex-wrap gap-4">
            <Button onClick={handleDownload} disabled={doneResults.length === 0}>
              {isFinished
                ? "Download all"
                : `Download ${doneResults.length} ready`}
            </Button>

            {/* Stopping keeps every finished image — it is not a reset (§9.1). */}
            {isProcessing && (
              <Button variant="secondary" onClick={stopProcessing}>
                Stop
              </Button>
            )}
            {!isProcessing && isPaused && pendingCount > 0 && (
              <Button variant="secondary" onClick={resume}>
                Resume {pendingCount} remaining
              </Button>
            )}

            <Button variant="quiet" onClick={clearFiles}>
              Clear all
            </Button>
          </div>
        </motion.section>
      )}
    </>
  );
};
