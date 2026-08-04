"use client";

import { FC } from "react";
import { Tag } from "../ui/Tag";
import type { ImageFormat, ImageOptions } from "@/media/image/options";
import { fieldLabel, helpText, numberInput } from "./settingsStyles";

const FORMAT_PRESETS: { label: string; value: ImageFormat }[] = [
  { label: "Original", value: "" },
  { label: "WebP", value: "image/webp" },
  { label: "JPEG", value: "image/jpeg" },
  { label: "PNG", value: "image/png" },
  { label: "AVIF", value: "image/avif" },
];

const RESOLUTION_PRESETS = [
  { label: "Original", value: 0 },
  { label: "4K", value: 3840 },
  { label: "1440p", value: 1440 },
  { label: "1080p", value: 1080 },
  { label: "720p", value: 720 },
  { label: "480p", value: 480 },
];

const FORMAT_LABELS: Record<ImageFormat, string> = {
  "": "Original format",
  "image/webp": "WebP",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/avif": "AVIF",
};

/**
 * The one-line version of the panel. Whatever is about to happen to a dropped
 * file has to be readable without opening anything — a collapsed panel that
 * hides its own defaults is a trap.
 */
export const summariseImage = ({
  format,
  quality,
  maxDimension,
  maxSizeMB,
  stripExif,
}: ImageOptions) =>
  [
    FORMAT_LABELS[format],
    format === "image/png"
      ? "lossless"
      : `${Math.round(quality * 100)}% quality`,
    maxDimension === 0 ? "original size" : `max ${maxDimension} px`,
    maxSizeMB > 0 ? `up to ${maxSizeMB} MB each` : null,
    stripExif ? "EXIF stripped" : null,
  ]
    .filter(Boolean)
    .join(" · ");

interface ImageSettingsProps {
  options: ImageOptions;
  onChange(options: ImageOptions): void;
}

const ImageSettings: FC<ImageSettingsProps> = ({ options, onChange }) => {
  const isCustomDimension =
    options.maxDimension !== 0 &&
    !RESOLUTION_PRESETS.some((preset) => preset.value === options.maxDimension);

  const isLossless = options.format === "image/png";

  const update = (patch: Partial<ImageOptions>) =>
    onChange({ ...options, ...patch });

  return (
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
            : options.format === "image/avif"
            ? "AVIF is usually smaller still, though encoding takes longer."
            : "Converting to WebP or AVIF usually saves another 25–50%."}
        </p>
      </fieldset>

      <div className="col-span-full md:col-span-4 lg:col-span-6">
        <label
          htmlFor="quality"
          className={`${fieldLabel} flex items-baseline justify-between gap-4`}
        >
          Quality
          <span data-numeric className="font-mono text-caption text-secondary">
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

      <fieldset className="col-span-full md:col-span-4 lg:col-span-6">
        <legend className={fieldLabel}>Additional sizes</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {RESOLUTION_PRESETS.filter((preset) => preset.value > 0).map(
            (preset) => {
              const selected = options.extraSizes.includes(preset.value);

              return (
                <Tag
                  key={preset.label}
                  selected={selected}
                  onClick={() =>
                    update({
                      extraSizes: selected
                        ? options.extraSizes.filter(
                            (size) => size !== preset.value
                          )
                        : [...options.extraSizes, preset.value],
                    })
                  }
                >
                  {preset.label}
                </Tag>
              );
            }
          )}
        </div>
        <p className={helpText}>
          Exports an extra file at each size picked, alongside the max
          resolution above. Applies to files you drop after this — not to
          files already in the queue.
        </p>
      </fieldset>

      <fieldset className="col-span-full md:col-span-4 lg:col-span-6">
        <legend className={fieldLabel}>Photo metadata</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          <Tag
            selected={!options.stripExif}
            onClick={() => update({ stripExif: false })}
          >
            Keep EXIF
          </Tag>
          <Tag
            selected={options.stripExif}
            onClick={() => update({ stripExif: true })}
          >
            Strip EXIF
          </Tag>
        </div>
        <p className={helpText}>
          Only applies when the output stays JPEG — every other format
          always drops EXIF.
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
  );
};

export default ImageSettings;
