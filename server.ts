/*
 * Assemble the Express service: security precedes body parsing, private APIs precede static files, and only development loads Vite.
 * Persistent records live in CONTENT_DATA_DIR.
 */
import "dotenv/config";
import { warrantyRouter, warrantyAdminRouter } from "./src/server/warranty";
import {
  securityHeaders,
  publicCors,
  sensitiveRequestGuard,
  rateLimit,
  errorHandler,
} from "./src/server/security";
import { createEnquiry, readEnquiries } from "./src/server/enquiries";
import {
  COLOUR_FAMILIES,
  SHADE_TONES,
  filterShades,
} from "./src/data/shadeFamilies";
import { requireAdmin } from "./src/admin/accounts";
import { contentRouter, uploads } from "./src/admin/routes";
import { readContent, dataDir } from "./src/admin/content-store";
import { legacyPage } from "./src/admin/legacy-page";
import {
  assertPrivateDataDirectory,
  privateDataDenyPatterns,
} from "./src/server/private-data-directory";
import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { CATEGORIES } from "./src/data/paintsData";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Render terminates HTTPS before forwarding requests to this HTTP server.
// Trust its single proxy hop automatically; explicit configuration still overrides it.
const trustedProxyHops = Number(
  process.env.TRUST_PROXY_HOPS ?? (process.env.RENDER === "true" ? "1" : "0"),
);
if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0)
  app.set("trust proxy", trustedProxyHops);
const PORT = parseInt(process.env.PORT || "3000", 10);
const isProd = process.env.NODE_ENV === "production";

app.disable("x-powered-by");
app.use(securityHeaders(isProd));
// Authenticate and reject foreign browser writes BEFORE parsing large bodies.
app.use("/api/admin", sensitiveRequestGuard, (req, res, next) => {
  if (req.method === "POST" && req.path.toLowerCase() === "/login")
    return next();
  return requireAdmin(req, res, next);
});
app.use("/api/auth", sensitiveRequestGuard);
app.post(["/api/admin/login", "/api/auth/login"], rateLimit(60, 60000));
app.use("/api/project", requireAdmin);
// Protect every archive location, including copies in dist and encoded paths.
app.use((req, res, next) => {
  let pathname: string;
  try {
    pathname = decodeURIComponent(req.path);
  } catch {
    return res.sendStatus(400);
  }
  if (/(?:^|\/)\.[^/]+/.test(pathname)) return res.sendStatus(404);
  if (/\.zip(?:\/|$)/i.test(pathname)) {
    res.setHeader("Cache-Control", "no-store");
    return requireAdmin(req, res, next);
  }
  next();
});
app.use(
  [
    "/api/content",
    "/api/products",
    "/api/shades",
    "/api/dealers",
    "/uploads",
    "/assets",
  ],
  publicCors,
);
// A 25 MiB image needs roughly 33.4 MiB when encoded as JSON/base64.
app.use(
  "/api/admin/upload",
  rateLimit(30, 60000),
  express.json({ limit: "36mb" }),
);
app.use(
  "/api/admin/pdf-upload",
  rateLimit(30, 60000),
  express.json({ limit: "8mb" }),
);
app.use("/api/warranty", warrantyRouter);
app.use("/api/admin/content", express.json({ limit: "10mb" }));
app.use("/api", express.json({ limit: "64kb" }));
app.use("/api", (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
  )
    return res.status(400).json({ error: "Send a JSON object." });
  next();
});
app.use("/api/admin/warranties", warrantyAdminRouter);
app.use("/api", contentRouter);
app.use("/uploads", uploads());
app.get(
  [
    "/assets/aistudio/areva-paints_a2364c60.html",
    "/attached-page",
    "/areva-html",
    "/attached-version",
  ],
  (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const nonce = res.locals.scriptNonce as string;
    res
      .type("html")
      .send(
        legacyPage().replace(
          /<script(?![^>]*(?:\bsrc=|\btype=["']application\/json))/gi,
          `<script nonce="${nonce}"`,
        ),
      );
  },
);

// ==========================================
// REST API ROUTES
// ==========================================

// 1. System Health Check
/* GET /api/health: Report service readiness and catalogue counts without returning private records. */
app.get("/api/health", (_req: Request, res: Response) => {
  const content = readContent();
  res.json({
    status: "ok",
    service: "Areva Paints Architectural Platform API",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: isProd ? "production" : "development",
    catalogStats: {
      productsCount: content.products.length,
      categoriesCount: CATEGORIES.length,
      shadesCount: content.colours.length,
      dealerDepotsCount: content.dealers.length,
    },
  });
});

// 2. Coatings Catalog Endpoint
/* GET /api/products: Read the current public catalogue with validated category/search filters. */
app.get("/api/products", (req: Request, res: Response) => {
  const { category, search } = req.query;

  let results = [...readContent().products];

  if (category && category !== "all") {
    results = results.filter((p) => p.categoryId === category);
  }

  if (search && typeof search === "string") {
    const q = search.toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q) ||
        p.sheen.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }

  res.json({
    products: results,
    categories: CATEGORIES,
    total: results.length,
  });
});

// 3. Single Coating Details Endpoint
/* GET /api/products/:id: Return one public product or a missing-product response. */
app.get("/api/products/:id", (req: Request, res: Response) => {
  const product = readContent().products.find((p) => p.id === req.params.id);
  if (!product) {
    return res
      .status(404)
      .json({ error: "Product not found in Areva catalogue." });
  }
  return res.json({ product });
});

// 4. Architectural Shades Palette
/* GET /api/shades: Filter the public shade palette using the shared family/tone rules. */
app.get("/api/shades", (req: Request, res: Response) => {
  const all = readContent().colours;
  const family =
    typeof req.query.family === "string" && req.query.family !== "All"
      ? req.query.family
      : "All Shades";
  const tone = typeof req.query.tone === "string" ? req.query.tone : "All";
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const shades = filterShades(all, family, tone, search);
  res.json({
    shades,
    families: ["All Shades", ...COLOUR_FAMILIES],
    tones: ["All", ...SHADE_TONES],
    toneCounts: Object.fromEntries(
      ["All", ...SHADE_TONES].map((t) => [
        t,
        filterShades(all, family, t, search).length,
      ]),
    ),
    total: shades.length,
  });
});

// 5. Authorized Dealer Depots
/* GET /api/dealers: Filter current CMS dealers without using the legacy fallback constant. */
app.get("/api/dealers", (req: Request, res: Response) => {
  const { state } = req.query;
  const content = readContent();
  let depots = [...content.dealers];

  if (state !== undefined && typeof state !== "string")
    return res.status(400).json({ error: "Choose a valid state." });
  if (state) {
    depots = depots.filter(
      (d) => d.state.toLowerCase() === (state as string).toLowerCase(),
    );
  }

  res.json({
    depots,
    statesCovered: [...new Set(content.dealers.map((d) => d.state))],
    total: depots.length,
  });
});

// 6. Paint Coverage Calculation Endpoint
/* POST /api/calculator/estimate: Validate dimensions and estimate quantities from authoritative catalogue coverage. */
app.post(
  "/api/calculator/estimate",
  rateLimit(120, 60000),
  (req: Request, res: Response) => {
    const {
      length,
      width,
      height,
      doors = 0,
      windows = 0,
      coats = 2,
      productId,
    } = req.body;

    const numberInRange = (
      v: unknown,
      min: number,
      max: number,
      integer = false,
    ) =>
      (typeof v === "number" ||
        (typeof v === "string" && /^\d+(?:\.\d+)?$/.test(v))) &&
      Number.isFinite(Number(v)) &&
      Number(v) >= min &&
      Number(v) <= max &&
      (!integer || Number.isInteger(Number(v)));
    if (
      !numberInRange(length, 0.1, 10000) ||
      !numberInRange(width, 0.1, 10000) ||
      !numberInRange(height, 0.1, 1000) ||
      !numberInRange(doors, 0, 1000, true) ||
      !numberInRange(windows, 0, 1000, true) ||
      !numberInRange(coats, 1, 10, true) ||
      typeof productId !== "string" ||
      productId.length > 100
    )
      return res.status(400).json({
        error:
          "Enter valid positive dimensions, 0–1,000 doors/windows and 1–10 coats.",
      });
    const product = readContent().products.find((p) => p.id === productId);
    if (!product)
      return res
        .status(404)
        .json({ error: "Product not found in Areva catalogue." });

    if (product.coverageSqFtPerLiter <= 0)
      return res
        .status(400)
        .json({ error: "Coverage has not been configured for this product." });

    const grossWallArea = 2 * (Number(length) + Number(width)) * Number(height);
    const deductions = Number(doors) * 21 + Number(windows) * 15;
    const netArea =
      product.calculationBasis === "floor"
        ? Number(length) * Number(width)
        : Math.max(0, grossWallArea - deductions);
    const effectiveCoats =
      product.calculationBasis === "floor" ? 1 : Number(coats);

    const exactLiters =
      (netArea * effectiveCoats) / product.coverageSqFtPerLiter;
    const totalLitersWithWastage = Math.ceil(exactLiters * 1.1 * 2) / 2; // 10% safety buffer rounded to 0.5L

    // Use the saved numeric sizes, never free-text packing labels or hard-coded cans.
    let remaining = totalLitersWithWastage;
    const sizes = [...new Set(product.availableSizes)].sort((a, b) => b - a);
    const canBreakdown: Array<{ size: number; count: number }> = [];
    sizes.forEach((size, index) => {
      const count =
        index === sizes.length - 1
          ? Math.ceil(remaining / size)
          : Math.floor(remaining / size);
      if (count > 0) {
        canBreakdown.push({ size, count });
        remaining = Math.max(0, remaining - size * count);
      }
    });

    const breakdownString = canBreakdown
      .map((c) => `${c.count} × ${c.size}${product.coverageUnit || "L"}`)
      .join(" + ");

    return res.json({
      product: {
        id: product.id,
        name: product.name,
        sheen: product.sheen,
        coverageSqFtPerLiter: product.coverageSqFtPerLiter,
      },
      dimensions: {
        length: Number(length),
        width: Number(width),
        height: Number(height),
      },
      deductions: {
        doors: Number(doors),
        windows: Number(windows),
        totalSqFt: deductions,
      },
      grossWallAreaSqFt: grossWallArea,
      netPaintableAreaSqFt: Math.round(netArea),
      coats: effectiveCoats,
      unit: product.coverageUnit || "L",
      exactLitersRequired: Math.round(exactLiters * 100) / 100,
      recommendedTotalLiters: totalLitersWithWastage,
      canBreakdown,
      canBreakdownString: breakdownString,
      safetyBufferPercent: 10,
      timestamp: new Date().toISOString(),
    });
  },
);

// 7. Enquiries Submission Endpoint
/* POST /api/enquiries: Persist a validated private enquiry on POST; listing requires admin authorization. */
app.post(
  "/api/enquiries",
  rateLimit(5, 15 * 60000),
  (req: Request, res: Response) => {
    try {
      const { enquiry, matchedDepot } = createEnquiry(req.body);
      res.setHeader("Cache-Control", "no-store");
      return res.status(201).json({
        success: true,
        ticketId: enquiry.id,
        enquiry,
        assignedDepot: matchedDepot,
        message: matchedDepot
          ? `Enquiry registered successfully. Routing to ${matchedDepot.name}.`
          : "Enquiry registered successfully. A dealer will be assigned.",
      });
    } catch (error) {
      // Validation is handled separately from filesystem failures to avoid leaking paths.
      const message = error instanceof Error ? error.message : "";
      if (/^(Enter a valid|Enquiry capacity)/.test(message))
        return res.status(400).json({ error: message });
      return res
        .status(500)
        .json({ error: "Your enquiry could not be saved. Please try again." });
    }
  },
);
/* GET /api/enquiries: Persist a validated private enquiry on POST; listing requires admin authorization. */
app.get("/api/enquiries", requireAdmin, (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const enquiries = readEnquiries();
  res.json({ enquiries, total: enquiries.length });
});

// 9. Full Project Code Download Endpoint (.zip Stream & Static Files)
app.get(
  ["/api/project/download", "/areva-paints-fullstack.zip"],
  (_req: Request, res: Response) => {
    try {
      const prebuiltZip = path.resolve(
        __dirname,
        "artifacts/source/areva-paints-fullstack.zip",
      );
      if (fs.existsSync(prebuiltZip)) {
        const stat = fs.statSync(prebuiltZip);
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Length", stat.size.toString());
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="areva-paints-fullstack.zip"',
        );
        res.setHeader("Cache-Control", "no-store");
        return res.sendFile(prebuiltZip);
      }
      return res
        .status(404)
        .json({ error: "Archive not found. Please regenerate." });
    } catch (err) {
      console.error("[Project Download Error]:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: "The archive could not be downloaded.",
        });
      }
    }
  },
);

// 9b. Lightweight Code-Only Zip Download (~110 KB - Instant & 100% Windows Compatible)
app.get(
  ["/api/project/download-code", "/areva-paints-code.zip"],
  (_req: Request, res: Response) => {
    try {
      const codeZip = path.resolve(
        __dirname,
        "artifacts/source/areva-paints-code.zip",
      );
      if (fs.existsSync(codeZip)) {
        const stat = fs.statSync(codeZip);
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Length", stat.size.toString());
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="areva-paints-code.zip"',
        );
        res.setHeader("Cache-Control", "no-store");
        return res.sendFile(codeZip);
      }
      return res.status(404).json({ error: "Code archive not found." });
    } catch (err) {
      console.error("[Code Download Error]:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to serve code archive." });
      }
    }
  },
);

// 9c. Source Files JSON Manifest (for 100% in-browser client JSZip packaging)
/* GET /api/project/source-files: Return an admin-only text manifest excluding secrets and private runtime files. */
app.get("/api/project/source-files", (_req: Request, res: Response) => {
  try {
    const files: Record<string, string> = {};
    const rootDir = __dirname;

    const textFiles = [
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "vite.config.ts",
      "server.ts",
      "index.html",
      "README.md",
      ".env.example",
      ".gitignore",
      "metadata.json",
      ".nvmrc",
      "render.yaml",
      "AREVA_TECHNICAL_DOCUMENTATION.md",
    ];

    for (const f of textFiles) {
      const full = path.join(rootDir, f);
      if (fs.existsSync(full) && fs.lstatSync(full).isFile()) {
        files[f] = fs.readFileSync(full, "utf-8");
      }
    }

    /* Collect only supported text sources without following symlinks or hidden directories. */
    function readTextDir(dir: string, relPath: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        /* Hidden entries may contain operator secrets; the text export skips them. */
        if (entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        const rel = path.join(relPath, entry.name).replace(/\\/g, "/");
        if (entry.isDirectory()) {
          readTextDir(fullPath, rel);
        } else if (
          entry.isFile() &&
          (entry.name.endsWith(".ts") ||
            entry.name.endsWith(".tsx") ||
            entry.name.endsWith(".css") ||
            entry.name.endsWith(".json") ||
            entry.name.endsWith(".html") ||
            entry.name.endsWith(".md") ||
            entry.name.endsWith(".js") ||
            entry.name.endsWith(".mjs") ||
            entry.name.endsWith(".cjs") ||
            entry.name.endsWith(".sql"))
        ) {
          files[rel] = fs.readFileSync(fullPath, "utf-8");
        }
      }
    }

    /* Include maintained text/config sources; binary artwork/fonts stay in the full ZIP. */
    for (const folder of [
      "src",
      "public",
      "scripts",
      "tests",
      "docs",
      "database",
    ]) {
      const directory = path.join(rootDir, folder);
      if (fs.existsSync(directory) && fs.lstatSync(directory).isDirectory()) {
        readTextDir(directory, folder);
      }
    }

    res.json({ success: true, count: Object.keys(files).length, files });
  } catch (err) {
    res
      .status(500)
      .json({ error: "The source archive could not be prepared." });
  }
});

// 10. Project Summary & Architecture Info Endpoint
/* GET /api/project/info: Return project metadata only after the shared source-export admin guard. */
app.get("/api/project/info", (_req: Request, res: Response) => {
  res.json({
    name: "Areva Paints Full-Stack Architectural Platform",
    version: "1.0.0",
    type: "Full-Stack TypeScript (Node.js/Express + React 19 + Vite)",
    modules: {
      backend: "Express 4.x + REST API + tsx",
      frontend: "React 19 + TypeScript + Tailwind CSS v4 + Motion",
      xrStudio: "Browser camera and canvas paint-colour preview",
      visualizer: "Room Interior Studio with 5 Architect-Curated Scenes",
      calculator: "Formula-Aware Liters Coverage & Packaging Distribution",
      dealers: "4-State Regional Depot Distributor Routing Engine",
    },
    scripts: {
      dev: "npm run dev (Runs Express server on port 3000 with Vite middleware)",
      build: "npm run build (Creates production Vite distribution in dist/)",
      start: "npm start (Starts production Express server serving dist/)",
      lint: "npm run lint (TypeScript type checking)",
    },
    downloadEndpoint: "/api/project/download",
  });
});

// Only explicit public files are served; archives are guarded above.
app.use(
  express.static(path.resolve(__dirname, "public"), { dotfiles: "deny" }),
);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "API endpoint not found." }),
);

/* Reject exposed data-directory locations, mount development or production assets, then start the single Express process. */
async function startServer() {
  assertPrivateDataDirectory(dataDir, __dirname);
  if (!isProd) {
    /* Load build tooling only for local development; production serves dist. */
    const { createServer: createViteServer } = await import("vite");
    // In dev: mount Vite middlewares so HMR and SPA routing work together on port 3000
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        fs: {
          // Preserve Vite's secret-file defaults and explicitly block private data.
          deny: [
            ".env",
            ".env.*",
            "*.{crt,pem}",
            "**/.git/**",
            ...privateDataDenyPatterns(dataDir),
          ],
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Areva Server] Vite middleware mounted in development mode.");
  } else {
    // In production: serve static assets from dist/
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      if (path.extname(req.path) || req.path.startsWith("/uploads/"))
        return res.sendStatus(404);
      res.sendFile(path.resolve(distPath, "index.html"));
    });
    console.log(`[Areva Server] Serving static build from ${distPath}`);
  }

  app.use(errorHandler);
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[Areva Server] Full-Stack application listening on http://0.0.0.0:${PORT}`,
    );
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
}

startServer().catch((err) => {
  console.error("[Areva Server] Failed to start server:", err);
  process.exit(1);
});
