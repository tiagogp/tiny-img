import {
  CompressionOptions,
  DEFAULT_OPTIONS,
  OutputFormat,
} from "@/components/Dropzone/CompressionSettings";

const STORAGE_KEY = "tinyimg:settings:v1";

const VALID_FORMATS: OutputFormat[] = [
  "",
  "image/webp",
  "image/jpeg",
  "image/png",
];

/**
 * Anything can be in localStorage — an older shape, a half-written value, a
 * hand-edited entry. Validate field by field and fall back per field rather
 * than throwing the whole thing away over one bad number.
 */
function coerce(raw: unknown): CompressionOptions {
  if (typeof raw !== "object" || raw === null) return DEFAULT_OPTIONS;

  const value = raw as Record<string, unknown>;

  const quality =
    typeof value.quality === "number" &&
    value.quality >= 0.1 &&
    value.quality <= 1
      ? value.quality
      : DEFAULT_OPTIONS.quality;

  const maxDimension =
    typeof value.maxDimension === "number" &&
    Number.isFinite(value.maxDimension) &&
    value.maxDimension >= 0
      ? Math.trunc(value.maxDimension)
      : DEFAULT_OPTIONS.maxDimension;

  const maxSizeMB =
    typeof value.maxSizeMB === "number" &&
    Number.isFinite(value.maxSizeMB) &&
    value.maxSizeMB >= 0
      ? value.maxSizeMB
      : DEFAULT_OPTIONS.maxSizeMB;

  const format = VALID_FORMATS.includes(value.format as OutputFormat)
    ? (value.format as OutputFormat)
    : DEFAULT_OPTIONS.format;

  return { quality, maxDimension, maxSizeMB, format };
}

/** Returns `null` when there is nothing stored, so the caller can skip a render. */
export function loadSettings(): CompressionOptions | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    return coerce(JSON.parse(stored));
  } catch {
    // Private mode, disabled storage, or malformed JSON — defaults are fine.
    return null;
  }
}

export function saveSettings(options: CompressionOptions) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Quota or a blocked storage API. Persisting settings is a convenience.
  }
}
