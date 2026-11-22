/* Shared browser/server upload limits. Byte signatures are checked by the server. */
export const IMAGE_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const RECEIPT_MIME_TYPES: readonly string[] = [
  "application/pdf",
  ...IMAGE_MIME_TYPES,
];
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
export const CATALOGUE_IMAGE_MAX_BYTES = 25 * 1024 * 1024;
