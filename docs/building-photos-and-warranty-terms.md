# Building photos and product warranty terms — 22 November 2026

The warranty registration form now accepts optional building/application photos. Product warranty badges open a Terms and conditions section, and admins can upload/assign its PDFs directly from the Products editor. The More menu now shows **Certifications and documents** and a separate illustrated **Terms and conditions** card.

## Building photos

In **Warranty Registration → 4. Site & application**, customers can add up to **five JPEG, PNG or WebP photos, 5 MB each**. They can preview and remove a photo before submission. Replacing the purchase receipt does not clear the building photos. Photos are optional so existing registrations and older clients remain valid.

Uploads require a live warranty session before the JSON body is parsed. The backend checks image signatures, size, upload ownership, unique selected IDs and the five-photo limit. Photos selected from another session cannot be attached, viewed or deleted. Registration snapshots contain server-owned `sitePhotos` metadata; client-supplied filenames/paths cannot choose a filesystem location. The existing receipt and building photos share `WARRANTY_STORAGE_MB` (128 MiB by default).

Private files live in `CONTENT_DATA_DIR/warranty-site-photos/`. Pending upload ownership is in `warranty-site-uploads.json`; completed metadata is stored with the purchase in `warranties.json`. Expired, unattached uploads can be cleaned up after 24 hours. Cleanup checks saved registrations before removing files, including after a partial cleanup failure. Existing registrations normalize a missing photo list to an empty list.

Admins see **Building photos** in the registration details dialog and can open/download each attachment. Access requires an active admin session and the photo must belong to the selected registration. Files have no public upload URL. The decision PDF lists the photo filenames, types and byte counts; photographs remain separate private attachments rather than being embedded in the report.

Back up both new private paths alongside all existing JSON files, public uploads and private receipts. Set an appropriate storage budget and disk size for actual photo volume; full storage refuses additional uploads without deleting customer records. The current JSON backend continues to require one process/instance.

## Product terms configuration

1. Open **Admin → Products → Edit product**.
2. Find **Warranty terms and conditions** below the technical specifications.
3. Choose an assignment to the product's **Product type** or the **Product**. Product-type assignments apply to current and future products of that type.
4. Enter a heading/description and upload a PDF up to 5 MB, or select an existing warranty document.
5. Click **Apply to workspace**, then **Save changes** to publish the complete product/document revision.

PDF upload alone does not publish a document. Closing/cancelling the product editor discards its staged document changes; previously uploaded public PDF files are retained in accordance with the existing upload lifecycle. Shared document edits affect all of its assignments. Assigning an existing document preserves its other assignments; manage or remove those in **Certifications and documents**.

The same document collection remains the source of truth. Warranty terms use the existing `warranty` document type with `categoryIds` and/or `productIds`, rather than duplicated product-owned files. The main document editor now includes **Product types** checkboxes, alongside individual linked products, attachments and visibility. Unassigned warranty documents are company-wide. A hidden document never appears in public content or the Terms page.

The product editor stages both product and document changes together, and the backend validates and persists them using the existing full-content revision check. Older clients that omit category assignments retain the saved assignments; explicit invalid/duplicate product types are rejected. Server timestamps and saved activity remain authoritative.

## Public navigation

The More card **Documents** is renamed **Certifications and documents**. **Terms and conditions** has its own locally optimized illustration and opens `#terms`. A configured warranty badge opens `#terms/<product-id>` with that product selected. Both the product card and specification dialog support this navigation; a modal closes before displaying the terms.

The Terms page shares the existing public gradient, fonts and responsive card style. Customers filter by product type or product, clear filters and open published PDFs. Matching includes explicit product assignments, product-type assignments and company-wide warranty documents. If nothing has been published, the page displays a contact/help state; no legal coverage wording is invented by the application.

Both the server-adapted public layout and the optional React studio use the shared section and filter controller. Product document downloads also recognize product-type assignments.

## API changes

| Method | Endpoint                                         | Access / purpose                                               |
| ------ | ------------------------------------------------ | -------------------------------------------------------------- |
| POST   | `/api/warranty/site-photos`                      | Current warranty session; upload a private image               |
| GET    | `/api/warranty/site-photos/:id`                  | Owning warranty session; preview an unattached photo           |
| DELETE | `/api/warranty/site-photos/:id`                  | Owning warranty session; remove an unattached photo            |
| POST   | `/api/warranty/registrations`                    | Existing endpoint additionally accepts optional `sitePhotoIds` |
| GET    | `/api/admin/warranties/:id/site-photos/:photoId` | Admin; view only a photo attached to this registration         |
| GET    | Same endpoint with `?download=1`                 | Admin; download with the saved filename                        |

All sensitive routes retain same-origin guards and no-store behavior. Public term PDFs use the existing authenticated admin PDF upload and public document download paths. Building photos and receipts are private and are never published by `/api/content` or source exports. Admin warranty search also matches building-photo filenames without indexing internal upload/session keys.

## Prepared SQL

Fresh `schema.sql` and generated `supabase-setup.sql` include `certifications.category_ids`, its filter index, `warranty_registrations.site_photos`, and a restricted immutable metadata validator. Photo snapshots enforce the five-photo limit, unique UUIDs, supported MIME types, bounded names, valid byte counts and no unexpected fields. The table count remains **23**.

For an existing installation after migrations 001–012, use [013-building-photos-and-product-terms.sql](../database/migrations/013-building-photos-and-product-terms.sql) once. It chooses the existing `public` or `areva` installation, stops on ambiguity/repeat application, preserves current records and leaves RLS/grants in place. Existing values start with empty assignments/photo arrays. Binary files are not imported by SQL.

Runtime storage remains private JSON. No live SQL, data import or deployment is performed by these repository changes. Existing OTP remains the requested demo flow; this feature does not activate WhatsApp delivery.

## Verification

Regression coverage exercises private upload access before parsing, image validation, upload limits, session ownership, removal, registration selection, idempotent retries, private admin previews/downloads, durable photo metadata, cleanup preservation, restart persistence, category assignments, older clients and both PostgreSQL schemas/migration rollback. Decision PDF checks include building-photo metadata.

Browser checks cover the actual product-editor upload/staging/publish flow, category inheritance, product and modal badge navigation, More cards, filters/empty states, root iframe integration, multiple building-photo previews/removal, receipt replacement, successful registration, admin photo downloads and mobile layouts.
