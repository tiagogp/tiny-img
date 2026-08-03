import React, { ButtonHTMLAttributes, forwardRef } from "react";

interface TagProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/**
 * Filter chip (§9.9). The selected state changes fill *and* weight — color is
 * never the only carrier of meaning.
 */
export const Tag = forwardRef<HTMLButtonElement, TagProps>(function Tag(
  { selected = false, className = "", children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={`inline-flex h-8 items-center rounded-pill border px-4 text-body-sm transition-[color,background-color,border-color,transform] duration-fast ease-standard active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-action bg-action-subtle font-semibold text-action"
          : "border-line bg-transparent font-regular text-secondary hover:border-line-strong hover:bg-surface hover:text-primary"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
