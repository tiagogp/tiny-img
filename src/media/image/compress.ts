import imageCompression from "browser-image-compression";
import type { EngineHandlers, MediaMeta, MediaOutcome } from "../types";
import { encodeAvif } from "./avif";
import { decodeHeic, isHeicFile } from "./heic";
import { withGradedCanvas } from "./lut/apply";
import { getLutTable } from "./lut/registry";
import type { CubeLut } from "./lut/cube";
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
  if (/lut/i.test(message)) {
    return "The colour LUT could not be applied in this browser. Remove it to compress without grading.";
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
 *
 * A LUT is exempt for the same reason, and more sharply: the user asked for
 * the colour to change. Handing back the original because it happened to be
 * smaller would return a file that is not the one they previewed, and the row
 * would claim "unchanged" about an image they deliberately changed.
 */
function finalizeOutcome(
  original: Dimensions,
  file: File,
  output: File,
  resultMeta: Dimensions,
  /** Set when the output differs from the source by intent, not just by size. */
  alwaysKeepOutput = false
): ImageOutcome {
  if (!alwaysKeepOutput && !isHeicFile(file) && output.size >= file.size) {
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

/** How many re-encodes a target size is worth before taking the best so far.
 *  Each one is a full encode of the image, and six halvings already place the
 *  quality to within a percent. */
const SIZE_SEARCH_STEPS = 6;

/** Quality has no meaning for these, so neither does searching on it. */
const LOSSLESS_TYPES = new Set(["image/png"]);

/**
 * `canvas.convertToBlob`, plus the target-size search that
 * `browser-image-compression` would otherwise have done for us.
 *
 * Only the *quality* is searched, never the resolution — the library will
 * shrink an image further to make a target, this will not. That is a real
 * difference in behaviour on this path, and the honest one of the two: the
 * resolution the user asked for is a stated intent, and silently overriding it
 * to hit a byte count trades a setting they chose for one they only hoped for.
 */
async function encodeCanvas(
  canvas: OffscreenCanvas,
  type: string,
  options: ImageOptions,
  signal: AbortSignal
): Promise<Blob> {
  const first = await canvas.convertToBlob({ type, quality: options.quality });

  const limit =
    options.maxSizeMB > 0 ? options.maxSizeMB * 1024 * 1024 : Number.POSITIVE_INFINITY;

  if (first.size <= limit || LOSSLESS_TYPES.has(type)) return first;

  // Highest quality that fits. The requested quality is the ceiling: this is
  // a size limit, not a licence to re-encode at something better.
  let low = 0.1;
  let high = options.quality;
  let best: Blob | null = null;

  for (let step = 0; step < SIZE_SEARCH_STEPS; step += 1) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const middle = (low + high) / 2;
    const candidate = await canvas.convertToBlob({ type, quality: middle });

    if (candidate.size <= limit) {
      best = candidate;
      low = middle;
    } else {
      high = middle;
    }
  }

  // Nothing in range fit, so the floor is the smallest this can be made. The
  // file still comes back — a target size is a request, not a guarantee.
  return best ?? canvas.convertToBlob({ type, quality: 0.1 });
}

/**
 * The path for every job that needs the pixels themselves.
 *
 * Two things need it, for the same underlying reason: `browser-image-compression`
 * owns its decode, resize and encode as one closed step with no hook between
 * them. AVIF needs it because the library cannot reliably produce AVIF at all
 * (see `avif.ts`); a LUT needs it because grading has to happen after the
 * decode and before the encode, which is exactly the seam the library does not
 * expose.
 *
 * Resize happens in the decoder rather than on the canvas: `createImageBitmap`
 * takes the target size directly, so the full-resolution bitmap is never
 * materialised and the LUT runs over the smaller image.
 */
async function compressOnCanvas(
  original: Dimensions,
  file: File,
  source: File,
  options: ImageOptions,
  targetType: string,
  lut: CubeLut | undefined,
  intensity: number,
  signal: AbortSignal
): Promise<ImageOutcome> {
  const shouldResize =
    options.maxDimension > 0 &&
    options.maxDimension < Math.max(original.width, original.height);
  const target = shouldResize
    ? predictDimensions(original, options.maxDimension)
    : original;

  const bitmap = await createImageBitmap(source, {
    imageOrientation: "from-image",
    // Straight alpha: the LUT has to grade a transparent pixel's real colour,
    // not its premultiplied fade toward black. Harmless when there is no LUT.
    premultiplyAlpha: "none",
    ...(shouldResize
      ? {
          resizeWidth: target.width,
          resizeHeight: target.height,
          resizeQuality: "high" as const,
        }
      : {}),
  });

  const canvas = new OffscreenCanvas(target.width, target.height);
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("The browser refused to read this image's pixels.");
  }

  try {
    if (lut) {
      // The renderer is shared by the whole queue and its canvas is reused, so
      // the copy has to happen inside the callback, before the lock is handed
      // to the next image.
      const graded = await withGradedCanvas(bitmap, lut, intensity, (gpu) => {
        context.drawImage(gpu, 0, 0);
        return true;
      });

      if (!graded) {
        throw new Error("The LUT could not be applied in this browser.");
      }
    } else {
      context.drawImage(bitmap, 0, 0, target.width, target.height);
    }
  } finally {
    bitmap.close();
  }

  const blob =
    targetType === "image/avif"
      ? await encodeAvif(
          context.getImageData(0, 0, target.width, target.height),
          options.quality
        )
      : await encodeCanvas(canvas, targetType, options, signal);

  const output = new File([blob], renameForType(file.name, targetType), {
    type: targetType,
    lastModified: file.lastModified,
  });

  return finalizeOutcome(original, file, output, target, lut !== undefined);
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

  // A reference whose table is gone — a reload, a cleared session — grades
  // nothing rather than failing the image. `coerceImageOptions` already drops
  // those on load, so reaching here means the LUT was removed mid-batch.
  const lut = options.lut ? getLutTable(options.lut.id) : undefined;

  if (targetType === "image/avif" || lut) {
    // The canvas path is one step from the caller's point of view, so there is
    // no meaningful progress to report between its ends.
    onProgress?.(0);
    const outcome = await compressOnCanvas(
      original,
      file,
      source,
      options,
      targetType,
      lut,
      options.lut?.intensity ?? 1,
      signal
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
  //
  // A graded image never reaches this line: a LUT routes the job to the canvas
  // path above, where the round trip through raw pixels drops every marker the
  // file had. The settings panel says so rather than leaving the user to
  // discover it — see `ImageSettings`.
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
