/*
 * Run once after migrations 001–011 on an existing installation.
 * Match current contact-number and warranty-review API validation in SQL.
 * This prepares future SQL storage; the running application still uses JSON.
 * No existing value is rewritten. Invalid legacy records abort the transaction.
 */
BEGIN;

/* Select exactly one application schema, never a caller-controlled search path. */
DO $$
BEGIN
  IF to_regclass('areva.site_state') IS NOT NULL AND to_regclass('public.site_state') IS NOT NULL THEN
    RAISE EXCEPTION 'Two Areva installations found. Inspect before migrating.';
  ELSIF to_regclass('areva.site_state') IS NOT NULL THEN
    PERFORM set_config('search_path', 'areva, pg_catalog', true);
  ELSIF to_regclass('public.site_state') IS NOT NULL THEN
    PERFORM set_config('search_path', 'public, pg_catalog', true);
  ELSE
    RAISE EXCEPTION 'No Areva installation found. Use the complete setup for a new database.';
  END IF;
END;
$$;

/* Preflight reports counts only: never print customer phone numbers or notes. */
DO $$
DECLARE
  dealer_issues integer;
  enquiry_issues integer;
  warranty_phone_issues integer;
  review_issues integer;
BEGIN
  SELECT count(*) INTO dealer_issues FROM dealers
    WHERE length(regexp_replace(phone, '[^0-9]', '', 'g')) NOT BETWEEN 7 AND 15;
  SELECT count(*) INTO enquiry_issues FROM enquiries
    WHERE NOT (phone ~ '^\+?[0-9 ()-]{7,25}$' AND length(regexp_replace(phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15);
  SELECT count(*) INTO warranty_phone_issues FROM warranty_registrations
    WHERE NOT (
      (alternate_mobile = '' OR (alternate_mobile ~ '^\+?[0-9 ()-]{7,25}$' AND length(regexp_replace(alternate_mobile, '[^0-9]', '', 'g')) BETWEEN 7 AND 15)) AND
      (dealer_phone = '' OR (dealer_phone ~ '^\+?[0-9 ()-]{7,25}$' AND length(regexp_replace(dealer_phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15)) AND
      (applicator_phone = '' OR (applicator_phone ~ '^\+?[0-9 ()-]{7,25}$' AND length(regexp_replace(applicator_phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15))
    );
  SELECT count(*) INTO review_issues FROM warranty_registrations
    WHERE NOT (
      (status NOT IN ('rejected', 'needs_information') OR
        (review_notes ~ '[^[:space:]]' AND reviewed_at IS NOT NULL AND reviewed_by ~ '[^[:space:]]')) AND
      (status = 'approved' OR NOT approval_confirmed)
    );
  IF dealer_issues + enquiry_issues + warranty_phone_issues + review_issues > 0 THEN
    RAISE EXCEPTION 'Migration 012 stopped: review existing data first (dealers %, enquiries %, warranty phones %, warranty decisions %). No records were changed.',
      dealer_issues, enquiry_issues, warranty_phone_issues, review_issues USING ERRCODE = '23514';
  END IF;
END;
$$;

/* Keep formatted contact numbers while rejecting punctuation-only values. */
ALTER TABLE dealers ADD CONSTRAINT dealers_phone_digits_check
  CHECK (length(regexp_replace(phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15);
ALTER TABLE enquiries ADD CONSTRAINT enquiries_phone_format_check CHECK (
  phone ~ '^\+?[0-9 ()-]{7,25}$' AND length(regexp_replace(phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15
);
ALTER TABLE warranty_registrations ADD CONSTRAINT warranty_registrations_contact_phones_check CHECK (
  (alternate_mobile = '' OR (alternate_mobile ~ '^\+?[0-9 ()-]{7,25}$' AND length(regexp_replace(alternate_mobile, '[^0-9]', '', 'g')) BETWEEN 7 AND 15)) AND
  (dealer_phone = '' OR (dealer_phone ~ '^\+?[0-9 ()-]{7,25}$' AND length(regexp_replace(dealer_phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15)) AND
  (applicator_phone = '' OR (applicator_phone ~ '^\+?[0-9 ()-]{7,25}$' AND length(regexp_replace(applicator_phone, '[^0-9]', '', 'g')) BETWEEN 7 AND 15))
);

/* Reasons and reviewer metadata are mandatory for rejection/information requests.
 * Real verified approvals keep their existing SQL rule; demo flags never change.
 * Existing final-review locking, row-level security and role grants are retained.
 */
ALTER TABLE warranty_registrations ADD CONSTRAINT warranty_registrations_decision_details_check CHECK (
  (status NOT IN ('rejected', 'needs_information') OR
    (review_notes ~ '[^[:space:]]' AND reviewed_at IS NOT NULL AND reviewed_by ~ '[^[:space:]]')) AND
  (status = 'approved' OR NOT approval_confirmed)
);

COMMIT;
