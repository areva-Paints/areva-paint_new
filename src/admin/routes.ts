import { OPTIONAL_PRODUCT_DETAILS } from '../data/productDetails';
import { COLOUR_FAMILIES, LEGACY_SHADE_FAMILIES, SHADE_TONES, normalizeShade } from '../data/shadeFamilies';
import {
  adminLogin,
  adminLogout,
  requireAdmin,
  currentUser,
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
  saveContent,
  readActivity,
  recordActivity,
} from "./content-store";
import { CATEGORIES, COLOR_SHADES } from "../data/paintsData";
import type { SiteContent } from "./content-types";

import { activityEvent, contentActivity } from "./activity";
import {
  ACTIVITY_SECTIONS,
  ACTIVITY_TABS,
  type ActivitySection,
} from "./activity-types";

export const contentRouter = express.Router();
contentRouter.use("/admin", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
contentRouter.use("/admin", (req, res, next) => {
  if (
    !["GET", "HEAD"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== `${req.protocol}://${req.get("host")}`
  )
    return res
      .status(403)
      .json({ error: "Cross-origin requests are not allowed." });
  next();
});
contentRouter.use("/auth", publicAccountRouter);
contentRouter.post("/admin/login", adminLogin);
contentRouter.post("/admin/logout", adminLogout);
contentRouter.use("/admin", requireAdmin);
contentRouter.use("/admin/users", usersRouter);
const adminActor = (req: express.Request) => currentUser(req)!.username;
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
contentRouter.get("/admin/session", (req, res) =>
  res.json({ authenticated: true, user: currentUser(req) }),
);
contentRouter.get("/content", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(readContent());
});
contentRouter.get("/admin/content", (_req, res) => res.json(readContent()));
function validate(c: SiteContent) {
  const text = (v: unknown, max = 3000) =>
    typeof v === "string" && v.length <= max;
  const nonempty = (v: unknown, max = 3000) =>
    text(v, max) && (v as string).trim().length > 0;
  const image = (v: unknown) =>
    text(v, 2048) &&
    (/^\/(?!\/)[^\s<>"']*$/.test(v as string) ||
      /^https:\/\/[^\s<>"']+$/.test(v as string));
  const ids = (items: { id: string }[]) =>
    items.every((x) => nonempty(x.id, 100) && /^[\w-]+$/.test(x.id)) &&
    new Set(items.map((x) => x.id)).size === items.length;
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
    throw Error(
      "Keep 1–200 products, up to 500 dealers and 12 landing images.",
    );
  if (
    !Array.isArray(c.colours) ||
    !c.colours.length ||
    c.colours.length > 5000 ||
    !Array.isArray(c.shadeCards) ||
    c.shadeCards.length > 50
  )
    throw Error("Keep 1–5,000 colours and up to 50 PDF shade cards.");
  if (
    !Array.isArray(c.galleryProjects) ||
    c.galleryProjects.length > 100 ||
    !ids(c.galleryProjects)
  )
    throw Error("Keep up to 100 projects, each with a unique identifier.");
  for (const project of c.galleryProjects) {
    project.location ??= "";
    project.description ??= "";
    if (
      !nonempty(project.title, 150) ||
      !text(project.location, 200) ||
      !text(project.description, 2000) ||
      !Array.isArray(project.photos) ||
      !project.photos.length ||
      project.photos.length > 20 ||
      !ids(project.photos)
    )
      throw Error(
        "Each project needs a name and 1–20 photos. Location and description are optional.",
      );
    for (const photo of project.photos) {
      photo.caption ??= "";
      if (!image(photo.image) || !text(photo.caption, 300))
        throw Error(
          "Project photos need a valid image; captions are optional.",
        );
    }
  }
  if (
    !Array.isArray(c.galleryAds) ||
    c.galleryAds.length > 100 ||
    !ids(c.galleryAds)
  )
    throw Error("Keep up to 100 ads, each with a unique identifier.");
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
      throw Error(
        "Each ad needs a title, Digital or Social media channel, and an image or HTTPS video/post link. Description is optional.",
      );
  }
  if (!Array.isArray(c.galleryReviews) || c.galleryReviews.length > 100 || !ids(c.galleryReviews))
    throw Error("Keep up to 100 reviews, each with a unique identifier.");
  for (const review of c.galleryReviews) {
    review.detail ??= "";
    review.image ??= "";
    if (!nonempty(review.name, 150) || !text(review.detail, 200) || !nonempty(review.text, 2000) || !text(review.image, 2048) || (review.image && !image(review.image)))
      throw Error("Each review needs a reviewer name and review text. Add a valid image and location/description if required.");
  }
  const families = new Set<string>([...COLOUR_FAMILIES, ...LEGACY_SHADE_FAMILIES]);
  const codes = new Set<string>();
  for (const colour of c.colours) {
    if (
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
      throw Error(
        "Each colour needs a name, valid code, six-digit HEX value, supported colour family and valid tone tags.",
      );
    const code = colour.code.trim().toUpperCase();
    if (codes.has(code))
      throw Error("Colour codes must be unique, regardless of letter case.");
    codes.add(code);
  }
  if (!ids(c.shadeCards))
    throw Error("PDF shade cards need unique identifiers.");
  for (const card of c.shadeCards)
    if (
      !nonempty(card.title, 150) ||
      (card.family !== undefined && card.family !== "All Shades" && !COLOUR_FAMILIES.includes(card.family)) ||
      !validTones(card.tones) ||
      typeof card.url !== "string" ||
      !/^\/uploads\/[a-f0-9-]+\.pdf$/.test(card.url) ||
      !fs.existsSync(path.join(dataDir, "uploads", path.basename(card.url)))
    )
      throw Error("Shade cards need a title, an uploaded PDF and valid family/tone tags.");
  if (!ids(c.products) || !ids(c.dealers) || !ids(c.landingImages))
    throw Error("Each entry needs a unique identifier.");
  if (!c.products.some((p) => p.coverageSqFtPerLiter > 0))
    throw Error(
      "Keep at least one product with configured coverage for the calculator.",
    );
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
      throw Error(
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
      throw Error("Invalid product specifications.");
    if (
      (p.coverageUnit !== undefined && !["L", "kg"].includes(p.coverageUnit)) ||
      (p.calculationBasis !== undefined &&
        !["wall", "floor"].includes(p.calculationBasis))
    )
      throw Error("Invalid coverage unit or calculation basis.");
    if (
      !p.specs ||
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
      throw Error("Invalid technical details.");
    if ((p.specs.coverageText !== undefined && !text(p.specs.coverageText, 300)) || (p.specs.dilution !== undefined && !text(p.specs.dilution, 300)) || (p.specs.warrantyLabel !== undefined && !text(p.specs.warrantyLabel, 100)) || !['bases','packing'].every(key => p.specs[key] === undefined || (Array.isArray(p.specs[key]) && p.specs[key].length <= (key === 'bases' ? 30 : 20) && p.specs[key].every(value => nonempty(value, 100)))))
      throw Error("Invalid product coverage text, dilution, bases, packing or warranty label.");
  }
  for (const d of c.dealers)
    if (
      !["name", "city", "state", "address", "phone"].every((k) =>
        nonempty(d[k], 500),
      ) ||
      !/^\d{6}$/.test(d.pin) ||
      !/^\+?[\d ()-]{7,25}$/.test(d.phone) ||
      !Array.isArray(d.badges) ||
      d.badges.length > 10 ||
      !d.badges.every((x) => text(x, 100))
    )
      throw Error("Dealers need contact details and a six-digit PIN code.");
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
      throw Error(
        "Landing images need a valid image. Caption, subtitle and recommended product are optional.",
      );
  }
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
      throw Error(
        "An uploaded image is missing. Edit the affected entry and upload it again before saving.",
      );
  }
}
function validTones(tones: unknown): boolean {
  return tones === undefined || (Array.isArray(tones) && tones.length <= SHADE_TONES.length && new Set(tones).size === tones.length && tones.every(t => SHADE_TONES.includes(t)));
}
contentRouter.put("/admin/content", (req, res) => {
  try {
    const current = readContent(),
      c = req.body as SiteContent;
    c.galleryProjects ??= current.galleryProjects;
    c.galleryAds ??= current.galleryAds;
    c.galleryReviews ??= current.galleryReviews;
    c.colours ??= current.colours;
    c.shadeCards ??= current.shadeCards;
    validate(c);
    const previousProducts = new Map(current.products.map(product=>[product.id,product]));
    c.products = c.products.map(product=>{
      const previous = previousProducts.get(product.id);
      const specs = { ...product.specs };
      for (const key of OPTIONAL_PRODUCT_DETAILS) {
        if (specs[key] === undefined && previous?.specs[key] !== undefined) (specs as any)[key] = previous.specs[key];
      }
      return { ...product, specs };
    });
    const previousShades = new Map(current.colours.map(shade => [shade.code.toUpperCase(), shade]));
    c.colours = c.colours.map(shade => normalizeShade({
      ...shade,
      tones: shade.tones ?? previousShades.get(shade.code.toUpperCase())?.tones,
    }));
    c.shadeCards = c.shadeCards.map(card => { const old = current.shadeCards.find(previous => previous.id === card.id); return { ...card, family: card.family ?? old?.family ?? "All Shades", tones: card.tones ?? old?.tones ?? [] }; });
    if (c.revision !== current.revision)
      return res.status(409).json({
        error:
          "Someone else saved changes. Reload this page before editing again.",
      });
    const now = new Date().toISOString();
    const galleryProjects = c.galleryProjects.map((project) => {
      const previous = current.galleryProjects.find((p) => p.id === project.id);
      const fields = {
        id: project.id,
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
    const galleryReviews = c.galleryReviews.map(review => {
      const previous = current.galleryReviews.find(item => item.id === review.id);
      const fields = { id: review.id, name: review.name.trim(), detail: review.detail.trim(), text: review.text.trim(), image: review.image.trim() };
      const unchanged = previous && JSON.stringify(fields) === JSON.stringify({ id: previous.id, name: previous.name, detail: previous.detail, text: previous.text, image: previous.image });
      return { ...fields, createdAt: previous?.createdAt || now, updatedAt: unchanged ? previous.updatedAt : now };
    });
    const next = {
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
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
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
      name || (pdf ? "PDF shade card uploaded" : "Image uploaded"),
      { fileUrl: url, bytes },
    ),
  );
}
contentRouter.post("/admin/pdf-upload", (req, res) => {
  const match =
    typeof req.body.data === "string" &&
    req.body.data.match(/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/);
  if (!match)
    return res
      .status(400)
      .json({ error: "Choose a PDF shade card up to 5 MB." });
  const bytes = Buffer.from(match[1], "base64");
  if (
    bytes.length < 12 ||
    bytes.length > 5 * 1024 * 1024 ||
    bytes.toString("ascii", 0, 5) !== "%PDF-" ||
    !bytes
      .subarray(Math.max(0, bytes.length - 1024))
      .includes(Buffer.from("%%EOF"))
  )
    return res
      .status(400)
      .json({ error: "The file is not a valid PDF, or exceeds 5 MB." });
  const dir = path.join(dataDir, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const name = crypto.randomUUID() + ".pdf";
  fs.writeFileSync(path.join(dir, name), bytes);
  uploadedActivity(
    req,
    "/uploads/" + name,
    bytes.length,
    name.endsWith(".pdf"),
  );
  res.status(201).json({ url: "/uploads/" + name });
});
contentRouter.post("/admin/upload", (req, res) => {
  const match =
    typeof req.body.data === "string" &&
    req.body.data.match(
      /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/,
    );
  if (!match)
    return res.status(400).json({ error: "Choose a JPEG, PNG or WebP image." });
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 25 * 1024 * 1024 || bytes.length < 12)
    return res
      .status(400)
      .json({ error: "Image must be between 12 bytes and 25 MB." });
  const valid =
    match[1] === "png"
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === "jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid)
    return res
      .status(400)
      .json({ error: "Image content does not match its file type." });
  const dir = path.join(dataDir, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const name = crypto.randomUUID() + "." + match[1];
  fs.writeFileSync(path.join(dir, name), bytes);
  uploadedActivity(
    req,
    "/uploads/" + name,
    bytes.length,
    name.endsWith(".pdf"),
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
export function uploads() {
  return express.static(path.join(dataDir, "uploads"), {
    setHeaders(res, file) {
      if (file.endsWith(".pdf"))
        res.setHeader("Content-Disposition", "attachment");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  });
}
