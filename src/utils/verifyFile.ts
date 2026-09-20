import {
  ACCEPT_ATTRIBUTE,
  SUPPORTED_FORMATS_LABEL,
  detectKind,
  formatByteLimit,
  getEngine,
} from "@/media/registry";
import type { MediaKind } from "@/media/types";

/** Queue-wide, not per-kind: this is a limit on rows, not on bytes. */
export const MAX_FILES = 100;

/** A drag only counts if it is carrying files — text selections drag too. */
export function isFileDrag(transfer: DataTransfer | null) {
  return Array.from(transfer?.types ?? []).includes("Files");
}

export { ACCEPT_ATTRIBUTE };

/** A file the queue can take, paired with the engine that will handle it. */
export interface AcceptedFile {
  file: File;
  kind: MediaKind;
}

export const verifyFile = (file: File) => detectKind(file) !== null;

export type RejectionReason = "type" | "size" | "limit";

export interface Rejection {
  name: string;
  reason: RejectionReason;
  /** Set for `size`, so the message can name that kind's own limit. */
  kind?: MediaKind;
}

export interface FileFilterResult<T> {
  accepted: T[];
  rejected: Rejection[];
}

/**
 * Splits an incoming batch into what we can process and what we cannot, so the
 * UI can tell the user why a file disappeared instead of silently dropping it.
 * The kind is resolved once here and travels with the file from then on.
 */
export function filterFiles(
  incoming: File[],
  currentCount: number
): FileFilterResult<AcceptedFile> {
  const accepted: AcceptedFile[] = [];
  const rejected: Rejection[] = [];

  for (const file of incoming) {
    const kind = detectKind(file);
    const engine = kind ? getEngine(kind) : undefined;

    if (!kind || !engine) {
      rejected.push({ name: file.name, reason: "type" });
    } else if (file.size > engine.maxBytes) {
      rejected.push({ name: file.name, reason: "size", kind });
    } else if (currentCount + accepted.length >= MAX_FILES) {
      rejected.push({ name: file.name, reason: "limit" });
    } else {
      accepted.push({ file, kind });
    }
  }

  return { accepted, rejected };
}

/** Names get listed so a skipped file is identifiable, not just counted. */
const NAMES_SHOWN = 3;

function listNames(names: string[]) {
  const shown = names.slice(0, NAMES_SHOWN).join(", ");
  const rest = names.length - NAMES_SHOWN;

  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

export function describeRejections(rejected: Rejection[]): string {
  const named = (reason: RejectionReason) =>
    rejected.filter((item) => item.reason === reason).map((item) => item.name);

  const parts: string[] = [];
  const wrongType = named("type");
  const overLimit = named("limit");

  if (wrongType.length > 0) {
    parts.push(
      `${wrongType.length} not a ${SUPPORTED_FORMATS_LABEL} (${listNames(
        wrongType
      )})`
    );
  }

  // Grouped by kind: one message per limit, so an oversized video is never
  // reported against the image cap once both engines are registered.
  const tooBig = rejected.filter((item) => item.reason === "size");
  const kinds = [...new Set(tooBig.map((item) => item.kind))];

  for (const kind of kinds) {
    const engine = kind ? getEngine(kind) : undefined;
    if (!engine) continue;

    const names = tooBig
      .filter((item) => item.kind === kind)
      .map((item) => item.name);

    parts.push(
      `${names.length} over ${formatByteLimit(engine.maxBytes)} (${listNames(
        names
      )})`
    );
  }

  if (overLimit.length > 0) {
    parts.push(
      `${overLimit.length} over the ${MAX_FILES} file limit (${listNames(
        overLimit
      )})`
    );
  }

  return `${rejected.length} file${
    rejected.length > 1 ? "s" : ""
  } skipped — ${parts.join(", ")}.`;
}
