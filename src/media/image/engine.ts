import type { MediaEngine, MediaOutcome } from "../types";
import { compressImage, describeImageError, type ImageOutcome } from "./compress";
import {
  DEFAULT_IMAGE_OPTIONS,
  coerceImageOptions,
  isSameImageOptions,
  type ImageOptions,
} from "./options";

/** Cap the pool so a 16-core machine doesn't spawn 16 decoder workers at once. */
const MAX_IMAGE_CONCURRENCY = 8;

export const imageEngine: MediaEngine<ImageOptions> = {
  kind: "image",
  accepts: ["image/jpeg", "image/png", "image/webp"],
  formatsLabel: "JPEG, PNG or WebP",
  maxBytes: 100 * 1024 * 1024,
  concurrency: MAX_IMAGE_CONCURRENCY,
  defaults: DEFAULT_IMAGE_OPTIONS,
  coerce: coerceImageOptions,
  isSame: isSameImageOptions,
  describeError: describeImageError,
  run: compressImage,
};

/**
 * Narrows a queue result back to an image, for the surfaces that only make
 * sense for one — a pixel-zoom comparison, a `1200×800` line. Everything else
 * in the queue stays kind-agnostic.
 */
export const isImageOutcome = (
  outcome: MediaOutcome
): outcome is ImageOutcome => outcome.kind === "image";
