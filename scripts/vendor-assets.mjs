// Copies third-party WASM/JS assets into /public so they load from our own
// origin instead of a CDN at runtime. Without this, each library bootstraps
// itself from jsdelivr/unpkg: it breaks offline, needs a third-party host in
// the CSP, and adds a network round-trip before the first job of that kind.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const vendorDir = join(dirname(new URL(import.meta.url).pathname), "..", "public", "vendor");

function copyTo(source, targetSubpath) {
  const target = join(vendorDir, targetSubpath);

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`vendored ${source} -> public/vendor/${targetSubpath}`);
}

function vendor(sourceModule, targetSubpath) {
  copyTo(require.resolve(sourceModule), targetSubpath);
}

vendor(
  "browser-image-compression/dist/browser-image-compression.js",
  "browser-image-compression.js"
);

// The bundle build inlines its .wasm as base64, so this one file is the
// entire self-hosted HEIC decoder — nothing else needs to sit alongside it.
vendor("libheif-js/libheif-wasm/libheif-bundle.mjs", "libheif-bundle.mjs");

// jSquash's AVIF encoder ships .js and .wasm as separate files that must stay
// next to each other: the emscripten glue derives the .wasm's URL from its
// own `import.meta.url`, so both go in the same vendored directory. Only the
// single-threaded build is vendored — the multithreaded one needs
// SharedArrayBuffer, which needs COOP/COEP headers we don't set yet (§5).
vendor("@jsquash/avif/codec/enc/avif_enc.js", "avif/avif_enc.js");
vendor("@jsquash/avif/codec/enc/avif_enc.wasm", "avif/avif_enc.wasm");

// FFmpeg WASM, for audio (and later video). Only the single-threaded core is
// vendored, for the same SharedArrayBuffer/COOP/COEP reason as AVIF above.
//
// The .js here is the *ESM* build specifically, not the UMD one: `@ffmpeg/
// ffmpeg`'s worker only ever loads a core via `import()` when running as a
// module worker (which it always is — see below), and only the ESM build has
// a real `export default` for that dynamic import to resolve. `@ffmpeg/core`'s
// own `exports` map only exposes the UMD path to a plain `require.resolve`
// (the "import" condition isn't reachable from CJS), so the ESM sibling is
// found by walking sideways from the UMD entry instead.
{
  const umdEntry = require.resolve("@ffmpeg/core");
  const esmDir = join(dirname(umdEntry), "..", "esm");

  copyTo(join(esmDir, "ffmpeg-core.js"), "ffmpeg/ffmpeg-core.js");
  copyTo(join(esmDir, "ffmpeg-core.wasm"), "ffmpeg/ffmpeg-core.wasm");
}

// `@ffmpeg/ffmpeg` always constructs its worker with `{ type: "module" }`, so
// the worker script is vendored verbatim (unbundled — it's plain ESM with no
// build step of its own) rather than left to load from jsDelivr via the
// package's default `classWorkerURL`. Its own `./const.js` and `./errors.js`
// imports resolve relative to wherever it's served from, so those two travel
// with it — neither has an `exports` entry of its own, so they're found
// beside the one subpath (`./worker`) that does.
{
  const workerEntry = require.resolve("@ffmpeg/ffmpeg/worker");
  const esmDir = dirname(workerEntry);

  copyTo(workerEntry, "ffmpeg/worker.js");
  copyTo(join(esmDir, "const.js"), "ffmpeg/const.js");
  copyTo(join(esmDir, "errors.js"), "ffmpeg/errors.js");
}
