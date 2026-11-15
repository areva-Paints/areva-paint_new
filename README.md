# Areva Paints — Full-Stack Architectural Coatings & Color Studio

A modern, high-performance web platform and digital studio for **Areva Paints**, engineered for homeowners, architects, interior designers, and commercial painting contractors.

---

## 🌟 Key Features

1. **WebXR Live Camera Augmented Reality (AR) Studio**:
   - Access real-time mobile camera video feed (`getUserMedia`) directly on iOS and Android.
   - 60fps canvas-based color transfer algorithm with edge/luminance blending and room-finish shaders (Velvet Matte, Eggshell Satin, High Sheen).
   - Interactive reticle target, tap-to-calibrate wall color picker, and frame capture snapshot tool.
   - High-fidelity simulated room fallback for desktop devices without cameras.

2. **Interactive Room Color Visualizer Studio**:
   - High-definition room interior scenes (Contemporary Living Lounge, Master Bedroom, Minimalist Dining, Kitchen & Breakfast, Corporate Executive Suite).
   - Real-time paint swatch preview across warm neutrals, cool tones, earth shades, and vibrant accents.
   - Sheen selector simulating Matte, Silk Emulsion, Eggshell, and High Gloss reflections.

3. **Coating Formulation System & Dropdown**:
   - Comprehensive formulation catalog featuring 14 specialized coating lines across Interior Luxury Emulsions, Exterior WeatherShield Coatings, Water-repellent Primers, Anti-Corrosion Metal Enamels, and Textured Finishes.
   - Technical Data Sheets (TDS) detailing spreading rates (sq ft/L), VOC levels, washability cycles, and drying intervals.

4. **Precision Paint Quantity & Can Configuration Calculator**:
   - Dynamic coating dropdown selecting specific spreading rates.
   - Dimensional inputs (Length × Width × Ceiling Height) with opening deductions (doors & windows).
   - Calculation of exact liters required, 10% safety buffer, and optimal can packing distribution (20L drums, 10L buckets, 4L cans, 1L tins).
   - Synchronized with REST API endpoint `POST /api/calculator/estimate`.

5. **Regional Authorized Dealer Depot Network**:
   - Dealer depot coverage across 4 key southern states: Karnataka (Bengaluru, Mysuru, Hubli), Maharashtra (Pune, Mumbai, Nashik), Tamil Nadu (Chennai, Coimbatore, Madurai), and Andhra Pradesh (Hyderabad, Visakhapatnam, Vijayawada).
   - Direct call assistance and one-click depot location routing.

6. **Project Quotation & Technical Specification Routing**:
   - Direct quote request modal with automatic routing to the nearest regional distributor.
   - Unique tracking ticket generation (`ARV-REQ-<UUID>`).
   - Integrated with backend storage at `POST /api/enquiries`.

7. **"Pop the Colour Bubbles" Color Play Arena**:
   - Engaging interactive mini-game with floating paint pigment bubbles, combo multipliers, and color unlocks.

8. **One-Click Full Project Code Downloader**:
   - Complete project source exporter via `GET /api/project/download` producing `areva-paints-fullstack.zip`.
   - In-app Project Export dialog with quick copy scripts, file manifest, and architecture summary.

---

## 🏗️ Architecture & Technology Stack

- **Frontend**:
  - React 19 (`react`, `react-dom`)
  - TypeScript 5.8+ (Strict type checking)
  - Vite 6+ / 8+ with `@vitejs/plugin-react`
  - Tailwind CSS v4 (`@tailwindcss/vite`, `@import "tailwindcss";`)
  - Lucide React (`lucide-react`)
  - Motion / Framer Motion (`motion`)
- **Backend**:
  - Node.js (v18+ or v20+)
  - Express 4.x (`express`) with typed request/response handlers
  - `tsx` for direct TypeScript server execution (`tsx server.ts`)
  - `jszip` for explicit source archive packaging (admin-only downloads)
  - Vite Dev Server Middleware integration in development (`vite.middlewares`)
  - Production static bundle serving with fallback SPA routing

---

## 🚀 Quick Start Guide

### 🪟 Windows Users: Unzipping the Project
If you downloaded `areva-paints-fullstack.zip` on Windows 10 or 11:
1. **Option A (File Explorer)**: Right-click `areva-paints-fullstack.zip` → select **Extract All...** → click **Extract**.
2. **Option B (PowerShell)**: In PowerShell, navigate to your Downloads folder and run:
   ```powershell
   Expand-Archive -Path .\areva-paints-fullstack.zip -DestinationPath .
   cd areva-paints-fullstack
   ```

### 1. Installation
Navigate into the extracted `areva-paints-fullstack` directory and install dependencies:
```bash
npm ci
```

### 2. Run Development Server
Starts the full-stack server running Express with Vite middleware on port 3000:
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### 3. Production Build & Execution
Build the optimized client bundle:
```bash
npm run build
```
Start the production server:
```bash
npm start
```

### 4. Type Checking & Code Quality
```bash
npm run lint
```

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health status, uptime, and catalog statistics |
| `GET` | `/api/products` | Retrieve paint catalog; filters: `?category=...&search=...` |
| `GET` | `/api/products/:id` | Detailed specification for a single coating formulation |
| `GET` | `/api/shades` | Complete shade palette with HEX and family groupings |
| `GET` | `/api/dealers` | Authorized regional dealer depots; filter: `?state=...` |
| `POST` | `/api/calculator/estimate` | Calculate paintable sq ft, liters, and can distribution |
| `POST` | `/api/enquiries` | Submit quotation or technical inquiry (returns ticket ID) |
| `GET` | `/api/enquiries` | List saved inquiries (admin authentication required) |
| `GET` | `/api/project/download` | Admin-only project archive download |
| `GET` | `/api/project/info` | Admin-only project architecture information |

---

## 📱 Mobile Responsiveness & WebXR Camera Guidelines

- **Mobile Viewport Optimization**: Fixed sticky navigation (<15% viewport height) with thumb-friendly controls.
- **WebXR AR Camera**:
  - Requires HTTPS or `localhost` to access camera hardware.
  - Automatically requests standard `facingMode: 'environment'` (rear camera) on mobile devices and front camera on laptops.
  - Interactive target reticle allows picking reference pixels directly from walls to blend target paint formulations.

---

## 📄 License & Brand
© Areva Paints — Engineered for architectural brilliance and protective wall coatings.
All rights reserved.

## Security and storage

See [the security review](docs/security-review.md) for implemented protections and deployment requirements. Content/accounts/history and enquiries use private JSON files on a persistent `CONTENT_DATA_DIR`; PostgreSQL/Supabase integration is still a prepared schema, not an active adapter. Source manifests and all ZIP downloads require an admin session. Archives are generated outside public/static builds in ignored `artifacts/source/`. `npm run build` builds the website only; source packaging is the separate `npm run package:source` command.

Use `npm ci`, `npm run lint`, `npm test`, `npm run build` and `npm audit --audit-level=moderate` before release. GitHub Actions runs the same checks, including isolated PostgreSQL permission tests. Production requires HTTPS, the correct proxy setting, a private persistent data directory, backups and configured admin credentials. Adding a GoDaddy domain requires adding its exact HTTPS origin to `PUBLIC_SITE_ORIGINS` and rebuilding a separately hosted frontend with the intended `VITE_CONTENT_ORIGIN` when applicable.

## Warranty Registration

The public **Warranty Registration** tab opens `/warranty`, using an on-screen demo OTP `123456` followed by a product/purchase/dealer/site form and private receipt upload. Records are available in **Admin → Warranty registrations** with search, full details and authenticated receipt download. Demo submissions never count as verified mobile numbers or approved warranties. No SMS or WhatsApp integration is active. See [the warranty guide](docs/warranty-registration.md) for persistence, new private SQL table/migration 006 and later Meta setup.

Final Approved/Rejected warranty decisions now close back to the admin list and automatically download an Areva Decision PDF with all saved fields and review details. Final decisions are read-only; reports can be downloaded again from the list/details. Existing SQL installations after migration 007 need migration 008. See the warranty guide for privacy and recovery behavior.

## Certifications and documents

Manage public certificate/report/data-sheet/warranty cards through **Admin → Certifications and documents**, including PDF uploads, linked products, issuer/reference/dates, visibility and display order. Both website views show the same cards and product downloads. See [the guide](docs/certifications-and-documents.md) for fields, storage and prepared migration 009. No live database migration is performed.

Admin navigation scrolls vertically on desktop; mobile navigation wraps into two columns at the top. Admin sign-in now expires after five idle minutes, with an eight-hour absolute cap. See [the session guide](docs/admin-navigation-and-sessions.md) for interaction, multi-tab and unsaved-edit behavior.
