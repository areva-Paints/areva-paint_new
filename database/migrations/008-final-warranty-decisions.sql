/* Lock final Approved/Rejected review fields without rewriting purchase snapshots.
 * Historical upgrade: apply once, in sequence, only when absent from the target installation.
 * This file is not run by Express and does not import the live JSON store.
 */
-- Apply ONCE after migration 007 to an existing Areva application database.
-- Keeps final approval/rejection decisions read-only; no records are changed.
-- PDF reports are generated privately by the backend, not stored as public assets.
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
    RAISE EXCEPTION 'No warranty table found. Apply migrations 006 and 007 first or use complete setup.';
  END IF;
END;
$$;
CREATE FUNCTION prevent_final_warranty_review_changes() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF OLD.status IN ('approved', 'rejected') AND
    ROW(NEW.status, NEW.review_notes, NEW.reviewed_by, NEW.reviewed_at,
        NEW.approval_confirmed, NEW.review_history, NEW.version)
      IS DISTINCT FROM
    ROW(OLD.status, OLD.review_notes, OLD.reviewed_by, OLD.reviewed_at,
        OLD.approval_confirmed, OLD.review_history, OLD.version)
  THEN
    RAISE EXCEPTION 'Final warranty decisions cannot be changed.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER warranty_registrations_final_review
  BEFORE UPDATE OF status, review_notes, reviewed_by, reviewed_at, approval_confirmed, review_history, version
  ON warranty_registrations
  FOR EACH ROW EXECUTE FUNCTION prevent_final_warranty_review_changes();
REVOKE ALL ON FUNCTION prevent_final_warranty_review_changes() FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.prevent_final_warranty_review_changes() FROM %I', current_schema(), role_name);
  END LOOP;
END;
$$;
COMMIT;
