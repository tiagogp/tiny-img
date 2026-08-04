"use client";

import { FC, useState } from "react";
import { Button } from "../ui/Button";
import type { MediaOptions } from "@/media/registry";
import type { MediaKind } from "@/media/types";
import type { ImageOptions } from "@/media/image/options";
import type { AudioOptions } from "@/media/audio/options";
import ImageSettings, { summariseImage } from "./ImageSettings";
import AudioSettings, { summariseAudio } from "./AudioSettings";

const KIND_TITLES: Record<MediaKind, string> = {
  image: "Images",
  audio: "Audio",
  video: "Video",
};

function summariseKind(kind: MediaKind, options: MediaOptions): string {
  switch (kind) {
    case "image":
      return summariseImage(options as ImageOptions);
    case "audio":
      return summariseAudio(options as AudioOptions);
    default:
      return "";
  }
}

function renderPanel(
  kind: MediaKind,
  options: MediaOptions,
  onChange: (next: MediaOptions) => void
) {
  switch (kind) {
    case "image":
      return (
        <ImageSettings
          options={options as ImageOptions}
          onChange={onChange as (next: ImageOptions) => void}
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
}) => {
  /** Collapsible in both directions — files no longer force it open. */
  const [isExpanded, setIsExpanded] = useState(false);
  const hasFiles = fileCount > 0;

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
          {hasFiles ? (
            <span className="flex flex-col gap-1">
              {presentKinds.map((kind) => {
                const kindOptions = options[kind];
                if (!kindOptions) return null;

                return (
                  <span key={kind}>
                    {KIND_TITLES[kind]} · {summariseKind(kind, kindOptions)}
                  </span>
                );
              })}
            </span>
          ) : (
            "Settings adapt to what you drop."
          )}
        </span>
        <span className="font-display text-button font-semibold text-secondary">
          {isExpanded ? "Hide" : "Adjust"}
        </span>
      </button>

      {/* The wrapper carries `hidden` because `.grid-page` sets `display: grid`
          and would win over the attribute's `display: none`. */}
      <div id="settings-body" hidden={!isExpanded}>
        {presentKinds.map((kind) => {
          const kindOptions = options[kind];
          if (!kindOptions) return null;

          return (
            <div key={kind}>
              {presentKinds.length > 1 && (
                <h3 className="mt-12 font-display text-h4 font-semibold text-primary first:mt-0">
                  {KIND_TITLES[kind]}
                </h3>
              )}
              {renderPanel(kind, kindOptions, (next) => onChange(kind, next))}
            </div>
          );
        })}
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
            Apply to all files
          </Button>
          {!isProcessing && (
            <p
              role="status"
              className={`text-body-sm ${
                isDirty ? "text-warning" : "text-secondary"
              }`}
            >
              {isDirty
                ? "Settings changed — apply to recompress the current files."
                : `Applied to ${fileCount} file${fileCount > 1 ? "s" : ""}.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default OutputSettings;
