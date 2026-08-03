# TinyImg

Compress WebP, PNG and JPEG **in the browser**. No uploads, no account, no queue — files
are read straight from disk, compressed on the user's own device, and never leave the tab.

There is no upload endpoint in this project because there is no server side to it: the
whole pipeline runs through the Canvas and Web Worker APIs.

## Features

- **Batch compression** — up to 100 images, up to 100 MB each, processed by a worker pool
  sized to `navigator.hardwareConcurrency` (capped at 8).
- **Compare before you commit** — preview each result against its original, with the size
  and resolution delta.
- **Real controls** — quality, output format (WebP/JPEG/PNG or keep the original), maximum
  resolution, and an optional target size per image. Change them and re-run the whole
  batch without re-dropping anything.
- **Settings are remembered** across visits (`localStorage`, validated field by field).
- **Never larger** — if re-encoding produces a bigger file, the original is kept and the
  item is marked unchanged.
- **EXIF preserved** on JPEG→JPEG, with a single retry without metadata when the source
  has a malformed EXIF block.
- **Download one at a time or the whole set as a zip**, every file keeping its name.
- **Light and dark themes**, applied before first paint so there is no flash.

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io) 10 (see `packageManager` in [package.json](package.json))

## Getting started

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

`predev`/`prebuild` run the `vendor` script automatically — see
[Vendored worker](#vendored-worker) below.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint (`eslint-config-next`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm vendor` | Copy `browser-image-compression` into `public/vendor/` |
| `pnpm artwork` | Re-encode `assets/poster.png` into the responsive AVIF/WebP set |

### Vendored worker

`browser-image-compression` bootstraps its web worker from jsDelivr by default. That
breaks offline, requires a third-party host in the CSP, and adds a round-trip before the
first image. [`scripts/vendor-image-compression.mjs`](scripts/vendor-image-compression.mjs)
copies the library into `public/vendor/` so the worker loads from our own origin. It runs
on `predev` and `prebuild`, so you rarely call it directly.

### Artwork

[`scripts/build-artwork.mjs`](scripts/build-artwork.mjs) regenerates `public/artwork/`
from `assets/poster.png`. The derived files are committed, so a plain `next build` needs
no image toolchain — run this only when the source poster changes. It pulls `sharp` on
demand rather than carrying it as a dependency.

## Project structure

```
src/
├── app/
│   ├── layout.tsx      Fonts, metadata, theme boot script, page shell
│   ├── page.tsx        Hero + tool, how it works, privacy statement
│   ├── globals.css     Base layer and component classes
│   └── tokens.css      Design tokens (see DESIGN.md)
├── components/
│   ├── Dropzone/       The tool: queue, per-item state, settings, compare preview
│   └── ui/             Button, IconButton, Tag
├── hooks/              useObjectUrl, useThumbnail
└── utils/              compressImage, verifyFile, settingsStorage, theme, …
```

Key entry points:

- [src/components/Dropzone/index.tsx](src/components/Dropzone/index.tsx) — the queue, the
  concurrency pool, and zip export.
- [src/utils/compressImage.ts](src/utils/compressImage.ts) — a single compression run:
  resize prediction, EXIF fallback, size guard, error mapping.
- [src/utils/verifyFile.ts](src/utils/verifyFile.ts) — accepted types and limits, plus the
  copy explaining why a file was skipped.

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Absolute base for OG/Twitter image URLs. Falls back to `VERCEL_URL`, then `http://localhost:3000`. |

## Design system

Type, color, spacing and motion follow [DESIGN.md](DESIGN.md), the source of truth for
anything visual. Tokens live in [src/app/tokens.css](src/app/tokens.css).

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Motion ·
browser-image-compression · JSZip

## Browser support

Any modern browser with Canvas and Web Worker support. `createImageBitmap` is used to read
dimensions when available, with an `<img>` fallback otherwise.
