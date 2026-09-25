import React from "react";
import { Dropzone } from "../components/Dropzone";

/** A real sequence, so the numbers are earned (§9.7). */
const STEPS = [
  {
    title: "Drop your files",
    body: "Images and audio, read from disk as-is. Drop them anywhere on the page — no request is ever made.",
  },
  {
    title: "Tune the output",
    body: "Pick a format, a quality level or bitrate, a resolution, a trim. Change your mind and re-run the whole batch at once — your settings are remembered next time.",
  },
  {
    title: "Download the result",
    body: "Compare any image against its original before you commit. Take one at a time or the whole set as a zip — every file keeps its name.",
  },
];

export default function Home() {
  return (
    <main id="main">
      {/* HERO + TOOL ------------------------------------------------ */}
      {/* The headline is a caption for the tool, not a poster above it: it
          stays on one line so the drop panel and the settings beside it land
          on the first screen, which is what a visitor came here to use. */}
      <section id="compress" className="pb-(--section-pad) pt-12 md:pt-16">
        <div className="container-page">
          <p className="font-mono text-eyebrow uppercase text-muted">
            In-browser media conversion
          </p>
          <h1 className="mt-3 font-display text-h1 font-bold text-primary">
            Tiny files. Same media. No upload.
          </h1>
          <p className="mt-5 max-w-measure-intro text-body-lg text-secondary">
            Compress and convert images and audio — your files never leave
            this device.
          </p>

          <div className="mt-10">
            <Dropzone />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS ----------------------------------------------- */}
      <section id="how-it-works" className="section bg-surface">
        <div className="container-page">
          <p className="font-mono text-eyebrow uppercase text-muted">
            How it works
          </p>
          <h2 className="mt-3 max-w-measure font-display text-h3 font-semibold text-primary">
            Three steps, none of them a server.
          </h2>

          <ol className="grid-page mt-10">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="group col-span-full border-t border-line pt-6 transition-colors duration-fast ease-standard hover:border-ink md:col-span-4"
              >
                <p
                  data-numeric
                  className="font-mono text-overline font-bold text-muted"
                >
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 font-display text-h4 font-semibold text-primary">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-measure text-body-sm text-secondary">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

    </main>
  );
}
