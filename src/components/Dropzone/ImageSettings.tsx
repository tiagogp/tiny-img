"use client";

import { FC, useRef, useState } from "react";
import { Tag } from "../ui/Tag";
import { Button } from "../ui/Button";
import type { ImageFormat, ImageOptions } from "@/media/image/options";
import {
  CubeParseError,
  describeCubeLut,
  isCubeFile,
  readCubeFile,
} from "@/media/image/lut/cube";
import {
  forgetLut,
  getLutTable,
  registerLut,
} from "@/media/image/lut/registry";
import { probeLutBackend } from "@/media/image/lut/apply";
import LutPreview from "./LutPreview";
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
  lut,
}: ImageOptions) =>
  [
    FORMAT_LABELS[format],
    format === "image/png"
      ? "lossless"
      : `${Math.round(quality * 100)}% quality`,
    maxDimension === 0 ? "original size" : `max ${maxDimension} px`,
    maxSizeMB > 0 ? `up to ${maxSizeMB} MB each` : null,
    // Named first among the optional parts: it is the only setting here that
    // changes what the photograph looks like rather than how big it is.
    lut ? `LUT ${lut.name} at ${Math.round(lut.intensity * 100)}%` : null,
    stripExif && !lut ? "EXIF stripped" : null,
  ]
    .filter(Boolean)
    .join(" · ");

interface ImageSettingsProps {
  options: ImageOptions;
  onChange(options: ImageOptions): void;
  /**
   * One photo from the queue, for the LUT preview to judge against. Absent
   * before anything is dropped, which is exactly when there is nothing to
   * preview on — the LUT can still be loaded, just not previewed yet.
   */
  sampleImage?: File;
}

const ImageSettings: FC<ImageSettingsProps> = ({
  options,
  onChange,
  sampleImage,
}) => {
  const [lutError, setLutError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const cubeInputRef = useRef<HTMLInputElement>(null);
  const isCustomDimension =
    options.maxDimension !== 0 &&
    !RESOLUTION_PRESETS.some((preset) => preset.value === options.maxDimension);

  const isLossless = options.format === "image/png";

  const update = (patch: Partial<ImageOptions>) =>
    onChange({ ...options, ...patch });

  const lutTable = options.lut ? getLutTable(options.lut.id) : undefined;

  const loadCube = async (file: File | undefined) => {
    if (!file) return;

    setLutError(null);

    if (!isCubeFile(file)) {
      setLutError(`${file.name} is not a .cube file.`);
      return;
    }

    try {
      const parsed = await readCubeFile(file);
      // Replacing one LUT with another drops the old table rather than letting
      // a long session accumulate every cube that was ever tried.
      if (options.lut) forgetLut(options.lut.id);
      update({ lut: registerLut(parsed, options.lut?.intensity ?? 1) });
    } catch (cause) {
      setLutError(
        cause instanceof CubeParseError
          ? cause.message
          : "This .cube file could not be read."
      );
    }
  };

  const removeLut = () => {
    if (options.lut) forgetLut(options.lut.id);
    setLutError(null);
    update({ lut: null });
  };

  // Asked only once a LUT is actually loaded, so a visit that never uses one
  // never creates a WebGL context to find out.
  const isSoftwareRendered =
    options.lut !== null && probeLutBackend() === "cpu";

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

      {/* Colour LUT. Optional, off by default, and the only setting on this
          panel that changes what the photograph looks like rather than how
          large it is — which is why it is the only one with a preview before
          it takes effect. */}
      <fieldset className="col-span-full md:col-span-8 lg:col-span-12">
        <legend className={fieldLabel}>Colour LUT</legend>

        <input
          ref={cubeInputRef}
          id="lut-file"
          type="file"
          accept=".cube"
          className="u-visually-hidden"
          onChange={(event) => {
            void loadCube(event.target.files?.[0]);
            // Otherwise re-picking the same file after removing it fires no
            // change event and the panel appears to ignore the choice.
            event.target.value = "";
          }}
        />

        {options.lut && lutTable ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-body-sm text-primary">
                {options.lut.name}
              </span>
              <span
                data-numeric
                className="rounded-pill border border-line px-3 py-1 font-mono text-caption text-muted"
              >
                {describeCubeLut(lutTable)}
              </span>
            </div>

            <label
              htmlFor="lut-intensity-setting"
              className={`${fieldLabel} mt-6 flex items-baseline justify-between gap-4`}
            >
              Intensity
              <span
                data-numeric
                className="font-mono text-caption text-secondary"
              >
                {Math.round(options.lut.intensity * 100)}%
              </span>
            </label>
            <input
              id="lut-intensity-setting"
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(options.lut.intensity * 100)}
              onChange={(event) =>
                update({
                  lut: options.lut
                    ? {
                        ...options.lut,
                        intensity: Number(event.target.value) / 100,
                      }
                    : null,
                })
              }
              className="mt-5 w-full cursor-pointer accent-action"
            />

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={!sampleImage}
                onClick={() => setIsPreviewOpen(true)}
              >
                Preview
              </Button>
              <Button variant="quiet" size="sm" onClick={removeLut}>
                Remove
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => cubeInputRef.current?.click()}
              >
                Replace
              </Button>
            </div>

            <p className={helpText}>
              {!sampleImage
                ? "Applied to every image in the batch. Drop a photo to preview it."
                : isSoftwareRendered
                ? "Applied to every image in the batch. This browser has no WebGL2, so grading runs on the CPU — a large batch will be slow."
                : "Applied to every image in the batch, before compression. Preview it on one photo first."}
            </p>
          </>
        ) : (
          <>
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => cubeInputRef.current?.click()}
              >
                Add a .cube file
              </Button>
            </div>
            <p className={helpText}>
              Optional. An Adobe .cube LUT, applied to every image in the batch
              before compression — or dropped onto the page with your photos.
              Display LUTs only: a log LUT (S-Log, LogC) expects footage this
              is not.
            </p>
          </>
        )}

        {lutError && (
          <p
            role="alert"
            className="mt-4 max-w-measure rounded-sm bg-error-surface px-4 py-3 text-body-sm text-error"
          >
            {lutError}
          </p>
        )}
      </fieldset>

      <fieldset className="col-span-full md:col-span-4 lg:col-span-6">
        <legend className={fieldLabel}>Photo metadata</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          <Tag
            selected={!options.stripExif && !options.lut}
            disabled={options.lut !== null}
            onClick={() => update({ stripExif: false })}
          >
            Keep EXIF
          </Tag>
          <Tag
            selected={options.stripExif || options.lut !== null}
            disabled={options.lut !== null}
            onClick={() => update({ stripExif: true })}
          >
            Strip EXIF
          </Tag>
        </div>
        <p className={helpText}>
          {options.lut
            ? "A LUT rebuilds the image from its pixels, which no metadata survives — EXIF is always dropped while one is applied."
            : "Only applies when the output stays JPEG — every other format always drops EXIF."}
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

      {isPreviewOpen && sampleImage && options.lut && lutTable && (
        <LutPreview
          file={sampleImage}
          lut={lutTable}
          initialIntensity={options.lut.intensity}
          onApply={(intensity) =>
            update({ lut: options.lut ? { ...options.lut, intensity } : null })
          }
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
};

export default ImageSettings;
