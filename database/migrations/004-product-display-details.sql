-- Apply once to an existing Areva database; fresh schema includes these fields.
-- Preserves numeric calculator values and existing warranties. No content import or live connection.
BEGIN;
DO $$
BEGIN
  IF to_regclass('areva.products') IS NOT NULL AND to_regclass('public.products') IS NOT NULL THEN
    RAISE EXCEPTION 'Two Areva product tables found. Inspect before migrating.';
  ELSIF to_regclass('areva.products') IS NOT NULL THEN
    PERFORM set_config('search_path', 'areva, pg_catalog', true);
  ELSIF to_regclass('public.products') IS NOT NULL THEN
    PERFORM set_config('search_path', 'public, pg_catalog', true);
  ELSE
    RAISE EXCEPTION 'No Areva product table found. Use the complete setup for a new database.';
  END IF;
END;
$$;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sheen_check;
ALTER TABLE products ALTER COLUMN sheen TYPE varchar(100);
ALTER TABLE products ADD CONSTRAINT products_sheen_check CHECK (btrim(sheen) <> '');
ALTER TABLE products ADD COLUMN coverage_text varchar(300) NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN dilution varchar(300) NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN bases varchar(100)[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD CONSTRAINT products_bases_check CHECK (cardinality(bases) <= 30 AND array_position(bases, NULL) IS NULL);
ALTER TABLE products ADD COLUMN packing varchar(100)[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD CONSTRAINT products_packing_check CHECK (cardinality(packing) <= 20 AND array_position(packing, NULL) IS NULL);
ALTER TABLE products ADD COLUMN warranty_label varchar(100) NOT NULL DEFAULT '';
COMMIT;
