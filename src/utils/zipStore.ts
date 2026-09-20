/**
 * A ZIP writer that never holds the archive in memory.
 *
 * The obvious way to build a "download all" — hand every file to a zip library
 * and ask for a Blob — copies the entire batch into the JS heap to produce a
 * second copy of the entire batch. For a phone that has just spent its memory
 * budget compressing those files, that doubling arrives at the worst possible
 * moment, and mobile Safari answers it by killing the tab.
 *
 * Nothing here needs to be in memory, because these entries are *stored*, not
 * deflated: JPEG, PNG, WebP and AVIF are already compressed, and DEFLATE over
 * them buys a fraction of a percent. Stored bytes appear in the archive
 * verbatim, so the output can be a `Blob` assembled from the input `Blob`s
 * themselves plus a few dozen bytes of header each. The browser keeps that
 * data wherever it already had it — usually on disk — and only materialises it
 * as the download streams out.
 *
 * The one thing that does have to read the bytes is CRC-32, which the format
 * requires ahead of the data it describes. That is done a chunk at a time, so
 * the high-water mark is one chunk rather than one archive.
 */

const LOCAL_HEADER_SIG = 0x04034b50;
const CENTRAL_HEADER_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

/** Version 2.0: the floor for a stored entry with a UTF-8 name. */
const VERSION = 20;

/** Bit 11: the name is UTF-8 rather than CP437. */
const UTF8_FLAG = 0x0800;

const STORED = 0;

/** Every size and offset in a ZIP32 header is a `uint32`. Past this the format
 *  needs ZIP64, which nothing this app produces should ever reach. */
const ZIP32_LIMIT = 0xffffffff;

/** Bytes read at a time while checksumming. Large enough not to thrash the
 *  reader, small enough to be irrelevant next to a decoded image. */
const CRC_CHUNK = 256 * 1024;

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;

  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  crcTable = table;
  return table;
}

function updateCrc(crc: number, bytes: Uint8Array): number {
  const table = getCrcTable();
  let next = crc;

  for (let index = 0; index < bytes.length; index += 1) {
    next = table[(next ^ bytes[index]) & 0xff] ^ (next >>> 8);
  }

  return next;
}

/**
 * CRC-32 of a blob, read in chunks so a 100 MB file costs `CRC_CHUNK` rather
 * than 100 MB. Falls back to a single read where streams are unavailable.
 */
async function checksum(blob: Blob): Promise<number> {
  let crc = 0xffffffff;

  if (typeof blob.stream === "function") {
    const reader = blob.stream().getReader();

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      crc = updateCrc(crc, value);
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  for (let start = 0; start < blob.size; start += CRC_CHUNK) {
    const slice = blob.slice(start, start + CRC_CHUNK);
    crc = updateCrc(crc, new Uint8Array(await slice.arrayBuffer()));
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS packed date and time, which is what the format stores. Anything
 *  before 1980 is unrepresentable, so it clamps rather than wrapping. */
function dosTimestamp(lastModified: number) {
  const date = new Date(lastModified);
  const year = Math.max(1980, date.getFullYear());

  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

interface EntrySource {
  name: string;
  blob: Blob;
  lastModified: number;
}

interface CentralRecord {
  /** Encoded once, because the header stores its length in bytes and a
   *  non-ASCII filename is longer than it looks. */
  name: Uint8Array<ArrayBuffer>;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

function localHeader(record: CentralRecord): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);

  view.setUint32(0, LOCAL_HEADER_SIG, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, UTF8_FLAG, true);
  view.setUint16(8, STORED, true);
  view.setUint16(10, record.time, true);
  view.setUint16(12, record.date, true);
  view.setUint32(14, record.crc, true);
  view.setUint32(18, record.size, true);
  view.setUint32(22, record.size, true);
  view.setUint16(26, record.name.length, true);
  view.setUint16(28, 0, true);

  return header;
}

function centralHeader(record: CentralRecord): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);

  view.setUint32(0, CENTRAL_HEADER_SIG, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, VERSION, true);
  view.setUint16(8, UTF8_FLAG, true);
  view.setUint16(10, STORED, true);
  view.setUint16(12, record.time, true);
  view.setUint16(14, record.date, true);
  view.setUint32(16, record.crc, true);
  view.setUint32(20, record.size, true);
  view.setUint32(24, record.size, true);
  view.setUint16(28, record.name.length, true);
  view.setUint16(30, 0, true); // extra
  view.setUint16(32, 0, true); // comment
  view.setUint16(34, 0, true); // disk number
  view.setUint16(36, 0, true); // internal attributes
  view.setUint32(38, 0, true); // external attributes
  view.setUint32(42, record.offset, true);

  return header;
}

function endOfCentralDirectory(
  count: number,
  size: number,
  offset: number
): Uint8Array<ArrayBuffer> {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);

  view.setUint32(0, END_OF_CENTRAL_DIR_SIG, true);
  view.setUint16(4, 0, true); // this disk
  view.setUint16(6, 0, true); // disk the directory starts on
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  view.setUint16(20, 0, true); // comment

  return record;
}

/**
 * A stored (uncompressed) ZIP of `entries`, as a `Blob` whose file data is the
 * caller's own blobs rather than a copy of them.
 *
 * `onProgress` reports entries checksummed, which is the only part of this
 * that takes any real time.
 */
export async function createStoredZip(
  entries: EntrySource[],
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const records: CentralRecord[] = [];

  let offset = 0;

  for (const entry of entries) {
    if (entry.blob.size > ZIP32_LIMIT) {
      throw new Error(`"${entry.name}" is too large to put in a ZIP archive.`);
    }

    const record: CentralRecord = {
      name: new Uint8Array(encoder.encode(entry.name)),
      crc: await checksum(entry.blob),
      size: entry.blob.size,
      offset,
      ...dosTimestamp(entry.lastModified),
    };

    const header = localHeader(record);

    parts.push(header, record.name, entry.blob);
    records.push(record);

    offset += header.length + record.name.length + record.size;

    if (offset > ZIP32_LIMIT) {
      throw new Error("This batch is too large to download as one ZIP archive.");
    }

    onProgress?.(records.length, entries.length);
  }

  const directoryOffset = offset;
  let directorySize = 0;

  for (const record of records) {
    const header = centralHeader(record);

    parts.push(header, record.name);
    directorySize += header.length + record.name.length;
  }

  parts.push(
    endOfCentralDirectory(records.length, directorySize, directoryOffset)
  );

  return new Blob(parts, { type: "application/zip" });
}
