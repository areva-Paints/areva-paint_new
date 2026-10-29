# Windows ZIP Extraction & Project Export Fix

Resolves the archive extraction error on Windows systems for `areva-paints-fullstack.zip` by re-packaging the archive with MS-DOS/Windows Explorer compatible headers, top-level folder wrapping, and comprehensive extraction instructions.

### User Review & Critical Decisions

> [!IMPORTANT]
> The native Windows 10/11 "Compressed (zipped) Folder" tool fails when an archive lacks explicit directory records, contains Unix-specific file permission headers, or lacks a top-level container directory.

- **Confirmed Decision (OS)**: Target operating system is confirmed as **Windows**.
- **Package Architecture**: Wrap all codebase contents inside a dedicated `areva-paints-fullstack/` root folder with standard MS-DOS compatible zip records and zero POSIX permission collisions.
- **Alternative Extraction Fallback**: Add one-click PowerShell extraction commands (`Expand-Archive`) and direct GitHub deployment steps inside the application's download modal.

---

### 1. Overview & Core Concept

- **What It Does**: Delivers a rock-solid, 100% Windows-compatible project download package containing the entire Areva Paints fullstack application (React 19 + TypeScript + Tailwind CSS frontend, Express backend, live AR recoloring camera, paint calculator, and product catalogs).
- **Target Audience / Persona**: Windows users (developers, contractors, and evaluators) who need to download, unzip, run locally, or push the project repository to GitHub.
- **Key Value**: Guarantees seamless unzipping in standard Windows File Explorer without requiring third-party extraction tools, while providing immediate fallbacks (PowerShell and 7-Zip) and direct GitHub commands.

---

### 2. User Experience & Visual Design

- **Download Modal Updates**:
  - Prominent **"Windows Ready"** badge on the download button confirming compatibility with Windows Explorer, WinRAR, and 7-Zip.
  - Interactive **Windows Quickstart Guide** inside `ProjectDownloadModal`:
    - Method A: Windows Explorer (Right-click `areva-paints-fullstack.zip` → *Extract All...*).
    - Method B: One-click PowerShell command (copyable):
      ```powershell
      Expand-Archive -Path .\areva-paints-fullstack.zip -DestinationPath .\areva-paints-fullstack
      ```
    - Method C: Direct GitHub Setup (copyable terminal commands to initialize git and push to any GitHub repo).
- **Visual Harmony**: Matches Areva Paints' premium corporate styling with navy, gold, and emerald accents, tabbed navigation between "Direct Download" and "GitHub Push".

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Archive Generation Engine**
  - *Chosen Approach*: Generate `public/areva-paints-fullstack.zip` using Python's standard `zipfile` with explicit directory metadata records, DOS timestamp conversion, and standard `ZIP_DEFLATED`.
  - *Why*: Eliminates the missing directory headers and attribute mismatch that cause the Windows error *"The Compressed (zipped) Folder is invalid"* or *"Windows cannot complete the extraction"*.
  - *Alternatives Considered*: Standard Linux `zip -r` command (frequently causes issues in Windows Explorer when symlinks or Unix file permissions are preserved).

- **Decision 2: Enclosing Root Directory**
  - *Chosen Approach*: Prefix all files with `areva-paints-fullstack/` in the archive.
  - *Why*: Prevents "zip bomb" messy extractions directly onto the user's Desktop or Downloads folder, and prevents path length truncation issues on Windows.

- **Decision 3: Dual Delivery Channels**
  - *Chosen Approach*: Maintain both a pre-built static file at `/areva-paints-fullstack.zip` (for instant reliable downloading) and an updated streaming endpoint at `/api/project/download`.
  - *Why*: Ensures downloads succeed even if browser iframe restrictions throttle dynamic streaming.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   Areva Paints App                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │             ProjectDownloadModal                 │  │
│  │   [Windows Zip (.zip)]    [GitHub Push Guide]   │  │
│  │   [PowerShell Copy]       [Local Run: npm dev]  │  │
│  └─────────────────────────┬────────────────────────┘  │
└────────────────────────────┼───────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌───────────────────────┐         ┌───────────────────────┐
│ /areva-paints-...zip  │         │ /api/project/download │
│ (Pre-built Windows    │         │ (Dynamic Archiver     │
│  Clean Zip Archive)   │         │  Windows-safe stream) │
└───────────────────────┘         └───────────────────────┘
            │                                 │
            └───────────────┬─────────────────┘
                            ▼
      ┌───────────────────────────────────────────┐
      │  Windows Explorer Extraction Compatible   │
      │  areva-paints-fullstack/                  │
      │  ├── package.json                         │
      │  ├── tsconfig.json                        │
      │  ├── vite.config.ts                       │
      │  ├── server.ts                            │
      │  ├── README.md (Windows Setup Guide)      │
      │  ├── src/                                 │
      │  └── public/                              │
      └───────────────────────────────────────────┘
```

- **Execution Steps Upon Approval**:
  1. Run archive builder script to produce a verified Windows-compliant `public/areva-paints-fullstack.zip`.
  2. Verify archive integrity using Python's `zipfile.ZipFile.testzip()`.
  3. Update `server.ts` to ensure dynamic archive generation uses the same root directory prefix and clean headers.
  4. Enhance `src/components/ProjectDownloadModal.tsx` with the Windows-specific guide, PowerShell copy command, and GitHub push workflow.
  5. Run `compile_applet` to verify zero build or TypeScript regressions.
