# Website administration

Open `/admin` to manage the website. The admin interface has seven sections:

| Section            | What you can manage                                                                            | Public result                     |
| ------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------- |
| Landing images     | Upload JPEG/PNG/WebP images, set captions and subtitles, reorder or remove slides              | Homepage carousel and React hero  |
| Products           | Products, images, descriptions, coverage per coat, material units and recommended coats        | Catalog, product details and calculator |
| Authorised dealers | Business name, phone, full address, city, state, PIN and service badges                        | Dealer search and enquiry routing |
| Gallery            | Project albums and digital/social media ads                                                   | Public Gallery tabs               |
| Colours & shade cards | Searchable colours and PDF shade cards                                                     | Colour library and visualizers    |
| Activity history | Private saved-action history, upload names and update dates | Admin only |
| Users | Create Admin, Customer, Architect and Builder accounts; disable/enable and reset passwords | Admin only |

Edits first go into the browser workspace. Select **Apply to workspace** in the editor, then **Save changes** to update the public website. Existing visitors see updated content after reloading; the React site also refreshes its data on window focus. Simultaneous saves use revision checks to prevent silent overwrites. The final product cannot be deleted because the calculator needs one product. An empty custom gallery restores the original landing slides.

Coverage is managed in **Products → Edit**, alongside the product details. Coverage per coat, material units, area calculation and recommended coats feed the same product list and public paint calculator. There is no separate Paint coverage tab.

## Start and sign in

1. Use Node.js 24 and install dependencies with `npm install --package-lock=false`.
2. Set `ADMIN_PASSWORD` in the server environment or an ignored `.env` file to a unique password of at least 12 characters. Never commit a real password. Without it, the server-configured admin login is disabled. Existing created admin accounts can still sign in; if none exist, administration stays disabled.
3. Run `npm run dev`, then open `/admin`. Sign in with username `admin` (or your `ADMIN_USERNAME`) and the configured password.

Authentication uses an HttpOnly, SameSite=Strict cookie, eight-hour sessions and a login attempt limit. Sessions expire when the server restarts. Use HTTPS when deployed publicly. Render is detected automatically through its platform-provided `RENDER=true` variable and trusts one proxy hop. On other hosts, if HTTPS terminates at a trusted reverse proxy, configure Express proxy trust via `TRUST_PROXY_HOPS` (for example `1` for exactly one trusted proxy) so secure cookies and origin checks use the correct protocol. Do not enable proxy trust on a server directly accessible by untrusted clients.

A public demo login is available only when explicitly enabled with `ADMIN_TEST_LOGIN=true` and no `ADMIN_PASSWORD` is configured. Normal administration requires a unique configured password. This remains the server-configured recovery/admin account. Additional individual accounts are managed in Users; password recovery is performed by an admin reset rather than an email recovery service.

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

If sign-in reports **Cross-origin requests are not allowed** on Render, redeploy the proxy-detection fix or set `TRUST_PROXY_HOPS=1` in the service Environment settings and restart. The browser uses HTTPS while the application receives HTTP from Render; proxy trust restores the correct external protocol without disabling origin protection.

## Colours, search and PDF shade cards

Open **Colours & shade cards** in `/admin`. Add individual names, unique colour codes, six-digit HEX values (for example `#B3CCD5`) and colour families. Search the library by name or code, edit existing colours, or remove colours while retaining at least one. Select **Apply to workspace** and **Save changes** to update the public website's searchable palette and React visualizers.

Upload a PDF shade card up to 5 MB. The PDF is retained as a downloadable reference, and the browser reads selectable text from up to 50 pages to build an import preview. Each import row must explicitly contain a colour name, code and HEX value, such as `Coastal Mist | AR901 | #B3CCD5`. Commas, tabs and whitespace-separated rows are also supported. Review and edit the detected names/codes, remove unwanted rows, then choose **Add reviewed colours** and **Save changes**. Existing codes are skipped instead of being overwritten. You can also paste rows directly into the import field.

Scanned/image-only, encrypted, or visually arranged PDF swatches may not produce usable rows. These PDFs remain reference downloads; add their colours manually using the manufacturer's HEX values. The importer does not infer HEX values from photographs, printed swatches or names. PDF processing runs in a lazily loaded browser worker. Uploaded PDFs are served as downloads. Titles, colour records and PDF links persist with the site's existing content storage; existing saved content receives the original palette automatically when upgraded.

Limits: 5,000 colours and 50 shade-card PDFs. Downloads are public after saving. Removing a PDF from the list removes its published link; the uploaded file remains on disk, like uploaded product images. Use `node --import tsx --test tests/admin.test.mjs tests/colour-import.test.mjs` to run the palette/import regression checks.

## Publishing landing images and using the public site

The landing-image editor now has **Save to website**, which checks that the image loads and publishes it immediately. **Apply to workspace** keeps a draft and still requires the footer's **Save changes** button. An “unsaved changes” notice means the public site has not been updated. Broken image links are blocked before publishing; an “Image unavailable” card means you must edit the entry and upload the file again. The server also rejects references to missing uploaded files.

After a successful save, use **Open updated homepage**. An already-open homepage on the same Web Service refreshes its embedded content when another admin tab publishes a new revision. Returning focus to a public tab also checks for updates. Uploaded files and content still require the persistent disk described above to survive Render redeployments.

The existing `areva-paint-new.onrender.com` Static Site now reads public content and the embedded homepage from `https://areva-paint-new-admin.onrender.com`, so both deployed portals use the same store. Uploaded image and PDF URLs resolve against that backend. Deploy the latest commit on **both** Render services for this connection to take effect. Other deployments can set `VITE_CONTENT_ORIGIN` to their backend origin at build time; otherwise the frontend uses its own origin. Administration remains on the Web Service.

Landing and product image uploads support JPEG, PNG and WebP files up to **25 MB**. The image upload endpoint allows 36 MB of JSON to accommodate base64 encoding; other JSON requests retain their existing limits. PDF shade cards remain limited to 5 MB. For landing slides, only the image is required: caption/alt text, subtitle and recommended product are optional. An image-only slide does not show an empty caption box.

## Project photo gallery

The public **Gallery → Projects** tab opens real project albums, separate from the room colour visualizer. In **Admin → Gallery → Projects**, choose **Add project**, enter a project name and upload one or more photos. Multiple photos can be selected together; JPEG/PNG/WebP files support 25 MB each, with up to 20 photos per project and 100 projects. Location, project description and individual captions are optional. Use **Use as cover**, **Move earlier** and the remove control to arrange the album.

Select **Save project to website** to publish directly, or **Apply to workspace** followed by the footer's **Save changes**. New or changed albums appear first. Unrelated product or dealer changes do not change gallery ordering. Public visitors can open each project to browse full photos, captions and thumbnails, using arrows or the keyboard. The Gallery tab remains available with a simple empty state until the first project is published. Existing saved content upgrades automatically to an empty project list without changing products, colours or landing slides.

Removing a project from the admin list stages its removal until **Save changes**. Uploaded files remain on disk, matching existing image storage behaviour. The same persistent storage and shared-backend settings apply. Run `node --import tsx --test tests/project-gallery.test.mjs` after building to check publication, validation, ordering, upgrades and persistence.

## Corporate reference layout

The supplied four-page concept now guides the public website's violet/gold theme, serif headings, home solution links and horizontal product specification cards. Home, Products, Colour Visualizer and Paint Calculator have separate views; Gallery stays in the main navigation, with services, company details, dealers, documents, contact and administration under **More**. Existing section links and enquiry prefills open the appropriate view. Product specifications and photography continue to come from the admin content store; the reference's sample products, coverage values and warranty claims do not replace saved catalogue data.

Selecting a product type opens its own category page (for example, `#products/interior`) with a category heading and filtered collection. Refresh and browser Back/Forward preserve that selection; **All product types** and the main **Products** link return to the same image-based category section on Home (`#solutions`). This single section contains all eight categories; **View all products** (`#products/all`) opens the complete catalogue. Product rows show the details first, followed by a round Areva/name badge. **View specifications & photo** opens the saved product image with the technical details. Mobile layouts keep the same text-then-badge order.

The round product visual starts with the Areva/product name and automatically switches between the name and saved product photograph every **5 seconds**. Click or tap to change the face immediately and restart the five-second delay; Enter and Space also work. Category changes start again with the name. Images keep their proportions, and failed or missing photos leave the name visible. Automatic changes pause in hidden tabs and with reduced-motion settings; manual switching remains available and becomes instant for reduced motion.

Both calculators offer a 0–30% safety allowance, defaulting to the existing 10%. Quotes include the selected allowance. Camera capture stops when leaving the public visualizer view. The optional React Studio retains its existing tools with the same corporate colour theme. For local review, run `npm run dev` and open the server on port 3000; use the public navigation and `/admin` with your configured credentials.

## Gallery Ads

Use **Admin → Gallery → Ads → Add ad** to add a campaign. Choose **Digital** or **Social media**, enter a title and add an image, an HTTPS video/post/campaign link, or both. Description is optional. Creative images use the existing JPEG/PNG/WebP upload limit of **25 MB**; up to 100 ads can be saved. **Save ad to website** saves directly; **Apply to workspace** and the footer's **Save changes** can be used to stage edits. Deletion is staged until saving.

Customers find these under **Gallery → Ads**, with **All**, **Digital** and **Social media** filters. Image creatives open in a full preview; configured video/post links open in a new tab. New or edited ads appear first. Existing projects, landing images and product data are preserved, including when an older admin client saves content without the Ads field. Run `node --import tsx --test tests/gallery-ads.test.mjs` to check validation, publication, safe rendering, compatibility and persistence.

## Homepage campaign hero

The opening homepage hero uses a shared live heading and working Products/Colour Visualizer links over a locally served, compressed room-and-paint background. The admin-managed landing carousel appears directly below it under **Latest from Areva**. Uploading or reordering Landing images changes that carousel; it does not replace the designed opening hero. The same opening hero appears in React Studio, followed by its existing room-preview and shade controls.


## Admin-only update dates and history

Open **Activity history** to review successful sign-ins/sign-outs, image/PDF uploads, saved additions, edits, deletions, reordering and website saves. Choose **Gallery**, **Colours & shade cards**, **Landing images**, **Products** or **Authorised dealers** to see only that area’s history. Gallery includes projects, photos and ads; Colours & shade cards includes colour and PDF events. **All activity** also includes account events, general uploads and website-save summaries. Search by entry, filename or admin username, filter by action and browse pages within the selected tab. Gallery and Colours offer an extra activity-type filter. Switching tabs resets the filters and returns to the first page. Each event shows its exact local date/time and relative age (for example **3 days ago**), the signed-in admin username, changed field names and the website revision where applicable. Passwords, session tokens and complete before/after customer records are not logged.

Content cards/rows show **Updated … ago**. Hover the age for an exact timestamp. Gallery dates already known before this feature remain usable; other older entries show **Not tracked yet** until a meaningful saved change occurs. Tracking starts on deployment/use; past actions cannot be reconstructed. Unsaved drafts and failed validation/conflict attempts are not recorded as changes. Uploading logs a file event immediately; a separate saved entry is required to publish it.

History is generated by the server and stored in a private `adminHistory` area of `CONTENT_DATA_DIR/content.json`. Content and its save-history events are written together with the existing atomic rename. Public content/HTML and even the admin content payload omit that private area; only authenticated **GET /api/admin/history** returns it. There is no UI/API for editing or clearing history. Operator filesystem access can still alter the file, so this is operational history, not a tamper-proof compliance log.

The same persistent disk/backup requirements apply. Keep the entire content file when backing up; a future PostgreSQL migration must preserve history separately from public CMS data. The history is not silently trimmed. It follows the current single-process JSON store model. Separate created admin accounts are identified by their own username. If several people share the same credentials, history cannot distinguish those people. Run `node --import tsx --test tests/admin-history.test.mjs` for privacy, change detection, filtering, revision conflicts and restart checks.


## Product category illustrations

The public product-category hub uses eight illustrated range cards configured in `src/data/categoryArt.ts`. Each selected range now opens a separate full-width photo banner with a white-and-gold heading, four descriptive feature icons, **Explore Products** (scrolls/focuses that range) and **All categories** (returns to the hub). The banners use `src/data/categoryLandings.ts`, shared `CategoryLandingHero.tsx` markup and local `landing-*.webp` scenes. Both renderers share the design, with a stacked mobile composition. These decorative category illustrations do not replace individual product photographs managed in **Products**; specifications, enquiries and the five-second product-photo flip remain in place. No database or Supabase change is needed for these banners.

The selected product range is highlighted in purple in the category links above its landing banner. All eight ranges are available there; selecting another changes its banner and product list. On narrow screens, the links scroll horizontally and automatically reveal the selected range. The main HTML site's category links also preserve direct URLs and browser Back/Forward behaviour. React Studio uses the same navigation and selected styling with its existing state-based category selection.

## Users, roles and logout

A **Logout** button appears in the top bar and sidebar. It invalidates the current admin session and clears its cookie; unsaved content prompts before leaving. **Users → Create user** is available only after admin sign-in. Enter full name, unique username, optional email, role and an initial password of 12–128 characters. Share credentials privately. Only admins can create accounts; there is no public registration endpoint.

| Role | Sign-in location | Permissions |
| --- | --- | --- |
| Admin | Admin tab or `/admin` | Manage website content, history and all created users |
| Customer | Public Customer tab | Sign in to own account; no admin access |
| Architect | Public Architect tab | Sign in to own account; no admin access |
| Builder | Public Builder tab | Sign in to own account; no admin access |

Created accounts can use their username or optional email, case-insensitively. The selected public account type must match the stored role. The Admin tab opens the dedicated admin portal. Public sign-in now checks real server credentials instead of the template's demo login. This does not add order fulfilment, saved cross-device project data or payments to the public account welcome screen.

Created accounts are stored privately in the existing content file, with a separate random salt and scrypt-derived password hash. Passwords cannot be viewed after creation and are never returned by user-list/session APIs. Content saves, uploads and history preserve these private records. No user list, hashes or salts are included in public content. The user limit is 200 created accounts, in addition to the existing server-configured admin. This feature uses the current JSON store; it does not connect PostgreSQL.

Admins can disable/enable accounts and reset passwords. These actions invalidate existing sessions immediately; re-enabling does not revive old sessions. You cannot disable your own account or the last active admin. The server-configured admin stays reserved and read-only in Users: change its credentials in server settings. A created admin who resets their own password is returned to sign-in. Sessions expire after eight hours or server restart. User creation and account-management changes are recorded in private Activity history under Users, with the actual acting admin username.

Both the HTML site and React Studio support account sign-in/logout. In a split Static Site/backend deployment, sign-in opens the backend site at top level so browser restrictions on third-party cookies do not turn login into a false success. Administration remains on the backend. Viewing the enquiry list (`GET /api/enquiries`) now also requires an admin session; public enquiry submission is unchanged.

Back up the entire content file and keep its persistent disk. Existing created accounts survive restarts/redeployments only when that storage survives. Future PostgreSQL migration must include private user credentials/roles and session-revocation versions, alongside the separate activity events. Run `node --import tsx --test tests/users.test.mjs` for authorization, role separation, password storage, collision checks, session revocation, privacy and restart checks.
