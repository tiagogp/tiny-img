/**
 * `canvas.convertToBlob({ type: "image/avif" })` only encodes AVIF natively in
 * Chrome 124+ — Firefox and Safari silently fall back to PNG, which would make
 * "AVIF output" a broken promise on two of three browser engines. This wraps
 * jSquash's WASM encoder (libavif under Apache-2.0) instead, so the output is
 * real AVIF everywhere.
 */

interface AvifEncodeOptions {
  quality: number;
  qualityAlpha: number;
  denoiseLevel: number;
  tileRowsLog2: number;
  tileColsLog2: number;
  speed: number;
  subsample: number;
  chromaDeltaQ: boolean;
  sharpness: number;
  enableSharpYUV: boolean;
  tune: number;
  bitDepth: number;
}

/** Mirrors jSquash's own `defaultOptions`, minus `quality` (set per call) and
 *  `lossless` (not exposed in this UI). */
const BASE_ENCODE_OPTIONS: Omit<AvifEncodeOptions, "quality"> = {
  qualityAlpha: -1,
  denoiseLevel: 0,
  tileColsLog2: 0,
  tileRowsLog2: 0,
  speed: 6,
  subsample: 1,
  chromaDeltaQ: false,
  sharpness: 0,
  tune: 0,
  enableSharpYUV: false,
  bitDepth: 8,
};

interface AvifEncoderModule {
  encode(
    data: Uint8Array,
    width: number,
    height: number,
    options: AvifEncodeOptions
  ): Uint8Array | null;
}

type AvifModuleFactory = (
  options?: Record<string, unknown>
) => Promise<AvifEncoderModule>;

let modulePromise: Promise<AvifEncoderModule> | null = null;

/**
 * Loaded only the first time AVIF output is actually selected, from our own
 * self-hosted copy — every JPEG/PNG/WebP job never pays for this WASM
 * encoder. `avif_enc.wasm` sits next to `avif_enc.js` in `public/vendor/avif/`
 * — the emscripten glue derives its URL from its own `import.meta.url`, so no
 * extra `locateFile` wiring is needed here. Only the single-threaded build is
 * vendored; the multithreaded one needs `SharedArrayBuffer`, which needs
 * COOP/COEP headers this app doesn't set (§5 of the roadmap).
 */
function loadAvifEncoder(): Promise<AvifEncoderModule> {
  if (!modulePromise) {
    // Widened to `string` so TypeScript treats this as a fully dynamic
    // specifier rather than trying to resolve `/vendor/...` as a module on
    // disk — it only exists at runtime, copied into `public/` by
    // `scripts/vendor-assets.mjs`. `webpackIgnore` does the equivalent for
    // the bundler.
    const url: string = "/vendor/avif/avif_enc.js";

    modulePromise = import(/* webpackIgnore: true */ url).then((imported) =>
      (imported.default as AvifModuleFactory)({ noInitialRun: true })
    );
  }

  return modulePromise;
}

/** `quality` is 0.1–1, matching the rest of `ImageOptions` — jSquash's own
 *  scale is 0–100. */
export async function encodeAvif(
  imageData: ImageData,
  quality: number
): Promise<Blob> {
  const encoder = await loadAvifEncoder();

  const output = encoder.encode(
    new Uint8Array(imageData.data.buffer),
    imageData.width,
    imageData.height,
    { ...BASE_ENCODE_OPTIONS, quality: Math.round(quality * 100) }
  );

  if (!output) {
    throw new Error("AVIF encoding failed for an unknown reason.");
  }

  // Re-wrapped rather than passed straight through: the encoder's return type
  // allows a `SharedArrayBuffer`-backed view, which `BlobPart` rejects even
  // though this particular one never is. Copying into a fresh `Uint8Array`
  // guarantees a plain `ArrayBuffer` underneath.
  return new Blob([new Uint8Array(output)], { type: "image/avif" });
}
