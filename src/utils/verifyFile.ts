export const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Mirrors the limits advertised in the dropzone copy. */
export const MAX_FILES = 100;
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export const ACCEPT_ATTRIBUTE = VALID_TYPES.join(",");

export const verifyFile = (file: File) => VALID_TYPES.includes(file.type);

export type RejectionReason = "type" | "size" | "limit";

export interface FileFilterResult<T> {
  accepted: T[];
  rejected: { name: string; reason: RejectionReason }[];
}

/**
 * Splits an incoming batch into what we can compress and what we cannot, so the
 * UI can tell the user why a file disappeared instead of silently dropping it.
 */
export function filterFiles(
  incoming: File[],
  currentCount: number
): FileFilterResult<File> {
  const accepted: File[] = [];
  const rejected: { name: string; reason: RejectionReason }[] = [];

  for (const file of incoming) {
    if (!verifyFile(file)) {
      rejected.push({ name: file.name, reason: "type" });
    } else if (file.size > MAX_FILE_SIZE) {
      rejected.push({ name: file.name, reason: "size" });
    } else if (currentCount + accepted.length >= MAX_FILES) {
      rejected.push({ name: file.name, reason: "limit" });
    } else {
      accepted.push(file);
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

export function describeRejections(
  rejected: { name: string; reason: RejectionReason }[]
): string {
  const named = (reason: RejectionReason) =>
    rejected.filter((item) => item.reason === reason).map((item) => item.name);

  const parts: string[] = [];
  const wrongType = named("type");
  const tooBig = named("size");
  const overLimit = named("limit");

  if (wrongType.length > 0) {
    parts.push(`${wrongType.length} not a JPEG, PNG or WebP (${listNames(wrongType)})`);
  }
  if (tooBig.length > 0) {
    parts.push(`${tooBig.length} over 100 MB (${listNames(tooBig)})`);
  }
  if (overLimit.length > 0) {
    parts.push(
      `${overLimit.length} over the ${MAX_FILES} image limit (${listNames(overLimit)})`
    );
  }

  return `${rejected.length} file${
    rejected.length > 1 ? "s" : ""
  } skipped — ${parts.join(", ")}.`;
}
