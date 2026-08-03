"use client";

import {
  AnimatePresence,
  motion,
  MotionConfig,
  type Transition,
} from "motion/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { openFilePicker } from "@/utils/openFilePicker";

/** Two thresholds, not one: a scroll parked on the boundary would otherwise
 *  strobe the shadow on and off (§6.1). */
const SHADOW_ON = 80;
const SHADOW_OFF = 60;

/** The §10.1 tokens in the units Motion wants. These animations run in JS, so
 *  they can't read the CSS custom properties the rest of the header uses —
 *  entrances take `--duration-base` / `--ease-out`, exits leave faster on
 *  `--duration-fast` / `--ease-in`. */
const ENTER: Transition = { duration: 0.22, ease: [0.16, 1, 0.3, 1] };
const EXIT: Transition = { duration: 0.16, ease: [0.7, 0, 0.84, 0] };

const NAV_LINKS = [
  { label: "Compress", href: "#compress" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Privacy", href: "#privacy" },
];

const Wordmark = () => (
  <span className="flex items-center gap-2 font-display text-h6 font-semibold text-inverse">
    <span aria-hidden="true" className="block h-2 w-2 rounded-pill bg-amber" />
    TinyImg
  </span>
);

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  /** The bar is sticky from the first pixel and never hides or shrinks — the
   *  ambient shadow going 0.42 → 0.5 is the entire scroll interaction (§6.1).
   *  Coalesced into one rAF per burst so a fast scroll reads `scrollY` once a
   *  frame instead of once an event. */
  useEffect(() => {
    let frame = 0;

    const read = () => {
      frame = 0;
      const y = window.scrollY;
      setIsScrolled(
        (wasScrolled) => y > (wasScrolled ? SHADOW_OFF : SHADOW_ON),
      );
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };

    // Reloading halfway down the page must not start the bar unshadowed.
    read();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    triggerRef.current?.focus();
  }, []);

  /** Lock the page, trap Tab inside the sheet, close on Escape (§6.3). */
  useEffect(() => {
    if (!isMenuOpen) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;

    body.style.overflow = "hidden";
    body.style.scrollbarGutter = "stable";

    const focusables = () =>
      Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ) ?? [],
      );

    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab") return;

      const nodes = focusables();
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.scrollbarGutter = "";
    };
  }, [closeMenu, isMenuOpen]);

  return (
    <header data-surface="ink" className="sticky top-4 z-nav md:top-6">
      <div
        className={`nav-shell flex h-14 items-center justify-between rounded-pill border border-line-inverse bg-ink pl-5 pr-2 transition-shadow duration-base ease-standard md:h-16 md:pl-6 md:pr-3 ${
          isScrolled ? "shadow-nav-scrolled" : "shadow-nav"
        }`}
      >
        <a href="#main" className="flex items-center rounded-pill">
          <Wordmark />
        </a>

        <nav aria-label="Main" className="mx-auto hidden md:block">
          <ul className="flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="nav-link relative rounded-pill px-2 font-display text-nav font-medium text-inverse-muted transition-colors duration-fast ease-standard hover:text-inverse active:opacity-70"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden md:block">
          <Button variant="inverse" size="sm" onClick={openFilePicker}>
            Compress images
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

      {/* The CSS blanket rule in §10.6 can't reach animations driven in JS, so
          Motion has to honour the preference itself: transforms are dropped and
          the sheet is simply present, opacity still crossfades. */}
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div
                key="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: ENTER }}
                exit={{ opacity: 0, transition: EXIT }}
                onClick={closeMenu}
                className="fixed inset-0 z-overlay bg-overlay md:hidden"
              />
              <motion.div
                key="sheet"
                ref={sheetRef}
                id="site-menu"
                initial={{ y: "100%" }}
                animate={{ y: 0, transition: ENTER }}
                exit={{ y: "100%", transition: EXIT }}
                className="fixed inset-x-0 bottom-0 z-modal max-h-[85dvh] overflow-y-auto rounded-t-lg bg-ink px-6 pb-8 pt-6 md:hidden"
              >
                <nav aria-label="Main">
                  <ul>
                    {NAV_LINKS.map((link) => (
                      <li
                        key={link.href}
                        className="border-b border-line-inverse"
                      >
                        <a
                          href={link.href}
                          onClick={closeMenu}
                          className="block py-5 font-display text-h4 font-semibold text-inverse"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>

                <Button
                  className="mt-8 w-full"
                  onClick={() => {
                    closeMenu();
                    openFilePicker();
                  }}
                >
                  Compress images
                </Button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </MotionConfig>
    </header>
  );
};
