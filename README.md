# Areva Paints

Website, content administration and warranty registration for Areva Paints. One Node.js/Express service can serve the public website, `/admin`, `/warranty` and their APIs.

**Current storage is private JSON on disk.** The PostgreSQL/Supabase files are a prepared schema, not an active database connection. Adding `DATABASE_URL` does not move records or change how the application saves them.

## Technologies used

| Area            | Technology and purpose                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Runtime         | Node.js 24 LTS; the tested version is pinned in `.nvmrc` and `render.yaml`                                                         |
| Backend         | Express 4 and TypeScript, executed with `tsx`                                                                                      |
| Frontend        | React 19, Vite 8, Tailwind CSS 4, Motion and Lucide icons                                                                          |
| Public layout   | Preserved HTML adapted on the server to current CMS data; shared React fragments and browser controllers provide the branded pages |
| Persistence     | Atomic private JSON files plus public uploads and private warranty receipts                                                        |
| Accounts        | Node `crypto.scrypt`, opaque in-memory sessions and separate admin/public/warranty cookies                                         |
| Documents       | PDF.js for shade-import previews; PDFKit/fontkit and committed Noto fonts for private warranty decision PDFs                       |
| Source exports  | JSZip; archives are created separately from website builds                                                                         |
| SQL preparation | PostgreSQL 16+ schema and migrations; PGlite runs isolated PostgreSQL regression tests                                             |
| Checks          | TypeScript type checking, Node test runner, production dependency audit and GitHub Actions                                         |

The project does not currently enable TypeScript's `strict` option. `npm run lint` runs `tsc --noEmit`; it is not an ESLint or formatting command. Dependency versions are reproducible through `package-lock.json`.

## Features and integration status

- Public catalogue with category pages, technical specifications, bases/packing, optional product warranty badges, shades, visualizers, calculator and dealer search.
- Admin editing for Certifications and documents, products, landing images, dealers, colours/shade PDFs, Gallery projects/campaigns/reviews, accounts and activity history.
- Warranty purchase registration with a captured login phone, dealer/invoice/site details, private receipt upload, admin search/date filters, final review decisions and decision PDFs.
- Customer **My registrations** after mobile/demo entry, with reference-protected history, current review status, existing-reference lookup and new/unfinished registration actions. See [customer history](docs/customer-warranty-history.md) for demo access limits and private SQL table migration 014.
- Admin sign-out after five minutes without interaction, with an eight-hour absolute session cap. Server restarts clear in-memory sessions and require sign-in again.
- Warranty entry currently uses **demo OTP `123456`**. It sends no SMS, WhatsApp or email and never marks the phone as verified. Meta WhatsApp Cloud API is a future integration, not an environment switch that is already implemented.
- The optional React studio's loyalty wallet/UPI and swatch-order screens are demonstrations using local state. No payment, delivery, QR rewards or order backend is connected. Camera colour preview uses browser video/canvas, not spatial WebXR tracking.

## Run locally

Install Node.js 24 LTS, then:

```bash
git clone https://github.com/areva-Paints/areva-paint_new.git
cd areva-paint_new
npm ci
cp .env.example .env
```

On Windows, copy `.env.example` to `.env` using File Explorer or `Copy-Item .env.example .env`. Set a unique `ADMIN_PASSWORD` of at least 12 characters in the local `.env`; never commit that file. Keep `NODE_ENV=development` for local work.

```bash
npm run dev
```

Open `http://localhost:3000`, `http://localhost:3000/admin` or `http://localhost:3000/warranty`. Express and Vite share port 3000. The configured admin username defaults to `admin`. No customer or other created account is seeded automatically; an admin creates those accounts in the Users tab.

For a local production check:

```bash
npm run build
NODE_ENV=production npm start
```

In PowerShell, use `$env:NODE_ENV = "production"` followed by `npm start`. Keep the root `server.ts`, `src/`, `public/`, `assets/fonts/`, `package.json`, lockfile and configuration alongside `dist/`; the backend is not bundled into `dist`. `npm run preview` previews client assets only and does not run the backend APIs.

## Configuration

Use local `.env` during development and the hosting provider's environment settings in production. Express reads `PORT`; Render supplies it automatically.

| Variable              | Setting                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | `production` on the hosted Web Service; `development` locally                                                          |
| `ADMIN_USERNAME`      | Recovery/admin sign-in name; default `admin`                                                                           |
| `ADMIN_PASSWORD`      | Server secret with at least 12 characters; required to bootstrap administration                                        |
| `ADMIN_TEST_LOGIN`    | Keep `false`; test login is ignored entirely in production                                                             |
| `CONTENT_DATA_DIR`    | Private persistent directory; use `/var/data/areva` with the provided Render disk                                      |
| `TRUST_PROXY_HOPS`    | `1` behind Render's proxy, `0` for direct local HTTP; match your actual reverse proxy                                  |
| `PUBLIC_SITE_ORIGINS` | Comma-separated exact HTTP(S) public origins, without paths or trailing `/`; include each intended custom domain       |
| `UPLOAD_STORAGE_MB`   | Public image/PDF upload budget; default `512` MiB                                                                      |
| `WARRANTY_STORAGE_MB` | Private receipt storage budget; default `128` MiB                                                                      |
| `WARRANTY_OTP_MODE`   | `demo` for the current flow; `disabled` to stop new warranty entry                                                     |
| `VITE_CONTENT_ORIGIN` | Optional **build-time public backend origin** for a separately hosted frontend; rebuild the frontend after changing it |

`VITE_*` values are exposed to the browser and must never contain passwords, API secrets or database credentials. The two existing Render public origins are included in the code's public allowlist; the variable adds other origins. Admin, auth and warranty writes remain same-origin. No AI API key is required by this application.

## Host on Render

### Recommended: one Web Service

Use a Render **Web Service**, not a Static Site. The service runs Express and serves all three page routes and their APIs. The supplied [render.yaml](render.yaml) defines the service and its persistent disk.

1. Connect the repository to Render and select the branch containing the reviewed changes. Use **New → Blueprint** with `render.yaml`, or **New → Web Service** for manual configuration.
2. Select the Node runtime and a plan that supports a persistent disk. The blueprint selects `starter`; verify current availability/pricing in Render.
3. Use these commands from the repository root:

   | Render field      | Value                                                           |
   | ----------------- | --------------------------------------------------------------- |
   | Build Command     | `npm ci --include=dev && npm run build && npm prune --omit=dev` |
   | Start Command     | `npm start`                                                     |
   | Health Check Path | `/api/health`                                                   |
   | Node version      | `24.22.1`                                                       |

   Build tools are installed for compilation and then removed. The server imports Vite only in its development branch, so the live service can start with production dependencies alone.

4. Add a **1 GB persistent disk** mounted at `/var/data/areva`. Set `CONTENT_DATA_DIR=/var/data/areva`. The runtime directory must be writable by the service and outside `public`, `dist` and `src`, including symlink targets. Its public `uploads/` subdirectory must be a real directory; media-file symlinks are not served. Development also denies Vite file access to the private data directory.
5. Set `NODE_ENV=production`, `TRUST_PROXY_HOPS=1`, `ADMIN_TEST_LOGIN=false` and a private `ADMIN_PASSWORD` of at least 12 characters. Set the remaining variables using the table above. The blueprint prompts for the admin secret; it does not contain a password.
6. Deploy, then check `/api/health`, `/`, `/admin` and `/warranty` on the Web Service's HTTPS URL. The first admin section should be Certifications and documents.
7. Save a small test content change and a test warranty purchase in staging, restart that service, then verify that the saved data and receipts remain. Restore the test content afterward.

Use **one service instance and one Node process** with this JSON backend. Separate services/disks do not synchronize; multiple workers cannot safely share full-file read/modify/write operations. Sessions and rate limits are also in memory. Database/object-storage/shared-session adapters are required before scaling across instances.

A Static Site alone cannot authenticate admins, save CMS/warranty records, accept receipt uploads or generate decision PDFs. A free/ephemeral filesystem can lose saved data across restarts or deploys; persistence needs a disk-capable service. The included upload budgets leave space for JSON files on the 1 GB disk, but monitor actual usage and back it up.

### If the public frontend remains a separate Static Site

Keep all admin and warranty pages on the Node Web Service. For the public Static Site:

1. Set its build-time `VITE_CONTENT_ORIGIN` to the Web Service origin, for example `https://areva-paint-new-admin.onrender.com`.
2. Use `npm ci --include=dev && npm run build` and publish `dist`. Configure a rewrite from `/*` to `/index.html` for client routes.
3. Include the exact Static Site origin in the Web Service's `PUBLIC_SITE_ORIGINS`, then redeploy/restart the backend and rebuild the frontend as needed.
4. Open `/admin` and `/warranty` on the backend origin. The app directs warranty entry to the configured backend so its private session and receipt requests remain same-origin.

Two independently running Web Services will have different data directories unless a shared storage adapter is deliberately implemented. Point both public views at the one intended content backend.

### Custom domain or other hosting

For a GoDaddy-managed domain, add the domain in Render and copy the DNS records Render provides into GoDaddy DNS. Allow Render to issue its HTTPS certificate. Add each intended HTTPS origin, including `www` if used, to `PUBLIC_SITE_ORIGINS`. A separately hosted frontend also needs the correct `VITE_CONTENT_ORIGIN` and a rebuild.

The Node service may also run on another Node-capable host/VPS with HTTPS, private persistent storage, one process, the same build/start commands and an appropriate proxy setting. Ordinary static-only shared hosting cannot run these Express APIs. Build in the repository root; do not upload only `dist` for a full-stack deployment.

## Data and backups

| Path inside `CONTENT_DATA_DIR` | Contents and access                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `content.json`                 | CMS content, created account password hashes/salts and private audit history; public APIs select safe fields         |
| `enquiries.json`               | Private customer enquiries and dealer snapshots                                                                      |
| `warranties.json`              | Private purchase/receipt metadata, captured login phone and review history                                           |
| `warranty-history-access.json` | Aggregated successful customer-history lookups using registration IDs and hashed session identifiers; no raw cookies |
| `warranty-uploads.json`        | Pending receipt metadata bound to warranty sessions                                                                  |
| `warranty-site-uploads.json`   | Pending private building-photo metadata bound to warranty sessions                                                   |
| `uploads/`                     | Public catalogue images and document/shade PDFs                                                                      |
| `warranty-receipts/`           | Private purchase receipts available only through authorized endpoints                                                |
| `warranty-site-photos/`        | Private building/application images attached to registrations                                                        |

Files are created when needed. A new empty directory starts from committed catalogue seeds; it does not recover previous CMS edits automatically. JSON writes use restricted temporary files, flush and atomic rename. That prevents partially written individual files, but does not replace backups or multi-process transactions.

Back up the **whole directory**, including all upload folders, to access-controlled storage outside the service disk. Use a provider snapshot or pause writes during a file-level backup so JSON and file attachments form one consistent set. Keep backups private because they contain customer details and password derivation material.

To restore, stop writes/service, restore the complete matching backup to the configured directory with permissions readable/writable only by the service user, restart, then check content, admin accounts and private receipt/PDF downloads. Restarting clears old sessions. Do not copy private data into Git, `public`, `src` or `dist`. A Git push/deploy updates code, not the persistent content backup.

## SQL files and upgrades

The running service has no SQL driver/adapter and does not execute SQL files on startup. The prepared schema has **24 tables** for catalogue content, dealers, shades, galleries, documents, accounts, history, enquiries and warranties, including private customer-history access records.

| Situation                     | SQL path                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| New empty PostgreSQL database | `database/schema.sql`, then `database/seed-categories.sql`                                                                               |
| New Areva schema in Supabase  | Run `database/supabase-setup.sql` once through the authorized owner account; it creates the private `areva` schema and includes the seed |
| Existing installation         | Apply only unapplied numbered migrations in order, after checking its current version and backing up; never rerun fresh setup            |
| Read-only inspection          | `database/review-checks.sql` checks table/RLS counts, private role access, constraint state and data-quality counts                      |

Migration [012-contact-and-review-integrity.sql](database/migrations/012-contact-and-review-integrity.sql) follows 001–011. It adds digit-count/format checks to contact numbers, requires rejection/information-request reasons and reviewer metadata, and prevents approval-confirmation flags on other statuses. Preflight reports conflicting legacy-record counts and stops the entire transaction without rewriting records. An operator must inspect/correct those conflicts before retrying. Fresh setup already includes these rules.

All application tables use row-level security with no public browser policies and revoke direct Supabase API-role access. A future backend SQL adapter still needs a dedicated permission model, parameterized queries, transactions, JSON-to-SQL import, attachment migration and deployment cutover. Never expose an owner connection string or privileged key through the frontend. Setting up SQL tables alone does not connect the website.

See [database layout](docs/database-layout.md), [Supabase setup](docs/supabase-setup.md) and [the current review](docs/code-review-2026-11-22.md). Regenerate the local combined setup after changing canonical schema/seed:

```bash
node scripts/prepare_supabase_sql.cjs
```

This command only writes SQL; it does not connect to any database.

## Code layout and comments

```text
server.ts                 Express composition, public APIs, static/dev serving
src/admin/                CMS, accounts, validation, private JSON store and public HTML adapters
src/server/               Security, enquiries, atomic storage, warranties, search and PDF reports
src/warranty/             Public warranty flow and private admin registration manager
src/components/           Shared public React components and optional studio tools
src/data/                 Catalogue seeds, metadata and shared display/validation helpers
public/assets/            Public browser controllers, styles and committed artwork
assets/fonts/             Licensed fonts used by server-generated decision PDFs
database/                 Prepared schema, ordered migrations and read-only review SQL
tests/                    Local API, persistence, rendering and PostgreSQL regression checks
scripts/                  Source packaging and SQL generation
render.yaml               Render Web Service, disk and environment blueprint
.github/workflows/        Automated type/test/build/audit checks
```

Block comments describe module responsibilities, functional handlers, storage/security boundaries, SQL tables, browser controllers and responsive style sections. Important effects explain their lifecycle and cleanup. JSON seed/config/lock files remain valid JSON, which does not support comments. Generated `dist`, binary assets and dependency code are not manually annotated; edit their maintained source instead. The preserved HTML prototype stays compatible with the server adapters' exact anchors.

## Verification and dependency status

```bash
npm ci
node scripts/prepare_supabase_sql.cjs --check
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=moderate
npm audit --audit-level=moderate
```

To verify the exact deployment shape in a disposable checkout, run `npm run build`, `npm prune --omit=dev` and `npm run check:production`. This checks real production startup without Vite using a temporary data directory and random test credential. Run `npm ci` afterward to restore development tools. CI performs this check after the full suite.

Full source ZIPs include supporting scripts, documentation, SQL and Render settings. The browser-generated text export omits binary artwork/fonts; use Git or the full ZIP for a complete deployment. Archives are created only by `npm run package:source` and are stored privately in `artifacts/source`, with download access limited to admins.

Tests create temporary local data directories and isolated PGlite databases; they do not migrate the hosted database. They cover auth/idle expiry, input validation, private uploads/storage, content conflicts, warranty entry/search/review/PDF behavior and SQL permissions/migrations. Build tools and PGlite must be present to run these checks; do not run tests after pruning dev dependencies.

On **22 November 2026**, both the production and complete locked dependency audits report **zero known advisories**. CI blocks advisories in both scopes. No dependency versions or lockfile entries were changed during this review. These are point-in-time registry results; see [the review](docs/code-review-2026-11-22.md) for fixes, verification and remaining runtime/integration limits.

## Troubleshooting

| Symptom                                       | Check                                                                                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Set ADMIN_PASSWORD … at least 12 characters” | Open Render **Web Service → Environment**, set the backend secret and save/redeploy. A Static Site environment cannot configure the backend admin. |
| Cannot find a backend service                 | In Render, locate/create a **Node Web Service** connected to this repository; a Static Site only publishes client files.                           |
| Website opens but APIs return 404             | Use the Node service URL, not Vite preview or a static-only host; check its start command and `/api/health`.                                       |
| CMS changes disappear after deploy            | Verify the persistent disk mount and `CONTENT_DATA_DIR`; check whether the frontend is reading a different backend origin.                         |
| Public uploads do not load                    | Restore the matching `uploads` directory and use the correct content backend origin; changing JSON alone cannot recover missing files.             |
| Login fails on a custom domain/proxy          | Use HTTPS and same-origin admin URLs, exact allowed public origins and the actual trusted proxy hop count.                                         |
| Admin signs out while idle                    | This is the configured five-minute policy. Unsaved drafts are cleared on expiry; sign in and reload saved content.                                 |
| Warranty OTP does not arrive                  | Only on-screen demo OTP is implemented. SMS/Meta WhatsApp delivery still requires backend provider integration.                                    |
| SQL table is empty after an admin save        | Current saves go to private JSON; no runtime SQL adapter/import has been enabled.                                                                  |
| Decision saved but PDF did not download       | Use Download decision PDF in the list/details; check that `assets/fonts` was deployed and the admin session is still active.                       |
| Production cannot find Vite                   | Use this revision's dynamic development import, build before pruning and start with `NODE_ENV=production`.                                         |

Additional guides: [warranty workflow](docs/warranty-registration.md), [certifications/documents](docs/certifications-and-documents.md), [admin sessions](docs/admin-navigation-and-sessions.md), [Gallery categories](docs/gallery-project-categories.md), [shared branding](docs/shared-brand-and-page-headers.md) and [security protections](docs/security-review.md).

## Building photos and warranty terms

Warranty registrations accept up to five optional private building photos (JPEG/PNG/WebP, 5 MB each). Admin registration details show previews and downloads. In Products, admins can upload public warranty-terms PDFs for a product or whole product type; the warranty badge opens the filtered Terms and conditions page. More now includes Certifications and documents and an illustrated Terms and conditions card. See [the guide](docs/building-photos-and-warranty-terms.md) for controls, storage, private endpoints and prepared migration 013. The runtime remains JSON-backed and OTP remains demo-only.
