"use client";

import { FC } from "react";
import { Tag } from "../ui/Tag";
import {
  AUDIO_BITRATES,
  AUDIO_FORMATS,
  isLosslessFormat,
  type AudioFormat,
  type AudioOptions,
} from "@/media/audio/options";
import { fieldLabel, helpText, numberInput } from "./settingsStyles";

const FORMAT_LABELS: Record<AudioFormat, string> = {
  "": "Original format",
  mp3: "MP3",
  wav: "WAV",
  aac: "AAC",
  opus: "Opus",
  flac: "FLAC",
};

/** The one-line version of the panel — same contract as `summariseImage`. */
export const summariseAudio = ({
  format,
  bitrateKbps,
  trimStartSec,
  trimEndSec,
  normalize,
}: AudioOptions) =>
  [
    FORMAT_LABELS[format],
    bitrateKbps > 0 && !isLosslessFormat(format)
      ? `${bitrateKbps} kbps`
      : null,
    trimStartSec > 0 || trimEndSec > 0 ? "trimmed" : null,
    normalize ? "normalized" : null,
  ]
    .filter(Boolean)
    .join(" · ");

interface AudioSettingsProps {
  options: AudioOptions;
  onChange(options: AudioOptions): void;
}

const AudioSettings: FC<AudioSettingsProps> = ({ options, onChange }) => {
  const bitrateDisabled = isLosslessFormat(options.format);

  const update = (patch: Partial<AudioOptions>) =>
    onChange({ ...options, ...patch });

  return (
    <div className="grid-page mt-12">
      <fieldset className="col-span-full md:col-span-4 lg:col-span-6">
        <legend className={fieldLabel}>Output format</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {AUDIO_FORMATS.map((format) => (
            <Tag
              key={format || "original"}
              selected={options.format === format}
              onClick={() => update({ format })}
            >
              {FORMAT_LABELS[format]}
            </Tag>
          ))}
        </div>
        <p className={helpText}>
          {options.format === "wav" || options.format === "flac"
            ? "Lossless — no quality is lost, but the file stays large."
            : "MP3 is the most compatible; Opus is usually the smallest."}
        </p>
      </fieldset>

      <fieldset className="col-span-full md:col-span-4 lg:col-span-6">
        <legend className={fieldLabel}>Bitrate</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {AUDIO_BITRATES.map((bitrate) => (
            <Tag
              key={bitrate}
              selected={options.bitrateKbps === bitrate}
              disabled={bitrateDisabled}
              onClick={() => update({ bitrateKbps: bitrate })}
            >
              {bitrate}
            </Tag>
          ))}
        </div>
        <p className={helpText}>
          {bitrateDisabled
            ? "Lossless formats don't use a target bitrate."
            : "Higher is closer to the source, at a larger file."}
        </p>
      </fieldset>

      <div className="col-span-full md:col-span-4 lg:col-span-6">
        <label htmlFor="trim-start" className={fieldLabel}>
          Trim start
        </label>
        <div className="mt-3 flex items-center gap-3">
          <input
            id="trim-start"
            data-numeric
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={options.trimStartSec || ""}
            onChange={(event) =>
              update({
                trimStartSec: Math.max(0, Number(event.target.value)),
              })
            }
            className={numberInput}
          />
          <span className="font-mono text-caption text-muted">seconds</span>
        </div>
        <p className={helpText}>0 keeps the start of the file.</p>
      </div>

      <div className="col-span-full md:col-span-4 lg:col-span-6">
        <label htmlFor="trim-end" className={fieldLabel}>
          Trim end
        </label>
        <div className="mt-3 flex items-center gap-3">
          <input
            id="trim-end"
            data-numeric
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={options.trimEndSec || ""}
            onChange={(event) =>
              update({ trimEndSec: Math.max(0, Number(event.target.value)) })
            }
            className={numberInput}
          />
          <span className="font-mono text-caption text-muted">seconds</span>
        </div>
        <p className={helpText}>0 keeps the natural end of the file.</p>
      </div>

      <fieldset className="col-span-full md:col-span-4 lg:col-span-6">
        <legend className={fieldLabel}>Volume</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          <Tag
            selected={!options.normalize}
            onClick={() => update({ normalize: false })}
          >
            Original
          </Tag>
          <Tag
            selected={options.normalize}
            onClick={() => update({ normalize: true })}
          >
            Normalize
          </Tag>
        </div>
        <p className={helpText}>
          Evens out loudness to a consistent target level.
        </p>
      </fieldset>
    </div>
  );
};

export default AudioSettings;
