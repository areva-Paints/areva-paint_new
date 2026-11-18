/*
 * Escape text before interpolation into the preserved HTML layout.
 * Escaping text does not authorize arbitrary URLs or executable HTML.
 */
/** Escape plain text at the few HTML-string sinks that cannot use React nodes. */
export function escapeMarkup(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
