"use client";

import { FC, useEffect, useRef, useState } from "react";
import type { CompressionOutcome } from "@/utils/compressImage";
import { convertSizeFileAndUnit } from "@/utils/convertSizeFileAndUnit";
import { useObjectUrl } from "@/hooks/useObjectUrl";

interface ComparePreviewProps {
  /** Fires from the dialog's native `close` event — see the effect below. */
  onClose(): void;
  file: File;
  outcome: CompressionOutcome;
}

const Metric: FC<{ label: string; value: string; toneClass?: string }> = ({
  label,
  value,
  toneClass = "text-primary",
}) => (
  <div>
    <p className="font-mono text-caption uppercase text-muted">{label}</p>
    <p data-numeric className={`mt-1 text-body-sm ${toneClass}`}>
      {value}
    </p>
  </div>
);

/**
 * Before/after comparison (§9.13). A compression tool that never shows the
 * result is asking for blind trust in a quality number — this is the only
 * place the user can actually check what 80% did to their photo.
 *
 * The divider is a real `<input type="range">` laid over the images: dragging,
 * arrow keys, Home and End all come for free, and it is the one control here
 * so it never competes with anything for focus.
 *
 * The component is mounted only while comparing, so nothing here allocates for
 * the other ninety-nine rows. Every close path goes through `dialog.close()`
 * rather than the parent's state, which is what makes the browser hand focus
 * back to the button that opened it (§9.13).
 */
const ComparePreview: FC<ComparePreviewProps> = ({
  onClose,
  file,
  outcome,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [position, setPosition] = useState(50);

  const originalUrl = useObjectUrl(file);
  const compressedUrl = useObjectUrl(outcome.file);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const close = () => dialogRef.current?.close();

  const saved = outcome.unchanged
    ? 0
    : Math.max(0, 100 - (outcome.file.size / outcome.originalSize) * 100);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Native `<dialog>` puts the click target on the element itself when the
      // backdrop is clicked, so the padding-free wrapper below is the content.
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
      aria-labelledby="compare-title"
      className="compare-dialog m-auto w-[min(880px,calc(100vw-var(--space-8)))] rounded-md bg-raised p-0 text-primary shadow-overlay backdrop:bg-overlay"
    >
      <div className="p-6 md:p-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-eyebrow uppercase text-muted">
              Before and after
            </p>
            <h2
              id="compare-title"
              className="mt-2 truncate font-display text-h4 font-semibold"
            >
              {file.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close comparison"
            className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-muted transition-colors duration-fast ease-standard hover:bg-surface hover:text-primary"
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
        </div>

        <div
          className="relative mt-8 select-none overflow-hidden rounded-sm bg-surface"
          style={{
            aspectRatio: `${outcome.originalWidth} / ${outcome.originalHeight}`,
            maxHeight: "60vh",
          }}
        >
          {originalUrl && (
            /* eslint-disable-next-line @next/next/no-img-element --
               blob: URLs (see ItemDropzone) — nothing to optimize server-side. */
            <img
              src={originalUrl}
              alt={`${file.name}, original`}
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          )}

          {compressedUrl && (
            /* eslint-disable-next-line @next/next/no-img-element -- as above. */
            <img
              src={compressedUrl}
              alt={`${file.name}, compressed`}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ clipPath: `inset(0 0 0 ${position}%)` }}
              draggable={false}
            />
          )}

          {/* Divider and labels are decorative — the range below is the control. */}
          <div
            aria-hidden="true"
            className="compare-divider pointer-events-none absolute inset-y-0 w-0.5 bg-bg"
            style={{ left: `${position}%` }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 rounded-pill bg-ink px-3 py-1 font-mono text-caption uppercase text-inverse"
          >
            Original
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-3 rounded-pill bg-ink px-3 py-1 font-mono text-caption uppercase text-inverse"
          >
            Compressed
          </span>

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            aria-label="Reveal the compressed image"
            aria-valuetext={`Compressed image revealed from ${position}%`}
            className="compare-range absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent"
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-x-12 gap-y-6">
          <Metric label="Before" value={convertSizeFileAndUnit(outcome.originalSize)} />
          <Metric
            label="After"
            value={convertSizeFileAndUnit(outcome.file.size)}
            toneClass={outcome.unchanged ? "text-primary" : "text-success"}
          />
          <Metric
            label="Saved"
            value={outcome.unchanged ? "Original kept" : `${saved.toFixed(1)}%`}
            toneClass={outcome.unchanged ? "text-muted" : "text-success"}
          />
          <Metric
            label="Dimensions"
            value={
              outcome.width !== outcome.originalWidth ||
              outcome.height !== outcome.originalHeight
                ? `${outcome.originalWidth}×${outcome.originalHeight} → ${outcome.width}×${outcome.height}`
                : `${outcome.width}×${outcome.height}`
            }
          />
        </div>
      </div>
    </dialog>
  );
};

export default ComparePreview;
