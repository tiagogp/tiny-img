import { getEngine, type MediaOptions } from "@/media/registry";
import type { MediaKind } from "@/media/types";

const STORAGE_KEY = "tinyimg:settings:v2";
/** v1 held image options at the top level, before there was more than one kind. */
const LEGACY_KEY = "tinyimg:settings:v1";

const KINDS: MediaKind[] = ["image", "audio", "video"];

export type StoredSettings = Partial<Record<MediaKind, MediaOptions>>;

/**
 * Each engine validates its own options, so a bad audio entry can never cost
 * someone their image settings. Kinds with no registered engine are dropped
 * rather than passed through — nothing would know how to read them back.
 */
function coerce(raw: unknown): StoredSettings {
  if (typeof raw !== "object" || raw === null) return {};

  const value = raw as Record<string, unknown>;
  const settings: StoredSettings = {};

  for (const kind of KINDS) {
    const engine = getEngine(kind);
    if (!engine || !(kind in value)) continue;

    settings[kind] = engine.coerce(value[kind]);
  }

  return settings;
}

function read(key: string): unknown {
  const stored = window.localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
}

/** Returns `null` when there is nothing stored, so the caller can skip a render. */
export function loadSettings(): StoredSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const current = read(STORAGE_KEY);
    if (current) return coerce(current);

    // A returning user should not lose the settings they picked before the
    // queue learned about other kinds. v1 is left in place rather than
    // deleted: it costs a few bytes and nothing reads it after this.
    const legacy = read(LEGACY_KEY);
    if (!legacy) return null;

    const engine = getEngine("image");
    return engine ? { image: engine.coerce(legacy) } : null;
  } catch {
    // Private mode, disabled storage, or malformed JSON — defaults are fine.
    return null;
  }
}

export function saveSettings(settings: StoredSettings) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota or a blocked storage API. Persisting settings is a convenience.
  }
}
