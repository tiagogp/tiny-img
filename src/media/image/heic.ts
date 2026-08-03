/** Safari reports a real MIME type for HEIC; most other browsers and OS file
 *  pickers report `""` or `application/octet-stream` instead — the extension
 *  check is what actually catches those. */
const HEIC_MIME_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
];
export const HEIC_EXTENSIONS = [".heic", ".heif"];

export const isHeicFile = (file: File) =>
  HEIC_MIME_TYPES.includes(file.type) ||
  HEIC_EXTENSIONS.some((extension) =>
    file.name.toLowerCase().endsWith(extension)
  );

/**
 * Mirrors the subset of libheif-js's runtime API this file calls. The package
 * ships type declarations for the raw wasm bindings underneath, but not for
 * this higher-level `HeifDecoder` wrapper — it only exists as JS at runtime.
 */
interface HeifImage {
  get_width(): number;
  get_height(): number;
  display(
    imageData: ImageData,
    callback: (result: ImageData | null) => void
  ): void;
}

interface HeifModule {
  HeifDecoder: new () => { decode(buffer: Uint8Array): HeifImage[] };
}

type HeifModuleFactory = (
  options?: Record<string, unknown>
) => Promise<HeifModule>;

let modulePromise: Promise<HeifModule> | null = null;

/**
 * Loaded only the first time a HEIC file is actually dropped, from our own
 * self-hosted copy — every other image job never pays for this ~1.4 MB
 * decoder. `webpackIgnore` keeps the bundler from trying to resolve a path
 * that only exists at runtime, in `public/`.
 */
function loadHeifModule(): Promise<HeifModule> {
  if (!modulePromise) {
    // Widened to `string` so TypeScript treats this as a fully dynamic
    // specifier rather than trying to resolve `/vendor/...` as a module on
    // disk — it only exists at runtime, copied into `public/` by
    // `scripts/vendor-assets.mjs`. `webpackIgnore` does the equivalent for
    // the bundler.
    const url: string = "/vendor/libheif-bundle.mjs";

    modulePromise = import(/* webpackIgnore: true */ url).then(
      (imported) => (imported.default as HeifModuleFactory)()
    );
  }

  return modulePromise;
}

/**
 * Decodes a HEIC/HEIF file to a plain JPEG `File`. Everything downstream —
 * resize, quality, target-format conversion, EXIF handling — then runs on
 * that JPEG exactly as it would on any other source, so this pre-step is the
 * only HEIC-specific code in the pipeline.
 */
export async function decodeHeic(file: File): Promise<File> {
  const libheif = await loadHeifModule();
  const buffer = new Uint8Array(await file.arrayBuffer());

  const decoder = new libheif.HeifDecoder();
  const image = decoder.decode(buffer)[0];

  if (!image) {
    throw new Error("This HEIC file has no image to decode.");
  }

  const width = image.get_width();
  const height = image.get_height();
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("The browser refused to read this image's pixels.");
  }

  const imageData = context.createImageData(width, height);

  await new Promise<void>((resolve, reject) => {
    image.display(imageData, (result) => {
      if (!result) {
        reject(new Error("This HEIC file could not be decoded."));
        return;
      }

      resolve();
    });
  });

  context.putImageData(imageData, 0, 0);
  const blob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: 0.92,
  });

  // `renameForType` in compress.ts strips whatever extension is here and
  // replaces it with the real output format's, so the original name is fine.
  return new File([blob], file.name, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
