"use client";

import {
  AnimatePresence,
  motion,
  MotionConfig,
  useMotionTemplate,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type Transition,
} from "motion/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "./ui/Button";
import { ThemeToggle } from "./ThemeToggle";
import { openFilePicker } from "@/utils/openFilePicker";

/** The ambient shadow's second layer ramps its alpha from 0.42 to 0.5 across
 *  this much scroll (§6.1) — the entire scroll interaction is this one
 *  continuous read, so there's no threshold to strobe at a boundary. */
const SHADOW_RANGE = 80;

/** The bar only starts hiding once it has cleared its own height plus the top
 *  gap — inside that first stretch the page still reads as "the top", so the
 *  nav staying put is what the eye expects. */
const HIDE_AFTER = 96;

/** Trackpads and momentum scrolling emit sub-pixel deltas in both directions;
 *  anything under this is noise and must not flip the bar. */
const DIRECTION_DEADZONE = 6;

/** How far out of focus the bar goes as it leaves. Enough to read as speed
 *  against the 0.16s exit, low enough that the wordmark is still legible on
 *  the way back in. */
const RETRACT_BLUR = "blur(6px)";

/** The same trick on the sheet, a touch heavier: it travels its own full height
 *  rather than the bar's, so the streak has more distance to cover before the
 *  panel settles. It only ever exists mid-travel — both ends of the animation
 *  are `blur(0px)`, so nothing frosted survives at rest (§Anti-patterns). */
const SHEET_BLUR = "blur(16px)";

/** The §10.1 tokens in the units Motion wants. These animations run in JS, so
 *  they can't read the CSS custom properties the rest of the header uses —
 *  entrances take `--duration-base` / `--ease-out`, exits leave faster on
 *  `--duration-fast` / `--ease-in`. */
const ENTER: Transition = { duration: 0.22, ease: [0.16, 1, 0.3, 1] };
const EXIT: Transition = { duration: 0.16, ease: [0.7, 0, 0.84, 0] };

/** The bar comes back across its own full height — the same `--duration-base`
 *  the smaller entrances use reads as a snap at that distance, so the return
 *  gets `--duration-slow` instead. Leaving stays on EXIT: going is meant to be
 *  quick, arriving is meant to be seen. */
const RETURN: Transition = { duration: 0.32, ease: [0.16, 1, 0.3, 1] };

/** The marker travels between links on `--duration-slow` / `--ease-out`: the
 *  distance is the width of the link group, so anything faster arrives before
 *  the eye has followed it and stops reading as one object moving. */
const MARKER: Transition = { duration: 0.32, ease: [0.16, 1, 0.3, 1] };

/** A hash entry points at a section of the home page; a path entry is a route
 *  of its own. Both live in one list so the bar and the sheet stay in step. */
const NAV_LINKS = [
  { label: "Compress", href: "#compress" },
  { label: "How it works", href: "#how-it-works" },
  { label: "LUT lab", href: "/lut-lab" },
];

const SECTION_IDS = NAV_LINKS.filter((link) => link.href.startsWith("#")).map(
  (link) => link.href.slice(1)
);

const HOME = "/";

/** Which section the reader is actually in, for the marker to sit under.
 *
 *  The band is the observer's own root margin rather than any scroll maths:
 *  everything outside the middle 5% of the viewport is cropped away, so a
 *  section counts as current exactly while it crosses the centre line. Ties —
 *  two sections meeting inside the band — go to the one earlier in the
 *  document, and an empty band (the footer, the very bottom of the page)
 *  leaves the last answer standing rather than clearing the marker. */
function useActiveSection(ids: string[]) {
  const [activeId, setActiveId] = useState(ids[0]);

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) return;

    const intersecting = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target.id);
          else intersecting.delete(entry.target.id);
        }

        const current = ids.find((id) => intersecting.has(id));
        if (current) setActiveId(current);
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [ids]);

  return activeId;
}

/** Text rather than the old wordmark art: that PNG has "TinyImg" baked into
 *  its pixels with no source file to re-render from, so the rename can't
 *  reuse it. `text-inverse` matches the white cut it replaces — the pill is
 *  `bg-ink`, dark under both themes, so there's nothing to swap on here
 *  either. */
const Wordmark = () => (
  <span className="font-display text-h4 font-semibold text-inverse">
    TinyMedia
  </span>
);

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const activeId = useActiveSection(SECTION_IDS);
  const pathname = usePathname();
  const isHome = pathname === HOME;

  /**
   * A bare `#compress` on another route scrolls to nothing, because the
   * section is on the home page. Off the home page the hash links have to
   * carry it — and only then can the marker mean anything, since the observer
   * has no sections to watch either.
   */
  const resolve = (href: string) =>
    href.startsWith("#") && !isHome ? `${HOME}${href}` : href;

  const isCurrent = (href: string) =>
    href.startsWith("#")
      ? isHome && href === `#${activeId}`
      : pathname === href;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  /** The bar is sticky from the first pixel; the ambient shadow's alpha tracks
   *  `scrollY` directly (§6.1). No listener to wire up: Motion already
   *  subscribes to scroll on a passive, rAF-batched loop. The colour stays in
   *  the tokens — only the alpha is interpolated here, so the dark theme's
   *  deeper shadow arrives through the same var() with nothing to switch on. */
  const { scrollY } = useScroll();
  const shadowAlpha = useTransform(scrollY, [0, SHADOW_RANGE], [0.42, 0.5]);
  const navShadow = useMotionTemplate`var(--shadow-nav-near), 0 12px 32px -14px rgb(var(--shadow-nav-rgb) / ${shadowAlpha})`;

  /** Hiding is a transform, and §10.6 says transforms are off when the user
   *  asks for less motion — a bar that teleported out of frame would be worse
   *  than one that simply stays. So for those users it never hides at all.
   *  `isRetracted` is what the animation reads, and it gates the blur too:
   *  Motion still animates filters under `reducedMotion`, so without the gate
   *  those users would be left with a permanently out-of-focus bar. */
  const prefersReducedMotion = useReducedMotion();
  const isRetracted = isHidden && !prefersReducedMotion;

  /** Same gate for the sheet: with the travel dropped there is no movement for
   *  the blur to describe, and animating it alone would just be a smear. */
  const sheetBlur = SHEET_BLUR;

  /** Scroll down and the bar leaves; scroll up — at any depth — and it is back.
   *  The previous offset is a ref rather than state: it changes on every frame
   *  of a scroll and only ever feeds the comparison below, so re-rendering on
   *  it would cost a render per frame and buy nothing. */
  const previousScrollY = useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const delta = latest - previousScrollY.current;

    /** Rubber-band overscroll on iOS runs `scrollY` negative and then back;
     *  clamping keeps that bounce from reading as a real downward gesture. */
    previousScrollY.current = Math.max(latest, 0);

    /** The sheet locks the body, so this shouldn't fire while it is open — but
     *  the bar carries the sheet's close button, so it must never leave. */
    if (isMenuOpen) return;

    if (latest <= HIDE_AFTER) {
      setIsHidden(false);
      return;
    }

    if (Math.abs(delta) < DIRECTION_DEADZONE) return;

    setIsHidden(delta > 0);
  });

  /** Only ever flips the state. The dialog is closed later, once the sheet has
   *  finished animating out, and focus goes back to the trigger there too —
   *  calling `focus()` here would land on an inert element and be dropped. */
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  /** Promote the sheet to the top layer. `showModal()` is the whole reason this
   *  is a `<dialog>`: it brings the focus trap, Escape and the inertness of
   *  everything behind it, so §6.3's contract is the platform's to keep rather
   *  than ours to re-implement. What is left here is the one piece it does not
   *  cover — the body scroll lock — because a modal dialog still lets the page
   *  behind it scroll. */
  useEffect(() => {
    if (!isMenuOpen) return;

    /** Reopening mid-exit finds the dialog still open, and `showModal()` throws
     *  on an already-open dialog rather than no-opping. */
    if (!dialogRef.current?.open) dialogRef.current?.showModal();

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousGutter = body.style.scrollbarGutter;

    body.style.overflow = "hidden";
    body.style.scrollbarGutter = "stable";

    return () => {
      body.style.overflow = previousOverflow;
      body.style.scrollbarGutter = previousGutter;
    };
  }, [isMenuOpen]);

  /** A modal dialog holds the rest of the page inert for as long as it is open,
   *  and the only control that can close this one is the trigger — which is
   *  `md:hidden`. Left alone, widening past the breakpoint with the menu open
   *  would strand the page with nothing able to dismiss it. Watching for the
   *  crossing is enough: the trigger is unreachable at desktop widths, so the
   *  menu can only ever be opened below the breakpoint in the first place. */
  useEffect(() => {
    if (!isMenuOpen) return;

    const desktop = window.matchMedia("(min-width: 768px)");

    desktop.addEventListener("change", closeMenu);
    return () => desktop.removeEventListener("change", closeMenu);
  }, [closeMenu, isMenuOpen]);

  return (
    <MotionConfig reducedMotion="user">
      {/* The gap above the pill moved from `top` onto the header's own padding
        so that hiding is a plain -100%: translating the box by its full height
        now clears the gap too, instead of parking the pill 16px into frame.
        The padding strip is transparent, so it hands its clicks back to the
        page and only the shell itself stays interactive. */}
      <motion.header
        data-surface="ink"
        onFocusCapture={() => setIsHidden(false)}
        className="pointer-events-none sticky top-0 z-nav pt-4 md:pt-6"
        initial={{ opacity: 0, y: -12 }}
        animate={
          isRetracted ? { opacity: 0, y: "-100%" } : { opacity: 1, y: 0 }
        }
        transition={isRetracted ? EXIT : RETURN}
      >
        {/* The blur rides on the shell rather than the header because a filter
          of any value — `blur(0px)` included — makes its element a containing
          block for fixed descendants, and the scrim and sheet below are fixed.
          On the header it would re-anchor them to a 72px strip; down here it
          only touches the pill, which has no fixed children.

          Three columns rather than a flex row with an auto-margin group: the
          left and right zones no longer weigh the same now that the right one
          carries a toggle as well as the CTA, and only equal side tracks keep
          the links centred on the pill instead of on whatever is left over. */}
        <motion.div
          style={{ boxShadow: navShadow }}
          initial={{ filter: "blur(0px)" }}
          animate={{ filter: isRetracted ? RETRACT_BLUR : "blur(0px)" }}
          transition={isRetracted ? EXIT : RETURN}
          className="nav-shell pointer-events-auto grid h-14 grid-cols-[1fr_auto_1fr] items-center rounded-pill border border-line-inverse bg-ink pl-5 pr-2 md:h-16 md:pl-6 md:pr-3"
        >
          <a href="#main" className="flex items-center justify-self-start rounded-pill">
            <Wordmark />
          </a>

          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-8">
              {NAV_LINKS.map((link) => {
                const isActive = isCurrent(link.href);

                return (
                  <li key={link.href}>
                    <a
                      href={resolve(link.href)}
                      /* "location" for a section of the page that is already
                         open — the marker is reporting where the reader is,
                         not which document they are in. A route entry is a
                         different document, so that one is "page". */
                      aria-current={
                        isActive
                          ? link.href.startsWith("#")
                            ? "location"
                            : "page"
                          : undefined
                      }
                      className={`relative rounded-pill px-2 font-display text-nav font-medium transition-colors duration-fast ease-standard active:opacity-70 ${
                        isActive
                          ? "text-inverse"
                          : "text-inverse-muted hover:text-inverse"
                      }`}
                    >
                      {link.label}
                      {isActive && (
                        /* One element that Motion moves between links, not one
                           per link fading in and out — a shared `layoutId` is
                           what makes the marker read as a single object
                           tracking the reader down the page. */
                        <motion.span
                          layoutId="nav-marker"
                          aria-hidden="true"
                          className="absolute inset-x-2 -bottom-2 h-0.5 rounded-pill bg-amber"
                          transition={MARKER}
                        />
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-1 justify-self-end md:gap-2">
            <ThemeToggle />

            <div className="hidden md:block">
              <Button variant="inverse" size="sm" onClick={openFilePicker}>
                Compress files
              </Button>
            </div>

            <button
              ref={triggerRef}
              type="button"
              aria-expanded={isMenuOpen}
              aria-controls="site-menu"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => (isMenuOpen ? closeMenu() : setIsMenuOpen(true))}
              className="flex h-11 w-11 flex-col items-center justify-center gap-2 rounded-pill md:hidden"
            >
              {/* The two bars close into an X — transform only, so the 44px target
                and the bar geometry never move (§10.5). */}
              <span
                aria-hidden="true"
                className={`block h-px w-5 bg-inverse transition-transform duration-base ease-standard ${
                  isMenuOpen ? "translate-y-[4.5px] rotate-45" : ""
                }`}
              />
              <span
                aria-hidden="true"
                className={`block h-px w-5 bg-inverse transition-transform duration-base ease-standard ${
                  isMenuOpen ? "translate-y-[-4.5px] -rotate-45" : ""
                }`}
              />
            </button>
          </div>
        </motion.div>

        {/* Top-layer elements are lifted out of every ancestor transform, filter
          and clip, so the dialog is unaffected by the header retracting above
          it and can stay here in the markup instead of needing a portal.
          `pointer-events` is inherited rather than painted, though, so the
          header's `none` still has to be undone by hand. */}
        <dialog
          ref={dialogRef}
          id="site-menu"
          aria-label="Main menu"
          onCancel={(event) => {
            /* Escape would otherwise close the dialog on the spot and skip the
               exit animation; letting state drive it keeps the one close path
               that `onExitComplete` below finishes. */
            event.preventDefault();
            closeMenu();
          }}
          className="menu-dialog pointer-events-auto"
        >
          {/* The CSS blanket rule in §10.6 can't reach animations driven in JS, so
            Motion has to honour the preference itself: transforms are dropped and
            the sheet is simply present, opacity still crossfades. */}
          <AnimatePresence
            onExitComplete={() => {
              dialogRef.current?.close();
              /* Only now is the trigger out of the dialog's inert shadow and
                 able to take focus. Native restore would aim at whatever was
                 focused when the dialog opened, which on browsers that don't
                 focus a button on click is the body. */
              triggerRef.current?.focus();
            }}
          >
            {isMenuOpen && (
              <>
                <motion.div
                  key="scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: ENTER }}
                  exit={{ opacity: 0, transition: EXIT }}
                  onClick={closeMenu}
                  className="fixed inset-0 z-overlay bg-overlay"
                />
                <motion.div
                  key="sheet"
                  initial={{ y: "100%", filter: sheetBlur }}
                  animate={{ y: 0, filter: "blur(0px)", transition: ENTER }}
                  exit={{ y: "100%", filter: sheetBlur, transition: EXIT }}
                  className="fixed inset-x-0 bottom-0 z-modal max-h-[85dvh] overflow-y-auto rounded-t-lg bg-ink px-6 pb-8 pt-6"
                >
                  <nav aria-label="Main">
                    <ul>
                      {NAV_LINKS.map((link) => {
                        const isActive = isCurrent(link.href);

                        return (
                          <li
                            key={link.href}
                            className="border-b border-line-inverse"
                          >
                            <a
                              href={resolve(link.href)}
                              aria-current={
                                isActive
                                  ? link.href.startsWith("#")
                                    ? "location"
                                    : "page"
                                  : undefined
                              }
                              onClick={closeMenu}
                              className="flex items-center gap-3 py-5 font-display text-h4 font-semibold text-inverse"
                            >
                              {/* No sliding marker down here: the sheet is a
                                  list the reader has just opened, not a bar
                                  they have been watching, so there is no
                                  movement to describe — the dot simply is. */}
                              <span
                                aria-hidden="true"
                                className={`h-1.5 w-1.5 shrink-0 rounded-pill bg-amber ${
                                  isActive ? "" : "invisible"
                                }`}
                              />
                              {link.label}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>

                  <Button
                    className="mt-8 w-full"
                    onClick={() => {
                      closeMenu();
                      openFilePicker();
                    }}
                  >
                    Compress files
                  </Button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </dialog>
      </motion.header>
    </MotionConfig>
  );
};
