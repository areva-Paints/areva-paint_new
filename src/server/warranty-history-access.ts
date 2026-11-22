/* Private, bounded audit of successful reference-protected customer history reads.
 * Registration details stay in the warranty store. Raw cookies, references, phone
 * numbers, unsuccessful guesses and admin review notes never enter this file.
 */
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "../admin/content-store";
import { writePrivateJson } from "./storage";

type Access = {
  registrationId: string;
  sessionHash: string;
  firstAccessedAt: string;
  lastAccessedAt: string;
  lookupCount: number;
};
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
const maximumRows = 10000;
const retentionMs = 90 * 24 * 60 * 60000;
const file = () => path.join(dataDir, "warranty-history-access.json");

/* Aggregate by registration/session and expire only audit rows, never purchases. */
export function recordWarrantyHistoryAccess(
  registrationIds: string[],
  sessionHash: string,
): void {
  if (!registrationIds.length) return;
  if (!hash.test(sessionHash) || registrationIds.some((id) => !uuid.test(id)))
    throw Error("Invalid warranty history access metadata");
  const stored: unknown = fs.existsSync(file())
    ? JSON.parse(fs.readFileSync(file(), "utf8"))
    : [];
  if (
    !Array.isArray(stored) ||
    stored.length > maximumRows ||
    stored.some(
      (row) =>
        !row ||
        typeof row !== "object" ||
        Object.keys(row).some(
          (key) =>
            ![
              "registrationId",
              "sessionHash",
              "firstAccessedAt",
              "lastAccessedAt",
              "lookupCount",
            ].includes(key),
        ) ||
        typeof row.registrationId !== "string" ||
        typeof row.sessionHash !== "string" ||
        !uuid.test(row.registrationId) ||
        !hash.test(row.sessionHash) ||
        typeof row.firstAccessedAt !== "string" ||
        typeof row.lastAccessedAt !== "string" ||
        !Number.isFinite(Date.parse(row.firstAccessedAt)) ||
        !Number.isFinite(Date.parse(row.lastAccessedAt)) ||
        Date.parse(row.firstAccessedAt) > Date.parse(row.lastAccessedAt) ||
        !Number.isSafeInteger(row.lookupCount) ||
        row.lookupCount < 1 ||
        row.lookupCount > 1000000,
    )
  )
    throw Error("Invalid warranty history access store");
  const now = Date.now(),
    at = new Date(now).toISOString();
  const rows = new Map<string, Access>();
  for (const row of stored as Access[]) {
    const key = row.registrationId + ":" + row.sessionHash;
    if (rows.has(key))
      throw Error("Duplicate warranty history access metadata");
    if (Date.parse(row.lastAccessedAt) > now - retentionMs) rows.set(key, row);
  }
  for (const id of new Set(registrationIds)) {
    const key = id + ":" + sessionHash,
      previous = rows.get(key);
    rows.set(key, {
      registrationId: id,
      sessionHash,
      firstAccessedAt: previous?.firstAccessedAt ?? at,
      lastAccessedAt:
        previous && Date.parse(previous.lastAccessedAt) > now
          ? previous.lastAccessedAt
          : at,
      lookupCount: Math.min(1000000, (previous?.lookupCount ?? 0) + 1),
    });
  }
  writePrivateJson(
    file(),
    [...rows.values()]
      .sort(
        (a, b) => Date.parse(b.lastAccessedAt) - Date.parse(a.lastAccessedAt),
      )
      .slice(0, maximumRows),
  );
}
