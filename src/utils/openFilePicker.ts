/** Id of the file input rendered inside the drop panel. */
export const FILE_INPUT_ID = "file-input";

/**
 * The nav, hero and footer all offer the same action, so they all reach the
 * one real `<input type="file">` instead of each owning a picker (§9.15).
 */
export function openFilePicker() {
  const input = document.getElementById(FILE_INPUT_ID);

  if (input instanceof HTMLInputElement) {
    input.click();
  }
}
