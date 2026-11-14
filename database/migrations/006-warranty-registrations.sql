-- Apply ONCE after migrations 001–005 to an existing Areva application database.
-- Creates private warranty submissions; does not connect the JSON-backed website to SQL.
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
    RAISE EXCEPTION 'No Areva application schema found. Use the complete setup for a new database.';
  END IF;
END;
$$;
-- Customer submissions and private receipt metadata; never exposed to browser database roles.
CREATE TABLE warranty_registrations (
  id uuid PRIMARY KEY,
  reference varchar(100) NOT NULL UNIQUE CHECK (btrim(reference) <> ''),
  submission_id uuid NOT NULL,
  mobile varchar(13) NOT NULL CHECK (mobile ~ '^\+91[6-9][0-9]{9}$'),
  verification_mode varchar(12) NOT NULL CHECK (verification_mode IN ('demo', 'whatsapp')),
  mobile_verified boolean NOT NULL DEFAULT false,
  status varchar(20) NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'needs_information', 'approved', 'rejected')),
  customer_name varchar(150) NOT NULL CHECK (btrim(customer_name) <> ''),
  email varchar(160) NOT NULL DEFAULT '',
  alternate_mobile varchar(25) NOT NULL DEFAULT '',
  product_id varchar(100) REFERENCES products(id) ON DELETE SET NULL,
  product_name varchar(150) NOT NULL CHECK (btrim(product_name) <> ''),
  category_id varchar(100) NOT NULL,
  category_name varchar(100) NOT NULL,
  warranty_years numeric NOT NULL DEFAULT 0 CHECK (warranty_years BETWEEN 0 AND 100),
  warranty_label varchar(100) NOT NULL DEFAULT '',
  purchase_date date NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0 AND quantity <= 100000),
  pack_size varchar(100) NOT NULL CHECK (btrim(pack_size) <> ''),
  batch_number varchar(100) NOT NULL DEFAULT '',
  shade varchar(150) NOT NULL DEFAULT '',
  dealer_id varchar(100) REFERENCES dealers(id) ON DELETE SET NULL,
  dealer_name varchar(200) NOT NULL CHECK (btrim(dealer_name) <> ''),
  dealer_phone varchar(25) NOT NULL DEFAULT '',
  dealer_address varchar(500) NOT NULL CHECK (btrim(dealer_address) <> ''),
  dealer_city varchar(150) NOT NULL CHECK (btrim(dealer_city) <> ''),
  invoice_number varchar(100) NOT NULL CHECK (btrim(invoice_number) <> ''),
  site_address varchar(500) NOT NULL CHECK (btrim(site_address) <> ''),
  city varchar(150) NOT NULL CHECK (btrim(city) <> ''),
  state varchar(150) NOT NULL CHECK (btrim(state) <> ''),
  pin_code varchar(6) NOT NULL CHECK (pin_code ~ '^[0-9]{6}$'),
  application_date date CHECK (application_date IS NULL OR application_date >= purchase_date),
  painted_area numeric CHECK (painted_area > 0 AND painted_area <= 100000),
  applicator_name varchar(150) NOT NULL DEFAULT '',
  applicator_phone varchar(25) NOT NULL DEFAULT '',
  notes varchar(2000) NOT NULL DEFAULT '',
  contact_consent boolean NOT NULL CHECK (contact_consent),
  receipt_id uuid NOT NULL UNIQUE,
  receipt_name varchar(150) NOT NULL CHECK (btrim(receipt_name) <> ''),
  receipt_mime varchar(30) NOT NULL CHECK (receipt_mime IN ('application/pdf','image/png','image/jpeg','image/webp')),
  receipt_bytes integer NOT NULL CHECK (receipt_bytes BETWEEN 12 AND 5242880),
  -- Private storage key only, not a public URL. Actual files need private persistent storage.
  receipt_file_key varchar(100) NOT NULL UNIQUE CHECK (receipt_file_key ~ '^[a-f0-9-]{36}\.(pdf|png|jpeg|webp)$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mobile, submission_id),
  CHECK (verification_mode <> 'demo' OR NOT mobile_verified),
  CHECK (status <> 'approved' OR (mobile_verified AND verification_mode <> 'demo'))
);
CREATE INDEX warranty_registrations_created_idx ON warranty_registrations(created_at DESC);
CREATE INDEX warranty_registrations_mobile_idx ON warranty_registrations(mobile);
CREATE INDEX warranty_registrations_invoice_idx ON warranty_registrations(lower(invoice_number));
CREATE INDEX warranty_registrations_product_idx ON warranty_registrations(category_id, product_id);

ALTER TABLE warranty_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE warranty_registrations FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.warranty_registrations FROM %I', current_schema(), role_name);
  END LOOP;
END;
$$;
COMMIT;
