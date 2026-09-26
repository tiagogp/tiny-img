"use client";

import LutBrightness from "./LutBrightness";

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
import MoreOptions from "./MoreOptions";
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
      update({ lut: registerLut(parsed, options.lut?.intensity ?? 1, options.lut?.brightness ?? 1) });
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

  const advancedSummary =
    [
      isCustomDimension ? `max ${options.maxDimension} px` : null,
      options.maxSizeMB > 0 ? `up to ${options.maxSizeMB} MB` : null,
      options.extraSizes.length > 0
        ? `${options.extraSizes.length} extra size${
            options.extraSizes.length > 1 ? "s" : ""
          }`
        : null,
      options.lut ? `LUT ${options.lut.name}` : null,
      options.stripExif && !options.lut ? "EXIF stripped" : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Target size, extra sizes, colour LUT, metadata";

  return (
    <div className="mt-6 flex flex-col gap-8">
      <fieldset>
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
            : "Tip: WebP usually saves another 25–50%."}
        </p>
      </fieldset>

      <div>
        <label
          htmlFor="quality"
          className={`${fieldLabel} flex items-baseline justify-between gap-4`}
        >
          Quality
          <span data-numeric className="font-mono text-caption text-secondary">
            {isLossless ? "Lossless" : `${Math.round(options.quality * 100)}%`}
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
        <div
          aria-hidden="true"
          className="mt-2 flex justify-between font-mono text-caption text-muted"
        >
          <span>Smaller file</span>
          <span>Better quality</span>
        </div>
      </div>

      <fieldset>
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
        <p className={helpText}>Smaller images are never scaled up.</p>
      </fieldset>

      <MoreOptions
        isInUse={
          isCustomDimension ||
          options.maxSizeMB > 0 ||
          options.extraSizes.length > 0 ||
          options.lut !== null ||
          options.stripExif
        }
        summary={advancedSummary}
      >
        <div>
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

        <div>
          <label htmlFor="custom-dimension" className={fieldLabel}>
            Custom max resolution
          </label>
          <div className="mt-3 flex items-center gap-3">
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
              px, longest side
            </span>
          </div>
        </div>

        <fieldset>
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
            Exports an extra copy at each size picked. Applies to files you
            drop after this.
          </p>
        </fieldset>

        {/* Colour LUT. Optional, off by default, and the only setting on this
            panel that changes what the photograph looks like rather than how
            large it is — which is why it is the only one with a preview before
            it takes effect. */}
        <fieldset>
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

              <LutBrightness
                id="lut-brightness-setting"
                value={options.lut.brightness}
                onChange={(brightness) => update({
                  lut: options.lut ? { ...options.lut, brightness } : null,
                })}
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
                Optional colour grade applied to every image before
                compression. Display LUTs only — not log (S-Log, LogC).
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

        <fieldset>
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
              ? "A LUT rebuilds the image from its pixels, so EXIF is always dropped while one is applied."
              : "Camera and location data. Only kept when the output stays JPEG."}
          </p>
        </fieldset>
      </MoreOptions>

      {isPreviewOpen && sampleImage && options.lut && lutTable && (
        <LutPreview
          file={sampleImage}
          lut={lutTable}
          initialIntensity={options.lut.intensity}
          initialBrightness={options.lut.brightness}
          onApply={(intensity, brightness) =>
            update({ lut: options.lut ? { ...options.lut, intensity, brightness } : null })
          }
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
};

export default ImageSettings;
