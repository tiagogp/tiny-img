# Roadmap — from TinyImg to TinyMedia

**Status:** direction agreed, phase 1 not started.
**Companion documents:** [`DESIGN.md`](./DESIGN.md) owns every visual rule referenced here.

---

## 0. What this document is

TinyImg compresses JPEG, PNG and WebP entirely in the browser. This document
plans the extension of that same promise — *nothing is uploaded* — to **audio and
video**, and specifies the UX and UI changes required to get there without
breaking the tool that already works.

It is a plan, not a record. Sections 1–5 are the product and technical
direction; section 6 is the interface specification; section 7 is the delivery
order.

---

## 1. Positioning

The differentiator was never the compression. Dozens of tools compress an image.
The differentiator is that **the file never leaves the device** — no upload, no
account, no queue on someone else's server, no retention policy to read.

That promise generalises far better than the current name does. `TinyImg` is a
ceiling: the moment an MP4 is accepted, the name is lying about the product.

**New positioning:**

> **TinyMedia — convert and compress media in your browser. Nothing is uploaded.**

**In scope:** conversion and compression. Format in, format out, with the knobs
that decide size and quality.

**Out of scope, deliberately:** editing. No timeline, no filters, no captions, no
overlays. A converter that stays a converter can be excellent; a converter
drifting toward an editor is a worse version of both.

**What does not change:** no backend, no account, no analytics touching file
contents, and closing the tab as the entire cleanup story.

The rename is planned in §7, not executed yet — see the checklist there.

---

## 2. Capability matrix

| Kind | Inputs | Outputs | Technology |
|---|---|---|---|
| **Image** | JPEG, PNG, WebP, HEIC/HEIF, AVIF | JPEG, PNG, WebP, AVIF | Canvas via `browser-image-compression`; WASM decoders for HEIC and AVIF |
| **Audio** | MP3, WAV, M4A/AAC, Ogg/Opus, FLAC, plus the audio track of any accepted video | MP3, WAV, AAC, Opus, FLAC | WebCodecs where available; FFmpeg WASM as the fallback and for MP3 |
| **Video** | MP4, WebM, MOV | MP4, WebM | WebCodecs + a muxer on the fast path; FFmpeg WASM fallback |

Two constraints shape every decision downstream:

1. **WebCodecs encodes and decodes, but does not mux.** It can use hardware
   acceleration and runs in a Dedicated Worker, but it hands back raw frames and
   chunks — assembling an MP4 or WebM requires a separate muxer/demuxer. It also
   has **no MP3 encoder**, so MP3 output always needs an additional library.
   ([MDN — WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API))
2. **FFmpeg.wasm covers all of it, in a worker, in the browser**
   ([docs](https://ffmpegwasm.netlify.app/docs/overview/)) — but it is
   considerably slower and more memory-hungry than native FFmpeg, and the
   multithreaded build is the heaviest of all
   ([benchmarks](https://ffmpegwasm.netlify.app/docs/performance/)).

So: WebCodecs is the fast path where it exists, FFmpeg is the correctness floor,
and neither is a reason to pretend a phone can transcode a 4K feature film.

---

## 3. Feature set

### 3.1 Image

- JPEG, PNG and WebP — everything that works today, unchanged.
- **HEIC/HEIF → JPEG or WebP.** The single highest-value addition: every iPhone
  photo is a file most tools refuse.
- **AVIF output.**
- Strip or preserve EXIF, as an explicit choice.
- Exact dimensions, and generating several sizes from one source.

### 3.2 Audio

- MP3 ↔ WAV.
- MP3/WAV → AAC, Opus, FLAC.
- Bitrate: 64, 128, 192, 256, 320 kbps.
- Trim the start and the end.
- Normalise volume.
- Extract the audio track from a video.

### 3.3 Video

- MP4 ↔ WebM.
- Downscale to 1080p, 720p, 480p.
- Choose a quality level **or** an approximate target size.
- Remove the audio track.
- Extract audio as MP3.
- Trim a range.

### 3.4 Deliberately deferred

**GIF output.** Popular, but heavy to produce and it hands the user a file larger
than the video it came from. It belongs after the core is solid, if at all.
Presets, saved profiles and batch recipes are also later — they are worth
building once the underlying options have stopped moving.

---

## 4. Architecture

### 4.1 What already generalises

The queue in [`src/components/Dropzone/index.tsx`](./src/components/Dropzone/index.tsx)
is not an image component. `drain()` owns a worker pool, a `Map` of
`AbortController`s, a `runIdRef` staleness epoch, `requestAnimationFrame`-batched
progress, and pause/resume/retry. None of that knows or cares what a file is.

Exactly **one line** is image-specific — the `compressImage(...)` call inside
`drain()`. That line is the seam.

### 4.2 The media layer

A new directory, with no React and no DOM-framework dependency:

```
src/media/
├── types.ts          MediaKind, MediaEngine, MediaProbe, MediaOutcome, option unions
├── registry.ts       detectKind(file), getEngine(kind), per-kind limits and concurrency
├── image/engine.ts   wraps the existing compressImage.ts, unchanged
├── audio/engine.ts
├── video/engine.ts   WebCodecs fast path, FFmpeg fallback
└── ffmpeg/client.ts  lazy singleton: loads once, owns the worker, maps progress, aborts
```

```ts
type MediaKind = "image" | "audio" | "video";

interface MediaEngine<O> {
  kind: MediaKind;
  /** MIME types this engine accepts. */
  accepts: string[];
  /** Per-kind, not one global 100 MB. */
  maxBytes: number;
  /** Pool slots. image: 8, audio: 2, video: 1. */
  concurrency: number;
  defaults: O;
  /** Dimensions, duration, codec, bitrate — read before anything is encoded. */
  probe(file: File): Promise<MediaProbe>;
  /** What this job will cost, so the UI can say so before starting it. */
  estimate(probe: MediaProbe, options: O): CostEstimate; // { seconds, memoryMB }
  run(file: File, options: O, handlers: EngineHandlers): Promise<MediaOutcome>;
}

interface EngineHandlers {
  signal: AbortSignal;
  onProgress(value: number): void;
  onStage(stage: "loading-engine" | "probing" | "converting" | "muxing"): void;
}
```

`MediaOutcome` generalises today's `CompressionOutcome`: `file`, `originalSize`
and `unchanged` stay where they are; the four dimension fields move into
`meta` / `originalMeta`, which also carry optional `duration`, `bitrate` and
`codec`. Video reuses the dimensions, audio simply has none.

### 4.3 Integration points

| # | Where | Change |
|---|---|---|
| 1 | The `compressImage(...)` call in `drain()` | becomes `getEngine(item.kind).run(...)` — the only change inside the pool |
| 2 | `getConcurrency()` | currently `clamp(hardwareConcurrency, 1, 8)`; becomes a per-kind slot budget so a video job never gets eight instances |
| 3 | [`src/utils/settingsStorage.ts`](./src/utils/settingsStorage.ts) | key `tinyimg:settings:v2`, shape `{ image, audio, video }`, per-kind `coerce()`, and a v1 → `v2.image` migration |
| 4 | [`src/utils/verifyFile.ts`](./src/utils/verifyFile.ts) | `VALID_TYPES` and `MAX_FILE_SIZE` become per-kind lookups from the registry; `describeRejections` builds its copy from that registry instead of the hardcoded *"not a JPEG, PNG or WebP"* and *"over 100 MB"* |

Everything else in the Dropzone — drag handling, the notice slot, the batch
progress rule, the zip download — survives untouched.

### 4.4 What stays image-only

`ComparePreview.tsx` is a split-screen pixel zoom. A clip-path seam over a
waveform means nothing, and pixel-peeping a video frame is the wrong question.
Time-based media gets its own comparison surface (§6.6) rather than a
generalised one that serves neither well.

---

## 5. Engineering constraints

A list of things that must remain true. Each one is a way the project could
quietly stop being what it claims to be.

- **FFmpeg loads only on the first audio or video job.** Never at page load,
  never in the initial bundle. An image user must never pay for a video feature.
- **WASM assets are self-hosted** in `public/vendor/`, following the existing
  `scripts/vendor-image-compression.mjs` pattern. Pulling a codec from a CDN
  reintroduces the third party the whole product exists to avoid.
- **Single-threaded FFmpeg first.** No `SharedArrayBuffer`, so no COOP/COEP
  headers needed. Multithreading is a later, explicit step that adds `headers()`
  to [`next.config.js`](./next.config.js) — safe here, since every asset is
  same-origin and `next/font` self-hosts, but it is a deployment change and
  should be treated as one.
- **One video at a time.** Images keep the wide pool.
- **Do not copy the file** between React, the worker and the WASM filesystem.
  Transfer; don't clone. A 2 GB video cloned twice is three copies of a 2 GB video.
- **Cancelling must free the WASM heap**, not merely reject a promise.
- **Warn before the tab closes** while a job is running.
- **Review codec licensing** in whichever FFmpeg build ships — x264 and x265 in
  particular.

---

## 6. UX and UI specification

**The governing rule: the three-step flow does not change.** Drop → Tune →
Download stays exactly as it is. The media kind is *detected*, never chosen up
front. No format tabs, no "what would you like to convert today" gate — the user
drops a file and the tool works out what it is.

### 6.1 Drop panel

- Heading: **"Drop your files here"**.
- Body: *"Images, audio and video, read straight from disk."*
- The monospace limits line becomes per-kind and stays literally true —
  `100 images · 100 MB · audio 500 MB · one video at a time · 2 GB`.
- The `accept` attribute is generated from the registry, not hand-maintained.

Artwork, drag states, the window-level drop target and the `.drop-*` CSS are
untouched. This is a copy change plus one generated attribute.

### 6.2 Adaptive settings panel

`CompressionSettings.tsx` splits into a shell — `OutputSettings` — plus
`ImageSettings`, `AudioSettings` and `VideoSettings`.

| Queue state | Panel shows |
|---|---|
| Empty | the image panel, with the caption *"Settings adapt to what you drop."* |
| One kind | that kind's panel only |
| Mixed | the present kinds stacked, each with its own heading and summary line |

The collapsed one-liner — the rule that makes the panel honest when closed —
becomes one line per present kind:

```
Images · WebP · 80% quality · original size
Video  · MP4 · 1080p · balanced
```

`Apply to all images` becomes **`Apply to all files`**. The dirty/applied
semantics, the warning colour on unapplied changes, and the full-batch re-run are
unchanged.

New controls, all built from the existing `Tag`, `Button` and the
`fieldLabel` / `helpText` / `numberInput` class constants already in the file —
**no new primitives**:

- **Audio:** output format tags · bitrate tags (64/128/192/256/320) · trim start
  and end · normalise toggle.
- **Video:** output format tags · resolution tags (the existing
  `RESOLUTION_PRESETS` already has 4K/1440p/1080p/720p/480p) · quality *or*
  target size · remove audio · extract MP3 · trim range.

### 6.3 Auto-start versus explicit start

This is the one genuine flow change.

Today the queue starts implicitly on drop, and for images that is right — the
work is over before a Start button could be found. Auto-starting a ten-minute
encode on someone's phone is a different act entirely.

- **Images and audio:** keep auto-start.
- **Video:** the row lands in a `ready` state showing the probe result and the
  cost estimate, with an explicit **Convert** action per row and for the batch.

> 1080p · 00:02:14 · about 3 min, ~600 MB of memory

That sentence is the feature. It is the difference between a tool that respects
the device and one that discovers its limits on the user's behalf.

### 6.4 Queue row

- **Kind-aware media slot.** Images keep `useThumbnail`. Video gets a poster
  frame — `<video>`, seek to 1s, draw to canvas — reusing the existing
  `MAX_DECODES = 2` semaphore so poster extraction cannot swamp the main thread.
  Audio gets a duration tile.
- **Metadata line per kind:** `1200×800` · `1080p · 00:02:14` · `03:41 · 192 kbps`.
- **New statuses**, on top of the four that exist:
  - `Ready — about 3 min` (video, before start)
  - `Preparing engine…` (first FFmpeg load)
  - `Waiting — one video at a time`
- **Progress gains a stage label.** A bar that sits at 0% for twenty seconds
  during a WASM download reads as broken; a bar labelled *Preparing engine* reads
  as working.

### 6.5 Engine-loading notice

The first audio or video job posts a one-time message into the existing `notice`
slot — same warning surface, same dismiss affordance:

> Preparing the media engine — a one-time ~30 MB download that stays on your device.

Saying *stays on your device* here is not decoration. A sudden 30 MB download in
a tool that promises no network activity needs an explanation in the same breath.

### 6.6 Compare surfaces

`ComparePreview.tsx` stays exactly as it is, image-only.

A new `CompareMedia.tsx` reuses its shell — native `<dialog>` + `showModal()`,
close-through-`dialog.close()` so focus returns correctly, `useObjectUrl` for
both blobs — but replaces the seam with an **A/B toggle sharing one playhead**:
two stacked `<video>` elements, or two `<audio>` elements with a level meter.

Explicitly **not** a split slider. A vertical seam through a waveform compares
nothing; switching sources at the same timestamp is how anyone actually judges
whether a conversion held up.

### 6.7 Downloads

The zip filename follows the rebrand. `renameForType()` extends to audio and
video extensions. `uniqueName()` and `downloadBlob()` need no changes.

### 6.8 Marketing copy

The accepted-format list currently appears in five places: `verifyFile.ts`, the
drop panel, `page.tsx` (both the hero lede and the `STEPS` array),
`layout.tsx` metadata, and the README. Phase 1 gives it one source of truth.

The privacy section needs particular attention — it currently credits *"the
Canvas and Web Worker APIs"*, which stops being the whole truth the moment
WebCodecs and WebAssembly are involved. The claim it makes ("no upload endpoint,
no account, no analytics on your files") stays true, and the mechanism named
alongside it should stay accurate.

### 6.9 Accessibility and motion

- `role="status"` announcements must **not** fire on every animation frame. For a
  three-minute encode that is a screen reader talking continuously. Throttle to
  stage changes and 10% steps.
- The new dialog follows `DESIGN.md` §9.13 (modal).
- `prefers-reduced-motion` is already handled globally (§12.10); nothing new opts out.
- Every new control keeps the 44px touch target from `DESIGN.md` §12.6.

---

## 7. Delivery sequence

| Phase | Content | User-visible |
|---|---|---|
| **0** | This document | — |
| **1** | Media layer and engine interface; extract the image engine; settings `v2`; generalise `verifyFile` | No |
| **2** | Image expansion: HEIC in, AVIF out, EXIF toggle, multiple sizes | Yes |
| **—** | **Rebrand to TinyMedia** | Yes |
| **3** | Audio: lazy FFmpeg client, MP3/WAV/AAC/Opus/FLAC, bitrate, trim, extract from video | Yes |
| **4** | Video: MP4/WebM, resolution, quality or target size, remove audio, extract MP3, trim | Yes |
| **5** | Advanced: presets, GIF, batch profiles, multithreaded FFmpeg with COOP/COEP | Yes |

Phase 1 ships no feature and changes nothing on screen. That is the point: the
seam gets opened while the only engine behind it is one that already works, so a
regression there is visible immediately rather than tangled up with a new codec.

**The rebrand lands between phases 2 and 3**, before audio ships — so the name
never lags the capability, and never over-promises one either.

Rebrand checklist:

- [ ] `layout.tsx` metadata — title, description, OpenGraph
- [ ] Hero headline, lede and `STEPS` copy in `page.tsx`
- [ ] Logos in `public/` (`logo-tinyimg-light-mode.png`, `logo-tinyimg-dark-mode.png`)
- [ ] OpenGraph and Twitter images, plus their `.alt.txt` files
- [ ] Zip filename (`tinyimg.zip`)
- [ ] `localStorage` key namespaces (`tinyimg:settings:*`, `tinyimg:theme:*`) — migrate, don't orphan
- [ ] README
- [ ] Repository name and any inbound links

---

## 8. Honest limits

The ceiling is the device, not the browser.

Images and audio are comfortable on essentially anything. Short video is fine.
Long video and 4K will be slow on a laptop and may exhaust memory on a phone —
FFmpeg.wasm is meaningfully slower than native FFmpeg and there is no version of
this architecture where that stops being true.

This is written down here so the interface can say it too. A tool that quietly
attempts a job it cannot finish spends the user's battery to arrive at a crashed
tab. A tool that says *"this will take about 12 minutes on this device"* and lets
them decide has told the truth, and is still the only tool that did it without
uploading anything.
