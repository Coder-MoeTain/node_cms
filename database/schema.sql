CREATE DATABASE IF NOT EXISTS nodepress_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nodepress_cms;

CREATE TABLE roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  slug VARCHAR(140) NOT NULL UNIQUE,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role_id INT UNSIGNED NULL,
  profile_image VARCHAR(255) NULL,
  status ENUM('active','disabled','pending') NOT NULL DEFAULT 'active',
  force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
  last_login DATETIME NULL,
  remember_token VARCHAR(255) NULL,
  reset_token VARCHAR(255) NULL,
  reset_token_expires DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_users_status (status),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description TEXT NULL,
  parent_id INT UNSIGNED NULL,
  image VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_categories_parent (parent_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE tags (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE posts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  title VARCHAR(220) NOT NULL,
  slug VARCHAR(240) NOT NULL UNIQUE,
  content LONGTEXT NOT NULL,
  excerpt TEXT NULL,
  featured_image VARCHAR(255) NULL,
  video_url VARCHAR(500) NULL,
  status ENUM('draft','published','private','scheduled') NOT NULL DEFAULT 'draft',
  category_id INT UNSIGNED NULL,
  author_id INT UNSIGNED NULL,
  seo_title VARCHAR(220) NULL,
  seo_description TEXT NULL,
  og_image VARCHAR(255) NULL,
  allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
  views_count INT UNSIGNED NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FULLTEXT INDEX idx_posts_search (title, excerpt, content),
  INDEX idx_posts_status_published (status, published_at),
  INDEX idx_posts_category (category_id),
  CONSTRAINT fk_posts_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE post_tags (
  post_id INT UNSIGNED NOT NULL,
  tag_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, tag_id),
  CONSTRAINT fk_post_tags_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE pages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  title VARCHAR(220) NOT NULL,
  slug VARCHAR(240) NOT NULL UNIQUE,
  content LONGTEXT NOT NULL,
  excerpt TEXT NULL,
  status ENUM('draft','published','private') NOT NULL DEFAULT 'draft',
  seo_title VARCHAR(220) NULL,
  seo_description TEXT NULL,
  author_id INT UNSIGNED NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_pages_status (status),
  CONSTRAINT fk_pages_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE media (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type ENUM('image','video','document','other') NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  uploaded_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_media_type (file_type),
  CONSTRAINT fk_media_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE menus (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  location ENUM('header','footer','sidebar') NOT NULL DEFAULT 'header',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE menu_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  menu_id INT UNSIGNED NOT NULL,
  parent_id INT UNSIGNED NULL,
  title VARCHAR(160) NOT NULL,
  url VARCHAR(500) NOT NULL,
  item_type ENUM('custom','page','category','post') NOT NULL DEFAULT 'custom',
  reference_id INT UNSIGNED NULL,
  target ENUM('_self','_blank') NOT NULL DEFAULT '_self',
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_menu_items_order (menu_id, display_order),
  CONSTRAINT fk_menu_items_menu FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_items_parent FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE banners (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  title VARCHAR(180) NOT NULL,
  subtitle VARCHAR(255) NULL,
  image VARCHAR(255) NULL,
  button_text VARCHAR(80) NULL,
  button_link VARCHAR(500) NULL,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE sliders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  image VARCHAR(255) NULL,
  images JSON NULL,
  button_text VARCHAR(80) NULL,
  button_url VARCHAR(500) NULL,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE themes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  description TEXT NULL,
  preview_image VARCHAR(255) NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE theme_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  theme_name VARCHAR(120) NOT NULL,
  primary_color VARCHAR(20) NOT NULL DEFAULT '#0d6efd',
  secondary_color VARCHAR(20) NOT NULL DEFAULT '#6c757d',
  background_color VARCHAR(20) NOT NULL DEFAULT '#ffffff',
  text_color VARCHAR(20) NOT NULL DEFAULT '#212529',
  font_family VARCHAR(120) NOT NULL DEFAULT 'Inter, Arial, sans-serif',
  header_layout VARCHAR(80) NOT NULL DEFAULT 'standard',
  footer_layout VARCHAR(80) NOT NULL DEFAULT 'four-columns',
  sidebar_position ENUM('left','right','none') NOT NULL DEFAULT 'right',
  blog_layout ENUM('grid','list','masonry') NOT NULL DEFAULT 'grid',
  site_layout ENUM('full-width','boxed') NOT NULL DEFAULT 'full-width',
  dark_mode BOOLEAN NOT NULL DEFAULT FALSE,
  logo VARCHAR(255) NULL,
  favicon VARCHAR(255) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE site_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  `key` VARCHAR(120) NOT NULL UNIQUE,
  `value` TEXT NULL,
  `group` VARCHAR(80) NOT NULL DEFAULT 'general',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE comments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  post_id INT UNSIGNED NOT NULL,
  parent_id INT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  website VARCHAR(255) NULL,
  content TEXT NOT NULL,
  ip_address VARCHAR(80) NULL,
  user_agent VARCHAR(255) NULL,
  status ENUM('pending','approved','spam','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_comments_post_status (post_id, status),
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE contact_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(40) NULL,
  subject VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('unread','read') NOT NULL DEFAULT 'unread',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE security_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(120) NOT NULL UNIQUE,
  `value` TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE login_attempts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(180) NULL,
  ip_address VARCHAR(80) NOT NULL,
  user_agent VARCHAR(255) NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_login_attempts_ip_created (ip_address, created_at)
) ENGINE=InnoDB;

CREATE TABLE blocked_ips (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(80) NOT NULL UNIQUE,
  reason VARCHAR(255) NULL,
  blocked_by INT UNSIGNED NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_blocked_ips_user FOREIGN KEY (blocked_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE activity_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(160) NOT NULL,
  entity_type VARCHAR(80) NULL,
  entity_id INT UNSIGNED NULL,
  ip_address VARCHAR(80) NULL,
  user_agent VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_activity_logs_user_created (user_id, created_at),
  CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE waf_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  rule_key VARCHAR(160) NOT NULL UNIQUE,
  description TEXT NULL,
  category ENUM('sql_injection','xss','command_injection','path_traversal','file_attack','bad_bot','scanner','brute_force','spam','cms_probe','custom') NOT NULL DEFAULT 'custom',
  pattern TEXT NOT NULL,
  pattern_type ENUM('regex','contains','equals') NOT NULL DEFAULT 'regex',
  target ENUM('url','query','body','headers','user_agent','ip','file_name','all') NOT NULL DEFAULT 'all',
  action ENUM('log','block','rate_limit','temporary_block','challenge') NOT NULL DEFAULT 'block',
  severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  status BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  score INT UNSIGNED NOT NULL DEFAULT 10,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_waf_rules_category (category),
  INDEX idx_waf_rules_status (status)
) ENGINE=InnoDB;

CREATE TABLE waf_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL,
  ip_address VARCHAR(80) NOT NULL,
  method VARCHAR(12) NOT NULL,
  url TEXT NOT NULL,
  route_type VARCHAR(40) NULL,
  user_agent TEXT NULL,
  headers_snapshot JSON NULL,
  query_snapshot JSON NULL,
  body_snapshot JSON NULL,
  file_snapshot JSON NULL,
  matched_rule_id INT UNSIGNED NULL,
  matched_rule_name VARCHAR(160) NULL,
  category VARCHAR(80) NULL,
  severity VARCHAR(20) NULL,
  action_taken VARCHAR(40) NOT NULL DEFAULT 'log',
  risk_score INT UNSIGNED NOT NULL DEFAULT 0,
  country VARCHAR(80) NULL,
  referer TEXT NULL,
  is_admin_route BOOLEAN NOT NULL DEFAULT FALSE,
  user_id INT UNSIGNED NULL,
  response_status INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_waf_logs_created (created_at),
  INDEX idx_waf_logs_ip (ip_address),
  INDEX idx_waf_logs_category (category),
  INDEX idx_waf_logs_action (action_taken),
  INDEX idx_waf_logs_severity (severity)
) ENGINE=InnoDB;

CREATE TABLE waf_ip_lists (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(80) NOT NULL,
  list_type ENUM('blacklist','whitelist','temporary_block') NOT NULL,
  reason VARCHAR(255) NULL,
  expires_at DATETIME NULL,
  status BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_waf_ip_list (ip_address, list_type),
  INDEX idx_waf_ip_status (ip_address, status),
  INDEX idx_waf_ip_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE waf_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type ENUM('boolean','string','number') NOT NULL DEFAULT 'string',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE waf_rate_limits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(80) NOT NULL,
  route_key VARCHAR(180) NOT NULL,
  request_count INT UNSIGNED NOT NULL DEFAULT 0,
  first_request_at DATETIME NOT NULL,
  last_request_at DATETIME NOT NULL,
  blocked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_waf_rate_limit (ip_address, route_key),
  INDEX idx_waf_rate_blocked (blocked_until)
) ENGINE=InnoDB;
