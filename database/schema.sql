-- Proposed PostgreSQL 16+ schema for Areva Paints.
-- Review-only: the application still uses content.json and in-memory enquiries.
-- Apply ONCE to a new, empty database. This file does not migrate existing data.
BEGIN;

CREATE TABLE categories (
  id varchar(100) PRIMARY KEY,
  name varchar(100) NOT NULL CHECK (btrim(name) <> ''),
  icon text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  accent_color varchar(7) NOT NULL CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0)
);

CREATE TABLE products (
  id varchar(100) PRIMARY KEY,
  category_id varchar(100) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name varchar(150) NOT NULL CHECK (btrim(name) <> ''),
  tagline varchar(500) NOT NULL DEFAULT '',
  description text NOT NULL CHECK (btrim(description) <> ''),
  image_url text NOT NULL CHECK (btrim(image_url) <> ''),
  coverage_sq_ft_per_unit numeric NOT NULL DEFAULT 0
    CHECK (coverage_sq_ft_per_unit BETWEEN 0 AND 10000),
  coverage_unit varchar(2) NOT NULL DEFAULT 'L' CHECK (coverage_unit IN ('L', 'kg')),
  calculation_basis varchar(5) NOT NULL DEFAULT 'wall' CHECK (calculation_basis IN ('wall', 'floor')),
  recommended_coats smallint NOT NULL DEFAULT 2 CHECK (recommended_coats BETWEEN 1 AND 10),
  sheen varchar(30) NOT NULL CHECK (sheen IN ('Ultra Matte', 'Soft Sheen', 'Satin Silk', 'High Gloss', 'Textured')),
  voc_level varchar(30) NOT NULL CHECK (voc_level IN ('Zero VOC (<5g/L)', 'Low VOC (<30g/L)', 'Standard')),
  washability varchar(30) NOT NULL CHECK (washability IN ('Class 1 (Scrubbable)', 'High Washable', 'Wipeable', 'Specialist')),
  tintable boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  drying_time text NOT NULL DEFAULT '',
  recoat_time text NOT NULL DEFAULT '',
  thinned_with text NOT NULL DEFAULT '',
  warranty_years numeric NOT NULL DEFAULT 0 CHECK (warranty_years BETWEEN 0 AND 100),
  surface_preparation text NOT NULL DEFAULT '',
  application_method text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_position_idx ON products(category_id, position);

CREATE TABLE product_pack_sizes (
  product_id varchar(100) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 19),
  size numeric NOT NULL CHECK (size > 0 AND size <= 1000),
  PRIMARY KEY (product_id, position)
);

CREATE TABLE product_surfaces (
  product_id varchar(100) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 29),
  surface_name varchar(200) NOT NULL,
  PRIMARY KEY (product_id, position)
);

CREATE TABLE dealers (
  id varchar(100) PRIMARY KEY,
  name varchar(500) NOT NULL CHECK (btrim(name) <> ''),
  phone varchar(25) NOT NULL CHECK (phone ~ '^\+?[0-9 ()-]{7,25}$'),
  address varchar(500) NOT NULL CHECK (btrim(address) <> ''),
  city varchar(500) NOT NULL CHECK (btrim(city) <> ''),
  state varchar(500) NOT NULL CHECK (btrim(state) <> ''),
  pin_code varchar(6) NOT NULL CHECK (pin_code ~ '^[0-9]{6}$'),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dealers_city_idx ON dealers(lower(city));
CREATE INDEX dealers_pin_idx ON dealers(pin_code);

CREATE TABLE dealer_badges (
  dealer_id varchar(100) NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 9),
  badge varchar(100) NOT NULL,
  PRIMARY KEY (dealer_id, position)
);

CREATE TABLE landing_images (
  id varchar(100) PRIMARY KEY,
  image_url text NOT NULL CHECK (btrim(image_url) <> ''),
  label varchar(150) NOT NULL DEFAULT '',
  subtitle varchar(150) NOT NULL DEFAULT '',
  recommended_product_text varchar(200) NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0)
);

CREATE TABLE colours (
  code varchar(40) PRIMARY KEY CHECK (btrim(code) <> ''),
  name varchar(150) NOT NULL CHECK (btrim(name) <> ''),
  hex varchar(7) NOT NULL CHECK (hex ~ '^#[0-9A-Fa-f]{6}$'),
  family varchar(30) NOT NULL CHECK (family IN (
    'Warm Neutrals', 'Earthy & Clay', 'Coastal & Blues',
    'Lush Greens', 'Vibrant Accents', 'Urban Greys'
  )),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0)
);
CREATE UNIQUE INDEX colours_code_case_insensitive_idx ON colours(upper(btrim(code)));
CREATE INDEX colours_name_idx ON colours(lower(name));

-- Existing goesWellWith values are HEX strings, not references to colour codes.
CREATE TABLE colour_pairings (
  colour_code varchar(40) NOT NULL REFERENCES colours(code) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 19),
  matching_hex varchar(7) NOT NULL CHECK (matching_hex ~ '^#[0-9A-Fa-f]{6}$'),
  PRIMARY KEY (colour_code, position)
);

CREATE TABLE shade_cards (
  id varchar(100) PRIMARY KEY,
  title varchar(150) NOT NULL CHECK (btrim(title) <> ''),
  pdf_url text NOT NULL CHECK (btrim(pdf_url) <> ''),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0)
);

CREATE TABLE gallery_projects (
  id varchar(100) PRIMARY KEY,
  title varchar(150) NOT NULL CHECK (btrim(title) <> ''),
  location varchar(200) NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gallery_projects_latest_idx ON gallery_projects(updated_at DESC, position DESC);

CREATE TABLE gallery_photos (
  id varchar(100) NOT NULL,
  project_id varchar(100) NOT NULL REFERENCES gallery_projects(id) ON DELETE CASCADE,
  image_url text NOT NULL CHECK (btrim(image_url) <> ''),
  caption varchar(300) NOT NULL DEFAULT '',
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 19),
  PRIMARY KEY (project_id, id),
  UNIQUE (project_id, position)
);

CREATE TABLE gallery_ads (
  id varchar(100) PRIMARY KEY,
  title varchar(150) NOT NULL CHECK (btrim(title) <> ''),
  channel varchar(7) NOT NULL CHECK (channel IN ('digital', 'social')),
  image_url text NOT NULL DEFAULT '',
  description varchar(2000) NOT NULL DEFAULT '',
  link_url text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(image_url) <> '' OR btrim(link_url) <> ''),
  CHECK (link_url = '' OR link_url ~* '^https://')
);
CREATE INDEX gallery_ads_latest_idx ON gallery_ads(channel, updated_at DESC, position DESC);

-- One shared revision protects the existing full-content Save changes workflow.
CREATE TABLE site_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO site_state(id, revision) VALUES (1, 0);

-- The current enquiry API stores names. Keep these snapshots even after deletion.
CREATE TABLE enquiries (
  id varchar(100) PRIMARY KEY,
  topic text NOT NULL DEFAULT 'Request a quotation',
  full_name text NOT NULL CHECK (btrim(full_name) <> ''),
  phone text NOT NULL CHECK (btrim(phone) <> ''),
  city text NOT NULL DEFAULT '',
  product_id varchar(100) REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  shade_code varchar(40) REFERENCES colours(code) ON DELETE SET NULL,
  shade_name text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'assigned_to_dealer')),
  assigned_dealer_id varchar(100) REFERENCES dealers(id) ON DELETE SET NULL,
  assigned_depot_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX enquiries_created_idx ON enquiries(created_at DESC);
CREATE INDEX enquiries_status_idx ON enquiries(status, created_at DESC);

COMMIT;
