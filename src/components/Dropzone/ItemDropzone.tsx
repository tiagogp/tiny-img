"use client";

import { convertSizeFileAndUnit } from "@/utils/convertSizeFileAndUnit";
import { downloadBlob } from "@/utils/downloadBlob";
import type { MediaOutcome } from "@/media/types";
import { isImageOutcome } from "@/media/image/engine";
import { isHeicFile } from "@/media/image/heic";
import { useThumbnail } from "@/hooks/useThumbnail";
import { FC, memo, useState } from "react";
import { Image } from "@/components/ui/Image";
import ComparePreview from "./ComparePreview";

interface ItemDropzoneProps {
  index: number;
  id: string;
  file: File;
  deleteFile(id: string): void;
  retryFile(id: string): void;
  actualItem?: MediaOutcome;
  isProcessing?: boolean;
  hasFailed?: boolean;
  /** Why it failed, so the row says more than "Failed". */
  error?: string;
  progress?: number;
  isPaused?: boolean;
}

/** Status is carried by a label, never by the dot colour alone (§12.1). */
const Status: FC<{ dotClass: string; label: string; toneClass?: string }> = ({
  dotClass,
  label,
  toneClass = "text-muted",
}) => (
  <p className={`flex items-center gap-2 font-mono text-caption ${toneClass}`}>
    <span aria-hidden="true" className={`h-2 w-2 rounded-pill ${dotClass}`} />
    {label}
  </p>
);

const rowButton =
  "inline-flex h-8 items-center rounded-pill border border-line px-4 text-body-sm text-secondary transition-[color,background-color,border-color] duration-fast ease-standard hover:border-line-strong hover:bg-surface hover:text-primary";

/** HEIC always leaves as something else — there is no HEIC output format —
 *  so the row can always name the real target once a result exists. */
const OUTPUT_FORMAT_LABELS: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/avif": "AVIF",
};

const ItemDropzone: FC<ItemDropzoneProps> = ({
  file,
  index,
  id,
  deleteFile,
  retryFile,
  actualItem,
  isProcessing = false,
  hasFailed = false,
  error,
  progress,
  isPaused = false,
}) => {
  const { name, size } = file;
  const [isComparing, setIsComparing] = useState(false);

  // The thumbnail always shows the source image: it is what the row is about,
  // and it exists before there is any result to show. Downscaled first — see
  // `useThumbnail` for why pointing at the original file is not an option.
  const thumbnailUrl = useThumbnail(file);

  const handleDownload = () => {
    if (!actualItem) return;

    // The page promises every file keeps its name, so no prefix is added here
    // — the engine has already corrected the extension if the format changed,
    // and the ZIP path uses the same name.
    downloadBlob(actualItem.file, actualItem.file.name);
  };

  // The dimension line and the pixel-zoom comparison only mean something for a
  // still image — time-based media gets its own surfaces (see ROADMAP §6.4/6.6).
  const image = actualItem && isImageOutcome(actualItem) ? actualItem : null;

  const wasResized =
    !!image &&
    (image.meta.width !== image.originalMeta.width ||
      image.meta.height !== image.originalMeta.height);

  const isHeicSource = isHeicFile(file);

  const savedPercent =
    actualItem && !actualItem.unchanged
      ? Math.max(0, 100 - (actualItem.file.size / actualItem.originalSize) * 100)
      : 0;

  return (
    /* `queue-row` skips layout and paint while off screen — with a hundred rows
       the ones nobody is looking at should not cost a frame. */
    <li className="queue-row flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-5 py-4 last:border-b-0 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span
          data-numeric
          aria-hidden="true"
          className="font-mono text-overline font-bold text-muted"
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Decorative: the filename beside it is the accessible name (§12.7). */}
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xs bg-surface">
          {thumbnailUrl && (
            <Image
              src={thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
        </span>

        <div className="min-w-0">
          <p className="min-w-0 truncate text-body-sm text-primary">{name}</p>
          {hasFailed && error && (
            <p className="mt-1 text-caption text-error">{error}</p>
          )}
        </div>
      </div>

      <div
        data-numeric
        className="flex items-center gap-2 font-mono text-caption"
      >
        <span
          className={
            actualItem && !actualItem.unchanged
              ? "text-muted line-through"
              : "text-secondary"
          }
        >
          {convertSizeFileAndUnit(size)}
        </span>
        {actualItem && !actualItem.unchanged && (
          <>
            <span aria-hidden="true" className="text-muted">
              →
            </span>
            <span className="text-success">
              {convertSizeFileAndUnit(actualItem.file.size)}
            </span>
            <span className="text-success">−{savedPercent.toFixed(0)}%</span>
          </>
        )}
      </div>

      {image && (
        <p data-numeric className="font-mono text-caption text-muted">
          {wasResized
            ? `${image.originalMeta.width}×${image.originalMeta.height} → ${image.meta.width}×${image.meta.height}`
            : `${image.meta.width}×${image.meta.height}`}
        </p>
      )}

      {isHeicSource && (
        <p className="font-mono text-caption text-muted">
          {image
            ? `HEIC → ${OUTPUT_FORMAT_LABELS[image.file.type] ?? "JPEG"}`
            : "HEIC"}
        </p>
      )}

      {/* `unchanged` means re-encoding produced a *bigger* file and the original
          was kept — "Already optimized" read as praise for a fallback. */}
      {actualItem?.unchanged && (
        <Status dotClass="bg-line-strong" label="Original was smaller — kept" />
      )}

      {!actualItem && hasFailed && (
        <Status dotClass="bg-error" label="Failed" toneClass="text-error" />
      )}

      {!actualItem && !hasFailed && isProcessing && (
        <Status
          dotClass="animate-pulse bg-action"
          toneClass="text-secondary"
          label={
            typeof progress === "number" && progress > 0
              ? `Compressing ${progress}%`
              : "Compressing…"
          }
        />
      )}

      {!actualItem && !hasFailed && !isProcessing && (
        <Status
          dotClass="bg-line-strong"
          label={isPaused ? "Stopped" : "Waiting"}
        />
      )}

      <div className="ml-auto flex items-center gap-2">
        {image && (
          <button
            type="button"
            onClick={() => setIsComparing(true)}
            className={rowButton}
          >
            Compare
          </button>
        )}
        {actualItem && (
          <button type="button" onClick={handleDownload} className={rowButton}>
            Download
          </button>
        )}
        {hasFailed && (
          <button
            type="button"
            onClick={() => retryFile(id)}
            className={rowButton}
          >
            Try again
          </button>
        )}
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={() => deleteFile(id)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-pill text-muted transition-colors duration-fast ease-standard hover:text-error"
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

      {image && isComparing && (
        <ComparePreview
          onClose={() => setIsComparing(false)}
          file={file}
          outcome={image}
        />
      )}
    </li>
  );
};

/**
 * The queue re-renders on every progress tick of every image in flight. Without
 * this, one worker reporting 41% re-renders all hundred rows — and each of those
 * renders re-reads a `File` and re-runs the thumbnail effect's dependency check.
 * Every prop here is either a primitive or an identity the parent keeps stable.
 */
export default memo(ItemDropzone);
