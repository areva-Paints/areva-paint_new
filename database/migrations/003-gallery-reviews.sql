-- Run once for an existing Areva application database; fresh setup includes this table.
-- Supports private Supabase areva and ordinary public-schema installations.
-- Does not import reviews or connect the JSON-backed website to PostgreSQL.
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
CREATE TABLE gallery_reviews (
  id varchar(100) PRIMARY KEY CHECK (btrim(id) <> ''),
  name varchar(150) NOT NULL CHECK (btrim(name) <> ''),
  detail varchar(200) NOT NULL DEFAULT '',
  review_text varchar(2000) NOT NULL CHECK (btrim(review_text) <> ''),
  image_url text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gallery_reviews_latest_idx ON gallery_reviews(updated_at DESC, position DESC);

ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_events_section_check;
ALTER TABLE activity_events ADD CONSTRAINT activity_events_section_check CHECK (section IN (
  'landingImages', 'products', 'dealers', 'colours', 'shadeCards',
  'galleryProjects', 'galleryPhotos', 'galleryAds', 'galleryReviews', 'uploads',
  'website', 'account', 'users'
));

-- Keep private Supabase reviews behind the backend, matching the original setup.
DO $$
DECLARE browser_role record;
BEGIN
  IF current_schema() = 'areva' THEN
    ALTER TABLE gallery_reviews ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE gallery_reviews FROM PUBLIC;
    FOR browser_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
      EXECUTE format('REVOKE ALL ON TABLE gallery_reviews FROM %I', browser_role.rolname);
    END LOOP;
  END IF;
END;
$$;
COMMIT;
