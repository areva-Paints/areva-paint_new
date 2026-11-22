/* Central file validation and disk accounting shared by admin, receipts and site
 * photos. MIME labels alone never establish a file's supported format.
 */
import fs from "node:fs";
import path from "node:path";

export function supportedFileBytes(bytes: Buffer, mime: string): boolean {
  if (bytes.length < 12) return false;
  if (mime === "application/pdf")
    return (
      bytes.toString("ascii", 0, 5) === "%PDF-" &&
      bytes
        .subarray(Math.max(0, bytes.length - 1024))
        .includes(Buffer.from("%%EOF"))
    );
  if (mime === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/webp")
    return (
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  return false;
}

/* A finite positive configuration overrides the documented budget; invalid input uses its default. */
export function uploadBudgetBytes(
  configured: string | undefined,
  defaultMiB: number,
): number {
  const value = Number(configured);
  const bytes = value * 1024 * 1024;
  return Number.isFinite(bytes) && bytes > 0 ? bytes : defaultMiB * 1024 * 1024;
}

/* Never count directories or symlinks as uploaded bytes. Missing folders start empty. */
export function uploadedBytes(directories: string[]): number {
  let total = 0;
  for (const directory of directories) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory)) {
      const entry = fs.lstatSync(path.join(directory, name));
      if (entry.isFile()) total += entry.size;
    }
  }
  return total;
}

export function warrantyUploadBytes(dataDirectory: string): number {
  return uploadedBytes(
    ["warranty-receipts", "warranty-site-photos"].map((folder) =>
      path.join(dataDirectory, folder),
    ),
  );
}
