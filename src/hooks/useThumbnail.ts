"use client";

import { useEffect, useState } from "react";

/**
 * The row shows the source image in a 40px slot. Pointing an `<img>` straight at
 * the original file makes the browser keep a *full-resolution* decoded bitmap
 * alive for every row: a 4000×3000 photo is ~48 MB of RGBA regardless of the box
 * it is painted into, so a hundred-file queue pins several gigabytes just to
 * draw thumbnails. Decoding once at thumbnail scale and keeping only that costs
 * ~4 KB a row instead.
 */
const THUMB_SIZE = 96;

/**
 * Thumbnailing competes with the compression pool for CPU and for peak memory —
 * the transient full decode is only cheap because at most two exist at a time.
 */
const MAX_DECODES = 2;

let active = 0;
const waiting: (() => void)[] = [];

function acquire(): Promise<void> {
  if (active < MAX_DECODES) {
    active += 1;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    waiting.push(() => {
      active += 1;
      resolve();
    });
  });
}

function release() {
  active -= 1;
  waiting.shift()?.();
}

function isSupported() {
  return (
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas === "function"
  );
}

/** Center crop to a square, matching the `object-cover` the row paints with. */
async function renderThumbnail(file: Blob): Promise<Blob> {
  // `resizeWidth` alone keeps the aspect ratio, so a portrait image comes back
  // tall — still small enough that the crop below is a cheap canvas draw.
  const bitmap = await createImageBitmap(file, {
    resizeWidth: THUMB_SIZE,
    resizeQuality: "low",
  });

  try {
    const side = Math.min(bitmap.width, bitmap.height, THUMB_SIZE);
    const canvas = new OffscreenCanvas(side, side);
    const context = canvas.getContext("2d");

    if (!context) throw new Error("2D context unavailable.");

    const source = Math.min(bitmap.width, bitmap.height);

    context.drawImage(
      bitmap,
      (bitmap.width - source) / 2,
      (bitmap.height - source) / 2,
      source,
      source,
      0,
      0,
      side,
      side
    );

    return await canvas.convertToBlob({ type: "image/webp", quality: 0.7 });
  } finally {
    bitmap.close();
  }
}

/**
 * A downscaled object URL for `file`, revoked when the file changes or the row
 * unmounts. Falls back to the original file where `OffscreenCanvas` is missing,
 * which is the old behaviour rather than an empty box.
 */
export function useThumbnail(file: Blob | undefined) {
  const [url, setUrl] = useState<string>();

  /* Same reason as useObjectUrl: the thumbnail is an allocation that has to be
     revoked on cleanup, and it is produced asynchronously, so there is nothing
     to derive during render. */
  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(undefined);
      return;
    }

    let created: string | undefined;
    let cancelled = false;

    const publish = (blob: Blob) => {
      if (cancelled) return;
      created = URL.createObjectURL(blob);
      setUrl(created);
    };

    const build = async () => {
      if (!isSupported()) {
        publish(file);
        return;
      }

      await acquire();

      try {
        if (cancelled) return;
        publish(await renderThumbnail(file));
      } catch {
        // A file the decoder rejects has no thumbnail — the row still has its
        // name, and compression will report the real error separately.
        if (!cancelled) setUrl(undefined);
      } finally {
        release();
      }
    };

    void build();

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
      setUrl(undefined);
    };
  }, [file]);

  return url;
}
