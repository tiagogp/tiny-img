/**
 * Adobe Cube LUT (`.cube`) parsing.
 *
 * The format is plain text: a few keyword lines, then one RGB triple per line.
 * No dependency is warranted for ~100 lines of it, and a hand-written parser is
 * the only way to produce the errors below — a library that throws
 * `Unexpected token` at line 4000 tells the user nothing about the file they
 * just dropped.
 *
 * Nothing here touches the DOM or a canvas: a LUT is data, and `render.ts` is
 * the only module that knows how to put it on pixels.
 */

/** Spec allows 2–256. Capped lower because a 256³ table is 50M floats — every
 *  real-world LUT is 17, 25, 32, 33, 64 or 65. */
const MAX_3D_SIZE = 144;
const MIN_SIZE = 2;
/** A 1D LUT is three curves, so a large one is cheap — but not unbounded. */
const MAX_1D_SIZE = 65536;

export interface CubeLut {
  /** From `TITLE`, else the file name. Shown in the UI, never parsed further. */
  title: string;
  /** 1 = three independent per-channel curves. 3 = a colour cube. */
  dimensions: 1 | 3;
  /** Nodes per axis. */
  size: number;
  /**
   * RGB triples, red varying fastest: index `(r + g * size + b * size²) * 3`
   * for a cube, `i * 3` for a curve. Values are as written in the file —
   * a LUT may legitimately go outside 0–1, and clamping is the renderer's
   * decision, not the parser's.
   */
  data: Float32Array;
  /** `DOMAIN_MIN` / `DOMAIN_MAX`, defaulting to 0 and 1 per the spec. */
  domainMin: [number, number, number];
  domainMax: [number, number, number];
}

/** Thrown for anything a person could fix by picking a different file. */
export class CubeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CubeParseError";
  }
}

const CUBE_EXTENSION = /\.cube$/i;

export const isCubeFile = (file: File) => CUBE_EXTENSION.test(file.name);

/** `TITLE "Kodak 2383"` — quoted per the spec, but unquoted in the wild. */
function parseTitle(rest: string): string {
  const trimmed = rest.trim();
  const quoted = trimmed.match(/^"(.*)"$/);

  return quoted ? quoted[1] : trimmed;
}

function parseTriple(parts: string[], keyword: string): [number, number, number] {
  if (parts.length !== 3) {
    throw new CubeParseError(`${keyword} needs three numbers.`);
  }

  const values = parts.map(Number);

  if (values.some((value) => !Number.isFinite(value))) {
    throw new CubeParseError(`${keyword} has a value that is not a number.`);
  }

  return [values[0], values[1], values[2]];
}

function parseSize(parts: string[], keyword: string, max: number): number {
  const size = Number(parts[0]);

  if (!Number.isInteger(size) || size < MIN_SIZE || size > max) {
    throw new CubeParseError(
      `${keyword} must be a whole number between ${MIN_SIZE} and ${max}.`
    );
  }

  return size;
}

/**
 * `fallbackTitle` is the file name: a LUT with no `TITLE` line is still a thing
 * the user has to recognise in a list.
 */
export function parseCube(text: string, fallbackTitle: string): CubeLut {
  // A UTF-8 BOM ahead of `TITLE` makes the keyword unrecognisable.
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);

  let title = "";
  let dimensions: 1 | 3 | undefined;
  let size = 0;
  let data: Float32Array | undefined;
  let written = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];

  for (let index = 0; index < lines.length; index += 1) {
    // Comments run to the end of the line, and a data line may carry one.
    const line = lines[index].split("#")[0].trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    const keyword = parts[0].toUpperCase();

    if (keyword === "TITLE") {
      title = parseTitle(line.slice(parts[0].length));
      continue;
    }

    if (keyword === "DOMAIN_MIN") {
      domainMin = parseTriple(parts.slice(1), "DOMAIN_MIN");
      continue;
    }

    if (keyword === "DOMAIN_MAX") {
      domainMax = parseTriple(parts.slice(1), "DOMAIN_MAX");
      continue;
    }

    if (keyword === "LUT_3D_SIZE" || keyword === "LUT_1D_SIZE") {
      if (dimensions) {
        throw new CubeParseError(
          "This file declares its size twice — a .cube is either 1D or 3D, not both."
        );
      }

      dimensions = keyword === "LUT_3D_SIZE" ? 3 : 1;
      size = parseSize(
        parts.slice(1),
        keyword,
        dimensions === 3 ? MAX_3D_SIZE : MAX_1D_SIZE
      );
      data = new Float32Array((dimensions === 3 ? size ** 3 : size) * 3);
      continue;
    }

    // Some exporters emit keywords this parser has no use for (LUT_3D_INPUT_RANGE
    // and friends). Skipping them silently is right; a stray *word* among the
    // data is not, so anything non-numeric that is not a known keyword fails.
    if (/^[A-Z_][A-Z0-9_]*$/i.test(parts[0])) continue;

    if (!data) {
      throw new CubeParseError(
        "The table starts before LUT_1D_SIZE or LUT_3D_SIZE says how big it is."
      );
    }

    if (parts.length !== 3) {
      throw new CubeParseError(
        `Line ${index + 1} has ${parts.length} values — every table row is three numbers.`
      );
    }

    if (written + 3 > data.length) {
      throw new CubeParseError(
        `This ${size}-point LUT has more rows than its size allows.`
      );
    }

    for (const part of parts) {
      const value = Number(part);

      if (!Number.isFinite(value)) {
        throw new CubeParseError(`Line ${index + 1} has a value that is not a number.`);
      }

      data[written] = value;
      written += 1;
    }
  }

  if (!dimensions || !data) {
    throw new CubeParseError(
      "No LUT_1D_SIZE or LUT_3D_SIZE line — this does not look like a .cube file."
    );
  }

  if (written !== data.length) {
    throw new CubeParseError(
      `This ${size}-point LUT is incomplete: ${written / 3} of ${
        data.length / 3
      } rows.`
    );
  }

  if (domainMax.some((max, axis) => max <= domainMin[axis])) {
    throw new CubeParseError("DOMAIN_MAX must be greater than DOMAIN_MIN.");
  }

  return {
    title: title || fallbackTitle,
    dimensions,
    size,
    data,
    domainMin,
    domainMax,
  };
}

/** Reads and parses a dropped file. Rejects with a `CubeParseError`. */
export async function readCubeFile(file: File): Promise<CubeLut> {
  const text = await file.text();

  return parseCube(text, file.name.replace(CUBE_EXTENSION, ""));
}

/** `33-point cube` / `1024-point curve`, for the chip beside the LUT's name. */
export const describeCubeLut = (lut: CubeLut) =>
  `${lut.size}-point ${lut.dimensions === 3 ? "cube" : "curve"}`;
