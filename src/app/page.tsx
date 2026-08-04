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
      {/* §7 asks for artwork at the top of the page. The artwork here lives
          inside the drop panel, so the hero *is* the tool: nothing separates
          the headline from the thing the headline is describing, and the one
          saturated element on the first screen is the action (§1.3). */}
      <section id="compress" className="section">
        <div className="container-page">
          <p className="font-mono text-eyebrow uppercase text-muted">
            In-browser media conversion
          </p>

          {/* §7.2 sets the headline in columns 1–7 with the copy beside it, but
              a 136px display face wraps its deliberate lines in any column
              narrower than the full grid. The headline therefore spans the grid
              and the lede keeps its columns 9–12 position underneath — the
              asymmetry moves from an empty column to an offset block. */}
          <h1 className="mt-3 font-display text-display font-bold text-primary">
            Tiny files. <br className="br-lg" />
            Same media. <br className="br-lg" />
            No upload.
          </h1>

          <div className="grid-page mt-8">
            <p className="col-span-full max-w-measure-intro text-body-lg text-secondary lg:col-span-4 lg:col-start-9">
              TinyMedia converts and compresses images and audio on your own
              device. Nothing is uploaded and the originals never leave this
              tab.
            </p>
          </div>

          <div className="mt-12">
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
          <h2 className="mt-3 max-w-measure font-display text-h2 font-semibold text-primary">
            Three steps, none of them a server.
          </h2>

          <ol className="grid-page mt-16">
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

      {/* CLOSING STATEMENT ------------------------------------------ */}
      <section id="privacy" className="section">
        <div className="container-narrow text-center">
          <h2 className="font-display text-h2 font-semibold text-primary">
            Your files never touch a server. Not ours, not anyone&apos;s.
          </h2>
          <p className="mx-auto mt-5 max-w-measure-intro text-body-lg text-secondary">
            Compression and conversion run in your browser through Canvas, Web
            Audio and WebAssembly. TinyMedia has no upload endpoint, no
            account, and no analytics on your files — closing the tab is all
            the cleanup there is.
          </p>
        </div>
      </section>
    </main>
  );
}
