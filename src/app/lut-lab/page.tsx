"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import LutPreview from "@/components/Dropzone/LutPreview";
import { Button } from "@/components/ui/Button";
import {
  CubeParseError,
  describeCubeLut,
  isCubeFile,
  readCubeFile,
  type CubeLut,
} from "@/media/image/lut/cube";
import { isFileDrag } from "@/utils/verifyFile";
import { convertSizeFileAndUnit } from "@/utils/convertSizeFileAndUnit";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { Image } from "@/components/ui/Image";

/**
 * A bench for the LUT core, deliberately outside the compression pipeline.
 *
 * Nothing here imports the queue: the point is to exercise the parser, both
 * renderer backends and the confirmation dialog against real files before any
 * of it touches the path that produces the user's actual output. Delete this
 * route once the LUT is wired into `ImageOptions` — and the nav entry with it.
 *
 * The drop panel is the same construction as the real one (§9.5): a
 * transparent file input stretched over the visible panel, which is what keeps
 * one control, one tab stop and one focus ring for an area that has to look
 * like a target. What is different is that this panel takes two *kinds* of
 * file and sorts them itself, so a photo and a `.cube` can arrive in the same
 * drop, in either order.
 */

/** Anything `createImageBitmap` can be expected to decode unaided. HEIC is out:
 *  it needs the libheif path, which belongs to the pipeline, not to the bench. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const ACCEPT = [...IMAGE_TYPES, ".cube"].join(",");

const INPUT_ID = "lut-lab-input";

interface Sorted {
  photo?: File;
  cube?: File;
  skipped: string[];
}

/** Last one wins per slot: dropping two photos means you meant the second. */
function sortDropped(files: File[]): Sorted {
  const sorted: Sorted = { skipped: [] };

  for (const file of files) {
    if (isCubeFile(file)) sorted.cube = file;
    else if (IMAGE_TYPES.includes(file.type)) sorted.photo = file;
    else sorted.skipped.push(file.name);
  }

  return sorted;
}

const slotShell =
  "flex min-w-0 flex-1 items-start gap-4 rounded-sm border border-line bg-surface p-5";

const Slot: React.FC<{
  label: string;
  filled: boolean;
  title: string;
  detail: string;
  onClear?: () => void;
  children?: React.ReactNode;
}> = ({ label, filled, title, detail, onClear, children }) => (
  <div className={slotShell} data-filled={filled || undefined}>
    {children}
    <div className="min-w-0 flex-1">
      <p className="font-mono text-caption uppercase text-muted">{label}</p>
      <p
        className={`mt-1 truncate text-body-sm ${
          filled ? "text-primary" : "text-muted"
        }`}
      >
        {title}
      </p>
      <p data-numeric className="mt-1 truncate font-mono text-caption text-muted">
        {detail}
      </p>
    </div>
    {filled && onClear && (
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove the ${label.toLowerCase()}`}
        className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-muted transition-colors duration-fast ease-standard hover:bg-bg hover:text-primary"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    )}
  </div>
);

export default function LutLab() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [lut, setLut] = useState<CubeLut | null>(null);
  const [lutFile, setLutFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [applied, setApplied] = useState<number | null>(null);
  const [brightness, setBrightness] = useState(1);
  const [isOpen, setIsOpen] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  /** `dragenter`/`dragleave` fire for every child element a drag crosses, so
   *  the state has to count depth rather than flip on each event. */
  const dragDepthRef = useRef(0);
  const windowDragDepthRef = useRef(0);

  const thumbnailUrl = useObjectUrl(photo ?? undefined);

  const accept = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const { photo: droppedPhoto, cube, skipped } = sortDropped(files);

    setNotice(
      skipped.length > 0
        ? `Ignored ${skipped.join(", ")} — this bench takes a JPEG, PNG, WebP or AVIF photo and a .cube file.`
        : ""
    );

    if (droppedPhoto) setPhoto(droppedPhoto);

    if (!cube) return;

    setError(null);

    try {
      setLut(await readCubeFile(cube));
      setLutFile(cube);
    } catch (cause) {
      setLut(null);
      setLutFile(null);
      setError(
        cause instanceof CubeParseError
          ? cause.message
          : "This .cube file could not be read."
      );
    }
  }, []);

  /**
   * Dropping a file anywhere outside the panel makes the browser navigate to
   * it, which throws the page away. The window owns the drop so a near miss
   * still works, and the panel keeps only its own highlight — the same
   * arrangement as the real queue.
   */
  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event.dataTransfer)) return;

      event.preventDefault();
      windowDragDepthRef.current += 1;
      setIsWindowDragging(true);
    };

    const onDragOver = (event: DragEvent) => {
      // Without this the browser refuses the drop and no drop event fires.
      if (isFileDrag(event.dataTransfer)) event.preventDefault();
    };

    const onDragLeave = (event: DragEvent) => {
      if (!isFileDrag(event.dataTransfer)) return;

      windowDragDepthRef.current = Math.max(0, windowDragDepthRef.current - 1);
      if (windowDragDepthRef.current === 0) setIsWindowDragging(false);
    };

    const onDrop = (event: DragEvent) => {
      const dropped = Array.from(event.dataTransfer?.files ?? []);
      if (dropped.length === 0) return;

      event.preventDefault();
      windowDragDepthRef.current = 0;
      dragDepthRef.current = 0;
      setIsWindowDragging(false);
      setIsDragging(false);

      void accept(dropped);
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
  }, [accept]);

  const isReady = photo !== null && lut !== null;

  return (
    <main id="main" className="section">
      <div className="container-page">
        <p className="font-mono text-eyebrow uppercase text-muted">
          Internal bench
        </p>
        <h1 className="mt-3 font-display text-h2 font-bold text-primary">
          LUT core
        </h1>
        <p className="mt-6 max-w-measure text-body text-secondary">
          Parser, WebGL2 and CPU renderers, and the confirmation dialog — not
          connected to compression. Applying a LUT here changes nothing and
          produces no file.
        </p>

        {/* Drop panel. The input is the control; the panel is what it looks
            like. See the note at the top of this file. */}
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            dragDepthRef.current += 1;
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (dragDepthRef.current === 0) setIsDragging(false);
          }}
          onDragOver={(event) => event.preventDefault()}
          className="relative mt-12 select-none"
        >
          <input
            id={INPUT_ID}
            type="file"
            multiple
            accept={ACCEPT}
            aria-label="Choose a photo and a .cube LUT"
            onChange={(event) => {
              void accept(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
            className="drop-input absolute inset-0 z-sticky h-full w-full cursor-pointer opacity-0"
          />

          <div
            data-dragging={isDragging || undefined}
            className="drop-panel flex cursor-pointer flex-col items-start rounded-hero border border-line bg-surface p-8 transition-[background-color,border-color,box-shadow] duration-fast ease-standard md:p-12"
          >
            <p className="font-mono text-eyebrow uppercase text-muted">
              Photo + LUT
            </p>
            <h2 className="mt-3 font-display text-h3 font-semibold text-primary">
              {isDragging ? "Release to load them" : "Drop a photo and a .cube"}
            </h2>
            <p className="mt-5 max-w-measure-intro text-body text-secondary">
              Both at once or one at a time, in any order — they are sorted by
              what they are, not by where they land. Drag them anywhere on this
              page, or use the button to browse.
            </p>

            {/* Not a <button>: the input above owns the click and the focus
                ring, and two controls for one action is one too many. */}
            <span
              aria-hidden="true"
              className="drop-cta mt-8 inline-flex h-12 items-center justify-center rounded-pill bg-action px-6 font-display text-button font-semibold text-inverse transition-[background-color,transform] duration-fast ease-standard"
            >
              Browse files
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 md:flex-row">
          <Slot
            label="Photo"
            filled={photo !== null}
            title={photo ? photo.name : "Nothing loaded"}
            detail={
              photo
                ? convertSizeFileAndUnit(photo.size)
                : "JPEG, PNG, WebP or AVIF"
            }
            onClear={() => setPhoto(null)}
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xs bg-bg">
              {thumbnailUrl && (
                <Image
                  src={thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </Slot>

          <Slot
            label="LUT"
            filled={lut !== null}
            title={lut ? lut.title : "Nothing loaded"}
            detail={
              lut && lutFile
                ? `${describeCubeLut(lut)} · ${lutFile.name}`
                : "An Adobe .cube file, 1D or 3D"
            }
            onClear={() => {
              setLut(null);
              setLutFile(null);
              setError(null);
            }}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 max-w-measure rounded-sm bg-error-surface px-4 py-3 text-body-sm text-error"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="mt-6 max-w-measure rounded-sm bg-warning-surface px-4 py-3 text-body-sm text-warning"
          >
            {notice}
          </p>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Button disabled={!isReady} onClick={() => setIsOpen(true)}>
            Preview
          </Button>
          {applied !== null && (
            <p role="status" className="font-mono text-caption text-success">
              Applied at {Math.round(applied * 100)}% — and then discarded,
              because nothing downstream reads it yet.
            </p>
          )}
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
              Drop anywhere to load
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && photo && lut && (
        <LutPreview
          file={photo}
          lut={lut}
          initialIntensity={applied ?? 1}
          initialBrightness={brightness}
          onApply={(intensity, light) => {
            setApplied(intensity);
            setBrightness(light);
          }}
          onClose={() => setIsOpen(false)}
        />
      )}
    </main>
  );
}
