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
import "dotenv/config";
import { contentRouter, uploads } from "./src/admin/routes";
import { readContent, dataDir } from "./src/admin/content-store";
import { legacyPage } from "./src/admin/legacy-page";
import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
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

export interface DealerDepot {
  city: string;
  name: string;
  phone: string;
  address: string;
  state: string;
}

export const DEALER_LOCATIONS: DealerDepot[] = [
  {
    state: "Karnataka",
    city: "Bengaluru Central",
    name: "Sri Balaji Paint & Hardware Depot",
    phone: "+91 98451 22334",
    address: "Old Madras Road, Indiranagar",
  },
  {
    state: "Karnataka",
    city: "Bengaluru South",
    name: "Chamundi Color World",
    phone: "+91 98801 44556",
    address: "Kanakapura Main Road, JP Nagar",
  },
  {
    state: "Karnataka",
    city: "Mysuru",
    name: "Cauvery Building Coatings",
    phone: "+91 94480 33221",
    address: "Sayyaji Rao Road",
  },
  {
    state: "Karnataka",
    city: "Hubli - Dharwad",
    name: "North Karnataka Paint Distributors",
    phone: "+91 98440 77889",
    address: "Station Road, Hubli",
  },
  {
    state: "Maharashtra",
    city: "Pune East",
    name: "Shree Ganesh Paint Center",
    phone: "+91 98220 11223",
    address: "Kharadi Bypass Road, Hadapsar",
  },
  {
    state: "Maharashtra",
    city: "Mumbai Suburban",
    name: "Maruti Waterproofing & Coatings",
    phone: "+91 98200 44332",
    address: "SV Road, Andheri West",
  },
  {
    state: "Maharashtra",
    city: "Nashik",
    name: "Godavari Color Plaza",
    phone: "+91 94222 55667",
    address: "College Road, Nashik",
  },
  {
    state: "Tamil Nadu",
    city: "Chennai Central",
    name: "Meenakshi Paints & Chemicals",
    phone: "+91 98400 99887",
    address: "Poonamallee High Road, Kilpauk",
  },
  {
    state: "Tamil Nadu",
    city: "Coimbatore",
    name: "Kongu Surface Solutions",
    phone: "+91 94430 11445",
    address: "Avinashi Road, Peelamedu",
  },
  {
    state: "Tamil Nadu",
    city: "Madurai",
    name: "Pandian Paint House",
    phone: "+91 98421 66778",
    address: "West Veli Street",
  },
  {
    state: "Andhra Pradesh",
    city: "Hyderabad / Secunderabad",
    name: "Deccan Coating Systems",
    phone: "+91 98480 22119",
    address: "Kukatpally Main Road",
  },
  {
    state: "Andhra Pradesh",
    city: "Visakhapatnam",
    name: "Coastal Wall Protection Hub",
    phone: "+91 98491 55662",
    address: "Daba Gardens",
  },
  {
    state: "Andhra Pradesh",
    city: "Vijayawada",
    name: "Krishna Paints & Adhesives",
    phone: "+91 98481 88990",
    address: "MG Road, Governorpet",
  },
];

// ==========================================
// REST API ROUTES
// ==========================================

// 1. System Health Check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Areva Paints Architectural Platform API",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: isProd ? "production" : "development",
    catalogStats: {
      productsCount: readContent().products.length,
      categoriesCount: CATEGORIES.length,
      shadesCount: readContent().colours.length,
      dealerDepotsCount: readContent().dealers.length,
    },
  });
});

// 2. Coatings Catalog Endpoint
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
app.get("/api/dealers", (req: Request, res: Response) => {
  const { state } = req.query;
  let depots = [...readContent().dealers];

  if (state !== undefined && typeof state !== "string")
    return res.status(400).json({ error: "Choose a valid state." });
  if (state) {
    depots = depots.filter(
      (d) => d.state.toLowerCase() === (state as string).toLowerCase(),
    );
  }

  res.json({
    depots,
    statesCovered: [...new Set(readContent().dealers.map((d) => d.state))],
    total: depots.length,
  });
});

// 6. Paint Coverage Calculation Endpoint
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
      return res
        .status(400)
        .json({
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
app.get("/api/project/source-files", (_req: Request, res: Response) => {
  try {
    const files: Record<string, string> = {};
    const rootDir = __dirname;

    const textFiles = [
      "package.json",
      "tsconfig.json",
      "vite.config.ts",
      "server.ts",
      "index.html",
      "README.md",
      ".env.example",
      ".gitignore",
      "metadata.json",
    ];

    for (const f of textFiles) {
      const full = path.join(rootDir, f);
      if (fs.existsSync(full)) {
        files[f] = fs.readFileSync(full, "utf-8");
      }
    }

    function readTextDir(dir: string, relPath: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
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
            entry.name.endsWith(".md"))
        ) {
          files[rel] = fs.readFileSync(fullPath, "utf-8");
        }
      }
    }

    const srcDir = path.join(rootDir, "src");
    if (fs.existsSync(srcDir)) {
      readTextDir(srcDir, "src");
    }

    res.json({ success: true, count: Object.keys(files).length, files });
  } catch (err) {
    res
      .status(500)
      .json({ error: "The source archive could not be prepared." });
  }
});

// 10. Project Summary & Architecture Info Endpoint
app.get("/api/project/info", (_req: Request, res: Response) => {
  res.json({
    name: "Areva Paints Full-Stack Architectural Platform",
    version: "1.0.0",
    type: "Full-Stack TypeScript (Node.js/Express + React 19 + Vite)",
    modules: {
      backend: "Express 4.x + REST API + tsx",
      frontend: "React 19 + TypeScript + Tailwind CSS v4 + Motion",
      xrStudio: "WebXR 60fps Live Camera Real-Time Wall Recoloring Canvas",
      visualizer: "Room Interior Studio with 5 Architect-Curated Scenes",
      calculator: "Formula-Aware Liters Coverage & Packaging Distribution",
      dealers: "4-State Regional Depot Distributor Routing Engine",
    },
    scripts: {
      dev: "npm run dev (Runs Express server on port 3000 with Vite middleware)",
      build: "npm run build (Creates production Vite distribution in dist/)",
      start: "npm start (Starts production Express server serving dist/)",
      lint: "npm run lint (TypeScript strict type validation)",
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

async function startServer() {
  for (const exposed of ["public", "dist", "src"]) {
    const relative = path.relative(path.resolve(__dirname, exposed), dataDir);
    if (
      !relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative)
    )
      throw Error("CONTENT_DATA_DIR must be outside public, dist and src.");
  }
  if (!isProd) {
    // In dev: mount Vite middlewares so HMR and SPA routing work together on port 3000
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
