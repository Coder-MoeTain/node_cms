-- Multisite content isolation scaffold (nullable site_id; NULL = legacy shared content)

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

ALTER TABLE media
  ADD COLUMN IF NOT EXISTS site_id INT UNSIGNED NULL AFTER id;

CREATE INDEX IF NOT EXISTS idx_posts_site ON posts (site_id);
CREATE INDEX IF NOT EXISTS idx_pages_site ON pages (site_id);
CREATE INDEX IF NOT EXISTS idx_categories_site ON categories (site_id);
CREATE INDEX IF NOT EXISTS idx_menus_site ON menus (site_id);
CREATE INDEX IF NOT EXISTS idx_media_site ON media (site_id);
