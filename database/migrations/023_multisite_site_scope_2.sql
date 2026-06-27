-- Multisite site scope phase 2: tags, widgets, CPT, taxonomies, comments

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE widget_areas
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE custom_post_types
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE taxonomies
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

CREATE INDEX IF NOT EXISTS idx_tags_site ON tags (site_id);
CREATE INDEX IF NOT EXISTS idx_widget_areas_site ON widget_areas (site_id);
CREATE INDEX IF NOT EXISTS idx_custom_post_types_site ON custom_post_types (site_id);
CREATE INDEX IF NOT EXISTS idx_taxonomies_site ON taxonomies (site_id);
CREATE INDEX IF NOT EXISTS idx_comments_site ON comments (site_id);
