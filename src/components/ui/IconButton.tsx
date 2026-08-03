import React, { ButtonHTMLAttributes, forwardRef } from "react";

/** A square, label-less control for the ink surfaces — the nav pill and the
 *  footer (§6.1). It carries no fill of its own at rest, so it never competes
 *  with the CTA sitting next to it; the 44px box is the touch target (§10.5)
 *  rather than anything the eye is meant to see. The focus ring is the
 *  inverse one, inherited from the `data-surface="ink"` rule in globals.css.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(function IconButton({ className = "", type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-inverse-muted transition-[color,background-color,opacity] duration-fast ease-standard hover:bg-ink-soft hover:text-inverse active:opacity-70 ${className}`}
      {...rest}
    />
  );
});
