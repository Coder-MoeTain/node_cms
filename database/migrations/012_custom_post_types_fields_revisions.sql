-- Custom Post Types, Custom Fields, Revisions (WordPress-like upgrade)

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS post_type VARCHAR(80) NOT NULL DEFAULT 'post' AFTER slug,
  ADD COLUMN IF NOT EXISTS content_format ENUM('classic','block') NOT NULL DEFAULT 'classic' AFTER content,
  ADD COLUMN IF NOT EXISTS block_content_json MEDIUMTEXT NULL AFTER content_format,
  ADD COLUMN IF NOT EXISTS rendered_content_cache MEDIUMTEXT NULL AFTER block_content_json;

CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts (post_type);
CREATE INDEX IF NOT EXISTS idx_posts_type_status ON posts (post_type, status);

CREATE TABLE IF NOT EXISTS custom_post_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  description TEXT NULL,
  icon VARCHAR(80) NULL DEFAULT 'bi-file-earmark',
  supports_title TINYINT(1) NOT NULL DEFAULT 1,
  supports_editor TINYINT(1) NOT NULL DEFAULT 1,
  supports_excerpt TINYINT(1) NOT NULL DEFAULT 1,
  supports_featured_image TINYINT(1) NOT NULL DEFAULT 1,
  supports_comments TINYINT(1) NOT NULL DEFAULT 0,
  supports_revisions TINYINT(1) NOT NULL DEFAULT 1,
  supports_custom_fields TINYINT(1) NOT NULL DEFAULT 1,
  has_archive TINYINT(1) NOT NULL DEFAULT 1,
  show_in_menu TINYINT(1) NOT NULL DEFAULT 1,
  show_in_api TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS field_groups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  description TEXT NULL,
  location_type ENUM('post_type','page','category','tag','custom_post_type') NOT NULL DEFAULT 'post_type',
  location_value VARCHAR(120) NOT NULL DEFAULT 'post',
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_fields (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  field_group_id INT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  name VARCHAR(80) NOT NULL,
  type ENUM(
    'text','textarea','rich_text','number','date','datetime',
    'select','checkbox','radio','image','file','url','email','color','repeater','group'
  ) NOT NULL DEFAULT 'text',
  options_json TEXT NULL,
  default_value TEXT NULL,
  placeholder VARCHAR(255) NULL,
  help_text VARCHAR(500) NULL,
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  validation_rules VARCHAR(500) NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_custom_fields_group_name (field_group_id, name),
  CONSTRAINT fk_custom_fields_group FOREIGN KEY (field_group_id) REFERENCES field_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_field_values (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  custom_field_id INT UNSIGNED NOT NULL,
  resource_type ENUM('post','page','custom_post') NOT NULL DEFAULT 'custom_post',
  resource_id INT UNSIGNED NOT NULL,
  value_text MEDIUMTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cfv_field_resource (custom_field_id, resource_type, resource_id),
  CONSTRAINT fk_cfv_field FOREIGN KEY (custom_field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS revisions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  resource_type ENUM('post','page','custom_post') NOT NULL,
  resource_id INT UNSIGNED NOT NULL,
  title VARCHAR(220) NULL,
  content MEDIUMTEXT NULL,
  excerpt TEXT NULL,
  block_content_json MEDIUMTEXT NULL,
  meta_json MEDIUMTEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_revisions_resource (resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS autosaves (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  resource_type ENUM('post','page','custom_post') NOT NULL,
  resource_id INT UNSIGNED NOT NULL,
  draft_data_json MEDIUMTEXT NOT NULL,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_autosave_resource_user (resource_type, resource_id, created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE posts SET post_type = 'post' WHERE post_type IS NULL OR post_type = '';
