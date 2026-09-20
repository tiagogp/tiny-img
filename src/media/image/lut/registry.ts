/**
 * Where the loaded LUT tables live for the length of a session.
 *
 * `ImageOptions` carries only a *reference* to a LUT — an id, a name and an
 * intensity — never the table. Two reasons, both hard:
 *
 * 1. Settings are persisted by `JSON.stringify`. A 33-point cube is ~108k
 *    floats; serialised it is megabytes, which blows the `localStorage` quota
 *    and takes every other setting down with it, silently, inside the existing
 *    try/catch.
 * 2. Options are compared with `isSame` on every render to decide whether the
 *    queue is dirty. Comparing a reference is O(1); comparing tables is not.
 *
 * The consequence is deliberate and worth stating: a LUT does not survive a
 * reload. `coerceImageOptions` drops a reference whose table is gone, so a
 * returning user sees "no LUT" rather than a name that grades nothing.
 */

import type { CubeLut } from "./cube";

const TABLES = new Map<string, CubeLut>();

let counter = 0;

/** What `ImageOptions` actually holds. Plain, small, serialisable. */
export interface LutSelection {
  id: string;
  /** The LUT's own title, for the summary line and the settings panel. */
  name: string;
  /** 0–1, a linear mix back toward the ungraded image. */
  intensity: number;
}

/**
 * Takes ownership of a parsed LUT and returns the selection that refers to it.
 * Re-registering an identical file makes a second entry; that is fine, the
 * table is small next to the photos and the session is the lifetime.
 */
export function registerLut(lut: CubeLut, intensity = 1): LutSelection {
  counter += 1;
  const id = `lut-${counter}`;
  TABLES.set(id, lut);

  return { id, name: lut.title, intensity };
}

/** `undefined` once the session that registered it is gone — see the note above. */
export const getLutTable = (id: string) => TABLES.get(id);

export const hasLutTable = (id: string) => TABLES.has(id);

/** Called when the user removes a LUT, so a long session does not accumulate
 *  every cube that was ever tried. */
export function forgetLut(id: string) {
  TABLES.delete(id);
}
