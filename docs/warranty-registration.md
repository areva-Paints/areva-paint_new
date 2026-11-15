# Warranty Registration — updated 15 November 2026

The public website now has a **Warranty Registration** link, opening the Areva-branded `/warranty` page at top level. React Studio includes the same link. The form runs on the backend origin so cookies and private receipt upload do not depend on third-party iframe cookies.

## Current demo flow

1. Enter a 10-digit Indian mobile number.
2. Submit to receive an on-screen **demo OTP `123456`**. No SMS or WhatsApp message is sent. The code expires after five minutes; resend has a 60-second cooldown and five incorrect attempts invalidate a challenge.
3. Continue to the registration form. This creates a separate, 30-minute warranty-entry session, never an admin/customer account session.
4. Enter the purchase and site details, upload a private receipt, confirm accurate information/contact consent, then submit.
5. The confirmation shows the registration reference, then automatically returns to the home page after three seconds. **Return to home page** allows an immediate return. Failed submissions stay on the form with their details intact. Every new demo record starts with `verificationMode: demo`, `mobileVerified: false` and `status: pending_review` regardless of client input. No warranty start/end date or approval is assigned automatically.

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

Search matches readable field values and review history/notes, ignoring case, repeated spaces and punctuation. Words may match across fields (for example, **Pune approved**); formatted phone numbers are accepted. Results update while typing, or use **Search** / Enter to refresh. Search combines with the selected product, status and date filters; **Reset filters** clears them all. Internal JSON property names and private upload keys are excluded from matches. While loading, old rows are hidden so they are not mistaken for current search results.

Open **Admin → Warranty registrations**. Search all saved details, including reference, name, mobile, invoice, product/type, dealer, site, batch, shade and notes. Filter by product type, review status and an inclusive **From / To** range. **Date field** selects Registration date (India Standard Time) or Purchase date; either end may be left blank. Reset filters clears the search and filters. Clicking **View / review** opens the complete private record. **Download private receipt** uses an admin-authenticated attachment endpoint; the original file is never given a public `/uploads` URL. The list refreshes when the browser regains focus.

Registration records are saved independently of CMS **Save changes**; changing website content does not overwrite them. Inside **Review & approval**, select Pending review, Needs information, Approved or Rejected. Add notes (required for rejection or information requests). Approval requires confirmation that purchase details and the attached receipt were reviewed; the receipt file must still exist. Click **Approve registration**, **Reject registration**, **Request information** or **Save review** to persist the decision immediately. No CMS Save changes action is needed.

After **Approved** or **Rejected** is saved, the dialog closes and returns to the registrations list. The browser automatically starts downloading a private **Decision PDF**. These are final decisions: reopening the details shows a read-only summary rather than the decision form. The backend also refuses further review changes; a retry of an identical final save is a no-op. Pending review and Needs information records can still be reviewed.

The list and final-details view offer **Download decision PDF** for later downloads. The report contains the complete saved customer/site, product/warranty, purchase/dealer/invoice, receipt metadata, application/notes, consent/verification details, final decision, review notes, reviewer/time and review history. Multi-page reports carry Areva branding and page numbers. Original payment receipts remain separate private attachments; the report is not a merged receipt file or an automatic warranty certificate. A failed PDF request does not undo the saved decision, and the list keeps a retry button even if its current filters hide that record.

An approved record remains marked **Demo · Mobile unverified**. This is an explicit manual purchase review, not proof of mobile ownership, a certificate, or an automatically assigned warranty start date. No SMS/WhatsApp notification is sent for any decision. Each change stores the acting admin username, review timestamp, notes, confirmation and append-only review history in the same atomic private record update. History and timestamps use IST in the admin interface.

Old records receive version 1 and empty review metadata without being auto-approved. A stale review save returns a conflict instead of overwriting another admin's decision; use **Reload latest record** to inspect the latest version before saving again. Unchanged saves do not create duplicate history events. There is no registration-deletion endpoint.

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
| `GET /api/admin/warranties` | Admin only; search/category/status/dateBy/from/to/page, twenty rows/page |
| `GET /api/admin/warranties/:id` | Admin only; latest record/review version |
| `PATCH /api/admin/warranties/:id` | Admin only; status/notes/approvalConfirmed/expectedVersion; sixty attempts/minute per IP |
| `GET /api/admin/warranties/:id/report.pdf` | Admin only; final records only, thirty requests/minute per IP, up to two active report jobs; no-store PDF attachment |
| `GET /api/admin/warranties/:id/receipt` | Admin only; private no-store attachment, sandbox/nosniff |

All warranty requests use no-store responses; writes require JSON and same-origin browser requests. Challenge/session maps are bounded at 2,000 entries each and expire on restart. Forged client phone-verification flags, warranty durations and product names are ignored. Temporary upload ownership is validated when submitting. Receipt storage defaults to 128 MiB; a full store refuses additional uploads without deleting real records. Up to 10,000 registrations and 5,000 temporary upload metadata entries are allowed. These are resource limits, not distributed spam prevention or antivirus/PDF sanitization.

## PostgreSQL / Supabase table

The fresh schema and regenerated `database/supabase-setup.sql` now have **20 tables**, with new private `warranty_registrations`. The table holds all form fields, snapshots, receipt metadata/storage key, consent and status. It includes RLS and revoked direct browser-role access. SQL constraints prevent a demo registration from becoming phone-verified. Approval requires real non-demo phone verification or explicit manual confirmation with an identified reviewer and timestamp. Review version, notes, current reviewer/time, confirmation and JSON review history are separate columns. Product/dealer references may become NULL on deletion while their text snapshots remain.

For an existing 19-table installation after migrations 001–005, review and apply [006-warranty-registrations.sql](../database/migrations/006-warranty-registrations.sql) once in the SQL Editor using the database owner. It selects either `areva` or `public` and stops on ambiguity. Then apply [007-warranty-review-and-filters.sql](../database/migrations/007-warranty-review-and-filters.sql) once for review metadata and manual approval. An existing 20-table installation with migration 006 needs migration 007, followed by [008-final-warranty-decisions.sql](../database/migrations/008-final-warranty-decisions.sql). After 007 is already applied, only 008 is needed for final review locking. Fresh setup includes all three; the table count stays 20. Do not rerun the full setup on an existing schema.

**No live database was changed.** This feature saves to private JSON immediately; the SQL schema is prepared for the future adapter. Setting `DATABASE_URL` alone does not make the application write to this table. A future import must preserve IDs/references, snapshots, contact consent, verification mode, dates, numeric quantity/area, review version/current metadata/history, and receipt private keys; actual binary receipts must also move to private storage. Empty `dealerId`, blank application date and blank area map to SQL NULL. Do not expose the table or a public Storage bucket to visitors.

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


`tests/warranty-review.test.mjs` additionally covers manual approval while keeping mobile unverified, missing-receipt/confirmation checks, authenticated reviewer metadata, validation/reason requirements, stale-write protection, no-op saves, status combinations, exact IST midnight/end-of-day boundaries, purchase ranges, invalid query input, restart persistence and public/private schema migration 007.


## Final-decision reports — 15 November 2026

Migration 008 adds an invoker trigger that prevents changes to the status, review notes, reviewer/time, confirmation, review history and version once the old status is Approved or Rejected. It preserves existing rows, allows harmless no-op updates and does not block product/dealer FK cleanup. Fresh schema/setup include it; table count remains 20.

PDFs are generated on demand from the saved record, without changing it or exposing a public file URL. No extra report-storage table is needed. The server rechecks admin access after generation and limits simultaneous jobs. Bundled SIL-OFL Noto fonts support Latin/currency and common Indian scripts; uncovered code points use explicit markers rather than disappearing. Long notes wrap across pages. Fonts/logos are local assets, so production does not require Chromium, an external PDF service or system fonts. Source packaging includes the fonts and license. Private decision PDFs contain customer information; downloaded files should be handled accordingly.

`tests/warranty-pdf.test.mjs` checks complete report text, long-note pagination, rejected/approved content, no PDF scripts, and migration-008 locks in public/private schemas. The updated review tests check final API rejection, private PDF authorization, pending-record denial and persistence. Browser checks cover automatic download and closing the dialog, read-only final details, later downloads and recovery from a failed PDF request without losing the saved decision.
