/**
 * How much work this device can be asked to do at once.
 *
 * A desktop tab that overshoots its memory budget swaps and stutters; mobile
 * Safari kills the whole renderer process and reloads the page, which throws
 * away the queue, the results and the settings the user was halfway through.
 * There is no event to catch and nothing to recover — the only defence is not
 * to allocate that much in the first place.
 *
 * The number that matters is the pool width, because every parallel job holds
 * a full-resolution decode: a 24 MP camera JPEG is ~96 MB of RGBA in the
 * decoder plus the same again in the canvas it is drawn to, so each extra lane
 * costs roughly 200 MB of peak. Four lanes is most of an iPhone's per-tab
 * ceiling before a single byte of output exists.
 */

interface MemoryNavigator extends Navigator {
  /** Chromium-only, rounded down to 0.25/0.5/1/2/4/8. Absent in Safari. */
  deviceMemory?: number;
}

/**
 * iPadOS has reported a desktop user agent since 13, so the string alone
 * cannot tell an iPad from a Mac — the touch point count is what still can.
 */
export function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;

  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/** `undefined` where the browser doesn't report it, which includes Safari. */
export function deviceMemoryGb(): number | undefined {
  if (typeof navigator === "undefined") return undefined;

  return (navigator as MemoryNavigator).deviceMemory;
}

/**
 * Whether a full-resolution decode is expensive enough here that the tab is at
 * risk of being killed for making several at once.
 *
 * Every iOS and iPadOS browser is included whatever its badge says: they all
 * run on WebKit, under the same per-tab ceiling, and a recent iPhone is not
 * meaningfully safer than an old one — the photos its camera produces grew
 * alongside the memory it has to decode them in.
 */
export function isMemoryConstrained(): boolean {
  if (isAppleMobile()) return true;

  const memory = deviceMemoryGb();
  if (memory !== undefined) return memory <= 4;

  // No signal either way: treat a coarse pointer as a phone rather than
  // assuming a workstation, since the failure modes are not symmetric — a
  // desktop that runs two lanes instead of eight is slower, a phone that runs
  // eight loses the user's work.
  return (
    typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches
  );
}

/**
 * How many jobs the pool may run in parallel, given the hard `ceiling` the
 * caller already imposes for its own reasons.
 *
 * Constrained devices get one lane, or two where the browser explicitly claims
 * enough memory to afford a second. That is a real slowdown on a batch, and
 * the right trade: the alternative is not a faster batch but a lost one.
 */
export function parallelJobBudget(ceiling: number): number {
  if (isMemoryConstrained()) {
    const memory = deviceMemoryGb();
    const lanes = !isAppleMobile() && memory !== undefined && memory >= 8 ? 2 : 1;

    return Math.max(1, Math.min(lanes, ceiling));
  }

  const cores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 0;

  return Math.max(1, Math.min(cores || 4, ceiling));
}
