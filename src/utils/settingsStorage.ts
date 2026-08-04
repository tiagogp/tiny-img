import { getEngine, type MediaOptions } from "@/media/registry";
import type { MediaKind } from "@/media/types";

const STORAGE_KEY = "tinymedia:settings:v2";
/** Pre-rebrand keys, newest first. `v2` already held the per-kind shape;
 *  `v1` held image options at the top level, before there was more than one
 *  kind. Both are read once as a fallback so a returning TinyImg user's
 *  settings survive the rename. */
const LEGACY_KEYS = ["tinyimg:settings:v2", "tinyimg:settings:v1"];

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
    // rename, or before the queue learned about other kinds. Legacy keys are
    // left in place rather than deleted: they cost a few bytes and nothing
    // reads them after this.
    const legacyV2 = read(LEGACY_KEYS[0]);
    if (legacyV2) return coerce(legacyV2);

    // v1 held image options flat, at the top level, before there was a
    // per-kind shape to nest them under.
    const legacyV1 = read(LEGACY_KEYS[1]);
    if (!legacyV1) return null;

    const engine = getEngine("image");
    return engine ? { image: engine.coerce(legacyV1) } : null;
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
