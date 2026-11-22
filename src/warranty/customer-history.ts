/* Remember only opaque registration references. A demo phone entry never proves
 * ownership: the server requires both the complete reference and its login phone.
 * Keep a bounded memory fallback when browser storage is blocked or unavailable.
 */
import { WARRANTY_HISTORY_LIMIT, normalizeWarrantyReference } from "./types";
const storageKey = "areva:warranty:references:v1";
let remembered: string[] = [];
let unsaved: string[] = [];

/* Ignore malformed local data and retain the most recently remembered references. */
function bounded(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(normalizeWarrantyReference)
        .filter((item): item is string => !!item),
    ),
  ].slice(-WARRANTY_HISTORY_LIMIT);
}

export function readWarrantyReferences(): string[] {
  try {
    remembered = bounded([
      ...bounded(JSON.parse(localStorage.getItem(storageKey) || "[]")),
      ...unsaved,
    ]);
  } catch {
    // A private-browsing/storage failure must not prevent a new registration.
  }
  return [...remembered];
}

/* Return whether the reference will survive another visit; never store customer form data. */
export function rememberWarrantyReference(value: string): boolean {
  const reference = normalizeWarrantyReference(value);
  if (!reference) return false;
  remembered = bounded([
    ...readWarrantyReferences().filter((item) => item !== reference),
    reference,
  ]);
  try {
    localStorage.setItem(storageKey, JSON.stringify(remembered));
    unsaved = [];
    return true;
  } catch {
    // Quota errors may block writes while reads still work; retain this visit's new reference.
    unsaved = bounded([
      ...unsaved.filter((item) => item !== reference),
      reference,
    ]);
    return false;
  }
}
