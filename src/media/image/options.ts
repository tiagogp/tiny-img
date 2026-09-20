import { hasLutTable, type LutSelection } from "./lut/registry";

/** `""` keeps each image in its original format. */
export type ImageFormat =
  | ""
  | "image/webp"
  | "image/jpeg"
  | "image/png"
  | "image/avif";

export interface ImageOptions {
  /** 0.1 - 1. Only affects lossy formats (JPEG/WebP/AVIF). */
  quality: number;
  /** Largest side in px. `0` keeps the original resolution. */
  maxDimension: number;
  /** Max size per image in MB. `0` means no target size. */
  maxSizeMB: number;
  /** Re-encode every image to this format. */
  format: ImageFormat;
  /**
   * Strips EXIF even when it could otherwise be kept. Preserving is only ever
   * possible for a JPEG staying a JPEG — this only ever narrows that, never
   * widens it.
   */
  stripExif: boolean;
  /**
   * Extra output sizes (largest side, px), generated alongside the normal
   * `maxDimension` output. Fixed per batch at the moment files are dropped —
   * changing this list re-applies to the next batch, not to files already in
   * the queue, since resizing the queue itself on every settings change would
   * make "Apply to all files" ambiguous about which rows it owns.
   */
  extraSizes: number[];
  /**
   * A colour LUT applied to every image in the batch before it is encoded, or
   * `null` for none — which is the default, and the only state a fresh visit
   * can be in.
   *
   * This is a *reference* to a table held for the session, not the table
   * itself; see `lut/registry.ts` for why. A LUT therefore does not survive a
   * reload, and `coerceImageOptions` drops a reference whose table is gone.
   */
  lut: LutSelection | null;
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
  stripExif: false,
  extraSizes: [],
  lut: null,
};

export const IMAGE_FORMATS: ImageFormat[] = [
  "",
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/avif",
];

export const isSameImageOptions = (a: ImageOptions, b: ImageOptions) =>
  a.quality === b.quality &&
  a.maxDimension === b.maxDimension &&
  a.maxSizeMB === b.maxSizeMB &&
  a.format === b.format &&
  a.stripExif === b.stripExif &&
  a.extraSizes.length === b.extraSizes.length &&
  a.extraSizes.every((size, index) => size === b.extraSizes[index]) &&
  // Identity and strength, not the table: a reference is all that can differ,
  // and this runs on every render to decide whether the queue is dirty.
  a.lut?.id === b.lut?.id &&
  a.lut?.intensity === b.lut?.intensity;

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

  const stripExif =
    typeof value.stripExif === "boolean"
      ? value.stripExif
      : DEFAULT_IMAGE_OPTIONS.stripExif;

  const extraSizes = Array.isArray(value.extraSizes)
    ? [
        ...new Set(
          value.extraSizes.filter(
            (size): size is number =>
              typeof size === "number" && Number.isFinite(size) && size > 0
          )
        ),
      ]
    : DEFAULT_IMAGE_OPTIONS.extraSizes;

  // A stored reference outlives the table it points at — the table lives in
  // memory and the reference in localStorage. Restoring the name alone would
  // put a LUT in the summary line that grades nothing, so it is dropped.
  const stored = value.lut as Partial<LutSelection> | null | undefined;
  const lut =
    stored &&
    typeof stored.id === "string" &&
    typeof stored.name === "string" &&
    typeof stored.intensity === "number" &&
    stored.intensity >= 0 &&
    stored.intensity <= 1 &&
    hasLutTable(stored.id)
      ? { id: stored.id, name: stored.name, intensity: stored.intensity }
      : null;

  return {
    quality,
    maxDimension,
    maxSizeMB,
    format,
    stripExif,
    extraSizes,
    lut,
  };
}
