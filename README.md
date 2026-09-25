# TinyMedia

Convert and compress images and audio **in the browser**. No uploads, no account, no
queue — files are read straight from disk, processed on the user's own device, and
never leave the tab.

There is no upload endpoint in this project because there is no server side to it: the
whole pipeline runs through Canvas, Web Audio and WebAssembly.

## Features

### Images

- **JPEG, PNG, WebP, HEIC/HEIF in — JPEG, PNG, WebP, AVIF out.** Every iPhone photo is
  a file most tools refuse; HEIC decodes through a self-hosted `libheif` build, AVIF
  encodes through a self-hosted `jSquash`/`libavif` build.
- **Batch compression** — up to 100 images, up to 100 MB each, processed by a worker
  pool sized to `navigator.hardwareConcurrency` (capped at 8).
- **Compare before you commit** — preview each result against its original, with the
  size and resolution delta.
- **Real controls** — quality, output format, maximum resolution, an optional target
  size, extra sizes generated alongside the main output, and an explicit EXIF
  keep/strip choice.
- **Never larger** — if re-encoding produces a bigger file, the original is kept and
  the item is marked unchanged.

### Audio

- **MP3, WAV, AAC, Ogg/Opus, FLAC in and out**, converted through a self-hosted,
  single-threaded FFmpeg WASM build — loaded only the first time an audio file is
  actually dropped, so an image-only visit never pays for it.
- **Bitrate, trim and normalize** — 64–320 kbps, cut the start and end, even out
  loudness with a single-pass `loudnorm`.
- **Never larger** — a file with nothing to change (original format, no trim, no
  normalize) skips the engine entirely and is returned unchanged.

### Both kinds

- **Settings are remembered** across visits (`localStorage`, validated field by
  field), independently per kind.
- **Download one at a time or the whole set as a zip**, every file keeping its name.
- **Light and dark themes**, applied before first paint so there is no flash.

## Requirements

- Node.js 20+
- [Yarn](https://yarnpkg.com) 4 via Corepack (`corepack enable`; see `packageManager` in [package.json](package.json))

## Getting started

```bash
yarn install
yarn dev
```

Open <http://localhost:3000>.

`predev`/`prebuild` run the `vendor` script automatically — see
[Vendored assets](#vendored-assets) below.

## Scripts

| Script | What it does |
| --- | --- |
| `yarn dev` | Next.js dev server |
| `yarn build` | Production build |
| `yarn start` | Serve the production build |
| `yarn lint` | ESLint (`eslint-config-next`) |
| `yarn typecheck` | `tsc --noEmit` |
| `yarn vendor` | Copy the WASM/JS decoders and encoders into `public/vendor/` |
| `yarn artwork` | Re-encode `assets/poster.png` into the responsive AVIF/WebP set |

### Vendored assets

Several libraries bootstrap themselves from a CDN by default — that breaks offline,
needs a third-party host in the CSP, and adds a round-trip before the first job of
that kind. [`scripts/vendor-assets.mjs`](scripts/vendor-assets.mjs) copies each one
into `public/vendor/` instead, so everything loads from this app's own origin:
`browser-image-compression`, the `libheif` HEIC decoder, the `jSquash` AVIF encoder,
and the single-threaded FFmpeg WASM core (plus its module worker). It runs on
`predev` and `prebuild`, so you rarely call it directly.

Every one of these loads lazily, on the first job that actually needs it — an
image-only session never fetches the FFmpeg core, and a session that never touches
HEIC or AVIF never fetches those either.

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
│   ├── page.tsx         Hero + tool, how it works, privacy statement
│   ├── globals.css      Base layer and component classes
│   └── tokens.css       Design tokens (see DESIGN.md)
├── components/
│   ├── Dropzone/        The tool: queue, settings panels, compare preview
│   └── ui/               Button, IconButton, Tag, Image
├── media/                Kind-agnostic engine layer — no React, no DOM framework
│   ├── types.ts          MediaEngine, MediaOutcome, EngineHandlers
│   ├── registry.ts       detectKind(file), getEngine(kind), per-kind limits
│   ├── image/            HEIC/AVIF decode+encode, EXIF handling, compress.ts
│   ├── audio/             FFmpeg-backed convert/trim/normalize engine
│   └── ffmpeg/           Lazy FFmpeg WASM client shared by audio (and later video)
├── hooks/                useObjectUrl, useThumbnail
└── utils/                 verifyFile, settingsStorage, theme, formatDuration, …
```

Key entry points:

- [src/components/Dropzone/index.tsx](src/components/Dropzone/index.tsx) — the queue,
  the concurrency pool, and zip export. The pool is kind-agnostic; the only
  kind-specific line is the call into `getEngine(item.kind).run(...)`.
- [src/media/registry.ts](src/media/registry.ts) — the single list of engines this
  build actually has. The accepted-file list, the rejection copy, and the per-kind
  size caps all read from here.
- [src/utils/verifyFile.ts](src/utils/verifyFile.ts) — accepted types and limits, plus
  the copy explaining why a file was skipped.

See [ROADMAP.md](ROADMAP.md) for what's built, what's planned (video next), and the
reasoning behind the architecture.

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Absolute base for OG/Twitter image URLs. Falls back to `VERCEL_URL`, then `http://localhost:3000`. |

## Design system

Type, color, spacing and motion follow [DESIGN.md](DESIGN.md), the source of truth for
anything visual. Tokens live in [src/app/tokens.css](src/app/tokens.css).

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Motion ·
browser-image-compression · jSquash/AVIF · libheif-js · FFmpeg WASM · JSZip

## Browser support

Any modern browser with Canvas, Web Worker and WebAssembly support. `createImageBitmap`
is used to read image dimensions when available, with an `<img>` fallback otherwise.
