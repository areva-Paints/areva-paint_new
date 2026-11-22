/*
 * Optional read-only inspection for an existing Areva PostgreSQL installation.
 * Run as its owner after setup/migrations; this never imports JSON or changes data.
 * Results contain counts and schema metadata, not customer details or credentials.
 */
BEGIN READ ONLY;

/* Inspect exactly one known installation rather than an untrusted search path. */
DO $$
BEGIN
  IF to_regclass('areva.site_state') IS NOT NULL AND to_regclass('public.site_state') IS NOT NULL THEN
    RAISE EXCEPTION 'Two Areva installations found. Inspect their schemas separately.';
  ELSIF to_regclass('areva.site_state') IS NOT NULL THEN
    PERFORM set_config('search_path', 'areva, pg_catalog', true);
  ELSIF to_regclass('public.site_state') IS NOT NULL THEN
    PERFORM set_config('search_path', 'public, pg_catalog', true);
  ELSE
    RAISE EXCEPTION 'No Areva installation found. The running website may still use JSON storage.';
  END IF;
END;
$$;

/* Expect 24 application tables, all with row-level security enabled. */
SELECT current_schema() AS application_schema,
  count(*) AS application_tables,
  count(*) FILTER (WHERE c.relrowsecurity) AS tables_with_rls
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema() AND c.relkind = 'r'
  AND c.relname IN (
    'categories', 'products', 'product_pack_sizes', 'product_surfaces',
    'dealers', 'dealer_badges', 'landing_images', 'colours', 'colour_pairings',
    'shade_cards', 'gallery_projects', 'gallery_photos', 'gallery_ads', 'gallery_reviews',
    'certifications', 'certification_attachments', 'certification_products',
    'site_state', 'enquiries', 'users', 'user_login_identifiers', 'activity_events', 'warranty_registrations', 'warranty_history_access'
  );

/* Expect no direct table privileges for browser/API roles, even with BYPASSRLS.
 * RLS alone is insufficient when a privileged role still has table grants.
 */
SELECT r.rolname, c.relname AS table_name
FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
  AND n.nspname = current_schema() AND c.relkind = 'r'
  AND c.relname IN ('users', 'user_login_identifiers', 'activity_events', 'enquiries', 'warranty_registrations', 'warranty_history_access')
  AND has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');

/* Expect no unvalidated application constraints after a completed upgrade. */
SELECT c.relname AS table_name, k.conname AS constraint_name
FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema() AND NOT k.convalidated;

/* These counts should be zero. Future-dated purchases are review candidates,
 * not a time-dependent CHECK constraint that would change meaning tomorrow.
 */
SELECT 'invalid_dealer_contact' AS check_name, count(*) AS affected_records
FROM dealers WHERE NOT (phone ~ '^\+?[0-9 ()-]{7,25}$' AND length(regexp_replace(phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15)
UNION ALL
SELECT 'invalid_enquiry_contact', count(*) FROM enquiries
WHERE NOT (phone ~ '^\+?[0-9 ()-]{7,25}$' AND length(regexp_replace(phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15)
UNION ALL
SELECT 'published_document_without_attachment', count(*) FROM certifications c
WHERE published AND NOT EXISTS (SELECT 1 FROM certification_attachments a WHERE a.certification_id = c.id)
UNION ALL
SELECT 'demo_mobile_marked_verified', count(*) FROM warranty_registrations
WHERE verification_mode = 'demo' AND mobile_verified
UNION ALL
SELECT 'review_missing_reason_or_reviewer', count(*) FROM warranty_registrations
WHERE status IN ('rejected', 'needs_information') AND NOT (
  review_notes ~ '[^[:space:]]' AND reviewed_by ~ '[^[:space:]]' AND reviewed_at IS NOT NULL
)
UNION ALL
SELECT 'confirmation_without_approval', count(*) FROM warranty_registrations
WHERE approval_confirmed AND status <> 'approved'
UNION ALL
SELECT 'future_purchase_date', count(*) FROM warranty_registrations
WHERE purchase_date > (now() AT TIME ZONE 'Asia/Kolkata')::date;

COMMIT;
