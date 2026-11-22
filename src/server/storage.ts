/*
 * Write private JSON through an exclusive restricted temporary file and atomic rename so interrupted writes do not publish partial records.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/* Create a new private attachment exclusively and remove it if writing or its
 * metadata commit fails. An existing file (including a symlink) is never removed.
 */
export function writePrivateUpload(
  file: string,
  bytes: Uint8Array,
  commit: () => void,
): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  let fd: number | undefined;
  let created = false;
  try {
    fd = fs.openSync(file, "wx", 0o600);
    created = true;
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    commit();
  } catch (error) {
    try {
      if (fd !== undefined) fs.closeSync(fd);
    } finally {
      if (created && fs.existsSync(file)) fs.unlinkSync(file);
    }
    throw error;
  }
}

/** Private, atomic single-process JSON persistence. Never serve this directory. */
export function writePrivateJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  let fd: number | undefined;
  try {
    fd = fs.openSync(temporary, "wx", 0o600);
    fs.writeFileSync(fd, JSON.stringify(value, null, 2));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, file);
  } finally {
    try {
      if (fd !== undefined) fs.closeSync(fd);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
}
