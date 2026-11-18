/* Add versioned review metadata, manual approval confirmation and search/filter indexes.
 * Historical upgrade: apply once, in sequence, only when absent from the target installation.
 * This file is not run by Express and does not import the live JSON store.
 */
-- Apply ONCE after migration 006 to an existing Areva application database.
-- Adds manual admin review without changing OTP verification or existing status values.
-- Does not connect the JSON-backed website to SQL or assign warranty dates.
BEGIN;
DO $$
BEGIN
  IF to_regclass('areva.warranty_registrations') IS NOT NULL AND to_regclass('public.warranty_registrations') IS NOT NULL THEN
    RAISE EXCEPTION 'Two possible Areva warranty tables found. Inspect before migrating.';
  ELSIF to_regclass('areva.warranty_registrations') IS NOT NULL THEN
    PERFORM set_config('search_path', 'areva, pg_catalog', true);
  ELSIF to_regclass('public.warranty_registrations') IS NOT NULL THEN
    PERFORM set_config('search_path', 'public, pg_catalog', true);
  ELSE
    RAISE EXCEPTION 'No warranty table found. Apply migration 006 first or use the complete setup for a new database.';
  END IF;
END;
$$;
ALTER TABLE warranty_registrations
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  ADD COLUMN review_notes varchar(2000) NOT NULL DEFAULT '',
  ADD COLUMN reviewed_by text NOT NULL DEFAULT '',
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN approval_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN review_history jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(review_history) = 'array');
-- The original approval constraint was unnamed; locate its expression safely.
-- Keep the status enumeration and the prohibition on verified demo phone numbers.
DO $$
DECLARE target record;
BEGIN
  FOR target IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'warranty_registrations'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
      AND pg_get_constraintdef(oid) LIKE '%mobile_verified%'
  LOOP
    EXECUTE format('ALTER TABLE warranty_registrations DROP CONSTRAINT %I', target.conname);
  END LOOP;
END;
$$;
ALTER TABLE warranty_registrations
  ADD CONSTRAINT warranty_registrations_review_metadata_check CHECK (
    (reviewed_at IS NULL AND reviewed_by = '') OR
    (reviewed_at IS NOT NULL AND btrim(reviewed_by) <> '')
  ),
  ADD CONSTRAINT warranty_registrations_manual_review_check CHECK (
    NOT approval_confirmed OR (reviewed_at IS NOT NULL AND btrim(reviewed_by) <> '')
  ),
  ADD CONSTRAINT warranty_registrations_approval_check CHECK (
    status <> 'approved' OR
    (mobile_verified AND verification_mode <> 'demo') OR
    (approval_confirmed AND reviewed_at IS NOT NULL AND btrim(reviewed_by) <> '')
  );
CREATE INDEX warranty_registrations_purchase_idx ON warranty_registrations(purchase_date);
CREATE INDEX warranty_registrations_status_created_idx ON warranty_registrations(status, created_at DESC);
COMMIT;
