// Re-encodes assets/poster.png into the responsive AVIF/WebP set the drop panel
// loads from /public/artwork. The derived files are committed so a plain
// `next build` needs no image toolchain; run this only when the source changes.
//
//   node scripts/build-artwork.mjs
//
// `sharp` is not a project dependency — it is pulled on demand, since this runs
// once per artwork change and not on every install.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "assets", "poster.png");
const targetDir = join(root, "public", "artwork");

/** The panel is half the container on desktop and full width below it, so the
 *  largest useful render is ~1312px at 2x. 1672 is the source width. */
const WIDTHS = [800, 1312, 1672];

/** Quality is per-format: AVIF holds up far lower than WebP at the same look. */
const FORMATS = [
  { extension: "avif", quality: 55 },
  { extension: "webp", quality: 82 },
];

mkdirSync(targetDir, { recursive: true });

for (const width of WIDTHS) {
  for (const { extension, quality } of FORMATS) {
    const output = join(targetDir, `poster-${width}.${extension}`);

    execFileSync(
      "npx",
      [
        "--yes",
        "sharp-cli@5",
        "--input",
        source,
        "--output",
        output,
        "--format",
        extension,
        "--quality",
        String(quality),
        "resize",
        String(width),
      ],
      { stdio: "ignore" }
    );

    console.log(`poster-${width}.${extension}`);
  }
}

console.log(`wrote ${WIDTHS.length * FORMATS.length} files -> public/artwork/`);
