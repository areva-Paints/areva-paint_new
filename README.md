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
   - Unique tracking ticket generation (`ARV-REQ-XXXXX`).
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
  - `archiver` for streaming project zip archive downloads
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
npm install
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
| `GET` | `/api/enquiries` | List all inquiries (administrative check) |
| `GET` | `/api/project/download` | Stream complete project source code as `areva-paints-fullstack.zip` |
| `GET` | `/api/project/info` | Repository structure, file count, and environment stats |

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
