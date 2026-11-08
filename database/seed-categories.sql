-- Run after schema.sql in a new database. Matches the current category IDs.
BEGIN;
INSERT INTO categories (id, name, icon, description, accent_color, position) VALUES
  ('interior', 'Interior Paints', '🏠', 'Emulsion, luxury architectural sheens and high-washability coatings.', '#6c4cf5', 0),
  ('exterior', 'Exterior Paints', '🌦️', 'Weather-resistant barrier coatings, UV shields and dirt-pick-up resistance.', '#ff7a18', 1),
  ('waterproofing', 'Waterproofing Solutions', '💧', 'Elastomeric roof coatings, damp-proof barriers and crystal moisture protection.', '#0b7bd6', 2),
  ('tile-adhesives', 'Tile Adhesives', '🧱', 'Polymer-modified high-strength adhesives for ceramic, vitrified and stone tiles.', '#ff5a5f', 3),
  ('sealants', 'Joint Sealants', '🔧', 'Polyurethane and acrylic flexible sealants for structural expansion joints.', '#0fb5a2', 4),
  ('putty-primers', 'Wall Putty & Primers', '🪣', 'Ultra-smooth surface leveling acrylic putties and high-adhesion primers.', '#8a4cf5', 5),
  ('textures', 'Textures & Finishes', '✨', 'Zester Series decorative exterior textures, stone finishes and rustic trowels.', '#ff4fa3', 6),
  ('chemicals', 'Construction Chemicals', '🏗️', 'Fast-curing road repair mortars, bonding agents and crystalline admixtures.', '#1b6fd1', 7);
COMMIT;
