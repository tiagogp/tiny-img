import imageCompression from "browser-image-compression";
import type { EngineHandlers, MediaMeta, MediaOutcome } from "../types";
import { encodeAvif } from "./avif";
import { decodeHeic, isHeicFile } from "./heic";
import type { ImageOptions } from "./options";

/**
 * Self-hosted copy of the lib, vendored by `scripts/vendor-assets.mjs`.
 * The default value points at jsDelivr, which the worker fetches at runtime.
 */
const LIB_URL = "/vendor/browser-image-compression.js";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export interface Dimensions {
  width: number;
  height: number;
}

/** Images always know their pixel size, so these are not optional here. */
export interface ImageMeta extends MediaMeta {
  width: number;
  height: number;
}

export type ImageOutcome = MediaOutcome<ImageMeta>;

export async function getFileDimensions(file: Blob): Promise<Dimensions> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }

  const url = URL.createObjectURL(file);

  try {
    return await new Promise<Dimensions>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error("Failed to load the image file."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Mirrors `handleMaxWidthOrHeight` in browser-image-compression: the scaled side
 * is assigned to `canvas.width`/`canvas.height`, which truncates to an integer.
 * Lets us report the output size without decoding the result a second time.
 */
function predictDimensions(
  original: Dimensions,
  maxDimension: number
): Dimensions {
  const largestSide = Math.max(original.width, original.height);

  if (maxDimension <= 0 || maxDimension >= largestSide) return original;

  return original.width > original.height
    ? {
        width: maxDimension,
        height: Math.trunc((original.height / original.width) * maxDimension),
      }
    : {
        width: Math.trunc((original.width / original.height) * maxDimension),
        height: maxDimension,
      };
}

function renameForType(name: string, type: string) {
  const extension = EXTENSIONS[type];
  if (!extension) return name;

  return `${name.replace(/\.[^./\\]+$/, "")}.${extension}`;
}

/**
 * The library throws decoder and canvas errors verbatim, which say nothing to
 * someone holding a photo that will not open. Map the cases we can recognise
 * and keep the raw message as a last resort — "Failed" alone is unactionable.
 */
export function describeImageError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (/heic|heif/i.test(message)) {
    return "This HEIC file could not be converted — it may be corrupt or use an unsupported variant.";
  }
  if (/avif encoding/i.test(message)) {
    return "AVIF encoding failed in this browser. Try a different output format.";
  }
  if (/canvas|tainted|securityerror/i.test(message)) {
    return "The browser refused to read this image's pixels.";
  }
  if (/memory|allocat|too large/i.test(message)) {
    return "Ran out of memory — the image is too large for this browser.";
  }
  if (/decode|load|corrupt|not an image|source image/i.test(message)) {
    return "This file could not be decoded — it may be corrupt.";
  }
  if (/worker|import|network|fetch/i.test(message)) {
    return "The compression worker failed to start. Reload and try again.";
  }

  return message || "Compression failed for an unknown reason.";
}

/**
 * Shared by both encode paths. Re-encoding a PNG, or touching an
 * already-optimised JPEG, routinely produces a bigger file — but a HEIC
 * source is exempt: the whole reason it was dropped is to leave as a JPEG or
 * WebP, and HEIC's own compression often beats a re-encode anyway, so keeping
 * the untouched original would silently defeat the feature.
 */
function finalizeOutcome(
  original: Dimensions,
  file: File,
  output: File,
  resultMeta: Dimensions
): ImageOutcome {
  if (!isHeicFile(file) && output.size >= file.size) {
    return {
      kind: "image",
      file,
      originalSize: file.size,
      meta: original,
      originalMeta: original,
      unchanged: true,
    };
  }

  return {
    kind: "image",
    file: output,
    originalSize: file.size,
    meta: resultMeta,
    originalMeta: original,
    unchanged: false,
  };
}

/**
 * AVIF bypasses `browser-image-compression` entirely — it can't reliably
 * produce AVIF cross-browser (see `avif.ts`) — so resize and encode happen by
 * hand here: decode, draw at the target size, hand the raw pixels to the
 * WASM encoder.
 */
async function compressToAvif(
  original: Dimensions,
  file: File,
  source: File,
  options: ImageOptions,
  targetType: string
): Promise<ImageOutcome> {
  const shouldResize =
    options.maxDimension > 0 && options.maxDimension < Math.max(original.width, original.height);
  const target = shouldResize
    ? predictDimensions(original, options.maxDimension)
    : original;

  const bitmap = await createImageBitmap(source, {
    imageOrientation: "from-image",
  });
  const canvas = new OffscreenCanvas(target.width, target.height);
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("The browser refused to read this image's pixels.");
  }

  context.drawImage(bitmap, 0, 0, target.width, target.height);
  bitmap.close();

  const imageData = context.getImageData(0, 0, target.width, target.height);
  const avifBlob = await encodeAvif(imageData, options.quality);

  const output = new File([avifBlob], renameForType(file.name, targetType), {
    type: targetType,
    lastModified: file.lastModified,
  });

  return finalizeOutcome(original, file, output, target);
}

export async function compressImage(
  file: File,
  options: ImageOptions,
  { signal, onProgress }: EngineHandlers
): Promise<ImageOutcome> {
  // Every downstream step — resize, quality, target-format conversion, EXIF —
  // then runs on a plain JPEG exactly as it would on any other source. This is
  // the only HEIC-specific step in the whole pipeline.
  const source = isHeicFile(file) ? await decodeHeic(file) : file;

  const original = await getFileDimensions(source);
  const largestSide = Math.max(original.width, original.height);
  const shouldResize =
    options.maxDimension > 0 && options.maxDimension < largestSide;
  const targetType = options.format || source.type;

  if (targetType === "image/avif") {
    onProgress?.(0);
    const outcome = await compressToAvif(
      original,
      file,
      source,
      options,
      targetType
    );
    onProgress?.(100);
    return outcome;
  }

  const run = (preserveExif: boolean) =>
    imageCompression(source, {
      initialQuality: options.quality,
      maxSizeMB:
        options.maxSizeMB > 0 ? options.maxSizeMB : Number.POSITIVE_INFINITY,
      maxWidthOrHeight: shouldResize ? options.maxDimension : undefined,
      alwaysKeepResolution: !shouldResize,
      fileType: options.format || undefined,
      preserveExif,
      useWebWorker: true,
      libURL: LIB_URL,
      signal,
      onProgress,
    });

  // The lib only copies EXIF when both sides are JPEG, and it rejects the whole
  // compression if the source has a malformed EXIF block. Falling back once is
  // better than failing an image that compresses fine without its metadata.
  // A HEIC source never satisfies `file.type === "image/jpeg"`, so it always
  // takes the strip path here — libheif's decode already rasterized away
  // whatever EXIF the original HEIC carried.
  const canPreserveExif =
    !options.stripExif &&
    file.type === "image/jpeg" &&
    (!options.format || options.format === file.type);

  const compressed = await (canPreserveExif
    ? run(true).catch((error) => {
        if (signal.aborted) throw error;
        return run(false);
      })
    : run(false));

  // `preserveExif` re-wraps JPEGs into a plain Blob and loses `name`, so rebuild
  // the File rather than trusting what comes back. Converting formats also has
  // to rename the file, otherwise a WebP ships with a `.png` extension.
  const output = new File([compressed], renameForType(file.name, targetType), {
    type: targetType,
    lastModified: file.lastModified,
  });

  // With a target size the lib may downscale further than we asked, so the only
  // reliable answer is to measure. Otherwise the resize is a single known step.
  const result =
    options.maxSizeMB > 0 && shouldResize
      ? await getFileDimensions(output)
      : predictDimensions(original, shouldResize ? options.maxDimension : 0);

  return finalizeOutcome(original, file, output, result);
}
