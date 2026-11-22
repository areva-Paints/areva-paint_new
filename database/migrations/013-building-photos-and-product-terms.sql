/* Run once after migrations 001–012 on an existing installation.
 * Adds product-type document assignments and private building-photo metadata.
 * Existing documents/photos default to empty arrays; no records or files are imported.
 * Runtime still uses private JSON. No database is changed by preparing this file.
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
ALTER TABLE certifications ADD COLUMN
category_ids varchar(100)[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(category_ids) <= 8 AND array_position(category_ids, NULL) IS NULL AND
    category_ids <@ ARRAY['interior','exterior','waterproofing','tile-adhesives','sealants','putty-primers','textures','chemicals']::varchar(100)[]
  );
CREATE INDEX certifications_categories_idx ON certifications USING gin(category_ids);

/* Match the private JSON photo snapshot; reject paths, unknown fields and invalid metadata. */
CREATE FUNCTION valid_warranty_site_photos(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE WHEN value IS NULL OR jsonb_typeof(value) <> 'array' THEN false ELSE
    jsonb_array_length(value) <= 5 AND
    (SELECT count(DISTINCT photo->>'id') FROM jsonb_array_elements(value) AS photo) = jsonb_array_length(value) AND
    NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(value) AS photo
      WHERE CASE WHEN jsonb_typeof(photo) <> 'object' THEN true ELSE NOT COALESCE(
        jsonb_typeof(photo) = 'object' AND
        photo - ARRAY['id','name','mime','bytes']::text[] = '{}'::jsonb AND
        jsonb_typeof(photo->'id') = 'string' AND photo->>'id' ~ '^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$' AND
        jsonb_typeof(photo->'name') = 'string' AND length(photo->>'name') BETWEEN 1 AND 150 AND btrim(photo->>'name') <> '' AND photo->>'name' !~ '[[:cntrl:]]' AND
        jsonb_typeof(photo->'mime') = 'string' AND photo->>'mime' IN ('image/jpeg','image/png','image/webp') AND
        CASE WHEN jsonb_typeof(photo->'bytes') = 'number' THEN
          (photo->>'bytes')::numeric BETWEEN 12 AND 5242880 AND trunc((photo->>'bytes')::numeric) = (photo->>'bytes')::numeric
        ELSE false END,
        false
      ) END
    )
  END;
$$;
REVOKE ALL ON FUNCTION valid_warranty_site_photos(jsonb) FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.valid_warranty_site_photos(jsonb) FROM %I', current_schema(), role_name);
  END LOOP;
END;
$$;

ALTER TABLE warranty_registrations ADD COLUMN site_photos jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE warranty_registrations ADD CONSTRAINT warranty_registrations_site_photos_check CHECK (valid_warranty_site_photos(site_photos));
COMMIT;
