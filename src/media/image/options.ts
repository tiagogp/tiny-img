/** `""` keeps each image in its original format. */
export type ImageFormat = "" | "image/webp" | "image/jpeg" | "image/png";

export interface ImageOptions {
  /** 0.1 - 1. Only affects lossy formats (JPEG/WebP). */
  quality: number;
  /** Largest side in px. `0` keeps the original resolution. */
  maxDimension: number;
  /** Max size per image in MB. `0` means no target size. */
  maxSizeMB: number;
  /** Re-encode every image to this format. */
  format: ImageFormat;
}

/**
 * Format and resolution are deliberately untouched by default. Downscaling a
 * 4000px photo to 1080px, or handing back a `.webp` where a `.png` went in, is
 * a decision with no undo, and a default that quietly makes one for the user is
 * the wrong kind of helpful — both are one tap away in the settings panel.
 */
export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  quality: 0.8,
  maxDimension: 0,
  maxSizeMB: 0,
  format: "",
};

export const IMAGE_FORMATS: ImageFormat[] = [
  "",
  "image/webp",
  "image/jpeg",
  "image/png",
];

export const isSameImageOptions = (a: ImageOptions, b: ImageOptions) =>
  a.quality === b.quality &&
  a.maxDimension === b.maxDimension &&
  a.maxSizeMB === b.maxSizeMB &&
  a.format === b.format;

/**
 * Anything can be in localStorage — an older shape, a half-written value, a
 * hand-edited entry. Validate field by field and fall back per field rather
 * than throwing the whole thing away over one bad number.
 */
export function coerceImageOptions(raw: unknown): ImageOptions {
  if (typeof raw !== "object" || raw === null) return DEFAULT_IMAGE_OPTIONS;

  const value = raw as Record<string, unknown>;

  const quality =
    typeof value.quality === "number" &&
    value.quality >= 0.1 &&
    value.quality <= 1
      ? value.quality
      : DEFAULT_IMAGE_OPTIONS.quality;

  const maxDimension =
    typeof value.maxDimension === "number" &&
    Number.isFinite(value.maxDimension) &&
    value.maxDimension >= 0
      ? Math.trunc(value.maxDimension)
      : DEFAULT_IMAGE_OPTIONS.maxDimension;

  const maxSizeMB =
    typeof value.maxSizeMB === "number" &&
    Number.isFinite(value.maxSizeMB) &&
    value.maxSizeMB >= 0
      ? value.maxSizeMB
      : DEFAULT_IMAGE_OPTIONS.maxSizeMB;

  const format = IMAGE_FORMATS.includes(value.format as ImageFormat)
    ? (value.format as ImageFormat)
    : DEFAULT_IMAGE_OPTIONS.format;

  return { quality, maxDimension, maxSizeMB, format };
}
