# Certifications and documents

Use **Admin → Certifications and documents → Add document** to manage the public document cards. No certificates or claims are invented or seeded. An installation with no published entries shows an empty-state message instead of the old example cards.

Each card has a required heading, description and document type (Certification, Test report, TDS, SDS, Product warranty or Other). Optional fields are a short card label such as Green building, issuing organisation, certificate/document reference, issue date, validity date and linked products. Valid until cannot precede the issue date. Labels/descriptions are plain text and render literally.

Upload up to five PDF attachments per card, at most 5 MiB each, and give each download a label. Published cards require at least one attachment. Turn off **Show on website** to keep a card hidden, including while preparing it without attachments. Click **Save document card** to save immediately. The PDF upload alone does not publish a card. All uploaded files use public `/uploads/…pdf` download URLs; hiding/deleting a card removes its listing, not files or existing download URLs. This section is for documents intended for public distribution, separate from private warranty receipts.

Search by heading, description, issuer, reference, attachment label or linked product, and filter by document type. Edit existing cards, use the arrows to change website order, or remove a card. Reordering and removal require the usual **Save changes** button. Uploads, creation, updates, ordering and deletion appear in **Activity history → Certifications and documents**.

The existing **Documents** navigation opens the public cards at `#certs`. Both the embedded reference website and React Studio use the same renderer and data. Cards show their label, heading, description, optional issuer/reference/dates, product names and PDF downloads. Associated products also show document downloads in their detail view. Company-wide documents appear in the main section only. Cards use white rounded surfaces, a gold top border and purple text, with four columns on large screens and fewer columns on small screens.

## Storage, compatibility and guardrails

The running application stores `certifications[]` in the private `CONTENT_DATA_DIR/content.json` alongside other CMS content. Files use the existing `CONTENT_DATA_DIR/uploads/` directory and shared upload quota. Back up both. The array determines display order. Each card contains `id`, `title`, `description`, `type`, `label`, `issuer`, `reference`, `issuedOn`, `validUntil`, `productIds`, `attachments`, `published`, `createdAt` and `updatedAt`. Attachments contain `id`, `label` and `url`.

Admin authentication and same-origin JSON guards apply to uploads and saves. PDF content must pass the existing signature/end-marker and 5 MiB checks; uploads are forced attachments with `nosniff` and sandbox headers. Cards can only reference existing uploaded PDFs, not arbitrary URLs, scripts or filesystem paths. This is format validation, not antivirus scanning or automatic certification verification. Publishing remains an admin decision.

Server validation limits the section to 100 cards and five PDFs per card, enforces types/IDs/dates/product associations, strips unknown fields and assigns timestamps. Duplicate attachment IDs across cards are rejected. Hidden cards are excluded from public content JSON and generated HTML; authenticated admins can manage them. Old stores default to an empty section, and old clients omitting the new field preserve existing cards. Revision conflicts refuse stale saves. Deleting a product removes its association without deleting the document or attachment. No scheduled expiry/unpublish process is introduced; validity is displayed as entered.

## Prepared SQL schema

The runtime is still JSON-backed; no live database change or SQL connection is part of this feature. Fresh schemas now have **23 tables**. Three new tables are `certifications` (card fields, publication flag, order and timestamps), `certification_attachments` (PDF labels/paths, positions 0–4) and `certification_products` (product associations). Child rows cascade on card deletion; removing a product only removes its association. Application validation requires an attachment before publishing, a cross-table rule that must also be retained by a future adapter.

Existing installations after migrations 001–008 use [009-certifications-and-documents.sql](../database/migrations/009-certifications-and-documents.sql) once. It detects `public` or private `areva`, stops on ambiguous/missing installations, preserves existing records, adds the activity section and enables RLS/revokes direct browser/API-role access on the new tables. Fresh schema/setup includes these additions; never rerun the full setup on an existing installation. During a future import, preserve IDs, attachment/product order, dates (blank optional dates become SQL NULL), publication flags and server timestamps, and migrate the PDFs separately.

## Verification

`tests/certifications.test.mjs` covers authenticated upload/saves, invalid PDFs/fields/URLs/dates/IDs, hidden-card exclusion, plain-text rendering, timestamps, older clients, revisions, order/history, product removal and restart persistence. Embedded PostgreSQL checks cover the upgrade in both schemas, PDF constraints, attachment limits, cascades and role permissions. Browser checks cover creating/uploading/editing/searching cards and the public/download/product-detail views at desktop and mobile widths.
