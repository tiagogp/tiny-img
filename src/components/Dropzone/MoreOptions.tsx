"use client";

import { FC, ReactNode, useId, useState } from "react";
import { fieldLabel } from "./settingsStyles";

interface MoreOptionsProps {
  /** Opens the section on its own while any setting inside it is in use — a
   *  collapsed panel that hides a non-default value is a trap. */
  isInUse: boolean;
  /** What is set in here, read without opening it. */
  summary: string;
  children: ReactNode;
}

/**
 * The line between what most people need and what a few do. Everything above
 * it is enough to compress a batch well; everything behind it changes the
 * result in ways that need reading about first.
 */
const MoreOptions: FC<MoreOptionsProps> = ({ isInUse, summary, children }) => {
  /** `null` until the user decides, so the section follows `isInUse` — which
   *  only settles after stored settings load on mount. */
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const open = isOpen ?? isInUse;
  const bodyId = useId();

  return (
    <div className="border-t border-line pt-6">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setIsOpen(!open)}
        className="group flex w-full items-center justify-between gap-4 text-left"
      >
        <span>
          <span className={fieldLabel}>More options</span>
          <span className="mt-1 block font-mono text-caption text-muted">
            {summary}
          </span>
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-secondary transition-transform duration-fast ease-standard group-hover:text-primary ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <div id={bodyId} hidden={!open} className="mt-8">
        <div className="flex flex-col gap-8">{children}</div>
      </div>
    </div>
  );
};

export default MoreOptions;
