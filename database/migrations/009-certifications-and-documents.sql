-- Run once after migrations 001–008 for an existing Areva installation.
-- Adds document-card tables only; the running website still uses its JSON content store.
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
-- Public document cards are curated through the backend. Files remain in uploads.
CREATE TABLE certifications (
  id varchar(100) PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]+$'),
  title varchar(150) NOT NULL CHECK (btrim(title) <> ''),
  description varchar(2000) NOT NULL CHECK (btrim(description) <> ''),
  document_type varchar(20) NOT NULL CHECK (document_type IN ('certification', 'test_report', 'tds', 'sds', 'warranty', 'other')),
  label varchar(80) NOT NULL DEFAULT '',
  issuer varchar(200) NOT NULL DEFAULT '',
  reference varchar(100) NOT NULL DEFAULT '',
  issued_on date CHECK (issued_on BETWEEN DATE '1900-01-01' AND DATE '2200-12-31'),
  valid_until date CHECK (valid_until BETWEEN DATE '1900-01-01' AND DATE '2200-12-31'),
  published boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 99),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (issued_on IS NULL OR valid_until IS NULL OR issued_on <= valid_until)
);
CREATE INDEX certifications_public_order_idx ON certifications(published, position);
CREATE TABLE certification_attachments (
  id varchar(100) PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]+$'),
  certification_id varchar(100) NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  label varchar(150) NOT NULL CHECK (btrim(label) <> ''),
  pdf_url text NOT NULL CHECK (pdf_url ~ '^/uploads/[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}\.pdf$'),
  position integer NOT NULL CHECK (position BETWEEN 0 AND 4),
  UNIQUE (certification_id, position)
);
CREATE TABLE certification_products (
  certification_id varchar(100) NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  product_id varchar(100) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 199),
  PRIMARY KEY (certification_id, product_id)
);
CREATE INDEX certification_products_product_idx ON certification_products(product_id);


ALTER TABLE activity_events DROP CONSTRAINT activity_events_section_check;
ALTER TABLE activity_events ADD CONSTRAINT activity_events_section_check CHECK (section IN (
  'landingImages', 'products', 'dealers', 'colours', 'shadeCards',
  'galleryProjects', 'galleryPhotos', 'galleryAds', 'galleryReviews', 'certifications', 'uploads',
  'website', 'account', 'users'
));

-- No direct browser/API-role access in either supported schema.
DO $$
DECLARE target text; role_name text;
BEGIN
  FOREACH target IN ARRAY ARRAY['certifications', 'certification_attachments', 'certification_products'] LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', current_schema(), target);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', current_schema(), target);
    FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', current_schema(), target, role_name);
    END LOOP;
  END LOOP;
END;
$$;
COMMIT;
