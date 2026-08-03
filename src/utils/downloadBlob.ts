/**
 * Triggers a download and releases the object URL afterwards. Creating one per
 * click without revoking pins the whole blob in memory until a page reload.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoking synchronously can cancel the download in Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Keeps ZIP entries unique — two `photo.jpg` would otherwise collide. */
export function uniqueName(name: string, taken: Set<string>) {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }

  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";

  let counter = 2;
  while (taken.has(`${base} (${counter})${extension}`)) counter++;

  const next = `${base} (${counter})${extension}`;
  taken.add(next);

  return next;
}
