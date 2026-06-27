-- Multisite site scope phase 3: field groups, banners, sliders, site settings, taxonomy terms, widget instances

ALTER TABLE field_groups
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE sliders
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE taxonomy_terms
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE widget_instances
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

CREATE INDEX IF NOT EXISTS idx_field_groups_site ON field_groups (site_id);
CREATE INDEX IF NOT EXISTS idx_banners_site ON banners (site_id);
CREATE INDEX IF NOT EXISTS idx_sliders_site ON sliders (site_id);
CREATE INDEX IF NOT EXISTS idx_site_settings_site ON site_settings (site_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_site ON taxonomy_terms (site_id);
CREATE INDEX IF NOT EXISTS idx_widget_instances_site ON widget_instances (site_id);
