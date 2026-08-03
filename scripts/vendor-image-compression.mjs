// Copies the compression lib into /public so the web worker can `importScripts`
// it from our own origin. Without this, browser-image-compression bootstraps its
// worker from https://cdn.jsdelivr.net at runtime: it breaks offline, needs a
// third-party host in the CSP, and adds a network round-trip to the first image.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const source = require.resolve("browser-image-compression/dist/browser-image-compression.js");
const targetDir = join(dirname(new URL(import.meta.url).pathname), "..", "public", "vendor");

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, "browser-image-compression.js"));

console.log("vendored browser-image-compression -> public/vendor/");
