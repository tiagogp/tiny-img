/**
 * The one LUT renderer the compression pipeline is allowed to use.
 *
 * The queue runs up to eight images at once, and each of them would otherwise
 * want a renderer of its own. Browsers cap how many live WebGL contexts a page
 * may hold — around sixteen, and the oldest are dropped without warning past
 * that — so a single batch of photos would start losing contexts mid-run. One
 * shared renderer, used under a lock, is the only arrangement that survives a
 * hundred-file queue.
 *
 * The lock also protects the renderer's own canvas, which is resized per image:
 * two jobs interleaving `setSource` and `draw` would each grade the other's
 * photo. Serialising the GPU step costs little — the draw is a single
 * full-screen pass, and the encode that follows it is where the time goes.
 */

import type { CubeLut } from "./cube";
import { createLutRenderer, type LutBackend, type LutRenderer } from "./render";

let renderer: LutRenderer | null = null;
let failed = false;

/** Promise chain, not a boolean: callers queue behind each other in arrival
 *  order rather than polling for a free slot. */
let tail: Promise<unknown> = Promise.resolve();

function ensureRenderer(): LutRenderer | null {
  if (renderer) return renderer;
  // A browser that could not build one a moment ago will not manage it now,
  // and retrying per image turns one failure into a hundred.
  if (failed) return null;

  try {
    renderer = createLutRenderer();
    return renderer;
  } catch {
    failed = true;
    return null;
  }
}

/**
 * Grades `source` and hands the result to `consume`, which must copy whatever
 * it needs out of the renderer's canvas *before returning* — the next job in
 * the queue resizes and overwrites it.
 *
 * Returns `null` when no backend could be created at all, which is the caller's
 * cue to carry on ungraded rather than fail the image.
 */
export async function withGradedCanvas<T>(
  source: ImageBitmap,
  lut: CubeLut,
  intensity: number,
  consume: (canvas: HTMLCanvasElement) => T | Promise<T>,
  brightness = 1
): Promise<T | null> {
  const run = tail.then(async () => {
    const active = ensureRenderer();
    if (!active) return null;

    active.setSource(source);
    active.setLut(lut);
    active.draw(intensity, brightness);

    return consume(active.canvas);
  });

  // The chain must not break on a rejection, or every later job inherits it.
  tail = run.catch(() => undefined);

  return run;
}

/** `null` until something has actually needed a renderer. Surfaced in the UI so
 *  a batch that is about to grade on the CPU can say so before it starts. */
export const lutBackend = (): LutBackend | null => renderer?.backend ?? null;

/** Lets a caller learn the backend without waiting for the first photo. */
export function probeLutBackend(): LutBackend | null {
  return ensureRenderer()?.backend ?? null;
}
