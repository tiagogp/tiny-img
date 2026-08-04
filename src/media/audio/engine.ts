import type { EngineHandlers, MediaEngine, MediaMeta, MediaOutcome } from "../types";
import { runFFmpeg } from "../ffmpeg/client";
import {
  AUDIO_FORMATS,
  DEFAULT_AUDIO_OPTIONS,
  coerceAudioOptions,
  isSameAudioOptions,
  type AudioFormat,
  type AudioOptions,
} from "./options";

/** Cap at 2: one shared WASM instance can only run one `exec()` at a time
 *  anyway (see `ffmpeg/client.ts`) — this just bounds how many rows sit
 *  "in flight" waiting their turn on it. */
const MAX_AUDIO_CONCURRENCY = 2;

const MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/ogg",
  "audio/opus",
  "audio/flac",
  "audio/x-flac",
];

/** Browsers and OS file pickers are as inconsistent about audio MIME types as
 *  they are about HEIC — the extension is what actually catches those. */
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac"];

export const isAudioFile = (file: File) =>
  MIME_TYPES.includes(file.type) ||
  AUDIO_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension));

interface FormatSpec {
  codec: string;
  extraArgs?: string[];
  extension: string;
  mime: string;
  /** wav/flac are lossless — a `-b:a` target has no meaning for either. */
  isLossy: boolean;
}

const FORMAT_SPECS: Record<Exclude<AudioFormat, "">, FormatSpec> = {
  mp3: { codec: "libmp3lame", extension: "mp3", mime: "audio/mpeg", isLossy: true },
  wav: { codec: "pcm_s16le", extension: "wav", mime: "audio/wav", isLossy: false },
  aac: {
    codec: "aac",
    extraArgs: ["-f", "adts"],
    extension: "aac",
    mime: "audio/aac",
    isLossy: true,
  },
  opus: { codec: "libopus", extension: "opus", mime: "audio/ogg", isLossy: true },
  flac: { codec: "flac", extension: "flac", mime: "audio/flac", isLossy: false },
};

export interface AudioMeta extends MediaMeta {
  duration: number;
}

export type AudioOutcome = MediaOutcome<AudioMeta>;

function extensionOf(name: string): string {
  const match = /\.([^./\\]+)$/.exec(name);
  return match ? match[1].toLowerCase() : "bin";
}

function renameFor(name: string, extension: string) {
  return `${name.replace(/\.[^./\\]+$/, "")}.${extension}`;
}

/** A real `<audio>` element is the cheapest way to read a duration — no need
 *  to invoke ffmpeg just to probe metadata it will read again anyway. */
function probeDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();

    const cleanup = () => URL.revokeObjectURL(url);

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const { duration } = audio;
      cleanup();
      resolve(Number.isFinite(duration) ? duration : 0);
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("This file could not be read as audio."));
    };
    audio.src = url;
  });
}

/** Bits per second, derived from the file itself rather than trusted to
 *  whatever the encoder logged — works the same way for the source file and
 *  the output, lossy or lossless. */
function estimateBitrate(bytes: number, durationSec: number): number | undefined {
  return durationSec > 0 ? Math.round((bytes * 8) / durationSec) : undefined;
}

function buildArgs(
  options: AudioOptions,
  inputName: string,
  outputName: string
): string[] {
  const args = ["-i", inputName];

  if (options.trimStartSec > 0) {
    args.push("-ss", String(options.trimStartSec));
  }
  if (options.trimEndSec > options.trimStartSec) {
    args.push("-to", String(options.trimEndSec));
  }

  if (options.normalize) {
    args.push("-af", "loudnorm=I=-16:TP=-1.5:LRA=11");
  }

  const isLossy = options.format === "" || FORMAT_SPECS[options.format]?.isLossy;

  if (options.format) {
    const spec = FORMAT_SPECS[options.format];
    args.push("-c:a", spec.codec);
    if (spec.extraArgs) args.push(...spec.extraArgs);
  }

  if (options.bitrateKbps > 0 && isLossy) {
    args.push("-b:a", `${options.bitrateKbps}k`);
  }

  args.push(outputName);
  return args;
}

const isNoOp = (options: AudioOptions) =>
  options.format === "" &&
  options.bitrateKbps === 0 &&
  options.trimStartSec === 0 &&
  options.trimEndSec === 0 &&
  !options.normalize;

async function convert(
  file: File,
  options: AudioOptions,
  originalDuration: number,
  handlers: EngineHandlers
): Promise<AudioOutcome> {
  const sourceExtension = extensionOf(file.name);
  const spec = options.format ? FORMAT_SPECS[options.format] : undefined;
  const outputExtension = spec?.extension ?? sourceExtension;
  const outputMime = spec?.mime ?? file.type;

  const runId = Math.random().toString(36).slice(2);
  const inputName = `in-${runId}.${sourceExtension}`;
  const outputName = `out-${runId}.${outputExtension}`;

  handlers.onStage?.("loading-engine");
  const inputData = new Uint8Array(await file.arrayBuffer());

  handlers.onStage?.("converting");
  const outputData = await runFFmpeg({
    args: buildArgs(options, inputName, outputName),
    inputName,
    inputData,
    outputName,
    signal: handlers.signal,
    onProgress: handlers.onProgress,
  });

  // Copied into a fresh `Uint8Array` rather than passed straight through:
  // ffmpeg.wasm's return type allows a `SharedArrayBuffer`-backed view, which
  // `BlobPart` rejects even though this particular one never is — same fix as
  // the AVIF encoder's output in `image/avif.ts`.
  const output = new File(
    [new Uint8Array(outputData)],
    renameFor(file.name, outputExtension),
    { type: outputMime, lastModified: file.lastModified }
  );

  const resultDuration =
    options.trimEndSec > options.trimStartSec
      ? options.trimEndSec - options.trimStartSec
      : options.trimStartSec > 0
      ? Math.max(0, originalDuration - options.trimStartSec)
      : originalDuration;

  return {
    kind: "audio",
    file: output,
    originalSize: file.size,
    meta: {
      duration: resultDuration,
      bitrate: estimateBitrate(output.size, resultDuration),
    },
    originalMeta: {
      duration: originalDuration,
      bitrate: estimateBitrate(file.size, originalDuration),
    },
    unchanged: false,
  };
}

async function run(
  file: File,
  options: AudioOptions,
  handlers: EngineHandlers
): Promise<AudioOutcome> {
  const originalDuration = await probeDuration(file);

  // Matches the image engine's "never larger" ethos — a re-encode nobody
  // asked for is both wasted work and a needless quality hit.
  if (isNoOp(options)) {
    return {
      kind: "audio",
      file,
      originalSize: file.size,
      meta: {
        duration: originalDuration,
        bitrate: estimateBitrate(file.size, originalDuration),
      },
      originalMeta: {
        duration: originalDuration,
        bitrate: estimateBitrate(file.size, originalDuration),
      },
      unchanged: true,
    };
  }

  return convert(file, options, originalDuration, handlers);
}

export function describeAudioError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (/aborted/i.test(message)) {
    return "Cancelled.";
  }
  if (/exited with code/i.test(message)) {
    return "This file could not be converted — it may be corrupt or use an unsupported codec.";
  }
  if (/memory|allocat|out of memory/i.test(message)) {
    return "Ran out of memory — the file is too large for this browser.";
  }
  if (/could not be read as audio/i.test(message)) {
    return message;
  }
  if (/worker|import|network|fetch|not loaded/i.test(message)) {
    return "The audio engine failed to start. Reload and try again.";
  }

  return message || "Conversion failed for an unknown reason.";
}

export const audioEngine: MediaEngine<AudioOptions> = {
  kind: "audio",
  accepts: MIME_TYPES,
  acceptExtensions: AUDIO_EXTENSIONS,
  matches: isAudioFile,
  formatsLabel: "MP3, WAV, AAC, Opus or FLAC",
  maxBytes: 500 * 1024 * 1024,
  concurrency: MAX_AUDIO_CONCURRENCY,
  defaults: DEFAULT_AUDIO_OPTIONS,
  coerce: coerceAudioOptions,
  isSame: isSameAudioOptions,
  describeError: describeAudioError,
  run,
};

export const isAudioOutcome = (
  outcome: MediaOutcome
): outcome is AudioOutcome => outcome.kind === "audio";

export { AUDIO_FORMATS };
