import React, { ButtonHTMLAttributes, FC, forwardRef } from "react";

/** Closed sets — a variant that does not exist is a build error (§14.8). */
type Variant = "primary" | "secondary" | "inverse" | "quiet";
type Size = "sm" | "md" | "lg";

const BASE =
  "relative inline-flex items-center justify-center whitespace-nowrap font-display font-semibold rounded-pill select-none transition-[color,background-color,border-color,box-shadow,transform] duration-fast ease-standard disabled:cursor-not-allowed";

const VARIANTS: Record<Variant, string> = {
  // One per view (§9.1).
  primary:
    "bg-action text-inverse hover:bg-action-hover hover:-translate-y-px active:bg-action-active active:translate-y-0 disabled:bg-line-strong disabled:text-muted disabled:translate-y-0 disabled:hover:bg-line-strong",
  secondary:
    "bg-transparent border-strong border-ink text-primary hover:bg-ink hover:text-inverse active:bg-ink-soft disabled:border-line disabled:text-muted disabled:hover:bg-transparent disabled:hover:text-muted",
  // Light pill on a dark surface — nav and footer CTA (§6.1).
  inverse:
    "bg-bg text-ink hover:bg-raised hover:-translate-y-px active:translate-y-0 disabled:bg-ink-soft disabled:text-inverse-muted",
  quiet:
    "bg-transparent text-secondary hover:text-primary active:opacity-70 disabled:text-muted",
};

const SIZES: Record<Size, string> = {
  sm: "h-10 text-button",
  md: "h-12 text-button",
  lg: "h-14 text-body",
};

/** The quiet variant is a label, not a pill — it carries no side padding. */
const PADDING: Record<Size, string> = {
  sm: "px-5",
  md: "px-6",
  lg: "px-8",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Fills the container up to 400px — the mobile CTA rule (§7.4). */
  block?: boolean;
}

const Spinner: FC<{ className?: string }> = ({ className }) => (
  <svg
    className={`h-4 w-4 animate-spin ${className ?? ""}`}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V1C5.9 1 1 5.9 1 12h3z"
    />
  </svg>
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      block = false,
      className = "",
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-state={loading ? "loading" : undefined}
        className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${
          variant === "quiet" ? "" : PADDING[size]
        } ${block ? "w-full max-w-cta" : ""} ${className}`}
        {...rest}
      >
        {/* Label keeps its width so the button never resizes mid-run (§9.1). */}
        <span className={loading ? "opacity-0" : undefined}>{children}</span>
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </span>
        )}
      </button>
    );
  }
);
