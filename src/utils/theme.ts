/** The theme's two halves — the boot script that runs before the first paint
 *  and the provider that runs after hydration — have to agree on where the
 *  choice is kept, so the key lives outside both. This module is deliberately
 *  free of "use client": a server component reading an export out of a client
 *  module gets a reference to it rather than its value. */
export const THEME_STORAGE_KEY = "tinymedia:theme:v1";

/** The pre-rebrand key. Read once as a fallback so a returning TinyImg user's
 *  theme choice survives the rename instead of silently reverting to system. */
const LEGACY_THEME_STORAGE_KEY = "tinyimg:theme:v1";

/** Resolves the theme and writes it onto the root element before the document
 *  has anything to paint, which is what keeps a stored dark theme from opening
 *  on a white page. It has to be inline and blocking to be that early, so it
 *  is kept to one statement of work: read the choice (falling back to the old
 *  key), resolve "system" — the absent case — against the OS, and set the
 *  attribute the palette keys off.
 *
 *  Nothing selects the dark palette without that attribute, so a thrown
 *  exception or a browser with scripting off both land on the light theme. */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)})||localStorage.getItem(${JSON.stringify(
  LEGACY_THEME_STORAGE_KEY
)});document.documentElement.dataset.theme=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){}})()`;
