"use client";

import React from "react";
import { Button } from "./ui/Button";
import { openFilePicker } from "@/utils/openFilePicker";

const LINK_GROUPS = [
  {
    title: "Tool",
    links: [
      { label: "Compress", href: "#compress" },
      { label: "How it works", href: "#how-it-works" },
    ],
  },
  {
    title: "Elsewhere",
    links: [
      { label: "Source on GitHub", href: "https://github.com/TiagoGP-exe/tiny-img" },
      {
        label: "Report an issue",
        href: "https://github.com/TiagoGP-exe/tiny-img/issues",
      },
    ],
  },
];

const linkClass =
  "nav-link relative inline-block rounded-pill font-display text-nav font-medium text-inverse-muted transition-colors duration-fast ease-standard hover:text-inverse active:opacity-70";

export const Footer = () => (
  <div className="container-page mt-16">
    <footer
      data-surface="ink"
      className="rounded-t-lg bg-ink px-6 pb-12 pt-24 md:px-12"
    >
      <div className="grid-page">
        <div className="col-span-full lg:col-span-5">
          <h2 className="font-display text-h2 font-semibold text-inverse">
            Smaller files, same media, nothing uploaded.
          </h2>
          <div className="mt-8">
            <Button variant="inverse" onClick={openFilePicker}>
              Compress files
            </Button>
          </div>
        </div>

        {LINK_GROUPS.map((group, index) => (
          <nav
            key={group.title}
            aria-label={group.title}
            className={`col-span-full sm:col-span-2 md:col-span-4 lg:col-span-3 ${
              index === 0 ? "lg:col-start-7" : "lg:col-start-10"
            }`}
          >
            <p className="font-mono text-eyebrow uppercase text-inverse-muted">
              {group.title}
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {group.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={linkClass}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mt-24 flex flex-col gap-2 border-t border-line-inverse pt-6 md:flex-row md:items-center md:justify-between">
        <p className="font-mono text-caption text-inverse-muted">
          © {new Date().getFullYear()} TinyMedia
        </p>
        <p className="font-mono text-caption text-inverse-muted">
          Every file is processed on your device.
        </p>
      </div>
    </footer>
  </div>
);
