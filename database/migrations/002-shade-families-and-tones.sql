-- For an existing Areva installation. Fresh installs already include these columns.
-- Supports the private Supabase areva schema or an ordinary public-schema install.
-- Does not replace HEX values, import shades, or connect the website to SQL.
BEGIN;
DO $$
BEGIN
  IF to_regclass('areva.colours') IS NOT NULL AND to_regclass('public.colours') IS NOT NULL THEN
    RAISE EXCEPTION 'Two colour tables found. Inspect the installation before migrating.';
  ELSIF to_regclass('areva.colours') IS NOT NULL THEN
    PERFORM set_config('search_path', 'areva, pg_catalog', true);
  ELSIF to_regclass('public.colours') IS NOT NULL THEN
    PERFORM set_config('search_path', 'public, pg_catalog', true);
  ELSE
    RAISE EXCEPTION 'No Areva colour table found. Use the complete setup for a fresh database.';
  END IF;
END;
$$;
ALTER TABLE colours DROP CONSTRAINT IF EXISTS colours_family_check;
ALTER TABLE colours ADD CONSTRAINT colours_family_check CHECK (family IN (
    'Oranges', 'Yellows', 'Greens', 'Blues', 'Violets', 'Earth Tones',
    'Classic Neutrals', 'Dark Accents', 'Whispering Whites', 'Reds & Pinks',
    'Warm Neutrals', 'Earthy & Clay', 'Coastal & Blues',
    'Lush Greens', 'Vibrant Accents', 'Urban Greys'
));
-- Legacy family names remain readable; the application normalizes them using the saved HEX.
ALTER TABLE colours ADD COLUMN tones text[] NOT NULL DEFAULT '{}';
ALTER TABLE colours ADD CONSTRAINT colours_tones_check CHECK (tones <@ ARRAY['Cool', 'Dark', 'Light', 'Pastel', 'Vibrant', 'Warm']::text[] AND cardinality(tones) <= 6 AND array_position(tones, NULL) IS NULL);
ALTER TABLE shade_cards ADD COLUMN family varchar(30) NOT NULL DEFAULT 'All Shades';
ALTER TABLE shade_cards ADD CONSTRAINT shade_cards_family_check CHECK (family IN ('All Shades', 'Oranges', 'Yellows', 'Greens', 'Blues', 'Violets', 'Earth Tones',
    'Classic Neutrals', 'Dark Accents', 'Whispering Whites', 'Reds & Pinks'));
ALTER TABLE shade_cards ADD COLUMN tones text[] NOT NULL DEFAULT '{}';
ALTER TABLE shade_cards ADD CONSTRAINT shade_cards_tones_check CHECK (tones <@ ARRAY['Cool', 'Dark', 'Light', 'Pastel', 'Vibrant', 'Warm']::text[] AND cardinality(tones) <= 6 AND array_position(tones, NULL) IS NULL);
COMMIT;
