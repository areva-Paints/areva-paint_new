-- Proposed PostgreSQL 16+ schema for Areva Paints.
-- Review-only: the application still uses content.json and in-memory enquiries.
-- Apply ONCE to a new, empty database. This file does not migrate existing data.
-- Reviewed against GitHub main 7d0656e on 2026-11-11: 18 tables, including private users/history.
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
    'Oranges', 'Yellows', 'Greens', 'Blues', 'Violets', 'Earth Tones',
    'Classic Neutrals', 'Dark Accents', 'Whispering Whites', 'Reds & Pinks',
    'Warm Neutrals', 'Earthy & Clay', 'Coastal & Blues',
    'Lush Greens', 'Vibrant Accents', 'Urban Greys'
  )),
  tones text[] NOT NULL DEFAULT '{}' CHECK (tones <@ ARRAY['Cool', 'Dark', 'Light', 'Pastel', 'Vibrant', 'Warm']::text[] AND cardinality(tones) <= 6 AND array_position(tones, NULL) IS NULL),
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
  family varchar(30) NOT NULL DEFAULT 'All Shades' CHECK (family IN ('All Shades', 'Oranges', 'Yellows', 'Greens', 'Blues', 'Violets', 'Earth Tones',
    'Classic Neutrals', 'Dark Accents', 'Whispering Whites', 'Reds & Pinks')),
  tones text[] NOT NULL DEFAULT '{}' CHECK (tones <@ ARRAY['Cool', 'Dark', 'Light', 'Pastel', 'Vibrant', 'Warm']::text[] AND cardinality(tones) <= 6 AND array_position(tones, NULL) IS NULL),
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
  updated_at timestamptz NOT NULL DEFAULT now(),
  history_started_at timestamptz
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

-- Created accounts only. The server-configured recovery admin is not a stored user.
CREATE TABLE users (
  id varchar(100) PRIMARY KEY CHECK (btrim(id) <> '' AND id <> 'environment-admin'),
  username varchar(80) NOT NULL
    CHECK (username = lower(btrim(username)) AND username ~ '^[a-z0-9][a-z0-9._@+-]{2,79}$'),
  email varchar(160) NOT NULL DEFAULT ''
    CHECK (email = lower(btrim(email)) AND (email = '' OR email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  name varchar(100) NOT NULL CHECK (btrim(name) <> ''),
  role varchar(9) NOT NULL CHECK (role IN ('admin', 'customer', 'architect', 'builder')),
  active boolean NOT NULL DEFAULT true,
  password_hash varchar(128) NOT NULL CHECK (password_hash ~ '^[0-9a-f]{128}$'),
  password_salt varchar(32) NOT NULL CHECK (password_salt ~ '^[0-9a-f]{32}$'),
  password_version bigint NOT NULL DEFAULT 1 CHECK (password_version >= 1),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX users_role_active_idx ON users(role, active);

-- One namespace prevents a username from colliding with another user's email.
-- A user whose username equals their own email needs only one identifier row.
CREATE TABLE user_login_identifiers (
  identifier varchar(160) PRIMARY KEY
    CHECK (btrim(identifier) <> '' AND identifier = lower(btrim(identifier))),
  user_id varchar(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX user_login_identifiers_user_idx ON user_login_identifiers(user_id);

-- Maintained transactionally, including JSON import and concurrent account creation.
CREATE FUNCTION sync_user_login_identifiers() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM user_login_identifiers WHERE user_id = NEW.id;
  INSERT INTO user_login_identifiers(identifier, user_id)
    SELECT DISTINCT value, NEW.id
    FROM (VALUES (NEW.username), (NULLIF(NEW.email, ''))) AS identifiers(value)
    WHERE value IS NOT NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_sync_login_identifiers
  AFTER INSERT OR UPDATE OF username, email ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_login_identifiers();

-- Private saved events, not content. No FK to deleted entities or recovery admins.
CREATE TABLE activity_events (
  id varchar(100) PRIMARY KEY CHECK (btrim(id) <> ''),
  event_sequence bigint GENERATED BY DEFAULT AS IDENTITY UNIQUE
    CHECK (event_sequence > 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL CHECK (btrim(actor) <> ''),
  action varchar(20) NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted', 'reordered', 'uploaded',
    'published', 'signed_in', 'signed_out'
  )),
  section varchar(30) NOT NULL CHECK (section IN (
    'landingImages', 'products', 'dealers', 'colours', 'shadeCards',
    'galleryProjects', 'galleryPhotos', 'galleryAds', 'uploads',
    'website', 'account', 'users'
  )),
  entity_id text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  revision bigint CHECK (revision >= 0),
  file_url text,
  bytes bigint CHECK (bytes >= 0)
);
CREATE INDEX activity_events_newest_idx ON activity_events(event_sequence DESC);
CREATE INDEX activity_events_section_idx ON activity_events(section, event_sequence DESC);
CREATE INDEX activity_events_action_idx ON activity_events(action, event_sequence DESC);
CREATE INDEX activity_events_entry_idx ON activity_events(section, entity_id, event_sequence DESC)
  WHERE action IN ('created', 'updated') AND entity_id <> '';

COMMIT;
