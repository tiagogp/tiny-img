"use client";

import {
  FC,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ImageOutcome } from "@/media/image/compress";
import { convertSizeFileAndUnit } from "@/utils/convertSizeFileAndUnit";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { Image } from "@/components/ui/Image";

interface ComparePreviewProps {
  /** Fires from the dialog's native `close` event — see the effect below. */
  onClose(): void;
  file: File;
  outcome: ImageOutcome;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;
/** One press of + or − — a ratio, so every step feels the same size. */
const ZOOM_STEP = 1.5;
/** Past this the interpolation is smoothing away the very artefacts the user
 *  zoomed in to look at, so the real pixels are shown instead. */
const PIXELATED_FROM = 3;

/** Pan offset in CSS pixels, measured from the centre of the frame. */
interface View {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: View = { scale: 1, x: 0, y: 0 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Stops a pan before the photo leaves the frame. The limits come from the
 * *displayed* image, not the frame: `object-contain` letterboxes anything the
 * 60vh cap has squashed, and clamping to the frame there would let the user
 * drag the picture off into the empty band beside it.
 */
function clampToFrame(
  view: View,
  frame: DOMRect | undefined,
  ratio: number
): View {
  if (!frame) return view;

  const shownWidth = Math.min(frame.width, frame.height * ratio);
  const shownHeight = Math.min(frame.height, frame.width / ratio);

  const limitX = Math.max(0, (shownWidth * view.scale - frame.width) / 2);
  const limitY = Math.max(0, (shownHeight * view.scale - frame.height) / 2);

  return {
    scale: view.scale,
    x: clamp(view.x, -limitX, limitX),
    y: clamp(view.y, -limitY, limitY),
  };
}

const Metric: FC<{ label: string; value: string; toneClass?: string }> = ({
  label,
  value,
  toneClass = "text-primary",
}) => (
  <div>
    <p className="font-mono text-caption uppercase text-muted">{label}</p>
    <p data-numeric className={`mt-1 text-body-sm ${toneClass}`}>
      {value}
    </p>
  </div>
);

const zoomButton =
  "inline-flex h-11 w-11 items-center justify-center rounded-pill text-inverse-muted transition-[color,background-color,opacity] duration-fast ease-standard hover:bg-ink-soft hover:text-inverse active:opacity-70 disabled:pointer-events-none disabled:opacity-40";

/**
 * Before/after comparison (§9.13). A compression tool that never shows the
 * result is asking for blind trust in a quality number — this is the only
 * place the user can actually check what 80% did to their photo.
 *
 * The divider is a real `<input type="range">` laid over the images: dragging,
 * arrow keys, Home and End all come for free, and it is the one control here
 * so it never competes with anything for focus.
 *
 * Zoom sits on top of that because artefacts live at the pixel level and a
 * photo fitted to 60vh hides every one of them. Both images take the *same*
 * transform, so the two halves stay registered no matter where the user pans;
 * the clip-path lives on an untransformed wrapper instead of the image, which
 * is what keeps the seam pinned to the divider rather than sliding with the
 * zoom. Once zoomed, dragging the frame pans — the divider is then moved by
 * its handle, and the range keeps the keyboard path either way.
 *
 * The component is mounted only while comparing, so nothing here allocates for
 * the other ninety-nine rows. Every close path goes through `dialog.close()`
 * rather than the parent's state, which is what makes the browser hand focus
 * back to the button that opened it (§9.13).
 */
const ComparePreview: FC<ComparePreviewProps> = ({
  onClose,
  file,
  outcome,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [view, setView] = useState<View>(IDENTITY);
  const [isPanning, setIsPanning] = useState(false);

  /** Pointer id plus the last seen client position, so a pan is a running sum
   *  of deltas and never fights the clamping applied to the previous frame. */
  const panRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const dividerPointerRef = useRef<number | null>(null);

  const originalUrl = useObjectUrl(file);
  const compressedUrl = useObjectUrl(outcome.file);

  const ratio = outcome.originalMeta.width / outcome.originalMeta.height;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const close = () => dialogRef.current?.close();

  /**
   * `anchor` is the point to hold still, in pixels from the centre of the
   * frame — the cursor for a wheel or a double click, the centre itself for
   * the buttons. Without it, zooming in on a corner walks the subject off
   * screen and the user has to pan back to what they were looking at.
   */
  const zoom = useCallback(
    (
      next: number | ((previous: number) => number),
      anchor?: { x: number; y: number }
    ) => {
      setView((previous) => {
        const scale = clamp(
          typeof next === "function" ? next(previous.scale) : next,
          MIN_SCALE,
          MAX_SCALE
        );

        if (scale === previous.scale) return previous;
        if (scale === MIN_SCALE) return IDENTITY;

        const ax = anchor?.x ?? 0;
        const ay = anchor?.y ?? 0;
        const step = scale / previous.scale;

        return clampToFrame(
          {
            scale,
            x: ax - (ax - previous.x) * step,
            y: ay - (ay - previous.y) * step,
          },
          frameRef.current?.getBoundingClientRect(),
          ratio
        );
      });
    },
    [ratio]
  );

  /**
   * Native listener, not `onWheel`: React attaches wheel at the root as
   * passive, so `preventDefault` there is a no-op and the page behind the
   * dialog scrolls while the user is zooming. A trackpad pinch arrives here
   * too, as a wheel event with `ctrlKey` — the same maths covers both.
   */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const rect = frame.getBoundingClientRect();

      zoom((previous) => previous * Math.exp(-event.deltaY * 0.002), {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      });
    };

    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [zoom]);

  const anchorFrom = (event: { clientX: number; clientY: number }) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return undefined;

    return {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2,
    };
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (view.scale === MIN_SCALE || panRef.current) return;

    panRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  };

  const pan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = panRef.current;
    if (!active || active.id !== event.pointerId) return;

    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    active.x = event.clientX;
    active.y = event.clientY;

    setView((previous) =>
      clampToFrame(
        { scale: previous.scale, x: previous.x + dx, y: previous.y + dy },
        frameRef.current?.getBoundingClientRect(),
        ratio
      )
    );
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.id !== event.pointerId) return;

    panRef.current = null;
    setIsPanning(false);
  };

  const moveDivider = (clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    setPosition(
      Math.round(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100))
    );
  };

  /** The handle owns its own drag so it keeps working once the range overlay
   *  has stepped aside for panning. */
  const startDividerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();

    dividerPointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveDivider(event.clientX);
  };

  const dragDivider = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dividerPointerRef.current !== event.pointerId) return;

    event.stopPropagation();
    moveDivider(event.clientX);
  };

  const endDividerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dividerPointerRef.current !== event.pointerId) return;

    dividerPointerRef.current = null;
  };

  /** `+`, `-` and `0` while the dialog has focus. The arrow keys are left to
   *  the range — they belong to the divider, which is the primary control. */
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoom((previous) => previous * ZOOM_STEP);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoom((previous) => previous / ZOOM_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      zoom(MIN_SCALE);
    }
  };

  const isZoomed = view.scale > MIN_SCALE;

  const imageStyle = {
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
    imageRendering:
      view.scale >= PIXELATED_FROM ? ("pixelated" as const) : undefined,
  };

  const saved = outcome.unchanged
    ? 0
    : Math.max(0, 100 - (outcome.file.size / outcome.originalSize) * 100);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      // Native `<dialog>` puts the click target on the element itself when the
      // backdrop is clicked, so the padding-free wrapper below is the content.
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
      aria-labelledby="compare-title"
      className="compare-dialog m-auto w-[min(880px,calc(100vw-var(--space-8)))] rounded-md bg-raised p-0 text-primary shadow-overlay backdrop:bg-overlay"
    >
      <div className="p-6 md:p-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-eyebrow uppercase text-muted">
              Before and after
            </p>
            <h2
              id="compare-title"
              className="mt-2 truncate font-display text-h4 font-semibold"
            >
              {file.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close comparison"
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

        <div
          ref={frameRef}
          onPointerDown={startPan}
          onPointerMove={pan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onDoubleClick={(event) =>
            zoom(
              (previous) =>
                previous >= MAX_SCALE ? MIN_SCALE : previous * ZOOM_STEP,
              anchorFrom(event)
            )
          }
          className={`relative mt-8 select-none overflow-hidden rounded-sm bg-surface ${
            isZoomed ? (isPanning ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
          style={{
            aspectRatio: `${outcome.originalMeta.width} / ${outcome.originalMeta.height}`,
            maxHeight: "60vh",
            touchAction: isZoomed ? "none" : undefined,
          }}
        >
          {/* The wrappers are never transformed, so the clip stays in the
              frame's coordinates and the seam sits exactly under the divider. */}
          <div className="absolute inset-0 overflow-hidden">
            {originalUrl && (
              <Image
                src={originalUrl}
                alt={`${file.name}, original`}
                className="h-full w-full object-contain"
                style={imageStyle}
                draggable={false}
              />
            )}
          </div>

          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          >
            {compressedUrl && (
              <Image
                src={compressedUrl}
                alt={`${file.name}, compressed`}
                className="h-full w-full object-contain"
                style={imageStyle}
                draggable={false}
              />
            )}
          </div>

          {/* Divider and labels are decorative — the range below is the control. */}
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
            Compressed
          </span>

          {/* Pointer target only while the frame is at rest: once zoomed, a
              drag means pan, and the handle below takes over the divider. */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            aria-label="Reveal the compressed image"
            aria-valuetext={`Compressed image revealed from ${position}%`}
            className={`compare-range absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent ${
              isZoomed ? "pointer-events-none" : ""
            }`}
          />

          {/* Decorative twin of the range: same value, drawn where the seam is
              so the drag target is visible instead of implied. */}
          <div
            aria-hidden="true"
            onPointerDown={startDividerDrag}
            onPointerMove={dragDivider}
            onPointerUp={endDividerDrag}
            onPointerCancel={endDividerDrag}
            // Two quick nudges of the handle are not a request to zoom.
            onDoubleClick={(event) => event.stopPropagation()}
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

          <div
            // Otherwise a second press of + inside the double-click window
            // lands on the frame as a zoom of its own.
            onDoubleClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute bottom-3 right-3 flex items-center gap-1 rounded-pill bg-ink p-1 text-inverse"
          >
            <button
              type="button"
              onClick={() => zoom((previous) => previous / ZOOM_STEP)}
              disabled={!isZoomed}
              aria-label="Zoom out"
              className={zoomButton}
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
                <path d="M3 8h10" />
              </svg>
            </button>

            {/* Not a live region: a wheel gesture would otherwise announce a
                dozen percentages a second. */}
            <button
              type="button"
              onClick={() => zoom(MIN_SCALE)}
              disabled={!isZoomed}
              aria-label={`Reset zoom, currently ${Math.round(
                view.scale * 100
              )} percent`}
              data-numeric
              className="inline-flex h-11 min-w-14 items-center justify-center rounded-pill px-2 font-mono text-caption text-inverse transition-[color,background-color,opacity] duration-fast ease-standard hover:bg-ink-soft disabled:pointer-events-none disabled:text-inverse-muted"
            >
              {Math.round(view.scale * 100)}%
            </button>

            <button
              type="button"
              onClick={() => zoom((previous) => previous * ZOOM_STEP)}
              disabled={view.scale >= MAX_SCALE}
              aria-label="Zoom in"
              className={zoomButton}
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
                <path d="M8 3v10M3 8h10" />
              </svg>
            </button>
          </div>
        </div>

        <p className="mt-4 font-mono text-caption text-muted">
          {isZoomed
            ? "Drag to pan · scroll or pinch to zoom · double click to zoom in"
            : "Scroll, pinch or double click to zoom in on the detail"}
        </p>

        <div className="mt-8 flex flex-wrap gap-x-12 gap-y-6">
          <Metric label="Before" value={convertSizeFileAndUnit(outcome.originalSize)} />
          <Metric
            label="After"
            value={convertSizeFileAndUnit(outcome.file.size)}
            toneClass={outcome.unchanged ? "text-primary" : "text-success"}
          />
          <Metric
            label="Saved"
            value={outcome.unchanged ? "Original kept" : `${saved.toFixed(1)}%`}
            toneClass={outcome.unchanged ? "text-muted" : "text-success"}
          />
          <Metric
            label="Dimensions"
            value={
              outcome.meta.width !== outcome.originalMeta.width ||
              outcome.meta.height !== outcome.originalMeta.height
                ? `${outcome.originalMeta.width}×${outcome.originalMeta.height} → ${outcome.meta.width}×${outcome.meta.height}`
                : `${outcome.meta.width}×${outcome.meta.height}`
            }
          />
        </div>
      </div>
    </dialog>
  );
};

export default ComparePreview;
