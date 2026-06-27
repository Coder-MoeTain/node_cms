-- Core CMS commercial upgrades: slug redirects, SEO fields, pending review, password protection

CREATE TABLE IF NOT EXISTS slug_redirects (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  resource_type ENUM('post','page') NOT NULL,
  resource_id INT UNSIGNED NOT NULL,
  old_slug VARCHAR(240) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_slug_redirects_old (resource_type, old_slug),
  KEY idx_slug_redirects_resource (resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE posts
  MODIFY COLUMN status ENUM('draft','pending','published','private','scheduled') NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(500) NULL AFTER og_image,
  ADD COLUMN IF NOT EXISTS og_title VARCHAR(220) NULL AFTER canonical_url,
  ADD COLUMN IF NOT EXISTS og_description TEXT NULL AFTER og_title,
  ADD COLUMN IF NOT EXISTS robots_noindex TINYINT(1) NOT NULL DEFAULT 0 AFTER og_description,
  ADD COLUMN IF NOT EXISTS robots_nofollow TINYINT(1) NOT NULL DEFAULT 0 AFTER robots_noindex,
  ADD COLUMN IF NOT EXISTS sitemap_include TINYINT(1) NOT NULL DEFAULT 1 AFTER robots_nofollow,
  ADD COLUMN IF NOT EXISTS post_password_hash VARCHAR(255) NULL AFTER sitemap_include,
  ADD COLUMN IF NOT EXISTS updated_by INT UNSIGNED NULL AFTER author_id;

ALTER TABLE pages
  MODIFY COLUMN status ENUM('draft','pending','published','private','scheduled') NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(500) NULL AFTER og_image,
  ADD COLUMN IF NOT EXISTS og_title VARCHAR(220) NULL AFTER canonical_url,
  ADD COLUMN IF NOT EXISTS og_description TEXT NULL AFTER og_title,
  ADD COLUMN IF NOT EXISTS robots_noindex TINYINT(1) NOT NULL DEFAULT 0 AFTER og_description,
  ADD COLUMN IF NOT EXISTS robots_nofollow TINYINT(1) NOT NULL DEFAULT 0 AFTER robots_noindex,
  ADD COLUMN IF NOT EXISTS sitemap_include TINYINT(1) NOT NULL DEFAULT 1 AFTER robots_nofollow,
  ADD COLUMN IF NOT EXISTS page_password_hash VARCHAR(255) NULL AFTER sitemap_include,
  ADD COLUMN IF NOT EXISTS updated_by INT UNSIGNED NULL AFTER author_id;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS seo_title VARCHAR(220) NULL AFTER description,
  ADD COLUMN IF NOT EXISTS seo_description TEXT NULL AFTER seo_title;

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS seo_title VARCHAR(220) NULL AFTER description,
  ADD COLUMN IF NOT EXISTS seo_description TEXT NULL AFTER seo_title;
