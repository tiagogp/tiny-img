// Copies third-party WASM/JS assets into /public so they load from our own
// origin instead of a CDN at runtime. Without this, each library bootstraps
// itself from jsdelivr/unpkg: it breaks offline, needs a third-party host in
// the CSP, and adds a network round-trip before the first job of that kind.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const vendorDir = join(dirname(new URL(import.meta.url).pathname), "..", "public", "vendor");

function vendor(sourceModule, targetSubpath) {
  const source = require.resolve(sourceModule);
  const target = join(vendorDir, targetSubpath);

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`vendored ${sourceModule} -> public/vendor/${targetSubpath}`);
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
