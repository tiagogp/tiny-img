"use client";

import { FC } from "react";
import { Button } from "../ui/Button";
import type { MediaOptions } from "@/media/registry";
import type { MediaKind } from "@/media/types";
import type { ImageOptions } from "@/media/image/options";
import type { AudioOptions } from "@/media/audio/options";
import ImageSettings from "./ImageSettings";
import AudioSettings from "./AudioSettings";

const KIND_TITLES: Record<MediaKind, string> = {
  image: "Images",
  audio: "Audio",
  video: "Video",
};

function renderPanel(
  kind: MediaKind,
  options: MediaOptions,
  onChange: (next: MediaOptions) => void,
  sampleImage?: File
) {
  switch (kind) {
    case "image":
      return (
        <ImageSettings
          options={options as ImageOptions}
          onChange={onChange as (next: ImageOptions) => void}
          sampleImage={sampleImage}
        />
      );
    case "audio":
      return (
        <AudioSettings
          options={options as AudioOptions}
          onChange={onChange as (next: AudioOptions) => void}
        />
      );
    default:
      return null;
  }
}

interface OutputSettingsProps {
  presentKinds: MediaKind[];
  options: Partial<Record<MediaKind, MediaOptions>>;
  onChange(kind: MediaKind, options: MediaOptions): void;
  onApply(): void;
  onReset(): void;
  isDirty: boolean;
  fileCount: number;
  isProcessing: boolean;
  /** Image-only, and only for the LUT preview — see `ImageSettings`. */
  sampleImage?: File;
}

const OutputSettings: FC<OutputSettingsProps> = ({
  presentKinds,
  options,
  onChange,
  onApply,
  onReset,
  isDirty,
  fileCount,
  isProcessing,
  sampleImage,
}) => {
  const hasFiles = fileCount > 0;

  /* Always open: the settings sit beside the files rather than behind a
     toggle, so what is about to happen to a drop is never a click away. The
     basic controls are enough on their own — everything else waits behind
     "More options" inside each panel. */
  return (
    <section
      aria-labelledby="settings-heading"
      className="rounded-md border border-line bg-surface p-6 md:p-8"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="settings-heading"
          className="font-display text-h4 font-semibold text-primary"
        >
          Settings
        </h2>
        <Button variant="quiet" size="sm" onClick={onReset}>
          Reset
        </Button>
      </div>
      {!hasFiles && (
        <p className="mt-2 text-body-sm text-secondary">
          The defaults work for most files — change them only if you need to.
        </p>
      )}

      {presentKinds.map((kind) => {
        const kindOptions = options[kind];
        if (!kindOptions) return null;

        return (
          <div
            key={kind}
            className={presentKinds.length > 1 ? "mt-8 first:mt-6" : undefined}
          >
            {presentKinds.length > 1 && (
              <h3 className="font-mono text-eyebrow uppercase text-muted">
                {KIND_TITLES[kind]}
              </h3>
            )}
            {renderPanel(
              kind,
              kindOptions,
              (next) => onChange(kind, next),
              sampleImage
            )}
          </div>
        );
      })}

      {/* The queue starts on drop, so this row has to say whether what is on
          screen reflects the settings above it or not (§1.2). */}
      {hasFiles && (
        <div className="mt-8 border-t border-line pt-6">
          {!isProcessing && (
            <p
              role="status"
              className={`text-body-sm ${
                isDirty ? "text-warning" : "text-secondary"
              }`}
            >
              {isDirty
                ? "Settings changed — apply to recompress your files."
                : `Applied to ${fileCount} file${fileCount > 1 ? "s" : ""}.`}
            </p>
          )}
          <Button
            className="mt-4 w-full"
            onClick={onApply}
            disabled={!isDirty}
            loading={isProcessing}
            variant="secondary"
          >
            Apply to all files
          </Button>
        </div>
      )}
    </section>
  );
};

export default OutputSettings;
