/**
 * The vocabulary the queue speaks. Nothing in here knows about React, the DOM,
 * or any particular codec — an engine is the only thing that does, and the
 * queue only ever sees this interface.
 */

export type MediaKind = "image" | "audio" | "video";

/**
 * Everything an engine can report about a file. All optional because no kind
 * fills all of it: audio has no dimensions, images have no duration.
 */
export interface MediaMeta {
  width?: number;
  height?: number;
  /** Seconds. */
  duration?: number;
  /** Bits per second. */
  bitrate?: number;
  codec?: string;
}

export interface MediaOutcome<M extends MediaMeta = MediaMeta> {
  kind: MediaKind;
  file: File;
  originalSize: number;
  meta: M;
  originalMeta: M;
  /** Re-encoding produced a bigger file, so the original was kept instead. */
  unchanged: boolean;
}

export interface EngineHandlers {
  signal: AbortSignal;
  onProgress?(value: number): void;
}

export interface MediaEngine<Options> {
  kind: MediaKind;
  /** MIME types accepted from a drop or the file picker. */
  accepts: readonly string[];
  /** Those types as a phrase, for the copy that explains a rejection. */
  formatsLabel: string;
  /** Per-kind: a 2 GB video and a 2 GB JPEG are not the same ask of a browser. */
  maxBytes: number;
  /** How many of this kind may run at once, whatever the machine could afford. */
  concurrency: number;
  defaults: Options;
  /** Storage holds whatever was last written to it — validate field by field. */
  coerce(raw: unknown): Options;
  isSame(a: Options, b: Options): boolean;
  /** Turns a thrown decoder or worker error into something a person can act on. */
  describeError(error: unknown): string;
  run(
    file: File,
    options: Options,
    handlers: EngineHandlers
  ): Promise<MediaOutcome>;
}
