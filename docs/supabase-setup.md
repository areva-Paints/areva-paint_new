# Supabase database setup for Areva Paints

Target project URL supplied by the user: `https://osljojzwulmjoqbnubia.supabase.co`.
Project reference: `osljojzwulmjoqbnubia`. Verify the project in the Dashboard before running SQL.

The HTTPS project URL is a Data API address, not a PostgreSQL login or permission to execute SQL. A Supabase dashboard account or an Authentication user is also different from the website's created Admin/Customer/Architect/Builder accounts. The current app does not use Supabase Auth.

## One file to run in the Supabase Dashboard

1. Open [this project's SQL Editor](https://supabase.com/dashboard/project/osljojzwulmjoqbnubia/sql/new) while signed in with database-management access.
2. Start a new query and paste the complete contents of [supabase-setup.sql](../database/supabase-setup.sql). Run it using the project database-owner role, normally `postgres`.
3. Run **once**. The script creates a new `areva` schema, all 24 reviewed tables and the eight categories in one transaction. It deliberately stops if `areva` already exists; inspect any existing data rather than dropping it or rerunning setup. It does not alter existing `public`, `auth` or `storage` tables.
4. The final queries should report **24 tables**, **8 categories**, and **24 tables with row-level security enabled**. In Table Editor, select the **areva** schema to see the tables.

This file already includes the full schema and category seed. Do not also run `schema.sql`, `seed-categories.sql` or the old 15-table upgrade in this setup flow. If an earlier proposal has already been applied in `public` or another schema, stop and plan its migration instead of creating a competing copy.

## Why a separate schema

Accounts, password hashes, admin history and enquiries are private server data. The script isolates them in `areva`, enables row-level security with no browser policies, and revokes schema/table/sequence/function access from `PUBLIC`, `anon`, `authenticated` and `service_role`. It leaves the existing Supabase roles and built-in Auth system unchanged. Do not expose `areva` through Supabase's Data API or add general browser-access policies. The existing architecture publishes selected content through Express APIs.

The database owner can still administer/import data. A future dedicated backend database role needs explicitly scoped database permissions and an intentional RLS strategy; no role, password or browser policy is provisioned by this script. The login-identifier trigger qualifies its lookup schema from the trigger table so an insert into `areva.users` works even if the caller's search path is `public`.

## Letting an authorized agent apply it

Use Supabase Dashboard **Connect** to obtain a PostgreSQL connection string. The session-pooler connection is useful when the direct database endpoint's IP family is unavailable; use the exact host, username, port and TLS settings shown for your project. Keep TLS verification enabled. Store the complete connection string as a private `DATABASE_URL` secret in the execution environment, never in chat, Git or frontend variables. A project/publishable/anon key is not a DDL credential.

Before applying, the operator must connect and check the current database role, the absence of an existing Areva setup in both `areva` and `public`, and the intended project. Apply only to the verified target; preserve existing records if any are found. This document and its local validation are not evidence that the live Supabase project was changed.

## Existing data and website integration

The script inserts category definitions only. Products, dealers, colours, galleries, created accounts, passwords and history are **not imported**. Supabase Auth users are not copied into `areva.users` or made website admins. Back up the full private `content.json`, enquiry/warranty files and all public/private uploads, then follow the mappings and import requirements in [database-layout.md](database-layout.md).

The application still uses private JSON files for content, enquiries and warranty registrations. Its PostgreSQL adapter/import remains to be implemented. A future adapter must use qualified `areva.*` table names or set a trusted search path for every pooled connection, preserve account verification/history transactions, and return only public content to visitors. Setting `DATABASE_URL` alone does not change current application storage. Uploaded image/PDF files also need persistent disk or a separately implemented Supabase Storage integration; this SQL does not migrate them.

For GoDaddy hosting, the Node.js/Express backend can connect to Supabase PostgreSQL over an authenticated TLS connection; hosting still needs Node support. The public frontend must not receive the database password or privileged connection string.

## Rebuilding the SQL file

After changing the base schema or seed, run from the repository root:

```bash
node scripts/prepare_supabase_sql.cjs
```

The generator only prepares the local SQL file from the reviewed sources; it never executes it. This setup targets a new Areva schema in an existing Supabase project, not an automatic upgrade of an existing Areva installation.

## Warranty Registration upgrade

An existing 19-table Areva installation needs [006-warranty-registrations.sql](../database/migrations/006-warranty-registrations.sql) once, after migrations 001–005, followed by [007-warranty-review-and-filters.sql](../database/migrations/007-warranty-review-and-filters.sql). The new fresh setup has 24 tables; never rerun it on an existing installation. See [warranty-registration.md](warranty-registration.md) for private receipt storage, JSON persistence and the future SQL adapter.

For an existing 20-table installation with migration 006 already applied, use only migration 007 for review metadata/manual approvals. The fresh setup includes these fields already; do not rerun it. No application database adapter or live migration is implied.

For final decisions and PDFs, an existing installation after migration 007 also needs [008-final-warranty-decisions.sql](../database/migrations/008-final-warranty-decisions.sql) once. It locks final review fields without changing records. PDFs are private backend-generated attachments, not public Supabase Storage files. Fresh setup includes the trigger.

## Certifications and documents upgrade

An existing 20-table installation after migrations 001–008 uses [009-certifications-and-documents.sql](../database/migrations/009-certifications-and-documents.sql) once. It adds `certifications`, `certification_attachments` and `certification_products`, updates activity sections and restricts direct API-role access. Fresh setup now has 24 tables and includes this upgrade. It does not import content, change the running JSON store or connect the application to SQL. See [the documents guide](certifications-and-documents.md).

## Gallery category upgrade

After migration 009, existing installations use [010-gallery-project-categories.sql](../database/migrations/010-gallery-project-categories.sql) once. It adds the category field/index and defaults existing projects to Other while retaining access restrictions and other data. Fresh setup includes it; the current fresh schema has 24 tables. No live migration or runtime SQL connection is implied.

## Warranty login phone snapshot

Existing installations after migration 010 use [011-warranty-login-mobile.sql](../database/migrations/011-warranty-login-mobile.sql) once. It adds required `login_mobile` and backfills it from each record's existing mobile number without changing review decisions. Fresh schema/setup includes the column. The count remains 23 tables; the runtime continues to use private JSON files. No live migration is performed here.


## Contact and review integrity — 18 November 2026

For an existing installation after migration 011, apply [012-contact-and-review-integrity.sql](../database/migrations/012-contact-and-review-integrity.sql) once. It rejects punctuation-only/invalid contact numbers, requires nonblank reasons and reviewer metadata for rejected/needs-information reviews, and limits approval confirmation to Approved records. Preflight stops and reports counts if older records conflict; it never silently rewrites data or bypasses the final-review lock. Fresh schema/setup already includes these checks; the current fresh schema has 24 tables.

The optional [review-checks.sql](../database/review-checks.sql) runs in a read-only transaction and reports table/RLS counts, private role grants, unvalidated constraints and data-quality counts without printing customer data. Run it as the intended installation owner after setup/upgrades. It does not connect the app to SQL. See [README.md](../README.md) for the complete current hosting/storage guide. No live database was changed during this review.


## Building photos and product-type terms — 22 November 2026

After migration 012, existing installations use [013-building-photos-and-product-terms.sql](../database/migrations/013-building-photos-and-product-terms.sql) once. It adds product-type document assignments and validated private building-photo metadata; table count remains 23. Fresh schema/setup includes these changes. The application still saves private JSON and no live database migration is performed. See [the feature guide](building-photos-and-warranty-terms.md).

## Customer warranty history — 22 November 2026

After migration 013, use [014-customer-warranty-history.sql](../database/migrations/014-customer-warranty-history.sql) once on existing SQL installations. It adds the private `warranty_history_access` table (24th table) and an index on login phone/submission date, preserving warranty records. The new table has RLS, revoked browser/API grants, validated session hashes and a cascading registration foreign key. Fresh setup already contains both. Customer history still uses private JSON and requires the complete registration reference while OTP is in demo mode. See [the customer history guide](customer-warranty-history.md). No live SQL migration is performed here.
