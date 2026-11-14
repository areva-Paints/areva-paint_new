# Warranty Registration — 14 November 2026

The public website now has a **Warranty Registration** link, opening the Areva-branded `/warranty` page at top level. React Studio includes the same link. The form runs on the backend origin so cookies and private receipt upload do not depend on third-party iframe cookies.

## Current demo flow

1. Enter a 10-digit Indian mobile number.
2. Submit to receive an on-screen **demo OTP `123456`**. No SMS or WhatsApp message is sent. The code expires after five minutes; resend has a 60-second cooldown and five incorrect attempts invalidate a challenge.
3. Continue to the registration form. This creates a separate, 30-minute warranty-entry session, never an admin/customer account session.
4. Enter the purchase and site details, upload a private receipt, confirm accurate information/contact consent, then submit.
5. The confirmation shows the registration reference. Every demo record stores `verificationMode: demo`, `mobileVerified: false` and `status: pending_review` regardless of client input. No warranty start/end date or approval is assigned automatically.

There is no public historical-record lookup by mobile number. Knowing the shared demo code does not give access to past registrations or receipts. A demo session can only create a new record and attach receipts uploaded in that same session. Retrying the same submission ID returns its existing confirmation instead of creating a duplicate. A separate registration can be made for another product.

## Fields

| Group | Fields |
| --- | --- |
| Customer | Full name, session mobile, optional email/alternate phone |
| Product/purchase | Product type and name from the current catalogue, purchase date, quantity, pack size/unit, optional batch/lot and shade |
| Warranty details | Server-side snapshot of product name/type and configured warranty years/label; no customer-entered duration |
| Dealer | Optional selection from existing dealers, dealer/shop name, address, city, optional phone, invoice/receipt number |
| Receipt | Required PDF/JPEG/PNG/WebP, up to 5 MiB; original display name, MIME, byte count and random private identifier |
| Site/application | Site address, city, state, six-digit PIN; optional completion date, painted area, applicator name/phone and notes |
| Submission | Accuracy/contact consent, reference, created timestamp, verification mode and pending-review status |

Dates must be real dates, not in the future; application completion cannot precede purchase. The API uses the current date in Asia/Kolkata. Quantities/areas must be positive and at most 100,000. Catalogue/dealer IDs and string lengths are validated on the server. Product names/type/warranty are snapshots, so future catalogue edits do not rewrite old registrations. Product warranty text is not a promise of eligibility or activation.

## Admin portal

Open **Admin → Warranty registrations**. Search all saved details, including reference, name, mobile, invoice, product/type, dealer, site, batch, shade and notes. Filter by product type, refresh and page through results. Clicking **View details** opens the complete private record. **Download private receipt** uses an admin-authenticated attachment endpoint; the original file is never given a public `/uploads` URL. The list refreshes when the browser regains focus.

Registration records are saved independently of CMS **Save changes**; changing website content does not overwrite them. This initial admin tab provides search/read/download, not approval, deletion, certificates or messaging. Demo entries are explicitly marked unverified and pending review.

## Current storage and privacy

The current application remains JSON-backed. On the existing persistent `CONTENT_DATA_DIR` volume:

- `warranties.json`: private durable registration records.
- `warranty-receipts/`: private binary receipt files; UUID filenames, not customer filenames.
- `warranty-uploads.json`: temporary session ownership/expiry metadata for receipts not yet attached to a registration.

Private files use mode 0600 and directories are created with mode 0700. Record/metadata writes use the shared atomic JSON writer. There are no public static routes into this directory. The admin API requires an active admin session; a warranty cookie cannot access it. Public content, HTML and source manifests do not contain saved warranty records.

Back up all three areas with the existing content/enquiry files and media. Receipts need the same durable disk as registrations. Unsubmitted uploads expire after 24 hours and are cleaned during subsequent upload/submission requests; referenced receipt files are protected even if metadata cleanup previously failed. Retention does not automatically delete submitted records. One Node process is required; multiple instances need a transactional shared repository/session store and coordinated storage limits first.

## API and guardrails

| Route | Access / behavior |
| --- | --- |
| `GET /api/warranty/options` | Public catalogue/dealer options, demo availability and today's date |
| `POST /api/warranty/otp/request` | Demo challenge; five requests/15 minutes per IP, resend cooldown, bounded challenge map |
| `POST /api/warranty/otp/verify` | Twenty attempts/15 minutes per IP plus five/challenge; consumes challenge; HttpOnly/SameSite Strict cookie |
| `GET /api/warranty/session` | Returns only the current entry session's mobile/demo status; no past records |
| `POST /api/warranty/logout` | Ends only the warranty-entry session |
| `POST /api/warranty/receipt` | Entry session required before parsing; 8 MiB JSON-body limit, five-MiB file limit, signature checks, ten uploads/hour per IP, three temporary uploads/session |
| `POST /api/warranty/registrations` | Entry session required, 32 KiB body limit, five attempts/hour per IP, validated/idempotent save |
| `GET /api/admin/warranties` | Admin only; search/category/page, twenty rows/page |
| `GET /api/admin/warranties/:id/receipt` | Admin only; private no-store attachment, sandbox/nosniff |

All warranty requests use no-store responses; writes require JSON and same-origin browser requests. Challenge/session maps are bounded at 2,000 entries each and expire on restart. Forged client phone-verification flags, warranty durations and product names are ignored. Temporary upload ownership is validated when submitting. Receipt storage defaults to 128 MiB; a full store refuses additional uploads without deleting real records. Up to 10,000 registrations and 5,000 temporary upload metadata entries are allowed. These are resource limits, not distributed spam prevention or antivirus/PDF sanitization.

## PostgreSQL / Supabase table

The fresh schema and regenerated `database/supabase-setup.sql` now have **20 tables**, with new private `warranty_registrations`. The table holds all form fields, snapshots, receipt metadata/storage key, consent and status. It includes RLS and revoked direct browser-role access. SQL constraints prevent a demo registration from becoming phone-verified or approved. Product/dealer references may become NULL on deletion while their text snapshots remain.

For an existing 19-table installation after migrations 001–005, review and apply [006-warranty-registrations.sql](../database/migrations/006-warranty-registrations.sql) once in the SQL Editor using the database owner. It selects either `areva` or `public` and stops on ambiguity. Do not rerun the full setup on an existing schema.

**No live database was changed.** This feature saves to private JSON immediately; the SQL schema is prepared for the future adapter. Setting `DATABASE_URL` alone does not make the application write to this table. A future import must preserve IDs/references, snapshots, contact consent, verification mode, dates, numeric quantity/area, and receipt private keys; actual binary receipts must also move to private storage. Empty `dealerId`, blank application date and blank area map to SQL NULL. Do not expose the table or a public Storage bucket to visitors.

## Configuration

```dotenv
WARRANTY_OTP_MODE=demo
WARRANTY_STORAGE_MB=128
```

`demo` is the current default requested for this feature. Set the mode to `disabled` to stop new demo sessions. Any value other than `demo` fails closed: setting `whatsapp` does not simulate a working Meta integration. No provider tokens are included in code, SQL or frontend variables.

## Later: Meta WhatsApp Cloud API

This is future integration work, not part of the current delivery. An operator will need a Meta business/app, WhatsApp Business Account and registered sending number, a suitable authentication-template approval, private production credentials/permissions and the required webhook configuration. Confirm provider eligibility, recipient opt-in and current Meta requirements during that setup.

Implement a backend provider adapter that generates unpredictable OTPs, stores only appropriate server-side challenge verification material, sends through the approved authentication template and validates expiry/attempts/replay. Keep the recipient and OTP out of public logs, verify webhook signatures if accepting callbacks, and keep production access tokens/app secrets in private hosting settings. Remove demo-code output in real mode and record real verification only after successful OTP validation; a delivery callback alone does not prove the recipient entered the code. A failed provider must never fall back to the shared demo code. Existing demo registrations remain unverified; do not bulk-upgrade them.

## Verification

`tests/warranty.test.mjs` covers OTP errors/replay, origin/auth boundaries, file validation, session ownership, private receipt downloads, registration validation, snapshot integrity, idempotency, unverified demo flags, expiry-cleanup safety, restart persistence and disabled/unconfigured provider behavior. Embedded PostgreSQL tests cover fresh/private schemas and migration 006, revoked access and demo-approval rejection. Browser checks exercise the actual entry/OTP/form/success flow, admin search/details/download, literal rendering of supplied text, and responsive layouts.
