# Project and security review — 14 November 2026

Reviewed the local repository based on `041643c`, including Express routes, admin/account code, public React and legacy HTML renderers, uploads, JSON storage, SQL schema/migrations, dependency/build configuration and tests. This is a code review with local regression/security checks. It is not a penetration-test certification or a review of the live hosting account/database.

## Findings addressed

| Priority | Finding | Change |
| --- | --- | --- |
| High | Source manifests and ZIPs were publicly downloadable; public archives also entered static frontend builds | Admin authentication on `/api/project/*` and every ZIP path, including encoded paths. Old ZIPs retained privately in ignored `artifacts/source-backups/`; public ZIP copies removed. New packages belong in `artifacts/source/`. Packaging writes only to that private directory and skips hidden files/symlinks. |
| High | Large image bodies were parsed before authenticating the caller | Admin authentication and browser-origin/content-type checks run before request parsing. Separate limits: image 36 MiB, PDF 8 MiB, content save 10 MiB, other API JSON 64 KiB. |
| High | Dealer search inserted browser input into HTML strings; React print output interpolated raw shade names | Escaped text at those sinks; dealer input accepts complete city names. Corrupt/non-array saved-shade localStorage is normalized rather than crashing the page. |
| High | Known testing credentials could be enabled in production | Production ignores `ADMIN_TEST_LOGIN`; no account or production password is created by this work. |
| High | Ordinary PostgreSQL schema lacked an explicit private-access boundary | Fresh schema enables RLS on all 19 Areva tables and revokes direct access from PUBLIC and existing Supabase API roles. Migration 005 applies the same restrictions to existing Areva tables. Identifier-trigger writes are qualified by the trigger table's schema. |
| Medium | Wildcard CORS and absent production browser headers | Public content/assets use exact allowed origins; admin/auth/source APIs do not allow credentialed cross-origin use. Enforced production CSP, per-response executable-script nonce, no object embedding, restricted base/form/frame sources, admin frame denial, nosniff, referrer/permissions policies and HTTPS HSTS. |
| Medium | Public enquiry/calculator APIs accepted malformed or unbounded values | Validated lengths/types/phone/dimensions/counts, unknown-product rejection, JSON-object requirement and per-IP request limits. Calculator packs use configured numeric product sizes. |
| Medium | Login maps, concurrent password derivations and uploads had weak resource bounds | Expiring bounded login-attempt map, bounded sessions (five per identity, 2,000 total), four concurrent password derivations, upload/calculator/enquiry limits and shared upload-storage budget. |
| Medium | Enquiries disappeared on restart and short random ticket IDs could collide | Private atomic `enquiries.json` persistence, UUID ticket IDs, no seeded sample enquiry, admin-only listing and no-store responses. Maximum 10,000 records refuses new writes without deleting customers. |
| Medium | Builds were not reproducible; an unused archive dependency introduced advisories | Added `package-lock.json`, use `npm ci` in hosting/CI, removed unused `archiver`/types and its vulnerable chain. Normal builds no longer generate source archives. |
| Quality | Duplicate unreachable HTML handlers, duplicated origin-check implementations, raw server errors and unknown API fallback to SPA | One dynamic HTML handler, shared security middleware, generic API errors, explicit API/file 404 responses, public-content field allowlist, private atomic JSON writer and Vite config using `import.meta.url`. |

## Current storage and database status

The running application architecture still uses JSON, with no runtime PostgreSQL driver/adapter or Supabase Auth/Storage integration. `DATABASE_URL` alone does not switch persistence. Content/accounts/history are in `CONTENT_DATA_DIR/content.json`; API enquiries are now in `CONTENT_DATA_DIR/enquiries.json`; uploaded public catalogue images/PDFs are in `CONTENT_DATA_DIR/uploads`.

The reviewed SQL has 19 tables, including private users, login identifiers, enquiries and activity. Fresh `database/schema.sql` and the generated Supabase setup include private-access restrictions. An existing schema with migrations 001–004 needs the separately reviewed `database/migrations/005-private-access-guardrails.sql`. This migration deliberately removes direct API-role grants; assess existing integrations before applying it. It stops if both public and private user tables exist. Unrelated public/Auth tables are preserved.

No live SQL was executed and no database credentials were available or requested. A future backend SQL role must receive intentionally scoped permissions and an RLS strategy; do not grant browser roles access or use a privileged database credential in frontend configuration. The trigger function retains invoker permissions and cannot be redirected to a caller-controlled identifier table through search_path. RLS does not restrict the database owner/superusers.

Enquiry files persist only when their volume persists. Old process-memory enquiries cannot be recovered by this change. Back up the entire private content file, enquiry file and uploads together; keep backups off the web root. File writes use unique mode-0600 temporary files, file fsync and atomic rename. No retention cleanup silently removes history, accounts, enquiries or uploads.

## Configuration and release checks

- Run production with `NODE_ENV=production`, HTTPS, strong private admin credentials and one Node process on persistent private storage.
- `CONTENT_DATA_DIR` must be outside `public`, `dist` and `src`; startup refuses those unsafe locations. Never publish that directory with a static host or backup/download URL.
- `PUBLIC_SITE_ORIGINS` contains comma-separated exact origins without paths/trailing slashes. The two existing Render origins are also allowed. Add the actual GoDaddy HTTPS domain when configured. Set the separate frontend's `VITE_CONTENT_ORIGIN` to the intended backend if needed.
- `TRUST_PROXY_HOPS=1` matches the existing Render proxy; direct hosting needs 0. Configure this to match the actual network so client IP limits and Secure cookies cannot be spoofed through a directly exposed trusted-proxy port.
- `UPLOAD_STORAGE_MB` defaults to 512 MiB. Image/PDF uploads allow 30 requests/minute per endpoint/IP. Calculator estimates allow 120/minute; enquiries allow five requests/15 minutes. These are local process backstops, not a distributed anti-abuse service.
- Login allows eight attempts/15 minutes per IP, with an additional 60-request/minute parser backstop. Successful login resets the failure window. Concurrent password work is bounded; overloaded verification fails rather than adding an unbounded queue.
- `npm run build` builds only the frontend. `npm run package:source` explicitly generates private operator archives; generate them when needed; old retained archives are backups and are not served. Admin downloads require a same-origin session; anonymous shell download commands cannot authenticate by themselves.
- GitHub Actions runs `npm ci`, type checks, all tests, production build and dependency audit on pushes/pull requests. No deployment or outbound message is part of that workflow. The runtime needs devDependencies for its existing Vite import/build setup; do not prune them without first splitting development-only imports.

## Verification

The full regression suite and added private-packaging check passed (16 tests total). Existing accounts, admin saves, uploads, products, colour metadata/PDFs, gallery projects/ads/reviews, activity privacy, session revocation, revision conflicts and restart behavior were exercised with temporary data. New checks cover source/ZIP authorization, request/origin/content-type boundaries, CSP nonce generation, private enquiries and file mode, rate limits, upload quota, production testing-password denial and invalid API inputs.

Embedded PostgreSQL/PGlite tests cover fresh schema/seed, all 19 RLS tables, API-role permission denial, RLS under an accidental SELECT grant, identifier inserts with hostile search_path, the existing-schema hardening migration, preservation of unrelated tables, Supabase private-schema setup and rollback on a repeat setup. They do not prove the live Supabase project's permissions.

The dependency audit reported three related moderate advisories before removing the unused archive chain and zero known advisories afterward. Type checks and production builds passed. Production Chromium checks passed for all public routes, the embedded Home page, admin login/tabs/logout and React Studio; injected scripts were blocked and dealer-search input stayed literal text. No unexpected CSP violations or browser exceptions were observed. Real PDF extraction/review, individual shade entry, saving, filtered public PDF links and both renderers also passed at 320–1440px. Rerun the commands below after future edits:

```bash
npm ci
npm run lint
npm test
npm run build
npm audit --audit-level=moderate
```

## Remaining work and practical limits

1. Implement and rehearse a PostgreSQL adapter/import before calling the website SQL-backed. Preserve role/password versions, private history, enquiry IDs, revision transactions and all content/media references. No live data migration was attempted here.
2. JSON files, session maps, limits and quota checks assume one process. Multiple replicas need transactional shared storage, shared sessions/rate limits and coordinated upload quotas. Keep that deployment restriction until those changes exist.
3. Admin MFA, account-specific/distributed brute-force protection, password recovery, bot challenges and centralized security monitoring are not implemented. The current protections reduce common abuse but do not promise prevention of all attacks.
4. Uploaded images/PDFs are public catalogue assets. Signature/size checks are not antivirus scanning, full image decoding or PDF sanitization. Never use this upload path for private warranty receipts; that feature remains deferred.
5. The legacy page still uses HTML-string rendering and a large inline script; it is escaped and nonce-protected, but gradual component extraction remains worthwhile. Larger admin components and synchronous full-file reads/writes also remain maintainability/performance debt. TypeScript checks run, but project-wide `strict`/ESLint adoption has not been completed. The main frontend bundle still has Vite's size warning.
6. Demo reward/sample/business flows and placeholder business contact details need product review before real fulfilment. Existing legacy Contact/booking handoffs use WhatsApp, while the React enquiry modal submits to the enquiry API; private enquiry persistence does not claim to unify those separate flows or send notifications.
7. Verify HTTPS, domain origins, proxy behavior, backup restoration, disk capacity and permissions in the actual hosting account before release. This review did not inspect live settings or change a deployment.
