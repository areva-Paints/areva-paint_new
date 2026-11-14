-- Apply once after migrations 001–004 to an existing Areva installation.
-- Review permissions with your operator: browser roles lose application-table access.
-- Does not connect the current JSON-backed app, migrate data or create a backend role.
BEGIN;
DO $$
BEGIN
  IF to_regclass('areva.users') IS NOT NULL AND to_regclass('public.users') IS NOT NULL THEN
    RAISE EXCEPTION 'Two possible Areva installations found. Inspect before migrating.';
  ELSIF to_regclass('areva.users') IS NOT NULL THEN
    PERFORM set_config('search_path', 'areva, pg_catalog', true);
  ELSIF to_regclass('public.users') IS NOT NULL THEN
    PERFORM set_config('search_path', 'public, pg_catalog', true);
  ELSE
    RAISE EXCEPTION 'No Areva users table found. Use the complete setup for a new database.';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION sync_user_login_identifiers() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  -- Qualify with the trigger table's schema; never resolve a caller-controlled path.
  EXECUTE format('DELETE FROM %I.user_login_identifiers WHERE user_id = $1', TG_TABLE_SCHEMA)
    USING NEW.id;
  EXECUTE format($sql$
    INSERT INTO %I.user_login_identifiers(identifier, user_id)
      SELECT DISTINCT value, $1
      FROM (VALUES ($2), (NULLIF($3, ''))) AS identifiers(value)
      WHERE value IS NOT NULL
  $sql$, TG_TABLE_SCHEMA) USING NEW.id, NEW.username, NEW.email;
  RETURN NEW;
END;
$$;

-- Private application tables: access is through the authenticated Express backend.
-- No browser policies or broad grants are created. The owner can administer data.
DO $$
DECLARE
  target text;
  role_name text;
  app_schema text := current_schema();
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'categories', 'products', 'product_pack_sizes', 'product_surfaces',
    'dealers', 'dealer_badges', 'landing_images', 'colours', 'colour_pairings',
    'shade_cards', 'gallery_projects', 'gallery_photos', 'gallery_ads', 'gallery_reviews',
    'site_state', 'enquiries', 'users', 'user_login_identifiers', 'activity_events'
  ] LOOP
    IF to_regclass(format('%I.%I', app_schema, target)) IS NULL THEN
      RAISE EXCEPTION 'Missing table %.%; apply earlier migrations before hardening.', app_schema, target;
    END IF;
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', app_schema, target);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', app_schema, target);
    FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', app_schema, target, role_name);
    END LOOP;
  END LOOP;
  EXECUTE format('REVOKE ALL ON FUNCTION %I.sync_user_login_identifiers() FROM PUBLIC', app_schema);
  -- This sequence belongs to Areva; avoid touching unrelated sequences in public.
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC', pg_get_serial_sequence(format('%I.activity_events', app_schema), 'event_sequence'));
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.sync_user_login_identifiers() FROM %I', app_schema, role_name);
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM %I', pg_get_serial_sequence(format('%I.activity_events', app_schema), 'event_sequence'), role_name);
    IF app_schema = 'areva' THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA areva REVOKE ALL ON TABLES FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA areva REVOKE ALL ON SEQUENCES FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA areva REVOKE ALL ON FUNCTIONS FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON SCHEMA areva FROM %I', role_name);
    END IF;
  END LOOP;
  IF app_schema = 'areva' THEN REVOKE ALL ON SCHEMA areva FROM PUBLIC; END IF;
END;
$$;
COMMIT;
