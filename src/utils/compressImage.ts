import imageCompression from "browser-image-compression";
import type { CompressionOptions } from "@/components/Dropzone/CompressionSettings";

/**
 * Self-hosted copy of the lib, vendored by `scripts/vendor-image-compression.mjs`.
 * The default value points at jsDelivr, which the worker fetches at runtime.
 */
const LIB_URL = "/vendor/browser-image-compression.js";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface Dimensions {
  width: number;
  height: number;
}

export interface CompressionOutcome {
  file: File;
  originalSize: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  /** Compressing made the file bigger, so the original was kept instead. */
  unchanged: boolean;
}

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

interface CompressImageHandlers {
  signal: AbortSignal;
  onProgress?(value: number): void;
}

/**
 * The library throws decoder and canvas errors verbatim, which say nothing to
 * someone holding a photo that will not open. Map the cases we can recognise
 * and keep the raw message as a last resort — "Failed" alone is unactionable.
 */
export function describeCompressionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

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

export async function compressImage(
  file: File,
  options: CompressionOptions,
  { signal, onProgress }: CompressImageHandlers
): Promise<CompressionOutcome> {
  const original = await getFileDimensions(file);
  const largestSide = Math.max(original.width, original.height);
  const shouldResize =
    options.maxDimension > 0 && options.maxDimension < largestSide;
  const targetType = options.format || file.type;

  const run = (preserveExif: boolean) =>
    imageCompression(file, {
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
  const canPreserveExif =
    file.type === "image/jpeg" && (!options.format || options.format === file.type);

  const compressed = await (canPreserveExif
    ? run(true).catch((error) => {
        if (signal.aborted) throw error;
        return run(false);
      })
    : run(false));

  // `preserveExif` re-wraps JPEGs into a plain Blob and loses `name`, so rebuild
  // the File rather than trusting what comes back. Converting formats also has
  // to rename the file, otherwise a WebP ships with a `.png` extension.
  const output = new File(
    [compressed],
    renameForType(file.name, targetType),
    { type: targetType, lastModified: file.lastModified }
  );

  // Re-encoding a PNG, or touching an already-optimised JPEG, routinely produces
  // a bigger file. Keep whichever one is actually smaller.
  if (output.size >= file.size) {
    return {
      file,
      originalSize: file.size,
      width: original.width,
      height: original.height,
      originalWidth: original.width,
      originalHeight: original.height,
      unchanged: true,
    };
  }

  // With a target size the lib may downscale further than we asked, so the only
  // reliable answer is to measure. Otherwise the resize is a single known step.
  const result =
    options.maxSizeMB > 0 && shouldResize
      ? await getFileDimensions(output)
      : predictDimensions(original, shouldResize ? options.maxDimension : 0);

  return {
    file: output,
    originalSize: file.size,
    width: result.width,
    height: result.height,
    originalWidth: original.width,
    originalHeight: original.height,
    unchanged: false,
  };
}
