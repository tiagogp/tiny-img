/**
 * Reading an image's pixel size without decoding its pixels.
 *
 * `createImageBitmap` is the obvious way to ask how big an image is, and the
 * most expensive answer possible: a 24 MP camera JPEG costs ~96 MB of RGBA and
 * a full DCT pass to learn two integers that are written in plain sight a few
 * hundred bytes into the file. Multiplied by the pool width, that decode is
 * the single largest allocation the queue makes before compression has even
 * started — and on mobile Safari it is enough on its own to have the tab
 * killed and the batch lost.
 *
 * Every format here writes its dimensions in a fixed-position header, so the
 * first slice of the file is all that has to be read. Anything this cannot
 * parse returns `null` and the caller falls back to the decoder, so an exotic
 * or malformed file still gets an answer — just the slow one.
 */

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Enough for the headers of every format below, including a JPEG carrying a
 * full EXIF block with an embedded thumbnail ahead of its frame header.
 */
const HEADER_BYTES = 256 * 1024;

const swapped = ({ width, height }: Dimensions): Dimensions => ({
  width: height,
  height: width,
});

function readPng(view: DataView): Dimensions | null {
  if (view.byteLength < 24) return null;

  // \x89 P N G \r \n \x1a \n, then the IHDR chunk, whose first two fields are
  // the dimensions. The spec requires IHDR to come first, so the offsets are
  // fixed rather than searched.
  const signature = view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a;
  if (!signature) return null;

  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readGif(view: DataView): Dimensions | null {
  if (view.byteLength < 10) return null;
  if (view.getUint32(0) !== 0x47494638) return null; // "GIF8"

  // The logical screen descriptor, little-endian, straight after the header.
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function readWebp(view: DataView): Dimensions | null {
  if (view.byteLength < 30) return null;
  if (view.getUint32(0) !== 0x52494646) return null; // "RIFF"
  if (view.getUint32(8) !== 0x57454250) return null; // "WEBP"

  const chunk = view.getUint32(12);

  // "VP8 " — lossy. The keyframe header sits behind a 3-byte sync code, and
  // the two sizes carry 2 bits of scaling in their high bits.
  if (chunk === 0x56503820) {
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }

  // "VP8L" — lossless. 14 bits each, minus one, packed little-endian behind a
  // one-byte signature.
  if (chunk === 0x5650384c) {
    const bits = view.getUint32(21, true);

    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  // "VP8X" — extended (animation, alpha, ICC). 24-bit little-endian, minus one.
  if (chunk === 0x56503858) {
    const read24 = (offset: number) =>
      view.getUint8(offset) |
      (view.getUint8(offset + 1) << 8) |
      (view.getUint8(offset + 2) << 16);

    return { width: read24(24) + 1, height: read24(27) + 1 };
  }

  return null;
}

/**
 * EXIF orientation from an APP1 segment, or `undefined` when the segment is
 * absent or unreadable. Only the value matters here, not the whole block: 5–8
 * mean the image is stored rotated a quarter turn from how it is displayed,
 * which is exactly the case where the frame header's dimensions are not the
 * ones anybody sees.
 */
function readExifOrientation(view: DataView, start: number, length: number): number | undefined {
  // "Exif\0\0" then a TIFF header, whose byte order the rest is relative to.
  if (length < 14) return undefined;
  if (view.getUint32(start) !== 0x45786966) return undefined;

  const tiff = start + 6;
  const order = view.getUint16(tiff);

  if (order !== 0x4949 && order !== 0x4d4d) return undefined;

  const little = order === 0x4949;

  if (view.getUint16(tiff + 2, little) !== 42) return undefined;

  const ifd = tiff + view.getUint32(tiff + 4, little);

  if (ifd + 2 > view.byteLength) return undefined;

  const entries = view.getUint16(ifd, little);

  for (let index = 0; index < entries; index += 1) {
    const entry = ifd + 2 + index * 12;

    if (entry + 12 > view.byteLength) return undefined;
    if (view.getUint16(entry, little) !== 0x0112) continue;

    // Tag 0x0112 is a SHORT, so the value is inline in the first two bytes of
    // the entry's value field rather than at an offset.
    const orientation = view.getUint16(entry + 8, little);

    return orientation >= 1 && orientation <= 8 ? orientation : undefined;
  }

  return undefined;
}

function readJpeg(view: DataView): Dimensions | null {
  if (view.byteLength < 4) return null;
  if (view.getUint16(0) !== 0xffd8) return null; // SOI

  let offset = 2;
  let orientation: number | undefined;

  while (offset + 4 <= view.byteLength) {
    // Segments may be padded with any number of 0xFF fill bytes.
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = view.getUint8(offset + 1);

    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    // Standalone markers carry no length field, so there is nothing to skip.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    // Entropy-coded data begins here and is not segmented — if no frame header
    // turned up before it, this file is not one we can read cheaply.
    if (marker === 0xda) return null;

    const length = view.getUint16(offset + 2);

    if (length < 2) return null;

    // SOF0–SOF15, which hold the frame's true size. The three exceptions in
    // that range are tables, not frames, and would decode to nonsense.
    const isFrameHeader =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isFrameHeader) {
      if (offset + 9 > view.byteLength) return null;

      const size = {
        // Stored height first, then width — the one field order in this file
        // that reads backwards.
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };

      if (!size.width || !size.height) return null;

      return orientation !== undefined && orientation >= 5 ? swapped(size) : size;
    }

    if (marker === 0xe1 && orientation === undefined) {
      orientation = readExifOrientation(view, offset + 4, length - 2);
    }

    offset += 2 + length;
  }

  return null;
}

/**
 * The image's displayed size, read from its header, or `null` for a format or
 * a file this cannot parse.
 *
 * "Displayed" is the contract that matters: the caller's alternative is
 * `createImageBitmap(…, { imageOrientation: "from-image" })`, which hands back
 * a rotated photo's dimensions the way a viewer would show them, and the two
 * have to agree or a portrait photo would be resized against its landscape
 * measurements.
 */
export async function readHeaderDimensions(blob: Blob): Promise<Dimensions | null> {
  try {
    const buffer = await blob.slice(0, HEADER_BYTES).arrayBuffer();
    const view = new DataView(buffer);

    const size =
      readPng(view) ?? readGif(view) ?? readWebp(view) ?? readJpeg(view);

    // A header can be read and still be nonsense; a zero here would divide by
    // itself later in the resize maths.
    return size && size.width > 0 && size.height > 0 ? size : null;
  } catch {
    // A truncated or unreadable slice is not a failure, just a miss — the
    // decoder fallback is what decides whether this file is really broken.
    return null;
  }
}
