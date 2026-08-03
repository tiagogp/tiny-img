"use client";

import { FC, useState } from "react";
import { Button } from "../ui/Button";
import { Tag } from "../ui/Tag";

/** `""` keeps each image in its original format. */
export type OutputFormat = "" | "image/webp" | "image/jpeg" | "image/png";

export interface CompressionOptions {
  /** 0.1 - 1. Only affects lossy formats (JPEG/WebP). */
  quality: number;
  /** Largest side in px. `0` keeps the original resolution. */
  maxDimension: number;
  /** Max size per image in MB. `0` means no target size. */
  maxSizeMB: number;
  /** Re-encode every image to this format. */
  format: OutputFormat;
}

/**
 * Format and resolution are deliberately untouched by default. Downscaling a
 * 4000px photo to 1080px, or handing back a `.webp` where a `.png` went in, is
 * a decision with no undo, and a default that quietly makes one for the user is
 * the wrong kind of helpful — both are one tap away below.
 */
export const DEFAULT_OPTIONS: CompressionOptions = {
  quality: 0.8,
  maxDimension: 0,
  maxSizeMB: 0,
  format: "",
};

export const isSameOptions = (a: CompressionOptions, b: CompressionOptions) =>
  a.quality === b.quality &&
  a.maxDimension === b.maxDimension &&
  a.maxSizeMB === b.maxSizeMB &&
  a.format === b.format;

const FORMAT_PRESETS: { label: string; value: OutputFormat }[] = [
  { label: "Original", value: "" },
  { label: "WebP", value: "image/webp" },
  { label: "JPEG", value: "image/jpeg" },
  { label: "PNG", value: "image/png" },
];

const RESOLUTION_PRESETS = [
  { label: "Original", value: 0 },
  { label: "4K", value: 3840 },
  { label: "1440p", value: 1440 },
  { label: "1080p", value: 1080 },
  { label: "720p", value: 720 },
  { label: "480p", value: 480 },
];

const FORMAT_LABELS: Record<OutputFormat, string> = {
  "": "Original format",
  "image/webp": "WebP",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
};

/**
 * The one-line version of the panel. Whatever is about to happen to a dropped
 * file has to be readable without opening anything — a collapsed panel that
 * hides its own defaults is a trap.
 */
const summarise = ({
  format,
  quality,
  maxDimension,
  maxSizeMB,
}: CompressionOptions) =>
  [
    FORMAT_LABELS[format],
    format === "image/png"
      ? "lossless"
      : `${Math.round(quality * 100)}% quality`,
    maxDimension === 0 ? "original size" : `max ${maxDimension} px`,
    maxSizeMB > 0 ? `up to ${maxSizeMB} MB each` : null,
  ]
    .filter(Boolean)
    .join(" · ");

const fieldLabel = "block text-body-sm font-medium text-primary";
const helpText = "mt-3 max-w-measure text-caption font-mono text-muted";
const numberInput =
  "h-12 w-32 rounded-sm border border-line bg-surface px-4 text-body text-primary transition-[background-color,border-color] duration-fast ease-standard hover:border-line-strong focus:border-action focus:bg-bg";

interface CompressionSettingsProps {
  options: CompressionOptions;
  onChange(options: CompressionOptions): void;
  onApply(): void;
  onReset(): void;
  isDirty: boolean;
  fileCount: number;
  isProcessing: boolean;
}

const CompressionSettings: FC<CompressionSettingsProps> = ({
  options,
  onChange,
  onApply,
  onReset,
  isDirty,
  fileCount,
  isProcessing,
}) => {
  /** Collapsible in both directions — files no longer force it open. */
  const [isExpanded, setIsExpanded] = useState(false);
  const hasFiles = fileCount > 0;

  const isCustomDimension =
    options.maxDimension !== 0 &&
    !RESOLUTION_PRESETS.some((preset) => preset.value === options.maxDimension);

  const isLossless = options.format === "image/png";

  const update = (patch: Partial<CompressionOptions>) =>
    onChange({ ...options, ...patch });

  return (
    <section aria-labelledby="settings-heading" className="mt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-eyebrow uppercase text-muted">Step 02</p>
          <h2
            id="settings-heading"
            className="mt-3 font-display text-h3 font-semibold text-primary"
          >
            Compression settings
          </h2>
        </div>
        {isExpanded && (
          <Button variant="quiet" size="sm" onClick={onReset}>
            Reset to defaults
          </Button>
        )}
      </div>

      {/* One rule, the current settings, and a way in and back out (§9.7). */}
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls="settings-body"
        onClick={() => setIsExpanded((open) => !open)}
        className="mt-8 flex w-full flex-wrap items-baseline justify-between gap-4 border-t border-line pt-6 text-left transition-colors duration-fast ease-standard hover:border-ink"
      >
        <span data-numeric className="font-mono text-caption text-muted">
          {summarise(options)}
        </span>
        <span className="font-display text-button font-semibold text-secondary">
          {isExpanded ? "Hide" : "Adjust"}
        </span>
      </button>

      {/* The wrapper carries `hidden` because `.grid-page` sets `display: grid`
          and would win over the attribute's `display: none`. */}
      <div id="settings-body" hidden={!isExpanded}>
        <div className="grid-page mt-12">
          <fieldset className="col-span-full md:col-span-4 lg:col-span-6">
            <legend className={fieldLabel}>Output format</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {FORMAT_PRESETS.map((preset) => (
                <Tag
                  key={preset.label}
                  selected={options.format === preset.value}
                  onClick={() => update({ format: preset.value })}
                >
                  {preset.label}
                </Tag>
              ))}
            </div>
            <p className={helpText}>
              {options.format === "image/webp"
                ? "WebP is usually the smallest, for photos and graphics alike."
                : "Converting to WebP usually saves another 25–35%."}
            </p>
          </fieldset>

          <div className="col-span-full md:col-span-4 lg:col-span-6">
            <label
              htmlFor="quality"
              className={`${fieldLabel} flex items-baseline justify-between gap-4`}
            >
              Quality
              <span
                data-numeric
                className="font-mono text-caption text-secondary"
              >
                {Math.round(options.quality * 100)}%
              </span>
            </label>
            <input
              id="quality"
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round(options.quality * 100)}
              disabled={isLossless}
              onChange={(event) =>
                update({ quality: Number(event.target.value) / 100 })
              }
              className="mt-5 w-full cursor-pointer accent-action disabled:cursor-not-allowed disabled:opacity-45 disabled:accent-line-strong"
            />
            <p className={helpText}>
              {isLossless
                ? "PNG output is lossless — quality has no effect."
                : "Applies to JPEG and WebP output."}
            </p>
          </div>

          <fieldset className="col-span-full md:col-span-4 lg:col-span-6">
            <legend className={fieldLabel}>Max resolution</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {RESOLUTION_PRESETS.map((preset) => (
                <Tag
                  key={preset.label}
                  selected={
                    !isCustomDimension && options.maxDimension === preset.value
                  }
                  onClick={() => update({ maxDimension: preset.value })}
                >
                  {preset.label}
                </Tag>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <label htmlFor="custom-dimension" className="u-visually-hidden">
                Custom maximum resolution in pixels
              </label>
              <input
                id="custom-dimension"
                data-numeric
                type="number"
                min={16}
                step={1}
                placeholder="Custom"
                value={isCustomDimension ? options.maxDimension : ""}
                onChange={(event) =>
                  update({
                    maxDimension: Math.max(0, Number(event.target.value)),
                  })
                }
                className={numberInput}
              />
              <span className="font-mono text-caption text-muted">
                px on the longest side
              </span>
            </div>
            <p className={helpText}>
              Images smaller than this are never scaled up.
            </p>
          </fieldset>

          <div className="col-span-full md:col-span-4 lg:col-span-6">
            <label htmlFor="max-size" className={fieldLabel}>
              Target size per image
            </label>
            <div className="mt-3 flex items-center gap-3">
              <input
                id="max-size"
                data-numeric
                type="number"
                min={0}
                step={0.1}
                placeholder="No limit"
                value={options.maxSizeMB || ""}
                onChange={(event) =>
                  update({ maxSizeMB: Math.max(0, Number(event.target.value)) })
                }
                className={numberInput}
              />
              <span className="font-mono text-caption text-muted">MB</span>
            </div>
            <p className={helpText}>Leave empty to compress by quality only.</p>
          </div>
        </div>
      </div>

      {/* The queue starts on drop, so this row has to say whether what is on
          screen reflects the settings above it or not (§1.2). */}
      {hasFiles && (
        <div className="mt-12 flex flex-wrap items-center gap-6">
          <Button
            onClick={onApply}
            disabled={!isDirty}
            loading={isProcessing}
            variant="secondary"
          >
            Apply to all images
          </Button>
          {!isProcessing && (
            <p
              role="status"
              className={`text-body-sm ${
                isDirty ? "text-warning" : "text-secondary"
              }`}
            >
              {isDirty
                ? "Settings changed — apply to recompress the current images."
                : `Applied to ${fileCount} image${fileCount > 1 ? "s" : ""}.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default CompressionSettings;
