/* Capture a required login-phone snapshot and backfill older purchases from their existing mobile number.
 * Historical upgrade: apply once, in sequence, only when absent from the target installation.
 * This file is not run by Express and does not import the live JSON store.
 */
-- Run once after migrations 001–010 on an existing installation.
-- Snapshot the entry phone separately. Existing records used mobile for entry.
-- This prepares SQL storage only; it does not change the running JSON store.
BEGIN;
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
ALTER TABLE warranty_registrations ADD COLUMN login_mobile varchar(13);
UPDATE warranty_registrations SET login_mobile = mobile;
ALTER TABLE warranty_registrations ALTER COLUMN login_mobile SET NOT NULL;
ALTER TABLE warranty_registrations ADD CONSTRAINT warranty_registrations_login_mobile_check
  CHECK (login_mobile ~ '^\+91[6-9][0-9]{9}$');
COMMIT;
