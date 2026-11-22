/* Run once after migrations 001–013 on an existing installation.
 * Add the customer history index and private aggregated access table.
 * Existing warranty rows remain unchanged. Runtime remains private JSON.
 */
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
CREATE INDEX warranty_registrations_login_created_idx ON warranty_registrations(login_mobile, created_at DESC);

/* Hashes record an access event; they must never be accepted as login proof. */
CREATE TABLE warranty_history_access (
  registration_id uuid NOT NULL REFERENCES warranty_registrations(id) ON DELETE CASCADE,
  session_hash varchar(64) NOT NULL CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  first_accessed_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  lookup_count integer NOT NULL DEFAULT 1 CHECK (lookup_count BETWEEN 1 AND 1000000),
  PRIMARY KEY (registration_id, session_hash),
  CHECK (last_accessed_at >= first_accessed_at)
);
CREATE INDEX warranty_history_access_recent_idx ON warranty_history_access(last_accessed_at DESC);
ALTER TABLE warranty_history_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE warranty_history_access FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.warranty_history_access FROM %I', current_schema(), role_name);
  END LOOP;
END;
$$;
COMMIT;
