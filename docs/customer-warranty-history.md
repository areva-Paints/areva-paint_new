# Customer warranty history — 22 November 2026

The public Warranty Registration flow now follows **Mobile number → Demo code → My registrations**. Customers can review previous submissions, find an existing registration using its complete reference, or start a **New registration**. A registration card shows the reference, product, product type, purchase date, submission date and current review status. **Refresh** reads the latest saved decision.

The purchase form includes **My registrations** navigation. Leaving it for history preserves the in-memory draft, receipt and building-photo selections; the action becomes **Continue registration**. A successful submission remains on its confirmation screen, with options for **My registrations**, **New registration** and **Back to website**. A new registration has fresh fields and a fresh idempotency ID. Returning from the website still begins at mobile entry, as requested previously.

## Access during demo OTP

The existing shared demo code does not prove mobile ownership. Automatically returning every registration for a supplied mobile number would disclose other customers' purchases. The new endpoint therefore requires **both** the session's primary/login mobile and each **complete, unguessable registration reference**. It does not return record existence or a total based only on a phone number.

New successful references are remembered in browser local storage under `areva:warranty:references:v1`, limited to 100. No names, phone numbers, addresses, invoices, receipt/photo URLs, internal IDs or review notes are stored there. Opening My registrations sends those references to the server; only records matching the current login phone are returned. A full reference from a prior browser or older registration can be entered manually. Treat complete references as private access information. Blocked browser storage does not prevent submission or lookup; the customer is prompted to keep the reference for another visit.

Older records without a separate `loginMobile` snapshot use their saved `mobile`. A record with `loginMobile` always uses that field; alternate/customer phone fields and caller-supplied `mobile`, `mobileVerified` or verification mode cannot broaden access. History is read-only and does not approve, activate or modify warranties.

The API is `POST /api/warranty/registrations/history` with `{ "references": ["ARV-WR-YYYYMMDD-<complete UUID>"] }`. Authentication precedes its 12 KiB body parser, input is bounded to 100 references, and lookups are limited to 60 requests per 15 minutes per IP. Requests retain same-origin protection and `Cache-Control: no-store`. The response contains only the customer-card fields. Private admin review notes, receipts, building photos, addresses and decision PDFs remain behind their existing admin authorization; this feature does not create customer attachment download routes.

Real WhatsApp OTP remains a separate integration. Once it genuinely verifies phone ownership, the server can support full phone-based history across devices after checking the verified session. **Do not remove the reference requirement based on the demo code or a client-supplied flag.**

## Storage and prepared SQL

History reads purchase details and the current review status from `warranties.json`. A separate private `warranty-history-access.json` aggregates successful lookups by registration ID and SHA-256 session hash, with first/last access times and a lookup count. It contains no raw cookies, phone numbers, references, addresses or review notes. Empty or unsuccessful searches do not create access rows. Runtime retention is bounded to 90 days and the 10,000 most recent registration/session pairs; pruning never deletes purchases. Add this private file to backups. A storage failure is reported rather than returning an unrecorded history response.

Prepared SQL includes a new **`warranty_history_access`** table, bringing the total to **24 tables**:

| Column              | Purpose                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `registration_id`   | Foreign key to the warranty registration; deleting a registration removes its access rows |
| `session_hash`      | SHA-256 session identifier; never a reusable login token                                  |
| `first_accessed_at` | First successful lookup for that registration/session pair                                |
| `last_accessed_at`  | Most recent successful lookup                                                             |
| `lookup_count`      | Aggregated lookup count, bounded to 1–1,000,000                                           |

The composite primary key prevents duplicate registration/session rows. Timestamp checks prevent an end time before the first access. An index supports retention/recent-access queries. RLS is enabled and direct `PUBLIC`, `anon`, `authenticated` and `service_role` access is revoked. Purchase details and review decisions remain in `warranty_registrations`; access hashes never authorize a lookup. The existing registration-reference constraint and the new `(login_mobile, created_at DESC)` index support customer-history queries.

For an existing SQL installation after migrations 001–013, apply [014-customer-warranty-history.sql](../database/migrations/014-customer-warranty-history.sql) once. It adds the private table and index, preserves warranty records and RLS/grants, refuses ambiguous installations and fails safely on repeat execution. Fresh schema/setup includes both. A future SQL adapter must apply the same audit retention bounds. Runtime still uses JSON; no live migration or WhatsApp delivery is performed by this feature.

## Verification

API regression checks cover authentication before parsing, forged/expired sessions, cross-site requests, invalid/oversized reference lists, empty lists without existence leaks, wrong login phones, spoofed verification flags, normalized/duplicate references, legacy rows, response field privacy, current review status, server restart persistence and disabled OTP mode. Access-store checks cover hashed identifiers, private file permissions, aggregation, retention/capacity and corruption handling. Browser-reference checks cover malformed data, duplicates, the 100-reference limit and unavailable storage. PostgreSQL checks exercise the table/index upgrade in both `public` and `areva`, including foreign keys, cascades, timestamp/count/hash constraints, duplicate prevention, revoked grants and RLS after an accidental SELECT grant.

Browser checks cover first-time entry, successful submission, history refresh, repeat visits, saved draft uploads, a new clean form, reference retrieval from another browser, incorrect references/phones, mobile layouts and unavailable storage.
