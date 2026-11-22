/*
 * Expose public content separately from authenticated editing, history and upload APIs.
 * Validate complete CMS payloads and restrict published documents to verified local PDF uploads.
 */
import { sensitiveRequestGuard, rateLimit } from "../server/security";
import { ValidationError } from "../server/validation-error";
import {
  supportedFileBytes,
  uploadedBytes,
  uploadBudgetBytes,
} from "../server/upload-files";
import {
  DOCUMENT_MAX_BYTES,
  CATALOGUE_IMAGE_MAX_BYTES,
} from "../data/uploadLimits";
import { writePrivateUpload } from "../server/storage";
import { prepareCertifications } from "./certification-store";
import { validContactPhone } from "../data/contactDetails";
import { GALLERY_PROJECT_CATEGORIES } from "../data/galleryCategories";
import { OPTIONAL_PRODUCT_DETAILS } from "../data/productDetails";
import {
  COLOUR_FAMILIES,
  LEGACY_SHADE_FAMILIES,
  SHADE_TONES,
  normalizeShade,
} from "../data/shadeFamilies";
import {
  adminLogin,
  adminLogout,
  requireAdmin,
  currentUser,
  adminSessionTiming,
  recordAdminInteraction,
  usersRouter,
  publicAccountRouter,
} from "./accounts";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  dataDir,
  readContent,
  readPublicContent,
  saveContent,
  readActivity,
  recordActivity,
} from "./content-store";
import { CATEGORIES, COLOR_SHADES } from "../data/paintsData";
import type { SiteContent } from "./content-types";
import { ADMIN_ACTIVITY_MAX_DELAY_MS } from "./session-policy";

import { activityEvent, contentActivity } from "./activity";
import {
  ACTIVITY_SECTIONS,
  ACTIVITY_TABS,
  type ActivitySection,
} from "./activity-types";

export const contentRouter = express.Router();
contentRouter.use("/admin", sensitiveRequestGuard);
contentRouter.use("/auth", publicAccountRouter);
contentRouter.post("/admin/login", adminLogin);
contentRouter.post("/admin/logout", adminLogout);
contentRouter.use("/admin", requireAdmin);
contentRouter.use("/admin/users", usersRouter);
/* Resolve the current admin name for saved activity records. */
const adminActor = (req: express.Request) => currentUser(req)!.username;
/* GET /admin/history: Filter and paginate saved private activity with validated query values. */
contentRouter.get("/admin/history", (req, res) => {
  const selectedTab = ACTIVITY_TABS.find(
    (tab) => tab.id === (req.query.tab || "all"),
  );
  if (!selectedTab)
    return res.status(400).json({ error: "Choose a valid history tab." });
  const selectedSections: readonly ActivitySection[] | null =
    selectedTab.sections;
  const history = readActivity();
  const latest: Record<string, string> = {};
  const lastSection: Record<string, string> = {};
  let lastPublishedAt: string | null = null;
  for (const event of history.events) {
    if (event.action === "published") lastPublishedAt = event.at;
    if (["created", "updated", "deleted", "reordered"].includes(event.action))
      lastSection[event.section] = event.at;
    if (event.entityId && ["created", "updated"].includes(event.action))
      latest[event.section + ":" + event.entityId] = event.at;
  }
  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim().toLowerCase().slice(0, 200)
      : "";
  const filtered = history.events
    .filter(
      (event) =>
        (!selectedSections || selectedSections.includes(event.section)) &&
        (!req.query.section || event.section === req.query.section) &&
        (!req.query.action || event.action === req.query.action) &&
        (!search ||
          [event.label, event.actor, event.fileUrl, ...event.fields]
            .join(" ")
            .toLowerCase()
            .includes(search)),
    )
    .reverse();
  /* Validate bounded finite numbers used in product calculation metadata. */
  const positive = (value: unknown, fallback: number) =>
    typeof value === "string" &&
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
      ? Number(value)
      : fallback;
  const pageSize = Math.min(50, positive(req.query.pageSize, 25));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, positive(req.query.page, 1));
  res.json({
    events: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    pages,
    startedAt: history.startedAt,
    totalEvents: history.events.length,
    latest,
    lastSection,
    lastPublishedAt,
  });
});
/* GET /admin/session: Check the current admin identity and authoritative idle/absolute deadlines. */
contentRouter.get("/admin/session", (req, res) => {
  const timing = adminSessionTiming(req),
    user = currentUser(req);
  if (!timing || !user)
    return res.status(401).json({ error: "Please sign in as an admin." });
  res.json({ authenticated: true, user, timing });
});
/* POST /admin/activity: Accept real interaction timing only for a still-valid admin session. */
contentRouter.post("/admin/activity", rateLimit(120, 60000), (req, res) => {
  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "idleForMs") ||
    !Number.isFinite(body.idleForMs) ||
    body.idleForMs < 0 ||
    body.idleForMs > ADMIN_ACTIVITY_MAX_DELAY_MS
  )
    return res
      .status(400)
      .json({ error: "Send a recent interaction delay in milliseconds." });
  const timing = recordAdminInteraction(req, body.idleForMs);
  if (!timing)
    return res.status(401).json({ error: "Please sign in as an admin." });
  res.json({ timing });
});
/* GET /content: Publish a curated CMS snapshot with no credentials, history or draft documents. */
contentRouter.get("/content", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(readPublicContent());
});
/* GET /admin/content: Read or atomically save a complete private CMS revision after validation. */
contentRouter.get("/admin/content", (_req, res) => res.json(readContent()));
/* Validate the entire CMS payload before any revision or file write. */
function validate(c: SiteContent) {
  /* Validate a bounded text field before accepting it into a stored record. */
  const text = (v: unknown, max = 3000) =>
    typeof v === "string" && v.length <= max;
  /* Require a bounded, nonblank editor text value. */
  const nonempty = (v: unknown, max = 3000) =>
    text(v, max) && (v as string).trim().length > 0;
  /* Accept supported public image references without allowing executable URL schemes. */
  const image = (v: unknown) => {
    if (!text(v, 2048) || /[\s\\<>"'\x00-\x1f\x7f]/.test(v as string))
      return false;
    if (/^\/(?!\/)/.test(v as string)) return true;
    try {
      const url = new URL(v as string);
      return (
        url.protocol === "https:" &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  };
  /* Require a plain record before validating nested content. */
  const record = (v: unknown): v is Record<string, unknown> =>
    Boolean(v) && typeof v === "object" && !Array.isArray(v);
  /* Reject invalid or duplicate entity identifiers within a content collection. */
  const ids = (items: { id: string }[]) =>
    items.every(
      (x) => record(x) && nonempty(x.id, 100) && /^[\w-]+$/.test(x.id),
    ) && new Set(items.map((x) => x.id)).size === items.length;
  /* Restrict campaign destinations to valid HTTPS URLs. */
  const webLink = (v: string) => {
    if (!text(v, 2048) || !/^https:\/\/[^\s<>"']+$/i.test(v)) return false;
    try {
      const url = new URL(v);
      return (
        url.protocol === "https:" &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  };
  if (
    !c ||
    !Array.isArray(c.products) ||
    !c.products.length ||
    c.products.length > 200 ||
    !Array.isArray(c.dealers) ||
    c.dealers.length > 500 ||
    !Array.isArray(c.landingImages) ||
    c.landingImages.length > 12
  )
    throw new ValidationError(
      "Keep 1–200 products, up to 500 dealers and 12 landing images.",
    );
  if (
    !Array.isArray(c.colours) ||
    !c.colours.length ||
    c.colours.length > 5000 ||
    !Array.isArray(c.shadeCards) ||
    c.shadeCards.length > 50
  )
    throw new ValidationError(
      "Keep 1–5,000 colours and up to 50 PDF shade cards.",
    );
  if (
    !Array.isArray(c.galleryProjects) ||
    c.galleryProjects.length > 100 ||
    !ids(c.galleryProjects)
  )
    throw new ValidationError(
      "Keep up to 100 projects, each with a unique identifier.",
    );
  /* Validate album metadata and every image before staging project changes. */
  for (const project of c.galleryProjects) {
    project.location ??= "";
    project.description ??= "";
    if (
      !nonempty(project.title, 150) ||
      typeof project.category !== "string" ||
      !Object.hasOwn(GALLERY_PROJECT_CATEGORIES, project.category) ||
      !text(project.location, 200) ||
      !text(project.description, 2000) ||
      !Array.isArray(project.photos) ||
      !project.photos.length ||
      project.photos.length > 20 ||
      !ids(project.photos)
    )
      throw new ValidationError(
        "Each project needs a name and 1–20 photos. Location and description are optional.",
      );
    for (const photo of project.photos) {
      photo.caption ??= "";
      if (!image(photo.image) || !text(photo.caption, 300))
        throw new ValidationError(
          "Project photos need a valid image; captions are optional.",
        );
    }
  }
  if (
    !Array.isArray(c.galleryAds) ||
    c.galleryAds.length > 100 ||
    !ids(c.galleryAds)
  )
    throw new ValidationError(
      "Keep up to 100 ads, each with a unique identifier.",
    );
  /* Validate campaign channels and require a safe image or HTTPS destination. */
  for (const ad of c.galleryAds) {
    ad.image ??= "";
    ad.description ??= "";
    ad.link ??= "";
    if (
      !nonempty(ad.title, 150) ||
      !["digital", "social"].includes(ad.channel) ||
      !text(ad.description, 2000) ||
      !text(ad.image, 2048) ||
      !text(ad.link, 2048) ||
      (!ad.image && !ad.link) ||
      (ad.image && !image(ad.image)) ||
      (ad.link && !webLink(ad.link))
    )
      throw new ValidationError(
        "Each ad needs a title, Digital or Social media channel, and an image or HTTPS video/post link. Description is optional.",
      );
  }
  if (
    !Array.isArray(c.galleryReviews) ||
    c.galleryReviews.length > 100 ||
    !ids(c.galleryReviews)
  )
    throw new ValidationError(
      "Keep up to 100 reviews, each with a unique identifier.",
    );
  /* Treat review/customer text as bounded content and require safe optional portraits. */
  for (const review of c.galleryReviews) {
    review.detail ??= "";
    review.image ??= "";
    if (
      !nonempty(review.name, 150) ||
      !text(review.detail, 200) ||
      !nonempty(review.text, 2000) ||
      !text(review.image, 2048) ||
      (review.image && !image(review.image))
    )
      throw new ValidationError(
        "Each review needs a reviewer name and review text. Add a valid image and location/description if required.",
      );
  }
  /* Validate shared shade metadata and a case-insensitive unique code namespace. */
  const families = new Set<string>([
    ...COLOUR_FAMILIES,
    ...LEGACY_SHADE_FAMILIES,
  ]);
  const codes = new Set<string>();
  for (const colour of c.colours) {
    if (
      !record(colour) ||
      !nonempty(colour.name, 150) ||
      typeof colour.code !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(colour.code) ||
      !/^#[0-9A-Fa-f]{6}$/.test(colour.hex) ||
      !families.has(colour.family) ||
      !validTones(colour.tones) ||
      !Array.isArray(colour.goesWellWith) ||
      colour.goesWellWith.length > 20 ||
      !colour.goesWellWith.every((v) => /^#[0-9A-Fa-f]{6}$/.test(v))
    )
      throw new ValidationError(
        "Each colour needs a name, valid code, six-digit HEX value, supported colour family and valid tone tags.",
      );
    const code = colour.code.trim().toUpperCase();
    if (codes.has(code))
      throw new ValidationError(
        "Colour codes must be unique, regardless of letter case.",
      );
    codes.add(code);
  }
  if (!ids(c.shadeCards))
    throw new ValidationError("PDF shade cards need unique identifiers.");
  /* Accept only local uploaded shade PDFs that still exist on the server. */
  for (const card of c.shadeCards)
    if (
      !nonempty(card.title, 150) ||
      (card.family !== undefined &&
        card.family !== "All Shades" &&
        !COLOUR_FAMILIES.includes(card.family)) ||
      !validTones(card.tones) ||
      typeof card.url !== "string" ||
      !/^\/uploads\/[a-f0-9-]+\.pdf$/.test(card.url) ||
      !fs.existsSync(path.join(dataDir, "uploads", path.basename(card.url)))
    )
      throw new ValidationError(
        "Shade cards need a title, an uploaded PDF and valid family/tone tags.",
      );
  if (!ids(c.products) || !ids(c.dealers) || !ids(c.landingImages))
    throw new ValidationError("Each entry needs a unique identifier.");
  if (!c.products.some((p) => p.coverageSqFtPerLiter > 0))
    throw new ValidationError(
      "Keep at least one product with configured coverage for the calculator.",
    );
  /* Validate calculator numbers and technical display values as separate product concerns. */
  for (const p of c.products) {
    if (
      !nonempty(p.name, 150) ||
      !nonempty(p.description) ||
      !text(p.tagline, 500) ||
      !CATEGORIES.some((x) => x.id === p.categoryId) ||
      !text(p.categoryName, 100) ||
      !image(p.image) ||
      !Number.isFinite(p.coverageSqFtPerLiter) ||
      p.coverageSqFtPerLiter < 0 ||
      p.coverageSqFtPerLiter > 10000 ||
      !Number.isInteger(p.recommendedCoats) ||
      p.recommendedCoats < 1 ||
      p.recommendedCoats > 10
    )
      throw new ValidationError(
        "Products need a name, description, valid image, category, nonnegative coverage and 1–10 coats.",
      );
    if (
      !nonempty(p.sheen, 100) ||
      !["Zero VOC (<5g/L)", "Low VOC (<30g/L)", "Standard"].includes(
        p.vocLevel,
      ) ||
      ![
        "Class 1 (Scrubbable)",
        "High Washable",
        "Wipeable",
        "Specialist",
      ].includes(p.washability) ||
      typeof p.tintable !== "boolean" ||
      (p.featured !== undefined && typeof p.featured !== "boolean") ||
      !Array.isArray(p.availableSizes) ||
      !p.availableSizes.length ||
      p.availableSizes.length > 20 ||
      p.availableSizes.some((v) => !Number.isFinite(v) || v <= 0 || v > 1000)
    )
      throw new ValidationError("Invalid product specifications.");
    if (
      (p.coverageUnit !== undefined && !["L", "kg"].includes(p.coverageUnit)) ||
      (p.calculationBasis !== undefined &&
        !["wall", "floor"].includes(p.calculationBasis))
    )
      throw new ValidationError("Invalid coverage unit or calculation basis.");
    if (
      !record(p.specs) ||
      ![
        "dryingTime",
        "recoatTime",
        "thinnedWith",
        "surfacePreparation",
        "applicationMethod",
      ].every((k) => text(p.specs[k])) ||
      !Array.isArray(p.specs.recommendedSurfaces) ||
      p.specs.recommendedSurfaces.length > 30 ||
      !p.specs.recommendedSurfaces.every((x) => text(x, 200)) ||
      !Number.isFinite(p.specs.warrantyYears) ||
      p.specs.warrantyYears < 0 ||
      p.specs.warrantyYears > 100
    )
      throw new ValidationError("Invalid technical details.");
    if (
      (p.specs.coverageText !== undefined &&
        !text(p.specs.coverageText, 300)) ||
      (p.specs.dilution !== undefined && !text(p.specs.dilution, 300)) ||
      (p.specs.warrantyLabel !== undefined &&
        !text(p.specs.warrantyLabel, 100)) ||
      !["bases", "packing"].every(
        (key) =>
          p.specs[key] === undefined ||
          (Array.isArray(p.specs[key]) &&
            p.specs[key].length <= (key === "bases" ? 30 : 20) &&
            p.specs[key].every((value) => nonempty(value, 100))),
      )
    )
      throw new ValidationError(
        "Invalid product coverage text, dilution, bases, packing or warranty label.",
      );
  }
  /* Require usable dealer contacts and preserve bounded public address metadata. */
  for (const d of c.dealers)
    if (
      !["name", "city", "state", "address", "phone"].every((k) =>
        nonempty(d[k], 500),
      ) ||
      !/^\d{6}$/.test(d.pin) ||
      !validContactPhone(d.phone) ||
      !Array.isArray(d.badges) ||
      d.badges.length > 10 ||
      !d.badges.every((x) => text(x, 100))
    )
      throw new ValidationError(
        "Dealers need contact details and a six-digit PIN code.",
      );
  /* Validate landing artwork while allowing optional campaign captions. */
  for (const l of c.landingImages) {
    l.label ??= "";
    l.roomType ??= "";
    l.recommendedProduct ??= "";
    if (
      !text(l.label, 150) ||
      !image(l.image) ||
      !text(l.roomType, 150) ||
      !text(l.recommendedProduct, 200)
    )
      throw new ValidationError(
        "Landing images need a valid image. Caption, subtitle and recommended product are optional.",
      );
  }
  /* Reject references to missing public uploads instead of saving broken CMS media. */
  for (const image of [
    ...c.landingImages,
    ...c.products,
    ...c.galleryProjects.flatMap((p) => p.photos),
    ...c.galleryAds,
    ...c.galleryReviews,
  ]) {
    if (
      image.image.startsWith("/uploads/") &&
      (!/^\/uploads\/[a-f0-9-]+\.(png|jpeg|webp)$/.test(image.image) ||
        !fs.existsSync(
          path.join(dataDir, "uploads", path.basename(image.image)),
        ))
    )
      throw new ValidationError(
        "An uploaded image is missing. Edit the affected entry and upload it again before saving.",
      );
  }
}
/* Accept only supported, unique shade-tone values. */
function validTones(tones: unknown): boolean {
  return (
    tones === undefined ||
    (Array.isArray(tones) &&
      tones.length <= SHADE_TONES.length &&
      new Set(tones).size === tones.length &&
      tones.every((t) => SHADE_TONES.includes(t)))
  );
}
/* PUT /admin/content: Read or atomically save a complete private CMS revision after validation. */
contentRouter.put("/admin/content", (req, res, next) => {
  try {
    const current = readContent(),
      c = req.body as SiteContent;
    c.galleryProjects ??= current.galleryProjects;
    if (Array.isArray(c.galleryProjects))
      for (const project of c.galleryProjects) {
        if (
          project &&
          typeof project === "object" &&
          project.category === undefined
        )
          project.category =
            current.galleryProjects.find((old) => old.id === project.id)
              ?.category ?? "other";
      }
    c.galleryAds ??= current.galleryAds;
    c.galleryReviews ??= current.galleryReviews;
    if (c.certifications === undefined)
      c.certifications = current.certifications;
    c.colours ??= current.colours;
    c.shadeCards ??= current.shadeCards;
    validate(c);
    const previousProducts = new Map(
      current.products.map((product) => [product.id, product]),
    );
    c.products = c.products.map((product) => {
      const previous = previousProducts.get(product.id);
      const specs = { ...product.specs };
      for (const key of OPTIONAL_PRODUCT_DETAILS) {
        if (specs[key] === undefined && previous?.specs[key] !== undefined)
          (specs as any)[key] = previous.specs[key];
      }
      return { ...product, specs };
    });
    const previousShades = new Map(
      current.colours.map((shade) => [shade.code.toUpperCase(), shade]),
    );
    c.colours = c.colours.map((shade) =>
      normalizeShade({
        ...shade,
        tones:
          shade.tones ?? previousShades.get(shade.code.toUpperCase())?.tones,
      }),
    );
    c.shadeCards = c.shadeCards.map((card) => {
      const old = current.shadeCards.find(
        (previous) => previous.id === card.id,
      );
      return {
        ...card,
        family: card.family ?? old?.family ?? "All Shades",
        tones: card.tones ?? old?.tones ?? [],
      };
    });
    if (c.revision !== current.revision)
      return res.status(409).json({
        error:
          "Someone else saved changes. Reload this page before editing again.",
      });
    const now = new Date().toISOString();
    const certifications = prepareCertifications(
      c.certifications,
      current.certifications,
      c.products,
      current.products,
      now,
    );
    const galleryProjects = c.galleryProjects.map((project) => {
      const previous = current.galleryProjects.find((p) => p.id === project.id);
      const fields = {
        id: project.id,
        category: project.category,
        title: project.title.trim(),
        location: project.location,
        description: project.description,
        photos: project.photos.map((p) => ({
          id: p.id,
          image: p.image,
          caption: p.caption,
        })),
      };
      const unchanged =
        previous &&
        JSON.stringify({
          ...fields,
          createdAt: previous.createdAt,
          updatedAt: previous.updatedAt,
        }) ===
          JSON.stringify({
            id: previous.id,
            category: previous.category,
            title: previous.title,
            location: previous.location,
            description: previous.description,
            photos: previous.photos,
            createdAt: previous.createdAt,
            updatedAt: previous.updatedAt,
          });
      return {
        ...fields,
        createdAt: previous?.createdAt || now,
        updatedAt: unchanged ? previous.updatedAt : now,
      };
    });
    const galleryReviews = c.galleryReviews.map((review) => {
      const previous = current.galleryReviews.find(
        (item) => item.id === review.id,
      );
      const fields = {
        id: review.id,
        name: review.name.trim(),
        detail: review.detail.trim(),
        text: review.text.trim(),
        image: review.image.trim(),
      };
      const unchanged =
        previous &&
        JSON.stringify(fields) ===
          JSON.stringify({
            id: previous.id,
            name: previous.name,
            detail: previous.detail,
            text: previous.text,
            image: previous.image,
          });
      return {
        ...fields,
        createdAt: previous?.createdAt || now,
        updatedAt: unchanged ? previous.updatedAt : now,
      };
    });
    const next = {
      certifications,
      galleryReviews,
      galleryProjects,
      galleryAds: c.galleryAds.map((ad) => {
        const previous = current.galleryAds.find((p) => p.id === ad.id);
        const fields = {
          id: ad.id,
          title: ad.title.trim(),
          channel: ad.channel,
          image: ad.image,
          description: ad.description,
          link: ad.link,
        };
        const unchanged =
          previous &&
          JSON.stringify(fields) ===
            JSON.stringify({
              id: previous.id,
              title: previous.title,
              channel: previous.channel,
              image: previous.image,
              description: previous.description,
              link: previous.link,
            });
        return {
          ...fields,
          createdAt: previous?.createdAt || now,
          updatedAt: unchanged ? previous.updatedAt : now,
        };
      }),
      colours: c.colours,
      shadeCards: c.shadeCards,
      products: c.products,
      dealers: c.dealers,
      landingImages: c.landingImages,
      revision: current.revision + 1,
    };
    saveContent(next, contentActivity(current, next, adminActor(req)));
    res.json(next);
  } catch (error) {
    if (error instanceof ValidationError)
      return res.status(400).json({ error: error.message });
    next(error);
  }
});
/* Associate an authenticated upload with a private activity event. */
function uploadedActivity(
  req: express.Request,
  url: string,
  bytes: number,
  pdf = false,
) {
  const section: ActivitySection =
    typeof req.body.section === "string" &&
    Object.hasOwn(ACTIVITY_SECTIONS, req.body.section) &&
    [
      "landingImages",
      "products",
      "galleryProjects",
      "galleryAds",
      "galleryReviews",
      "shadeCards",
      "certifications",
    ].includes(req.body.section)
      ? req.body.section
      : "uploads";
  const name =
    typeof req.body.originalName === "string"
      ? req.body.originalName
          .replace(/[\x00-\x1f\x7f]/g, "")
          .slice(0, 200)
          .trim()
      : "";
  recordActivity(
    activityEvent(
      adminActor(req),
      "uploaded",
      section,
      name || (pdf ? "PDF uploaded" : "Image uploaded"),
      { fileUrl: url, bytes },
    ),
  );
}
/* Refuse new uploads that would exceed the shared disk budget without removing files. */
function uploadCapacity(dir: string, bytes: number) {
  return (
    uploadedBytes([dir]) + bytes <=
    uploadBudgetBytes(process.env.UPLOAD_STORAGE_MB, 512)
  );
}
/* POST /admin/pdf-upload: Validate a PDF signature, filename and budget before recording a public document upload. */
contentRouter.post("/admin/pdf-upload", (req, res) => {
  const match =
    typeof req.body.data === "string" &&
    req.body.data.match(/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/);
  if (!match)
    return res.status(400).json({ error: "Choose a PDF up to 5 MB." });
  const bytes = Buffer.from(match[1], "base64");
  if (
    bytes.length > DOCUMENT_MAX_BYTES ||
    !supportedFileBytes(bytes, "application/pdf")
  )
    return res
      .status(400)
      .json({ error: "The file is not a valid PDF, or exceeds 5 MB." });
  const dir = path.join(dataDir, "uploads");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const name = crypto.randomUUID() + ".pdf";
  if (!uploadCapacity(dir, bytes.length))
    return res.status(507).json({
      error: "Upload storage is full. Contact the website administrator.",
    });
  writePrivateUpload(path.join(dir, name), bytes, () =>
    uploadedActivity(
      req,
      "/uploads/" + name,
      bytes.length,
      name.endsWith(".pdf"),
    ),
  );
  res.status(201).json({ url: "/uploads/" + name });
});
/* POST /admin/upload: Validate supported image bytes and storage budget before assigning a server filename. */
contentRouter.post("/admin/upload", (req, res) => {
  const match =
    typeof req.body.data === "string" &&
    req.body.data.match(
      /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/,
    );
  if (!match)
    return res.status(400).json({ error: "Choose a JPEG, PNG or WebP image." });
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > CATALOGUE_IMAGE_MAX_BYTES || bytes.length < 12)
    return res
      .status(400)
      .json({ error: "Image must be between 12 bytes and 25 MB." });
  const valid = supportedFileBytes(bytes, "image/" + match[1]);
  if (!valid)
    return res
      .status(400)
      .json({ error: "Image content does not match its file type." });
  const dir = path.join(dataDir, "uploads");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const name = crypto.randomUUID() + "." + match[1];
  if (!uploadCapacity(dir, bytes.length))
    return res.status(507).json({
      error: "Upload storage is full. Contact the website administrator.",
    });
  writePrivateUpload(path.join(dir, name), bytes, () =>
    uploadedActivity(
      req,
      "/uploads/" + name,
      bytes.length,
      name.endsWith(".pdf"),
    ),
  );
  res.status(201).json({ url: "/uploads/" + name });
});
contentRouter.use("/content/legacy-image", (req, res) => {
  const index = Number(req.path.slice(1));
  if (!Number.isInteger(index) || index < 0 || index > 100)
    return res.sendStatus(404);
  const html = fs.readFileSync(
    path.resolve("public/assets/aistudio/areva-paints_a2364c60.html"),
    "utf8",
  );
  const block = html.slice(
    html.indexOf("const P = ["),
    html.indexOf("const $ ="),
  );
  const line = block.split("\n").filter((l) => l.trim().startsWith('["'))[
    index
  ];
  const image = line?.match(/"(data:image\/[^;]+;base64,[^"]+)"/);
  if (!image) return res.sendStatus(404);
  const [header, body] = image[1].split(",");
  res.type(header.slice(5).split(";")[0]).send(Buffer.from(body, "base64"));
});
/* Serve only allowed public media filenames with download/security headers for PDFs. */
export function uploads() {
  const directory = path.join(dataDir, "uploads");
  const serve = express.static(directory, {
    dotfiles: "deny",
    index: false,
    setHeaders(res, file) {
      if (file.endsWith(".pdf")) {
        res.setHeader("Content-Disposition", "attachment");
        res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  });
  return ((req, res, next) => {
    let name: string;
    try {
      name = decodeURIComponent(req.path);
    } catch {
      return res.sendStatus(400);
    }
    if (
      !/^\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\.(?:pdf|png|jpeg|webp)$/.test(
        name,
      )
    )
      return res.sendStatus(404);
    try {
      if (!fs.lstatSync(path.join(directory, name.slice(1))).isFile())
        return res.sendStatus(404);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return res.sendStatus(404);
      return next(error);
    }
    return serve(req, res, next);
  }) as express.RequestHandler;
}
