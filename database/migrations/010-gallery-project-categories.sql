/* Add supported Gallery project categories and preserve existing albums under Other.
 * Historical upgrade: apply once, in sequence, only when absent from the target installation.
 * This file is not run by Express and does not import the live JSON store.
 */
-- Run once after migrations 001–009. Existing projects stay uncategorized as Other.
-- This does not move JSON content or change the running application's storage.
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
ALTER TABLE gallery_projects ADD COLUMN category varchar(20) NOT NULL DEFAULT 'other'
  CHECK (category IN ('interior', 'exterior', 'textures', 'waterproofing', 'commercial', 'other'));
CREATE INDEX gallery_projects_category_latest_idx ON gallery_projects(category, updated_at DESC, position DESC);
COMMIT;
