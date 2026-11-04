# Website administration

Open `/admin` to manage the website. The admin interface has four sections:

| Section            | What you can manage                                                                            | Public result                     |
| ------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------- |
| Landing images     | Upload JPEG/PNG/WebP images, set captions and subtitles, reorder or remove slides              | Homepage carousel and React hero  |
| Products           | Add/edit/remove products, images, categories, descriptions, short taglines and featured status | Catalog and product detail views  |
| Authorised dealers | Business name, phone, full address, city, state, PIN and service badges                        | Dealer search and enquiry routing |
| Paint coverage     | Product coverage per coat, litres/kilograms, recommended coats and wall/floor calculations     | Product list and calculator       |

Edits first go into the browser workspace. Select **Apply to workspace** in the editor, then **Save changes** to update the public website. Existing visitors see updated content after reloading; the React site also refreshes its data on window focus. Simultaneous saves use revision checks to prevent silent overwrites. The final product cannot be deleted because the calculator needs one product. An empty custom gallery restores the original landing slides.

## Start and sign in

1. Use Node.js 24 and install dependencies with `npm install --package-lock=false`.
2. Set `ADMIN_PASSWORD` in the server environment or an ignored `.env` file to a unique password of at least 12 characters. Never commit a real password. Without it, admin sign-in is disabled; the public website remains available.
3. Run `npm run dev`, then open `/admin`. Sign in with username `admin` (or your `ADMIN_USERNAME`) and the configured password.

Authentication uses an HttpOnly, SameSite=Strict cookie, eight-hour sessions and a login attempt limit. Sessions expire when the server restarts. Use HTTPS when deployed publicly. If HTTPS terminates at a trusted reverse proxy, configure Express proxy trust via `TRUST_PROXY_HOPS` (for example `1` for exactly one trusted proxy) so secure cookies and origin checks use the correct protocol. Do not enable proxy trust on a server directly accessible by untrusted clients.

A public demo login is available only when explicitly enabled with `ADMIN_TEST_LOGIN=true` and no `ADMIN_PASSWORD` is configured. Normal administration requires a unique configured password. This provides a single shared admin account; individual staff accounts and password recovery are not implemented.

## Storage and deployment

Content is saved atomically to `.local/content/content.json`; uploaded images go in `.local/content/uploads/`. Set `CONTENT_DATA_DIR` to an absolute path on a persistent volume in production. Back up this directory. It is ignored by Git and must remain outside any publicly served directory. This implementation is intended for one Node server process with a writable disk; use a shared database/object store before scaling to multiple replicas or deploying on an ephemeral filesystem.

The initial admin catalog preserves all 18 products and 13 dealers from the default embedded website. Product images embedded in the original HTML remain accessible through `/api/content/legacy-image/:index`. Existing calculator coverage is retained, including the 50 sq ft/L moisture coating. Products absent from the original calculator use the React catalog's coverage when available, otherwise coverage is marked **Not set** (stored as zero) and the product is excluded from estimates until an admin configures it. Prices are not managed here; the embedded calculator directs visitors to a dealer instead of inventing an estimate for newly added products.

The original HTML source stays unchanged. Its served response receives saved content, and React components consume the same `/api/content` endpoint. The prebuilt downloadable ZIPs are separate existing artifacts; they are not regenerated on every content save.

## Validation

- `npm run lint` — TypeScript checks.
- `npx vite build` — frontend build without rewriting tracked ZIP downloads.
- `node --import tsx --test tests/admin.test.mjs` — starts an isolated server and temporary storage, checks sign-in and access control, file validation, content validation, revision conflicts, public products/dealers/calculator, escaped HTML output, logout and persistence across server restarts.

Local server/browser checks may require the cloud command sandbox's supported escalation mechanism.

## Render deployment and temporary test login

A plain `Not Found` at both `/admin` and `/api/health` indicates that Render is not serving the current Express application. Use a **Node Web Service**, not a Static Site: admin authentication, saving and uploads require the backend. A static-site rewrite alone will not enable these functions.

For an existing Web Service, select the repository's `main` branch, set the build command to `npm install --include=dev --package-lock=false && npx vite build`, and the start command to `npm start`. Set `NODE_ENV=production` and `TRUST_PROXY_HOPS=1` behind Render's proxy, then deploy the latest commit. After deployment, `/api/health` must return JSON and `/admin` must show the login form. If this is currently a Static Site, create a Web Service and use its URL; editing this repository cannot change an existing Render service's type.

For temporary testing, set `ADMIN_TEST_LOGIN=true` in Render's Environment settings and leave `ADMIN_PASSWORD` unset or empty. Sign in with username **admin** and password **ArevaTest2026!**. These are public testing credentials; do not enable them for a site containing real customer data. To disable the test login, set `ADMIN_TEST_LOGIN=false` and set a unique `ADMIN_PASSWORD` of at least 12 characters. `ADMIN_USERNAME` defaults to `admin`; a configured password always takes precedence over the test password. Redeploy/restart after changing environment settings.

`render.yaml` supplies an optional Blueprint for a Node Web Service with a persistent disk. Its `starter` service and disk require a paid Render plan. It keeps testing login disabled until you explicitly enable it. For a free Web Service, configure the build/start commands manually and note that saved content and uploads will not survive redeploys without external persistent storage. Adding this file does not automatically reconfigure an existing Render service or trigger a Blueprint deployment.
