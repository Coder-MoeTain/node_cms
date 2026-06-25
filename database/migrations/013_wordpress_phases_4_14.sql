-- WordPress phases 4-14: blocks on pages, widgets, templates, import/export, updates, comments, multisite

ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS content_format ENUM('classic','block') NOT NULL DEFAULT 'classic' AFTER content,
  ADD COLUMN IF NOT EXISTS block_content_json MEDIUMTEXT NULL AFTER content_format,
  ADD COLUMN IF NOT EXISTS rendered_content_cache MEDIUMTEXT NULL AFTER block_content_json;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER post_id,
  ADD COLUMN IF NOT EXISTS approved_by INT NULL AFTER user_agent,
  ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL AFTER approved_by;

CREATE TABLE IF NOT EXISTS widget_areas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(500) NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS widget_instances (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  widget_area_id INT UNSIGNED NOT NULL,
  widget_type VARCHAR(80) NOT NULL,
  title VARCHAR(160) NULL,
  settings_json MEDIUMTEXT NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_widget_instances_area FOREIGN KEY (widget_area_id) REFERENCES widget_areas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  template_type VARCHAR(80) NOT NULL,
  theme_slug VARCHAR(120) NULL,
  block_content_json MEDIUMTEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_site_templates_slug_theme (slug, theme_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS template_parts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  part_type VARCHAR(80) NOT NULL,
  theme_slug VARCHAR(120) NULL,
  block_content_json MEDIUMTEXT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_template_parts_slug_theme (slug, theme_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS import_jobs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_type VARCHAR(40) NOT NULL DEFAULT 'json',
  status ENUM('pending','running','completed','failed','rolled_back') NOT NULL DEFAULT 'pending',
  source_filename VARCHAR(255) NULL,
  summary_json MEDIUMTEXT NULL,
  log_text MEDIUMTEXT NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS update_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  component_type ENUM('core','plugin','theme') NOT NULL DEFAULT 'core',
  component_slug VARCHAR(160) NULL,
  from_version VARCHAR(40) NULL,
  to_version VARCHAR(40) NULL,
  status ENUM('checked','available','installed','failed') NOT NULL DEFAULT 'checked',
  message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sites (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  domain VARCHAR(255) NULL,
  path VARCHAR(255) NOT NULL DEFAULT '/',
  status ENUM('active','inactive','archived') NOT NULL DEFAULT 'active',
  owner_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_domains (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NOT NULL,
  domain VARCHAR(255) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_site_domains_domain (domain),
  CONSTRAINT fk_site_domains_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  role_slug VARCHAR(80) NOT NULL DEFAULT 'admin',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_site_users (site_id, user_id),
  CONSTRAINT fk_site_users_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS network_site_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NOT NULL,
  setting_key VARCHAR(120) NOT NULL,
  setting_value MEDIUMTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_network_site_settings (site_id, setting_key),
  CONSTRAINT fk_network_site_settings_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO widget_areas (name, slug, description, display_order) VALUES
  ('Sidebar', 'sidebar', 'Main sidebar widget area', 1),
  ('Footer Column 1', 'footer-1', 'Footer first column', 2),
  ('Footer Column 2', 'footer-2', 'Footer second column', 3),
  ('Footer Column 3', 'footer-3', 'Footer third column', 4),
  ('Homepage Sections', 'homepage-sections', 'Homepage widget sections', 5);
