import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir, readContent, saveContent } from "./content-store";
import { CATEGORIES, COLOR_SHADES } from "../data/paintsData";
import type { SiteContent } from "./content-types";

export const contentRouter = express.Router();
const sessions = new Map<string, number>();
const attempts = new Map<string, { count: number; until: number }>();
const hash = (v: string) => crypto.createHash("sha256").update(v).digest();
const cookieToken = (req: express.Request) =>
  req.headers.cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("areva_admin="))
    ?.slice(12) || "";
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
contentRouter.post("/admin/login", (req, res) => {
  const testLogin =
    process.env.ADMIN_TEST_LOGIN === "true" && !process.env.ADMIN_PASSWORD;
  const password =
    process.env.ADMIN_PASSWORD || (testLogin ? "ArevaTest2026!" : "");
  const username = process.env.ADMIN_USERNAME || "admin";
  if (!password || password.length < 12)
    return res.status(503).json({
      error:
        "Set ADMIN_PASSWORD on the server to at least 12 characters, then restart to enable administration.",
    });
  const key = req.ip || "local",
    now = Date.now(),
    a = attempts.get(key);
  if (a && a.until > now && a.count >= 8)
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again in 15 minutes." });
  if (
    typeof req.body.password !== "string" ||
    typeof (req.body.username ?? "admin") !== "string" ||
    !crypto.timingSafeEqual(
      hash(req.body.username ?? "admin"),
      hash(username),
    ) ||
    !crypto.timingSafeEqual(hash(req.body.password), hash(password))
  ) {
    attempts.set(key, {
      count: a && a.until > now ? a.count + 1 : 1,
      until: a && a.until > now ? a.until : now + 900000,
    });
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  attempts.delete(key);
  for (const [token, until] of sessions)
    if (until < now) sessions.delete(token);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, now + 8 * 3600000);
  res
    .cookie("areva_admin", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: req.secure,
      maxAge: 8 * 3600000,
      path: "/",
    })
    .json({ success: true });
});
contentRouter.use("/admin", (req, res, next) => {
  if ((sessions.get(cookieToken(req)) || 0) < Date.now())
    return res.status(401).json({ error: "Please sign in." });
  next();
});
contentRouter.get("/admin/session", (_req, res) =>
  res.json({ authenticated: true }),
);
contentRouter.post("/admin/logout", (req, res) => {
  sessions.delete(cookieToken(req));
  res.clearCookie("areva_admin", { path: "/" }).json({ success: true });
});
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
  const families = new Set(COLOR_SHADES.map((c) => c.family));
  const codes = new Set<string>();
  for (const colour of c.colours) {
    if (
      !nonempty(colour.name, 150) ||
      typeof colour.code !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(colour.code) ||
      !/^#[0-9A-Fa-f]{6}$/.test(colour.hex) ||
      !families.has(colour.family) ||
      !Array.isArray(colour.goesWellWith) ||
      colour.goesWellWith.length > 20 ||
      !colour.goesWellWith.every((v) => /^#[0-9A-Fa-f]{6}$/.test(v))
    )
      throw Error(
        "Each colour needs a name, valid code, six-digit HEX value and colour family.",
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
      typeof card.url !== "string" ||
      !/^\/uploads\/[a-f0-9-]+\.pdf$/.test(card.url) ||
      !fs.existsSync(path.join(dataDir, "uploads", path.basename(card.url)))
    )
      throw Error("Shade cards need a title and an uploaded PDF.");
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
      ![
        "Ultra Matte",
        "Soft Sheen",
        "Satin Silk",
        "High Gloss",
        "Textured",
      ].includes(p.sheen) ||
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
contentRouter.put("/admin/content", (req, res) => {
  try {
    const current = readContent(),
      c = req.body as SiteContent;
    c.galleryProjects ??= current.galleryProjects;
    c.colours ??= current.colours;
    c.shadeCards ??= current.shadeCards;
    validate(c);
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
    const next = {
      galleryProjects,
      colours: c.colours,
      shadeCards: c.shadeCards,
      products: c.products,
      dealers: c.dealers,
      landingImages: c.landingImages,
      revision: current.revision + 1,
    };
    saveContent(next);
    res.json(next);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
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
