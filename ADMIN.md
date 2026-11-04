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
3. Run `npm run dev`, then open `/admin`. Sign in with the configured password.

Authentication uses an HttpOnly, SameSite=Strict cookie, eight-hour sessions and a login attempt limit. Sessions expire when the server restarts. Use HTTPS when deployed publicly. If HTTPS terminates at a trusted reverse proxy, configure Express proxy trust via `TRUST_PROXY_HOPS` (for example `1` for exactly one trusted proxy) so secure cookies and origin checks use the correct protocol. Do not enable proxy trust on a server directly accessible by untrusted clients.

No default or hard-coded admin password is shipped. This provides a single shared admin account; individual staff accounts and password recovery are not implemented.

## Storage and deployment

Content is saved atomically to `.local/content/content.json`; uploaded images go in `.local/content/uploads/`. Set `CONTENT_DATA_DIR` to an absolute path on a persistent volume in production. Back up this directory. It is ignored by Git and must remain outside any publicly served directory. This implementation is intended for one Node server process with a writable disk; use a shared database/object store before scaling to multiple replicas or deploying on an ephemeral filesystem.

The initial admin catalog preserves all 18 products and 13 dealers from the default embedded website. Product images embedded in the original HTML remain accessible through `/api/content/legacy-image/:index`. Existing calculator coverage is retained, including the 50 sq ft/L moisture coating. Products absent from the original calculator use the React catalog's coverage when available, otherwise coverage is marked **Not set** (stored as zero) and the product is excluded from estimates until an admin configures it. Prices are not managed here; the embedded calculator directs visitors to a dealer instead of inventing an estimate for newly added products.

The original HTML source stays unchanged. Its served response receives saved content, and React components consume the same `/api/content` endpoint. The prebuilt downloadable ZIPs are separate existing artifacts; they are not regenerated on every content save.

## Validation

- `npm run lint` — TypeScript checks.
- `npx vite build` — frontend build without rewriting tracked ZIP downloads.
- `node --import tsx --test tests/admin.test.mjs` — starts an isolated server and temporary storage, checks sign-in and access control, file validation, content validation, revision conflicts, public products/dealers/calculator, escaped HTML output, logout and persistence across server restarts.

Local server/browser checks may require the cloud command sandbox's supported escalation mechanism.
