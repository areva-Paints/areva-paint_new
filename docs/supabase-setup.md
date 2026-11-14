# Supabase database setup for Areva Paints

Target project URL supplied by the user: `https://osljojzwulmjoqbnubia.supabase.co`.
Project reference: `osljojzwulmjoqbnubia`. Verify the project in the Dashboard before running SQL.

The HTTPS project URL is a Data API address, not a PostgreSQL login or permission to execute SQL. A Supabase dashboard account or an Authentication user is also different from the website's created Admin/Customer/Architect/Builder accounts. The current app does not use Supabase Auth.

## One file to run in the Supabase Dashboard

1. Open [this project's SQL Editor](https://supabase.com/dashboard/project/osljojzwulmjoqbnubia/sql/new) while signed in with database-management access.
2. Start a new query and paste the complete contents of [supabase-setup.sql](../database/supabase-setup.sql). Run it using the project database-owner role, normally `postgres`.
3. Run **once**. The script creates a new `areva` schema, all 19 reviewed tables and the eight categories in one transaction. It deliberately stops if `areva` already exists; inspect any existing data rather than dropping it or rerunning setup. It does not alter existing `public`, `auth` or `storage` tables.
4. The final queries should report **19 tables**, **8 categories**, and **19 tables with row-level security enabled**. In Table Editor, select the **areva** schema to see the tables.

This file already includes the full schema and category seed. Do not also run `schema.sql`, `seed-categories.sql` or the old 15-table upgrade in this setup flow. If an earlier proposal has already been applied in `public` or another schema, stop and plan its migration instead of creating a competing copy.

## Why a separate schema

Accounts, password hashes, admin history and enquiries are private server data. The script isolates them in `areva`, enables row-level security with no browser policies, and revokes schema/table/sequence/function access from `PUBLIC`, `anon`, `authenticated` and `service_role`. It leaves the existing Supabase roles and built-in Auth system unchanged. Do not expose `areva` through Supabase's Data API or add general browser-access policies. The existing architecture publishes selected content through Express APIs.

The database owner can still administer/import data. A future dedicated backend database role needs explicitly scoped database permissions and an intentional RLS strategy; no role, password or browser policy is provisioned by this script. The login-identifier trigger qualifies its lookup schema from the trigger table so an insert into `areva.users` works even if the caller's search path is `public`.

## Letting an authorized agent apply it

Use Supabase Dashboard **Connect** to obtain a PostgreSQL connection string. The session-pooler connection is useful when the direct database endpoint's IP family is unavailable; use the exact host, username, port and TLS settings shown for your project. Keep TLS verification enabled. Store the complete connection string as a private `DATABASE_URL` secret in the execution environment, never in chat, Git or frontend variables. A project/publishable/anon key is not a DDL credential.

Before applying, the operator must connect and check the current database role, the absence of an existing Areva setup in both `areva` and `public`, and the intended project. Apply only to the verified target; preserve existing records if any are found. This document and its local validation are not evidence that the live Supabase project was changed.

## Existing data and website integration

The script inserts category definitions only. Products, dealers, colours, galleries, created accounts, passwords and history are **not imported**. Supabase Auth users are not copied into `areva.users` or made website admins. Back up the full private `content.json` and uploads, then follow the mappings and import requirements in [database-layout.md](database-layout.md).

The application still uses private JSON files for content and enquiries. Its PostgreSQL adapter/import remains to be implemented. A future adapter must use qualified `areva.*` table names or set a trusted search path for every pooled connection, preserve account verification/history transactions, and return only public content to visitors. Setting `DATABASE_URL` alone does not change current application storage. Uploaded image/PDF files also need persistent disk or a separately implemented Supabase Storage integration; this SQL does not migrate them.

For GoDaddy hosting, the Node.js/Express backend can connect to Supabase PostgreSQL over an authenticated TLS connection; hosting still needs Node support. The public frontend must not receive the database password or privileged connection string.

## Rebuilding the SQL file

After changing the base schema or seed, run from the repository root:

```bash
node scripts/prepare_supabase_sql.cjs
```

The generator only prepares the local SQL file from the reviewed sources; it never executes it. This setup targets a new Areva schema in an existing Supabase project, not an automatic upgrade of an existing Areva installation.
