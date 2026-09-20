"use client";

import {
  FC,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CubeLut } from "@/media/image/lut/cube";
import { describeCubeLut } from "@/media/image/lut/cube";
import { createLutRenderer, type LutRenderer } from "@/media/image/lut/render";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { Image } from "@/components/ui/Image";
import { Button } from "../ui/Button";
import { helpText } from "./settingsStyles";

/**
 * The confirmation step for a LUT (§6.6, alongside the compression comparator).
 *
 * A LUT is the one setting in this app whose result cannot be predicted from
 * its name — "quality 80%" is a number a person can reason about, "Kodak 2383"
 * is not. So it is the one setting that does not take effect until it has been
 * seen: nothing leaves this dialog until Apply.
 *
 * Grading happens on a downscaled copy of the photo, never the original. At
 * 1600px the result is indistinguishable from full resolution for judging a
 * look, and it is what keeps the intensity slider live on the CPU backend.
 */

/** Longest side of the preview render, in px. */
const PREVIEW_MAX_DIMENSION = 1600;

const DEFAULT_INTENSITY = 1;

interface LutPreviewProps {
  /** The photo to judge the LUT on — typically the first image in the queue. */
  file: File;
  lut: CubeLut;
  /** Reopening to adjust an already-applied LUT starts where it left off. */
  initialIntensity?: number;
  onApply(intensity: number): void;
  /** Fires from the dialog's native `close` event, so every dismissal path —
   *  Escape, the backdrop, Cancel — lands in exactly one place. */
  onClose(): void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Fits the decode to the preview budget. `undefined` leaves a small photo
 *  alone — `createImageBitmap` would happily scale it *up*. */
function previewSize(width: number, height: number) {
  const longest = Math.max(width, height);
  if (longest <= PREVIEW_MAX_DIMENSION) return undefined;

  const ratio = PREVIEW_MAX_DIMENSION / longest;

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

const LutPreview: FC<LutPreviewProps> = ({
  file,
  lut,
  initialIntensity = DEFAULT_INTENSITY,
  onApply,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasSlotRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<LutRenderer | null>(null);
  /** A queued frame, so dragging the slider coalesces to one draw per paint
   *  instead of one per input event — the difference is visible on the CPU. */
  const frameRequestRef = useRef<number | null>(null);

  const [intensity, setIntensity] = useState(initialIntensity);
  const [position, setPosition] = useState(50);
  const [ratio, setRatio] = useState<number | null>(null);
  const [backend, setBackend] = useState<LutRenderer["backend"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const originalUrl = useObjectUrl(file);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const close = () => dialogRef.current?.close();

  const scheduleDraw = useCallback((value: number) => {
    if (frameRequestRef.current !== null) {
      cancelAnimationFrame(frameRequestRef.current);
    }

    frameRequestRef.current = requestAnimationFrame(() => {
      frameRequestRef.current = null;
      rendererRef.current?.draw(value);
    });
  }, []);

  /**
   * Decode, build the renderer, upload once. Everything expensive about this
   * dialog happens here — the slider afterwards only re-runs the shader.
   */
  useEffect(() => {
    let cancelled = false;
    let renderer: LutRenderer | null = null;
    let bitmap: ImageBitmap | null = null;

    const setup = async () => {
      try {
        // Decoded twice on purpose: the first pass is the only way to learn the
        // photo's real size, and the second is what applies the downscale. The
        // first bitmap is closed immediately, so only one is ever held.
        const probe = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
        const size = previewSize(probe.width, probe.height);
        const aspect = probe.width / probe.height;
        probe.close();

        if (cancelled) return;

        bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
          // Straight alpha, to match the renderer's drawing buffer.
          premultiplyAlpha: "none",
          ...(size
            ? {
                resizeWidth: size.width,
                resizeHeight: size.height,
                resizeQuality: "high" as const,
              }
            : {}),
        });

        if (cancelled) return;

        renderer = createLutRenderer();
        renderer.setSource(bitmap);
        renderer.setLut(lut);
        renderer.draw(initialIntensity);

        // The renderer owns its canvas, so the DOM gets the real thing rather
        // than a copy of it — one less full-frame blit per slider step.
        const slot = canvasSlotRef.current;
        if (!slot) return;

        renderer.canvas.className = "h-full w-full object-contain";
        slot.replaceChildren(renderer.canvas);

        rendererRef.current = renderer;
        setBackend(renderer.backend);
        setRatio(aspect);
      } catch (cause) {
        if (cancelled) return;

        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : "This image could not be decoded for preview."
        );
      } finally {
        // Both backends copy the pixels out during `setSource` — the GPU into
        // a texture, the CPU into an ImageData — so nothing downstream reads
        // the bitmap again, and a decoded photo is far too large to keep open.
        bitmap?.close();
      }
    };

    void setup();

    return () => {
      cancelled = true;

      if (frameRequestRef.current !== null) {
        cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
      }

      rendererRef.current = null;
      renderer?.dispose();
    };
  }, [file, lut, initialIntensity]);

  const moveDivider = (clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    setPosition(
      Math.round(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100))
    );
  };

  const dividerPointerRef = useRef<number | null>(null);

  const startDividerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dividerPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveDivider(event.clientX);
  };

  const dragDivider = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dividerPointerRef.current !== event.pointerId) return;
    moveDivider(event.clientX);
  };

  const endDividerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dividerPointerRef.current !== event.pointerId) return;
    dividerPointerRef.current = null;
  };

  const isReady = ratio !== null && !error;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
      aria-labelledby="lut-preview-title"
      className="compare-dialog m-auto w-[min(880px,calc(100vw-var(--space-8)))] rounded-md bg-raised p-0 text-primary shadow-overlay backdrop:bg-overlay"
    >
      <div className="p-6 md:p-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-eyebrow uppercase text-muted">
              Preview LUT
            </p>
            <h2
              id="lut-preview-title"
              className="mt-2 truncate font-display text-h4 font-semibold"
            >
              {lut.title}
            </h2>
            <p className="mt-1 font-mono text-caption text-muted">
              {describeCubeLut(lut)}
              {backend === "cpu" ? " · rendering on the CPU" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close preview"
            className="-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-muted transition-colors duration-fast ease-standard hover:bg-surface hover:text-primary"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-8 rounded-sm bg-error-surface px-4 py-3 text-body-sm text-error"
          >
            {error}
          </p>
        ) : (
          <div
            ref={frameRef}
            className="relative mt-8 select-none overflow-hidden rounded-sm bg-surface"
            style={{
              aspectRatio: ratio ?? 3 / 2,
              maxHeight: "60vh",
            }}
          >
            <div className="absolute inset-0">
              {originalUrl && (
                <Image
                  src={originalUrl}
                  alt={`${file.name}, ungraded`}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              )}
            </div>

            {/* The canvas is inserted here by the effect, not by React — it
                belongs to the renderer, which has to outlive any re-render. */}
            <div
              ref={canvasSlotRef}
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 0 0 ${position}%)` }}
              aria-hidden="true"
            />

            {isReady && (
              <>
                <div
                  aria-hidden="true"
                  className="compare-divider pointer-events-none absolute inset-y-0 w-0.5 bg-bg"
                  style={{ left: `${position}%` }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-3 rounded-pill bg-ink px-3 py-1 font-mono text-caption uppercase text-inverse"
                >
                  Original
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-3 rounded-pill bg-ink px-3 py-1 font-mono text-caption uppercase text-inverse"
                >
                  Graded
                </span>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={position}
                  onChange={(event) => setPosition(Number(event.target.value))}
                  aria-label="Reveal the graded image"
                  aria-valuetext={`Graded image revealed from ${position}%`}
                  className="compare-range absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent"
                />

                <div
                  aria-hidden="true"
                  onPointerDown={startDividerDrag}
                  onPointerMove={dragDivider}
                  onPointerUp={endDividerDrag}
                  onPointerCancel={endDividerDrag}
                  className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-pill bg-bg text-primary shadow-overlay"
                  style={{ left: `${position}%`, touchAction: "none" }}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 4 2.5 8 6 12M10 4l3.5 4-3.5 4" />
                  </svg>
                </div>
              </>
            )}

            {!isReady && (
              <p className="absolute inset-0 flex items-center justify-center font-mono text-caption text-muted">
                Decoding…
              </p>
            )}
          </div>
        )}

        <div className="mt-8">
          <label
            htmlFor="lut-intensity"
            className="flex items-baseline justify-between gap-4 text-body-sm font-medium text-primary"
          >
            Intensity
            <span data-numeric className="font-mono text-caption text-secondary">
              {Math.round(intensity * 100)}%
            </span>
          </label>
          <input
            id="lut-intensity"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(intensity * 100)}
            disabled={!isReady}
            onChange={(event) => {
              const next = Number(event.target.value) / 100;
              setIntensity(next);
              scheduleDraw(next);
            }}
            className="mt-5 w-full cursor-pointer accent-action disabled:cursor-not-allowed disabled:opacity-45 disabled:accent-line-strong"
          />
          <p className={helpText}>
            Mixes the graded result back toward the original. 100% is the LUT as
            its author wrote it.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
          <Button variant="quiet" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!isReady}
            onClick={() => {
              onApply(intensity);
              close();
            }}
          >
            Apply LUT
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default LutPreview;
