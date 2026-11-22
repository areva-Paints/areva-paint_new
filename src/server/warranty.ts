/*
 * Manage warranty demo entry, scoped sessions, private receipts, idempotent registration and admin review/search/PDF routes.
 * Demo OTP never marks a phone as verified; final review decisions are immutable.
 */
import {
  createBuildingPhotoRouter,
  validateSitePhotos,
  consumeSitePhotos,
  sitePhotoPath,
} from "./warranty-site-photos";
import { createWarrantyPdf } from "./warranty-pdf";
import { recordWarrantyHistoryAccess } from "./warranty-history-access";
import { warrantySearch } from "./warranty-search";
import express from "express";
import crypto from "node:crypto";
import { validContactPhone } from "../data/contactDetails";
import fs from "node:fs";
import path from "node:path";
import { dataDir, readContent } from "../admin/content-store";
import { currentUser, requireAdmin } from "../admin/accounts";
import { CATEGORIES } from "../data/paintsData";
import { writePrivateJson, writePrivateUpload } from "./storage";
import {
  supportedFileBytes,
  warrantyUploadBytes,
  uploadBudgetBytes,
} from "./upload-files";
import { DOCUMENT_MAX_BYTES } from "../data/uploadLimits";
import { rateLimit, sensitiveRequestGuard } from "./security";
import {
  DEMO_OTP,
  WARRANTY_HISTORY_LIMIT,
  normalizeWarrantyReference,
  WARRANTY_STATUSES,
  isFinalWarrantyStatus,
  type WarrantyStatus,
  type ReceiptInfo,
  type WarrantyRegistration,
} from "../warranty/types";

type Session = { mobile: string; until: number };
type Challenge = { mobile: string; until: number; attempts: number };
type Upload = { receipt: ReceiptInfo; session: string; until: number };
type Row = WarrantyRegistration & { submissionId: string };
const sessions = new Map<string, Session>(),
  challenges = new Map<string, Challenge>();
const cookieName = "areva_warranty";
/* Locate private saved warranty registrations in the persistent data directory. */
const storeFile = () => path.join(dataDir, "warranties.json");
/* Locate private receipt files outside every public static root. */
const receiptDir = () => path.join(dataDir, "warranty-receipts");
/* Locate pending private receipt metadata used during registration. */
const uploadsFile = () => path.join(dataDir, "warranty-uploads.json");
/* Validate identifiers before using them for private registration lookups. */
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
/* Hash opaque public-entry values rather than storing their raw comparison material. */
const digest = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
/* Enable only the implemented demo mode or disable new warranty entry. */
const mode = () =>
  (process.env.WARRANTY_OTP_MODE || "demo") === "demo" ? "demo" : "disabled";
/* Read a private JSON file with an explicit empty-store fallback. */
function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : fallback;
}
/* Normalize compatible older records while preserving their login-phone and review snapshots. */
export function readWarranties(): Row[] {
  const rows = readJson<Row[]>(storeFile(), []);
  if (!Array.isArray(rows)) throw Error("Invalid warranty store");
  return rows.map((row) => ({
    ...row,
    loginMobile: row.loginMobile ?? row.mobile,
    sitePhotos: row.sitePhotos ?? [],
    version: row.version ?? 1,
    reviewNotes: row.reviewNotes ?? "",
    reviewedBy: row.reviewedBy ?? "",
    reviewedAt: row.reviewedAt ?? null,
    approvalConfirmed: row.approvalConfirmed ?? false,
    reviewHistory: row.reviewHistory ?? [],
  }));
}
/* Read the opaque warranty-session cookie independently from admin accounts. */
const sessionKey = (req: express.Request) =>
  digest(
    req.headers.cookie
      ?.split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) || "",
  );
/* Resolve a live warranty session without treating demo entry as phone verification. */
function current(req: express.Request): Session | null {
  const key = sessionKey(req),
    session = sessions.get(key);
  if (mode() !== "demo" || !session || session.until <= Date.now()) {
    sessions.delete(key);
    return null;
  }
  return session;
}
/* Refuse receipt or registration actions when the scoped warranty session is absent or expired. */
const requireWarranty: express.RequestHandler = (req, res, next) => {
  if (!current(req))
    return res.status(401).json({
      error:
        "Your registration session expired. Enter your mobile number again.",
    });
  next();
};
/* Discard expired demo challenges and warranty sessions from bounded in-memory maps. */
function prune() {
  const now = Date.now();
  for (const [id, value] of challenges)
    if (value.until <= now) challenges.delete(id);
  for (const [id, value] of sessions)
    if (value.until <= now) sessions.delete(id);
}
/* Use the India calendar date for purchase/application validation. */
export function indiaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("-");
}
/* Reject impossible or unsupported purchase/application calendar dates. */
function date(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1900-01-01" ||
    value > indiaToday()
  )
    return false;
  const parsed = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
/* Normalize a supported Indian mobile number to its +91 snapshot form. */
function mobile(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[ ()-]/g, "");
  return /^(?:\+91|91)?[6-9]\d{9}$/.test(normalized)
    ? "+91" + normalized.slice(-10)
    : null;
}
/* Remove expired unattached receipts while keeping files already used by registrations. */
function pruneUploads() {
  const uploads = readJson<Record<string, Upload>>(uploadsFile(), {});
  let changed = false;
  const referenced = new Set(readWarranties().map((row) => row.receipt.id));
  for (const [id, upload] of Object.entries(uploads))
    if (upload.until <= Date.now()) {
      const file = receiptPath(upload.receipt);
      if (!referenced.has(id) && fs.existsSync(file)) fs.unlinkSync(file);
      delete uploads[id];
      changed = true;
    }
  if (changed) writePrivateJson(uploadsFile(), uploads);
  return uploads;
}
/* Resolve only server-generated private receipt filenames inside the receipt directory. */
function receiptPath(receipt: ReceiptInfo) {
  if (!uuid(receipt.id)) throw Error("Invalid receipt identifier");
  const ext = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/webp": "webp",
  }[receipt.mime];
  if (!ext) throw Error("Invalid receipt type");
  return path.join(receiptDir(), receipt.id + "." + ext);
}

export const warrantyRouter = express.Router();
warrantyRouter.use(sensitiveRequestGuard);
/* GET /options: Return product/dealer choices required by the warranty form, without private records. */
warrantyRouter.get("/options", (_req, res) => {
  const content = readContent();
  res.json({
    otpMode: mode(),
    today: indiaToday(),
    categories: CATEGORIES,
    products: content.products,
    dealers: content.dealers,
  });
});
/* Allocate a bounded demo challenge; this endpoint sends no SMS or WhatsApp message. */
warrantyRouter.post(
  "/otp/request",
  rateLimit(5, 15 * 60000),
  express.json({ limit: "4kb" }),
  (req, res) => {
    if (mode() !== "demo")
      return res.status(503).json({
        error:
          "Mobile OTP delivery is not configured yet. Please try again later.",
      });
    const phone = mobile(req.body?.mobile);
    if (!phone)
      return res
        .status(400)
        .json({ error: "Enter a valid 10-digit Indian mobile number." });
    prune();
    const existing = [...challenges.values()].find(
      (value) => value.mobile === phone && value.until > Date.now() + 4 * 60000,
    );
    if (existing) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({
        error: "Please wait 60 seconds before requesting another code.",
      });
    }
    if (challenges.size >= 2000)
      return res
        .status(503)
        .json({ error: "Registration is busy. Please try again later." });
    const challengeId = crypto.randomUUID();
    challenges.set(challengeId, {
      mobile: phone,
      until: Date.now() + 5 * 60000,
      attempts: 0,
    });
    res.json({
      challengeId,
      expiresIn: 300,
      resendAfter: 60,
      mode: "demo",
      demoCode: DEMO_OTP,
      message:
        "Demo only. No SMS or WhatsApp message was sent; the mobile number is not actually verified.",
    });
  },
);
/* Exchange the demo challenge/code for a scoped session, keeping mobileVerified false. */
warrantyRouter.post(
  "/otp/verify",
  rateLimit(20, 15 * 60000),
  express.json({ limit: "4kb" }),
  (req, res) => {
    prune();
    const challenge = uuid(req.body?.challengeId)
      ? challenges.get(req.body.challengeId)
      : null;
    if (mode() !== "demo" || !challenge)
      return res
        .status(400)
        .json({ error: "This code expired. Request a new one." });
    if (challenge.attempts >= 5) {
      challenges.delete(req.body.challengeId);
      return res
        .status(429)
        .json({ error: "Too many incorrect codes. Request a new one." });
    }
    challenge.attempts++;
    if (typeof req.body.code !== "string" || req.body.code !== DEMO_OTP)
      return res.status(400).json({
        error:
          "Incorrect demo code. Use the six-digit code shown on this page.",
      });
    if (sessions.size >= 2000)
      return res
        .status(503)
        .json({ error: "Registration is busy. Please try again later." });
    challenges.delete(req.body.challengeId);
    sessions.delete(sessionKey(req));
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(digest(token), {
      mobile: challenge.mobile,
      until: Date.now() + 30 * 60000,
    });
    res
      .cookie(cookieName, token, {
        httpOnly: true,
        sameSite: "strict",
        secure: req.secure,
        maxAge: 30 * 60000,
        path: "/api/warranty",
      })
      .json({ mobile: challenge.mobile, mode: "demo", mobileVerified: false });
  },
);
/* GET /session: Return only the current safe warranty/public-account session details. */
warrantyRouter.get("/session", requireWarranty, (req, res) =>
  res.json({
    mobile: current(req)!.mobile,
    mode: "demo",
    mobileVerified: false,
  }),
);
/* A demo code is not phone verification. Return only minimal summaries for full,
 * unguessable references the customer already holds AND the session's login phone.
 * The posted phone, admin review notes, receipts and private files are never used
 * to broaden this lookup. An empty request never reveals whether a phone exists.
 */
warrantyRouter.post(
  "/registrations/history",
  requireWarranty,
  rateLimit(60, 15 * 60000),
  express.json({ limit: "12kb" }),
  (req, res) => {
    const input = req.body?.references;
    if (!Array.isArray(input) || input.length > WARRANTY_HISTORY_LIMIT)
      return res
        .status(400)
        .json({ error: "Provide up to 100 complete registration references." });
    const normalized = input.map(normalizeWarrantyReference);
    if (normalized.some((reference) => !reference))
      return res.status(400).json({
        error: "Enter complete registration references starting with ARV-WR-.",
      });
    const references = new Set(normalized);
    const phone = current(req)?.mobile;
    if (!phone)
      return res.status(401).json({
        error:
          "Your registration session expired. Enter your mobile number again.",
      });
    const matched = references.size
      ? readWarranties()
          .filter(
            (row) => row.loginMobile === phone && references.has(row.reference),
          )
          .sort(
            (a, b) =>
              b.createdAt.localeCompare(a.createdAt) ||
              a.reference.localeCompare(b.reference),
          )
      : [];
    recordWarrantyHistoryAccess(
      matched.map((row) => row.id),
      sessionKey(req),
    );
    const registrations = matched.map(
      ({
        reference,
        productName,
        categoryName,
        purchaseDate,
        createdAt,
        status,
      }) => ({
        reference,
        productName,
        categoryName,
        purchaseDate,
        createdAt,
        status,
      }),
    );
    res.json({ registrations, total: registrations.length });
  },
);
/* POST /logout: Invalidate the scoped session and expire its cookie. */
warrantyRouter.post("/logout", (req, res) => {
  sessions.delete(sessionKey(req));
  res
    .clearCookie(cookieName, { path: "/api/warranty" })
    .json({ success: true });
});
warrantyRouter.use(
  "/site-photos",
  createBuildingPhotoRouter(requireWarranty, sessionKey),
);
/* POST /receipt: Validate receipt bytes and ownership before saving them privately. */
warrantyRouter.post(
  "/receipt",
  requireWarranty,
  rateLimit(10, 60 * 60000),
  express.json({ limit: "8mb" }),
  (req, res) => {
    const match =
      typeof req.body?.data === "string" &&
      req.body.data.match(
        /^data:(application\/pdf|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
      );
    if (!match)
      return res
        .status(400)
        .json({ error: "Upload a PDF, JPEG, PNG or WebP receipt up to 5 MB." });
    const bytes = Buffer.from(match[2], "base64"),
      mime = match[1];
    const valid =
      bytes.length <= DOCUMENT_MAX_BYTES && supportedFileBytes(bytes, mime);
    if (!valid)
      return res
        .status(400)
        .json({ error: "The receipt is invalid or exceeds 5 MB." });
    const uploads = pruneUploads();
    if (
      Object.keys(uploads).length >= 5000 ||
      Object.values(uploads).filter(
        (upload) => upload.session === sessionKey(req),
      ).length >= 3
    )
      return res.status(429).json({
        error:
          "Keep up to three receipt uploads per session. Submit a registration or try again later.",
      });
    fs.mkdirSync(receiptDir(), { recursive: true, mode: 0o700 });
    const total = warrantyUploadBytes(dataDir);
    const limit = uploadBudgetBytes(process.env.WARRANTY_STORAGE_MB, 128);
    if (total + bytes.length > limit)
      return res.status(507).json({
        error: "Receipt storage is full. Please contact Areva Paints.",
      });
    const receipt: ReceiptInfo = {
      id: crypto.randomUUID(),
      name:
        typeof req.body.name === "string"
          ? path
              .basename(req.body.name)
              .replace(/[\x00-\x1f\x7f]/g, "")
              .slice(0, 150) || "Purchase receipt"
          : "Purchase receipt",
      mime,
      bytes: bytes.length,
    };
    const file = receiptPath(receipt);
    writePrivateUpload(file, bytes, () => {
      uploads[receipt.id] = {
        receipt,
        session: sessionKey(req),
        until: Date.now() + 24 * 3600000,
      };
      writePrivateJson(uploadsFile(), uploads);
    });
    res.status(201).json(receipt);
  },
);
/* Validate and idempotently save the purchase with its session-owned private receipt. */
warrantyRouter.post(
  "/registrations",
  requireWarranty,
  rateLimit(5, 60 * 60000),
  express.json({ limit: "32kb" }),
  (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return res.status(400).json({ error: "Send a registration form." });
    try {
      const session = current(req)!;
      if (!uuid(body.submissionId))
        throw Error("Reload the registration form and try again.");
      const rows = readWarranties();
      // A retry after a slow response returns the same registration, not a duplicate.
      const previous = rows.find(
        (row) =>
          row.submissionId === body.submissionId &&
          row.mobile === session.mobile,
      );
      if (previous)
        return res.json({
          id: previous.id,
          reference: previous.reference,
          status: previous.status,
        });
      /* Validate a bounded text field before accepting it into a stored record. */
      const text = (key: string, max: number, required = false) => {
        const value = body[key] ?? "";
        if (
          typeof value !== "string" ||
          value.length > max ||
          /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) ||
          (required && !value.trim())
        )
          throw Error(
            "Enter a valid " + key + " (up to " + max + " characters).",
          );
        return value.trim();
      };
      const input = {
        customerName: text("customerName", 150, true),
        email: text("email", 160),
        alternateMobile: text("alternateMobile", 25),
        productId: text("productId", 100, true),
        purchaseDate: text("purchaseDate", 10, true),
        quantity: text("quantity", 20, true),
        packSize: text("packSize", 100, true),
        batchNumber: text("batchNumber", 100),
        shade: text("shade", 150),
        dealerId: text("dealerId", 100),
        dealerName: text("dealerName", 200, true),
        dealerPhone: text("dealerPhone", 25),
        dealerAddress: text("dealerAddress", 500, true),
        dealerCity: text("dealerCity", 150, true),
        invoiceNumber: text("invoiceNumber", 100, true),
        siteAddress: text("siteAddress", 500, true),
        city: text("city", 150, true),
        state: text("state", 150, true),
        pinCode: text("pinCode", 6, true),
        applicationDate: text("applicationDate", 10),
        paintedArea: text("paintedArea", 20),
        applicatorName: text("applicatorName", 150),
        applicatorPhone: text("applicatorPhone", 25),
        notes: text("notes", 2000),
        consent: body.consent === true,
      };
      if (!input.consent)
        throw Error(
          "Confirm the information and contact consent before submitting.",
        );
      if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
        throw Error("Enter a valid email address.");
      for (const key of [
        "alternateMobile",
        "dealerPhone",
        "applicatorPhone",
      ] as const)
        if (input[key] && !validContactPhone(input[key]))
          throw Error("Enter a valid " + key + ".");
      if (!/^[0-9]{6}$/.test(input.pinCode))
        throw Error("Enter a six-digit site PIN code.");
      if (
        !date(input.purchaseDate) ||
        (input.applicationDate &&
          (!date(input.applicationDate) ||
            input.applicationDate < input.purchaseDate))
      )
        throw Error(
          "Use valid purchase/application dates, with completion on or after purchase and no future dates.",
        );
      for (const key of ["quantity", "paintedArea"] as const)
        if (
          (input[key] || key === "quantity") &&
          (!/^\d+(?:\.\d{1,2})?$/.test(input[key]) ||
            Number(input[key]) <= 0 ||
            Number(input[key]) > 100000)
        )
          throw Error("Enter a positive " + key + " up to 100,000.");
      const content = readContent(),
        product = content.products.find((p) => p.id === input.productId);
      if (!product) throw Error("Select a current Areva product.");
      if (
        input.dealerId &&
        !content.dealers.some((d) => d.id === input.dealerId)
      )
        throw Error("Select a current dealer or choose another dealer.");
      const uploads = pruneUploads(),
        upload = uuid(body.receiptId) ? uploads[body.receiptId] : null;
      if (
        !upload ||
        upload.session !== sessionKey(req) ||
        !fs.existsSync(receiptPath(upload.receipt))
      )
        throw Error(
          "Attach your purchase receipt in this registration session.",
        );
      if (rows.length >= 10000)
        return res.status(507).json({
          error: "Registration storage is full. Please contact Areva Paints.",
        });
      const sitePhotos = validateSitePhotos(body.sitePhotoIds, sessionKey(req));
      const id = crypto.randomUUID(),
        reference =
          "ARV-WR-" + indiaToday().replace(/-/g, "") + "-" + id.toUpperCase();
      const row: Row = {
        ...input,
        id,
        reference,
        mobile: session.mobile,
        loginMobile: session.mobile,
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        productName: product.name,
        warrantyYears: product.specs.warrantyYears,
        warrantyLabel: product.specs.warrantyLabel || "Performance warranty",
        verificationMode: "demo",
        mobileVerified: false,
        status: "pending_review",
        version: 1,
        reviewNotes: "",
        reviewedBy: "",
        reviewedAt: null,
        approvalConfirmed: false,
        reviewHistory: [],
        receipt: upload.receipt,
        sitePhotos,
        createdAt: new Date().toISOString(),
        submissionId: body.submissionId,
      };
      writePrivateJson(storeFile(), [row, ...rows]);
      try {
        consumeSitePhotos(sitePhotos);
      } catch {
        /* Durable registrations retain ownership; pruning checks references. */
      }
      // A submitted receipt must never be removed by temporary-upload cleanup.
      delete uploads[row.receipt.id];
      try {
        writePrivateJson(uploadsFile(), uploads);
      } catch {
        /* Preserve the durable registration; cleanup also checks references. */
      }
      res
        .status(201)
        .json({ id: row.id, reference: row.reference, status: row.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/^(Enter |Use |Select |Attach |Confirm |Reload )/.test(message))
        return res.status(400).json({ error: message });
      throw error;
    }
  },
);

export const warrantyAdminRouter = express.Router();
warrantyAdminRouter.use(requireAdmin);
/* Validate admin date filters before applying inclusive calendar-day bounds. */
function validFilterDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const parsed = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
/* Select a safe admin response, omitting internal idempotency/session storage keys. */
const publicRow = ({
  submissionId: _privateSubmission,
  ...row
}: Row): WarrantyRegistration => row;
/* GET /: Search private registrations with validated category/status and inclusive date-range filters. */
warrantyAdminRouter.get("/", (req, res) => {
  const keys = ["search", "category", "status", "dateBy", "from", "to", "page"];
  if (
    keys.some(
      (key) =>
        req.query[key] !== undefined && typeof req.query[key] !== "string",
    )
  )
    return res
      .status(400)
      .json({ error: "Use a single value for each search filter." });
  const query = String(req.query.search || "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  const category = String(req.query.category || "");
  const status = String(req.query.status || "");
  const dateBy = String(req.query.dateBy || "registration");
  const from = String(req.query.from || ""),
    to = String(req.query.to || "");
  if (
    (category && !CATEGORIES.some((c) => c.id === category)) ||
    (status && !Object.hasOwn(WARRANTY_STATUSES, status))
  )
    return res
      .status(400)
      .json({ error: "Choose a valid product type and review status." });
  if (
    !["registration", "purchase"].includes(dateBy) ||
    (from && !validFilterDate(from)) ||
    (to && !validFilterDate(to)) ||
    (from && to && from > to)
  )
    return res
      .status(400)
      .json({ error: "Choose a valid date range with From on or before To." });
  const lower = from ? Date.parse(from + "T00:00:00+05:30") : -Infinity;
  const upper = to ? Date.parse(to + "T23:59:59.999+05:30") : Infinity;
  const matchesSearch = warrantySearch(query);
  const rows = readWarranties().filter((row) => {
    if (
      (category && row.categoryId !== category) ||
      (status && row.status !== status)
    )
      return false;
    if (from || to) {
      if (dateBy === "purchase") {
        if ((from && row.purchaseDate < from) || (to && row.purchaseDate > to))
          return false;
      } else {
        const time = Date.parse(row.createdAt);
        if (!Number.isFinite(time) || time < lower || time > upper)
          return false;
      }
    }
    return matchesSearch(row);
  });
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const page = Math.min(
    pages,
    typeof req.query.page === "string" && /^\d+$/.test(req.query.page)
      ? Math.max(1, Math.min(10000, Number(req.query.page)))
      : 1,
  );
  res.json({
    total: rows.length,
    page,
    pages,
    registrations: rows.slice((page - 1) * 20, page * 20).map(publicRow),
  });
});
/* GET /:id: Load the complete private registration snapshot for an authorized admin. */
warrantyAdminRouter.get("/:id", (req, res) => {
  const row = uuid(req.params.id)
    ? readWarranties().find((row) => row.id === req.params.id)
    : null;
  if (!row) return res.status(404).json({ error: "Registration not found." });
  res.json({ registration: publicRow(row) });
});
/* PATCH /:id: Save a version-checked review, require reasons/confirmation and lock final decisions. */
warrantyAdminRouter.patch("/:id", rateLimit(60, 60000), (req, res) => {
  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some(
      (key) =>
        !["status", "notes", "expectedVersion", "approvalConfirmed"].includes(
          key,
        ),
    ) ||
    typeof body.status !== "string" ||
    !Object.hasOwn(WARRANTY_STATUSES, body.status) ||
    typeof body.notes !== "string" ||
    body.notes.length > 2000 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body.notes) ||
    !Number.isSafeInteger(body.expectedVersion) ||
    body.expectedVersion < 1 ||
    typeof body.approvalConfirmed !== "boolean"
  )
    return res.status(400).json({
      error:
        "Choose a review decision, notes up to 2,000 characters and the current record version.",
    });
  const status = body.status as WarrantyStatus,
    notes = body.notes.trim();
  if (["rejected", "needs_information"].includes(status) && !notes)
    return res
      .status(400)
      .json({ error: "Add a reason or explain what information is needed." });
  if (status === "approved" && body.approvalConfirmed !== true)
    return res.status(400).json({
      error:
        "Confirm that you reviewed the purchase details and receipt before approving. Mobile verification remains unchanged.",
    });
  const rows = readWarranties(),
    index = uuid(req.params.id)
      ? rows.findIndex((row) => row.id === req.params.id)
      : -1;
  if (index < 0)
    return res.status(404).json({ error: "Registration not found." });
  const previous = rows[index];
  if (previous.version !== body.expectedVersion)
    return res.status(409).json({
      error:
        "Another admin has reviewed this registration. Reload the latest record before saving.",
    });
  const approvalConfirmed = status === "approved";
  if (
    previous.status === status &&
    previous.reviewNotes === notes &&
    previous.approvalConfirmed === approvalConfirmed
  )
    return res.json({ registration: publicRow(previous) });
  if (isFinalWarrantyStatus(previous.status))
    return res.status(409).json({
      error:
        "This registration already has a final decision. Approval and rejection details cannot be changed.",
    });
  if (status === "approved" && !fs.existsSync(receiptPath(previous.receipt)))
    return res.status(409).json({
      error:
        "The receipt file is missing. Restore the purchase receipt before approving this registration.",
    });
  const actor = currentUser(req)!.username,
    at = new Date().toISOString();
  const next: Row = {
    ...previous,
    status,
    reviewNotes: notes,
    reviewedBy: actor,
    reviewedAt: at,
    approvalConfirmed,
    version: previous.version + 1,
    reviewHistory: [
      ...previous.reviewHistory,
      { id: crypto.randomUUID(), status, actor, at, notes, approvalConfirmed },
    ],
  };
  rows[index] = next;
  writePrivateJson(storeFile(), rows);
  res.json({ registration: publicRow(next) });
});
let activeReports = 0;
/* GET /:id/report.pdf: Generate a private PDF only for a saved final decision. */
warrantyAdminRouter.get(
  "/:id/report.pdf",
  rateLimit(30, 60000),
  async (req, res, next) => {
    let started = false;
    try {
      const row = uuid(req.params.id)
        ? readWarranties().find((row) => row.id === req.params.id)
        : null;
      if (!row)
        return res.status(404).json({ error: "Registration not found." });
      if (!isFinalWarrantyStatus(row.status))
        return res.status(409).json({
          error: "A decision PDF is available after approval or rejection.",
        });
      if (activeReports >= 2) {
        res.setHeader("Retry-After", "5");
        return res
          .status(503)
          .json({ error: "PDF generation is busy. Please try again shortly." });
      }
      activeReports++;
      started = true;
      const pdf = await createWarrantyPdf(row);
      // A logout or account revocation during generation must also revoke this response.
      if (!currentUser(req))
        return res.status(401).json({ error: "Please sign in as an admin." });
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="Areva-Warranty-' + row.reference + '.pdf"',
      );
      res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
      res.send(pdf);
    } catch (error) {
      next(error);
    } finally {
      if (started) activeReports--;
    }
  },
);
/* GET /:id/receipt: Stream an admin-authorized private receipt with download and sandbox headers. */
warrantyAdminRouter.get("/:id/receipt", (req, res) => {
  const row = uuid(req.params.id)
    ? readWarranties().find((row) => row.id === req.params.id)
    : null;
  if (!row) return res.status(404).json({ error: "Registration not found." });
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  res.download(
    receiptPath(row.receipt),
    "Areva-" +
      row.id +
      "." +
      {
        "application/pdf": "pdf",
        "image/png": "png",
        "image/jpeg": "jpeg",
        "image/webp": "webp",
      }[row.receipt.mime],
  );
});

/* Building photos are private attachments owned by the selected registration. */
warrantyAdminRouter.get("/:id/site-photos/:photoId", (req, res) => {
  const row = uuid(req.params.id)
    ? readWarranties().find((item) => item.id === req.params.id)
    : null;
  const photo = row?.sitePhotos?.find((item) => item.id === req.params.photoId);
  if (!photo || !fs.existsSync(sitePhotoPath(photo)))
    return res.status(404).json({ error: "Building photo not found." });
  res.setHeader("Cache-Control", "no-store");
  if (req.query.download === "1")
    return res.download(sitePhotoPath(photo), photo.name);
  res.type(photo.mime).sendFile(sitePhotoPath(photo));
});
