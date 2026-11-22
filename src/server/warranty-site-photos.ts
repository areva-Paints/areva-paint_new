/* Private building-photo uploads are scoped to a warranty entry session. Saved
 * registrations own their attachments permanently; temporary cleanup never deletes
 * referenced files. Only the owning entry or an authenticated admin can read them.
 */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir } from "../admin/content-store";
import { writePrivateJson } from "./storage";
import { rateLimit } from "./security";
import type { ReceiptInfo } from "../warranty/types";

export const MAX_BUILDING_PHOTOS = 5;
const maxBytes = 5 * 1024 * 1024;
const directory = () => path.join(dataDir, "warranty-site-photos");
const metadata = () => path.join(dataDir, "warranty-site-uploads.json");
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
type Upload = { photo: ReceiptInfo; session: string; until: number };
const read = (): Record<string, Upload> =>
  fs.existsSync(metadata())
    ? JSON.parse(fs.readFileSync(metadata(), "utf8"))
    : {};

/* Never accept a filesystem path or extension from the browser. */
export function sitePhotoPath(photo: ReceiptInfo): string {
  const extension = (
    {
      "image/jpeg": "jpeg",
      "image/png": "png",
      "image/webp": "webp",
    } as Record<string, string>
  )[photo.mime];
  if (!uuid(photo.id) || !extension) throw Error("Invalid building photo.");
  return path.join(directory(), photo.id + "." + extension);
}

/* Receipt and building photos share the existing bounded private upload budget. */
export function privateWarrantyStorageBytes(): number {
  return ["warranty-receipts", "warranty-site-photos"].reduce((total, name) => {
    const folder = path.join(dataDir, name);
    return (
      total +
      (fs.existsSync(folder)
        ? fs.readdirSync(folder).reduce((sum, file) => {
            const stat = fs.lstatSync(path.join(folder, file));
            return sum + (stat.isFile() ? stat.size : 0);
          }, 0)
        : 0)
    );
  }, 0);
}

/* Expire only unattached uploads, preserving references even after a partial cleanup failure. */
function prune(): Record<string, Upload> {
  const uploads = read();
  const file = path.join(dataDir, "warranties.json");
  const records = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : [];
  if (!Array.isArray(records)) throw Error("Invalid warranty store");
  const referenced = new Set(
    records.flatMap((row) =>
      (row.sitePhotos ?? []).map((photo: ReceiptInfo) => photo.id),
    ),
  );
  let changed = false;
  for (const [id, upload] of Object.entries(uploads)) {
    if (upload.until <= Date.now() || referenced.has(id)) {
      const file = sitePhotoPath(upload.photo);
      if (!referenced.has(id) && fs.existsSync(file)) fs.unlinkSync(file);
      delete uploads[id];
      changed = true;
    }
  }
  if (changed) writePrivateJson(metadata(), uploads);
  return uploads;
}

export function validateSitePhotos(
  ids: unknown,
  session: string,
): ReceiptInfo[] {
  if (ids === undefined) return [];
  if (
    !Array.isArray(ids) ||
    ids.length > MAX_BUILDING_PHOTOS ||
    new Set(ids).size !== ids.length ||
    !ids.every(uuid)
  )
    throw Error("Attach up to five different building photos.");
  const uploads = prune();
  return ids.map((id) => {
    const upload = uploads[id];
    if (
      !upload ||
      upload.session !== session ||
      !fs.existsSync(sitePhotoPath(upload.photo))
    )
      throw Error(
        "Attach each building photo after uploading it in this registration session.",
      );
    return upload.photo;
  });
}

export function consumeSitePhotos(photos: ReceiptInfo[]) {
  if (!photos.length) return;
  const uploads = read();
  for (const photo of photos) delete uploads[photo.id];
  writePrivateJson(metadata(), uploads);
}

export function createBuildingPhotoRouter(
  requireWarranty: express.RequestHandler,
  sessionKey: (req: express.Request) => string,
) {
  const router = express.Router();
  router.use(requireWarranty);
  router.post(
    "/",
    rateLimit(30, 60 * 60000),
    express.json({ limit: "8mb" }),
    (req, res) => {
      const match =
        typeof req.body?.data === "string" &&
        req.body.data.match(
          /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
        );
      if (!match)
        return res.status(400).json({
          error: "Choose a JPEG, PNG or WebP building photo up to 5 MB.",
        });
      const bytes = Buffer.from(match[2], "base64"),
        mime = match[1];
      const valid =
        bytes.length >= 12 &&
        bytes.length <= maxBytes &&
        (mime === "image/png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : mime === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : bytes.toString("ascii", 0, 4) === "RIFF" &&
              bytes.toString("ascii", 8, 12) === "WEBP");
      if (!valid)
        return res
          .status(400)
          .json({ error: "The building photo is invalid or exceeds 5 MB." });
      const uploads = prune(),
        session = sessionKey(req);
      if (
        Object.keys(uploads).length >= 5000 ||
        Object.values(uploads).filter((upload) => upload.session === session)
          .length >= MAX_BUILDING_PHOTOS
      )
        return res
          .status(429)
          .json({ error: "Keep up to five building photos per registration." });
      const configured = Number(process.env.WARRANTY_STORAGE_MB || "128");
      const limit =
        Number.isFinite(configured) && configured > 0
          ? configured * 1024 * 1024
          : 128 * 1024 * 1024;
      if (privateWarrantyStorageBytes() + bytes.length > limit)
        return res.status(507).json({
          error:
            "Private warranty storage is full. Please contact Areva Paints.",
        });
      const photo: ReceiptInfo = {
        id: crypto.randomUUID(),
        mime,
        bytes: bytes.length,
        name:
          typeof req.body.name === "string"
            ? path
                .basename(req.body.name)
                .replace(/[\x00-\x1f\x7f]/g, "")
                .slice(0, 150) || "Building photo"
            : "Building photo",
      };
      fs.mkdirSync(directory(), { recursive: true, mode: 0o700 });
      const file = sitePhotoPath(photo);
      let created = false;
      try {
        fs.writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
        created = true;
        uploads[photo.id] = {
          photo,
          session,
          until: Date.now() + 24 * 3600000,
        };
        writePrivateJson(metadata(), uploads);
      } catch (error) {
        if (created && fs.existsSync(file)) fs.unlinkSync(file);
        throw error;
      }
      res.status(201).json(photo);
    },
  );
  router.get("/:id", (req, res) => {
    const upload = uuid(req.params.id) ? prune()[req.params.id] : null;
    if (
      !upload ||
      upload.session !== sessionKey(req) ||
      !fs.existsSync(sitePhotoPath(upload.photo))
    )
      return res.status(404).json({ error: "Building photo not found." });
    res.setHeader("Cache-Control", "no-store");
    res.type(upload.photo.mime).sendFile(sitePhotoPath(upload.photo));
  });
  router.delete("/:id", (req, res) => {
    const uploads = prune(),
      upload = uuid(req.params.id) ? uploads[req.params.id] : null;
    if (!upload || upload.session !== sessionKey(req))
      return res.status(404).json({ error: "Building photo not found." });
    if (fs.existsSync(sitePhotoPath(upload.photo)))
      fs.unlinkSync(sitePhotoPath(upload.photo));
    delete uploads[req.params.id];
    writePrivateJson(metadata(), uploads);
    res.json({ removed: true });
  });
  return router;
}
