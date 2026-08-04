import { FFmpeg } from "@ffmpeg/ffmpeg";

/**
 * Self-hosted copies, vendored by `scripts/vendor-assets.mjs`. The core is the
 * ESM build specifically — see the vendor script's comment for why the UMD
 * one won't do inside a module worker.
 *
 * Fully qualified rather than root-relative: `@ffmpeg/ffmpeg` resolves
 * `classWorkerURL` against its own bundled module's `import.meta.url`, which
 * the dev bundler can hand back as a `file://` URL rather than this page's
 * origin — a root-relative `/vendor/...` string then resolves to
 * `file:///vendor/...`, which the browser refuses to construct a Worker
 * from. An absolute URL sidesteps that resolution entirely.
 */
function vendorUrl(path: string): string {
  return `${window.location.origin}${path}`;
}

let clientPromise: Promise<FFmpeg> | null = null;

/**
 * Loaded only the first time an audio (or later, video) job actually runs —
 * every image-only session never pays for this ~30 MB download. One instance
 * is reused for every job after that; see `runFFmpeg` for why that means
 * actual `exec()` calls still have to be serialized by hand.
 */
export function getClient(): Promise<FFmpeg> {
  if (!clientPromise) {
    const ffmpeg = new FFmpeg();
    clientPromise = ffmpeg
      .load({
        coreURL: vendorUrl("/vendor/ffmpeg/ffmpeg-core.js"),
        wasmURL: vendorUrl("/vendor/ffmpeg/ffmpeg-core.wasm"),
        classWorkerURL: vendorUrl("/vendor/ffmpeg/worker.js"),
      })
      .then(() => ffmpeg);
  }

  return clientPromise;
}

/** Chains actual `exec()` calls onto one another. A single WASM instance can
 *  only run one command at a time regardless of how many rows the queue
 *  thinks are "concurrent" — this is what actually owns that constraint,
 *  rather than leaving two jobs to race on the same instance's virtual FS. */
let execQueue: Promise<void> = Promise.resolve();

export interface RunFFmpegOptions {
  args: string[];
  inputName: string;
  inputData: Uint8Array;
  outputName: string;
  signal: AbortSignal;
  onProgress?(percent: number): void;
}

/**
 * Cancellation is real but not preemptive: `signal` aborts the *promise* for
 * whichever call is in flight (ffmpeg.wasm supports this natively — see
 * `FFmpeg#exec`'s `{ signal }` option), so a cancelled row stops waiting
 * immediately. The worker itself keeps chewing on the command in the
 * background until it finishes; its result is simply never read. That's a
 * reasonable trade for audio (seconds, not the minutes a video would take) —
 * true interruption would mean `ffmpeg.terminate()`, which kills the shared
 * instance out from under any other job queued behind it.
 */
export async function runFFmpeg({
  args,
  inputName,
  inputData,
  outputName,
  signal,
  onProgress,
}: RunFFmpegOptions): Promise<Uint8Array> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  const ffmpeg = await getClient();

  const run = async (): Promise<Uint8Array> => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const handleProgress = ({ progress }: { progress: number }) => {
      onProgress?.(Math.min(100, Math.max(0, Math.round(progress * 100))));
    };

    ffmpeg.on("progress", handleProgress);

    try {
      await ffmpeg.writeFile(inputName, inputData, { signal });

      // `exec` resolves with an exit code rather than rejecting on a logical
      // ffmpeg failure (a bad filter graph, an unsupported codec) — only a
      // transport-level problem (not loaded, aborted) actually throws.
      const exitCode = await ffmpeg.exec(args, -1, { signal });
      if (exitCode !== 0) {
        throw new Error(`ffmpeg exited with code ${exitCode}`);
      }

      const data = await ffmpeg.readFile(outputName, "binary", { signal });
      return data as Uint8Array;
    } finally {
      ffmpeg.off("progress", handleProgress);

      // Frees the WASM heap of this job's data regardless of outcome — a
      // failed or aborted call may not have produced every file, and
      // `deleteFile` throws on a path that was never written.
      await ffmpeg.deleteFile(inputName).catch(() => {});
      await ffmpeg.deleteFile(outputName).catch(() => {});
    }
  };

  const result = execQueue.then(run, run);

  // The queue itself must never reject — a failed job would otherwise wedge
  // every job scheduled behind it.
  execQueue = result.then(
    () => undefined,
    () => undefined
  );

  return result;
}
