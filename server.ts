import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { PRODUCTS, CATEGORIES, COLOR_SHADES } from './src/data/paintsData';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// CORS headers for canvas manipulation and cross-origin embedding
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

export interface DealerDepot {
  city: string;
  name: string;
  phone: string;
  address: string;
  state: string;
}

export const DEALER_LOCATIONS: DealerDepot[] = [
  { state: 'Karnataka', city: 'Bengaluru Central', name: 'Sri Balaji Paint & Hardware Depot', phone: '+91 98451 22334', address: 'Old Madras Road, Indiranagar' },
  { state: 'Karnataka', city: 'Bengaluru South', name: 'Chamundi Color World', phone: '+91 98801 44556', address: 'Kanakapura Main Road, JP Nagar' },
  { state: 'Karnataka', city: 'Mysuru', name: 'Cauvery Building Coatings', phone: '+91 94480 33221', address: 'Sayyaji Rao Road' },
  { state: 'Karnataka', city: 'Hubli - Dharwad', name: 'North Karnataka Paint Distributors', phone: '+91 98440 77889', address: 'Station Road, Hubli' },
  { state: 'Maharashtra', city: 'Pune East', name: 'Shree Ganesh Paint Center', phone: '+91 98220 11223', address: 'Kharadi Bypass Road, Hadapsar' },
  { state: 'Maharashtra', city: 'Mumbai Suburban', name: 'Maruti Waterproofing & Coatings', phone: '+91 98200 44332', address: 'SV Road, Andheri West' },
  { state: 'Maharashtra', city: 'Nashik', name: 'Godavari Color Plaza', phone: '+91 94222 55667', address: 'College Road, Nashik' },
  { state: 'Tamil Nadu', city: 'Chennai Central', name: 'Meenakshi Paints & Chemicals', phone: '+91 98400 99887', address: 'Poonamallee High Road, Kilpauk' },
  { state: 'Tamil Nadu', city: 'Coimbatore', name: 'Kongu Surface Solutions', phone: '+91 94430 11445', address: 'Avinashi Road, Peelamedu' },
  { state: 'Tamil Nadu', city: 'Madurai', name: 'Pandian Paint House', phone: '+91 98421 66778', address: 'West Veli Street' },
  { state: 'Andhra Pradesh', city: 'Hyderabad / Secunderabad', name: 'Deccan Coating Systems', phone: '+91 98480 22119', address: 'Kukatpally Main Road' },
  { state: 'Andhra Pradesh', city: 'Visakhapatnam', name: 'Coastal Wall Protection Hub', phone: '+91 98491 55662', address: 'Daba Gardens' },
  { state: 'Andhra Pradesh', city: 'Vijayawada', name: 'Krishna Paints & Adhesives', phone: '+91 98481 88990', address: 'MG Road, Governorpet' },
];

// In-memory storage for inquiries & estimates
interface StoredEnquiry {
  id: string;
  topic: string;
  fullName: string;
  phone: string;
  city: string;
  productName?: string;
  shadeName?: string;
  message?: string;
  createdAt: string;
  status: 'pending' | 'in_review' | 'assigned_to_dealer';
  assignedDepot?: string;
}

const enquiriesStore: StoredEnquiry[] = [
  {
    id: 'ARV-REQ-98210',
    topic: 'Request a quotation',
    fullName: 'Arun Kulkarni Architects',
    phone: '+91 98450 11223',
    city: 'Bengaluru',
    productName: 'Areva Sheen Pro',
    shadeName: 'Terracotta Hearth (AR108)',
    message: 'Specification for 12,000 sq ft luxury residential villa exterior and living lounge.',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    status: 'assigned_to_dealer',
    assignedDepot: 'Bengaluru Central Depot - Peenya Industrial Area',
  },
];

// ==========================================
// REST API ROUTES
// ==========================================

// 1. System Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Areva Paints Architectural Platform API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: isProd ? 'production' : 'development',
    catalogStats: {
      productsCount: PRODUCTS.length,
      categoriesCount: CATEGORIES.length,
      shadesCount: COLOR_SHADES.length,
      dealerDepotsCount: DEALER_LOCATIONS.length,
    },
  });
});

// 2. Coatings Catalog Endpoint
app.get('/api/products', (req: Request, res: Response) => {
  const { category, search } = req.query;

  let results = [...PRODUCTS];

  if (category && category !== 'all') {
    results = results.filter((p) => p.categoryId === category);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q) ||
        p.sheen.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }

  res.json({
    products: results,
    categories: CATEGORIES,
    total: results.length,
  });
});

// 3. Single Coating Details Endpoint
app.get('/api/products/:id', (req: Request, res: Response) => {
  const product = PRODUCTS.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found in Areva catalogue.' });
  }
  return res.json({ product });
});

// 4. Architectural Shades Palette
app.get('/api/shades', (req: Request, res: Response) => {
  const { family } = req.query;
  let shades = [...COLOR_SHADES];

  if (family && family !== 'All') {
    shades = shades.filter((s) => s.family === family);
  }

  res.json({
    shades,
    families: ['All', 'Warm Neutrals', 'Cool Tones', 'Vibrant Accents', 'Greens & Earth'],
    total: shades.length,
  });
});

// 5. Authorized Dealer Depots
app.get('/api/dealers', (req: Request, res: Response) => {
  const { state } = req.query;
  let depots = [...DEALER_LOCATIONS];

  if (state) {
    depots = depots.filter((d) => d.state.toLowerCase() === (state as string).toLowerCase());
  }

  res.json({
    depots,
    statesCovered: ['Karnataka', 'Maharashtra', 'Tamil Nadu', 'Andhra Pradesh'],
    total: depots.length,
  });
});

// 6. Paint Coverage Calculation Endpoint
app.post('/api/calculator/estimate', (req: Request, res: Response) => {
  const { length, width, height, doors = 0, windows = 0, coats = 2, productId } = req.body;

  if (!length || !width || !height || !productId) {
    return res.status(400).json({
      error: 'Missing required parameters: length, width, height, and productId are required.',
    });
  }

  const product = PRODUCTS.find((p) => p.id === productId) || PRODUCTS[0];

  const grossWallArea = 2 * (Number(length) + Number(width)) * Number(height);
  const deductions = Number(doors) * 21 + Number(windows) * 15;
  const netArea = Math.max(0, grossWallArea - deductions);

  const exactLiters = (netArea * Number(coats)) / product.coverageSqFtPerLiter;
  const totalLitersWithWastage = Math.ceil(exactLiters * 1.1 * 2) / 2; // 10% safety buffer rounded to 0.5L

  // Package sizing calculation
  let remaining = totalLitersWithWastage;
  const cans20L = Math.floor(remaining / 20);
  remaining %= 20;
  const cans10L = Math.floor(remaining / 10);
  remaining %= 10;
  const cans4L = Math.floor(remaining / 4);
  remaining %= 4;
  const cans1L = Math.ceil(remaining);

  const canBreakdown: Array<{ size: number; count: number }> = [];
  if (cans20L > 0) canBreakdown.push({ size: 20, count: cans20L });
  if (cans10L > 0) canBreakdown.push({ size: 10, count: cans10L });
  if (cans4L > 0) canBreakdown.push({ size: 4, count: cans4L });
  if (cans1L > 0) canBreakdown.push({ size: 1, count: cans1L });

  const breakdownString = canBreakdown.map((c) => `${c.count} × ${c.size}L`).join(' + ');

  return res.json({
    product: {
      id: product.id,
      name: product.name,
      sheen: product.sheen,
      coverageSqFtPerLiter: product.coverageSqFtPerLiter,
    },
    dimensions: { length: Number(length), width: Number(width), height: Number(height) },
    deductions: { doors: Number(doors), windows: Number(windows), totalSqFt: deductions },
    grossWallAreaSqFt: grossWallArea,
    netPaintableAreaSqFt: Math.round(netArea),
    coats: Number(coats),
    exactLitersRequired: Math.round(exactLiters * 100) / 100,
    recommendedTotalLiters: totalLitersWithWastage,
    canBreakdown,
    canBreakdownString: breakdownString,
    safetyBufferPercent: 10,
    timestamp: new Date().toISOString(),
  });
});

// 7. Enquiries Submission Endpoint
app.post('/api/enquiries', (req: Request, res: Response) => {
  const { topic, fullName, phone, city, productName, shadeName, message } = req.body;

  if (!fullName || !phone) {
    return res.status(400).json({ error: 'Full name and contact phone number are required.' });
  }

  // Find nearest dealer depot for city
  const matchedDepot = DEALER_LOCATIONS.find(
    (d: DealerDepot) => d.city.toLowerCase() === (city || '').toLowerCase()
  ) || DEALER_LOCATIONS[0];

  const newTicketId = `ARV-REQ-${Math.floor(10000 + Math.random() * 90000)}`;

  const newEnquiry: StoredEnquiry = {
    id: newTicketId,
    topic: topic || 'Request a quotation',
    fullName: fullName.trim(),
    phone: phone.trim(),
    city: city || 'Bengaluru',
    productName: productName || undefined,
    shadeName: shadeName || undefined,
    message: message || undefined,
    createdAt: new Date().toISOString(),
    status: 'assigned_to_dealer',
    assignedDepot: `${matchedDepot.name} (${matchedDepot.city})`,
  };

  enquiriesStore.unshift(newEnquiry);

  return res.status(201).json({
    success: true,
    ticketId: newTicketId,
    enquiry: newEnquiry,
    assignedDepot: matchedDepot,
    message: `Enquiry registered successfully. Routing to ${matchedDepot.name}.`,
  });
});

// 8. Enquiries List Endpoint (For Verification & Admin)
app.get('/api/enquiries', (_req: Request, res: Response) => {
  res.json({
    enquiries: enquiriesStore,
    total: enquiriesStore.length,
  });
});

// 9. Full Project Code Download Endpoint (.zip Stream & Static Files)
app.get(['/api/project/download', '/areva-paints-fullstack.zip'], (_req: Request, res: Response) => {
  try {
    const prebuiltZip = path.resolve(__dirname, 'public/areva-paints-fullstack.zip');
    if (fs.existsSync(prebuiltZip)) {
      const stat = fs.statSync(prebuiltZip);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', stat.size.toString());
      res.setHeader('Content-Disposition', 'attachment; filename="areva-paints-fullstack.zip"');
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.sendFile(prebuiltZip);
    }
    return res.status(404).json({ error: 'Archive not found. Please regenerate.' });
  } catch (err) {
    console.error('[Project Download Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: (err as Error)?.message || 'Server error generating project download.',
      });
    }
  }
});

// 9b. Lightweight Code-Only Zip Download (~110 KB - Instant & 100% Windows Compatible)
app.get(['/api/project/download-code', '/areva-paints-code.zip'], (_req: Request, res: Response) => {
  try {
    const codeZip = path.resolve(__dirname, 'public/areva-paints-code.zip');
    if (fs.existsSync(codeZip)) {
      const stat = fs.statSync(codeZip);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', stat.size.toString());
      res.setHeader('Content-Disposition', 'attachment; filename="areva-paints-code.zip"');
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.sendFile(codeZip);
    }
    return res.status(404).json({ error: 'Code archive not found.' });
  } catch (err) {
    console.error('[Code Download Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve code archive.' });
    }
  }
});

// 9c. Source Files JSON Manifest (for 100% in-browser client JSZip packaging)
app.get('/api/project/source-files', (_req: Request, res: Response) => {
  try {
    const files: Record<string, string> = {};
    const rootDir = __dirname;

    const textFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'server.ts',
      'index.html',
      'README.md',
      '.env.example',
      '.gitignore',
      'metadata.json',
    ];

    for (const f of textFiles) {
      const full = path.join(rootDir, f);
      if (fs.existsSync(full)) {
        files[f] = fs.readFileSync(full, 'utf-8');
      }
    }

    function readTextDir(dir: string, relPath: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const rel = path.join(relPath, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          readTextDir(fullPath, rel);
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.ts') ||
            entry.name.endsWith('.tsx') ||
            entry.name.endsWith('.css') ||
            entry.name.endsWith('.json') ||
            entry.name.endsWith('.html') ||
            entry.name.endsWith('.md'))
        ) {
          files[rel] = fs.readFileSync(fullPath, 'utf-8');
        }
      }
    }

    const srcDir = path.join(rootDir, 'src');
    if (fs.existsSync(srcDir)) {
      readTextDir(srcDir, 'src');
    }

    res.json({ success: true, count: Object.keys(files).length, files });
  } catch (err) {
    res.status(500).json({ error: (err as Error)?.message });
  }
});

// 10. Project Summary & Architecture Info Endpoint
app.get('/api/project/info', (_req: Request, res: Response) => {
  res.json({
    name: 'Areva Paints Full-Stack Architectural Platform',
    version: '1.0.0',
    type: 'Full-Stack TypeScript (Node.js/Express + React 19 + Vite)',
    modules: {
      backend: 'Express 4.x + REST API + tsx',
      frontend: 'React 19 + TypeScript + Tailwind CSS v4 + Motion',
      xrStudio: 'WebXR 60fps Live Camera Real-Time Wall Recoloring Canvas',
      visualizer: 'Room Interior Studio with 5 Architect-Curated Scenes',
      calculator: 'Formula-Aware Liters Coverage & Packaging Distribution',
      dealers: '4-State Regional Depot Distributor Routing Engine',
    },
    scripts: {
      dev: 'npm run dev (Runs Express server on port 3000 with Vite middleware)',
      build: 'npm run build (Creates production Vite distribution in dist/)',
      start: 'npm start (Starts production Express server serving dist/)',
      lint: 'npm run lint (TypeScript strict type validation)',
    },
    downloadEndpoint: '/api/project/download',
  });
});

// 11. Attached HTML Page Direct Access Endpoints
app.get(['/attached-page', '/areva-html', '/attached-version'], (_req: Request, res: Response) => {
  const attachedHtmlPath = path.resolve(__dirname, 'public/assets/aistudio/areva-paints_a2364c60.html');
  if (fs.existsSync(attachedHtmlPath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.sendFile(attachedHtmlPath);
  }
  return res.status(404).send('Attached file not found.');
});

// ==========================================
// VITE DEV SERVER / PRODUCTION STATIC SERVER
// Serve public assets directory directly with CORS enabled for canvas
app.use(express.static(path.resolve(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
  },
}));

async function startServer() {
  if (!isProd) {
    // In dev: mount Vite middlewares so HMR and SPA routing work together on port 3000
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Areva Server] Vite middleware mounted in development mode.');
  } else {
    // In production: serve static assets from dist/
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log(`[Areva Server] Serving static build from ${distPath}`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Areva Server] Full-Stack application listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Areva Server] Failed to start server:', err);
  process.exit(1);
});
