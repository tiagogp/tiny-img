import { imageEngine } from "./image/engine";
import type { ImageOptions } from "./image/options";
import type { MediaEngine, MediaKind } from "./types";

/** Widens as each engine lands. The queue only ever holds one of these. */
export type MediaOptions = ImageOptions;

/**
 * The single list of what this build can actually do. Everything that used to
 * hardcode a format — the accept attribute, the rejection copy, the size cap —
 * reads from here, so adding an engine is one entry rather than a search.
 */
const ENGINES: MediaEngine<MediaOptions>[] = [imageEngine];

export const getEngine = (kind: MediaKind) =>
  ENGINES.find((engine) => engine.kind === kind);

function engineMatches(engine: MediaEngine<MediaOptions>, file: File) {
  return engine.matches
    ? engine.matches(file)
    : engine.accepts.includes(file.type);
}

/** `null` for anything no registered engine claims — including a blank type. */
export function detectKind(file: File): MediaKind | null {
  const engine = ENGINES.find((candidate) => engineMatches(candidate, file));

  return engine?.kind ?? null;
}

export const engineForFile = (file: File) => {
  const kind = detectKind(file);
  return kind ? getEngine(kind) : undefined;
};

export const ACCEPT_ATTRIBUTE = ENGINES.flatMap((engine) => [
  ...engine.accepts,
  ...(engine.acceptExtensions ?? []),
]).join(",");

/** "JPEG, PNG or WebP" today; "…, or an MP4 or WebM" once video is registered. */
export const SUPPORTED_FORMATS_LABEL = ENGINES.map(
  (engine) => engine.formatsLabel
).join(", ");

/**
 * Limits are announced in copy, so they are rounded the way a person would say
 * them — `convertSizeFileAndUnit` is for measured sizes and keeps its decimals.
 */
export function formatByteLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024);

  return mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${Math.round(mb)} MB`;
}
