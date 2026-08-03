"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { THEME_STORAGE_KEY } from "@/utils/theme";

/** "system" is the default and follows the OS for as long as it is chosen; the
 *  toggle in the header only ever writes an explicit light or dark, which is
 *  what pins the site against a later OS change. */
export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

interface ThemeContextValue {
  theme: Theme;
  /** What is actually painted: "system" already resolved against the OS. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* -------------------------------------------------------------------
   THE STORE
   The choice is kept in localStorage rather than in React state — the
   boot script has to be able to read it before React exists, so making
   React the owner would mean two sources of truth for one value. What
   is left here is the plumbing that turns storage into something React
   can subscribe to: a listener set for writes made in this tab (the
   `storage` event only ever fires in the *other* ones) and the media
   query for the OS changing underneath a "system" choice.
   ------------------------------------------------------------------- */

const listeners = new Set<() => void>();

/** Where the choice goes when localStorage refuses it. Private mode should
 *  cost you persistence across reloads, not the ability to switch theme. */
let fallbackTheme: Theme | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);

  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    query.removeEventListener("change", listener);
    window.removeEventListener("storage", listener);
  };
}

function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage is unavailable; the fallback below is the whole answer.
  }

  return fallbackTheme ?? "system";
}

function readResolvedTheme(): ResolvedTheme {
  const theme = readTheme();
  if (theme !== "system") return theme;

  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** The server has neither storage nor a media query, so it renders the light
 *  theme and React re-runs the snapshot the moment it is on the client. The
 *  page does not flash in that gap: the boot script has already put the right
 *  palette on the document, and this only decides what React itself believes. */
const serverTheme = (): Theme => "system";
const serverResolvedTheme = (): ResolvedTheme => "light";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    readResolvedTheme,
    serverResolvedTheme
  );

  /** The attribute is the single source of truth for CSS: tokens.css keys the
   *  dark palette off it and never looks at `prefers-color-scheme` itself, so
   *  "system" has to be resolved to a concrete value before it lands here. */
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    fallbackTheme = next;

    try {
      if (next === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Persisting the choice is a convenience; the session still honours it.
    }

    for (const listener of listeners) listener();
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return context;
}
