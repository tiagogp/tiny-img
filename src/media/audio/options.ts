/** `""` keeps the source's own container and codec. */
export type AudioFormat = "" | "mp3" | "wav" | "aac" | "opus" | "flac";

export interface AudioOptions {
  format: AudioFormat;
  /** kbps. Ignored for `wav`/`flac` — both are lossless, no bitrate to set.
   *  `0` means "let the codec pick its own default". */
  bitrateKbps: number;
  /** Seconds into the file to start at. `0` = from the beginning. */
  trimStartSec: number;
  /** Seconds into the file to end at. `0` = until the natural end. */
  trimEndSec: number;
  /** Loudness-normalizes the output (single-pass `loudnorm`). */
  normalize: boolean;
}

/** Format and bitrate are left alone by default, same reasoning as the image
 *  engine's defaults: converting someone's audio to a different codec is a
 *  decision with no undo, so it's opt-in rather than assumed. */
export const DEFAULT_AUDIO_OPTIONS: AudioOptions = {
  format: "",
  bitrateKbps: 0,
  trimStartSec: 0,
  trimEndSec: 0,
  normalize: false,
};

export const AUDIO_FORMATS: AudioFormat[] = [
  "",
  "mp3",
  "wav",
  "aac",
  "opus",
  "flac",
];

export const AUDIO_BITRATES = [64, 128, 192, 256, 320];

/** wav/flac are both lossless containers — a target bitrate has no meaning
 *  for either, so the UI disables the control rather than sending a value
 *  the codec would silently ignore. */
export const isLosslessFormat = (format: AudioFormat) =>
  format === "wav" || format === "flac";

export const isSameAudioOptions = (a: AudioOptions, b: AudioOptions) =>
  a.format === b.format &&
  a.bitrateKbps === b.bitrateKbps &&
  a.trimStartSec === b.trimStartSec &&
  a.trimEndSec === b.trimEndSec &&
  a.normalize === b.normalize;

/**
 * Anything can be in localStorage — validate field by field and fall back
 * per field rather than throwing the whole thing away over one bad number.
 */
export function coerceAudioOptions(raw: unknown): AudioOptions {
  if (typeof raw !== "object" || raw === null) return DEFAULT_AUDIO_OPTIONS;

  const value = raw as Record<string, unknown>;

  const format = AUDIO_FORMATS.includes(value.format as AudioFormat)
    ? (value.format as AudioFormat)
    : DEFAULT_AUDIO_OPTIONS.format;

  const bitrateKbps =
    typeof value.bitrateKbps === "number" &&
    Number.isFinite(value.bitrateKbps) &&
    value.bitrateKbps >= 0
      ? Math.trunc(value.bitrateKbps)
      : DEFAULT_AUDIO_OPTIONS.bitrateKbps;

  const trimStartSec =
    typeof value.trimStartSec === "number" &&
    Number.isFinite(value.trimStartSec) &&
    value.trimStartSec >= 0
      ? value.trimStartSec
      : DEFAULT_AUDIO_OPTIONS.trimStartSec;

  const trimEndSec =
    typeof value.trimEndSec === "number" &&
    Number.isFinite(value.trimEndSec) &&
    value.trimEndSec >= 0
      ? value.trimEndSec
      : DEFAULT_AUDIO_OPTIONS.trimEndSec;

  const normalize =
    typeof value.normalize === "boolean"
      ? value.normalize
      : DEFAULT_AUDIO_OPTIONS.normalize;

  return { format, bitrateKbps, trimStartSec, trimEndSec, normalize };
}
