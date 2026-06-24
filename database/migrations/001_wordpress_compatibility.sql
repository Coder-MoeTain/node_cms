USE nodepress_cms;

-- Non-destructive compatibility migration for WordPress-like field names requested in the upgrade spec.
-- Existing application fields are preserved; these aliases make future migration/import work safer.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar VARCHAR(255) NULL AFTER role_id;

UPDATE users SET avatar = profile_image WHERE avatar IS NULL AND profile_image IS NOT NULL;

ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS featured_image VARCHAR(255) NULL AFTER content,
  ADD COLUMN IF NOT EXISTS created_by INT UNSIGNED NULL AFTER seo_description;

UPDATE pages SET created_by = author_id WHERE created_by IS NULL AND author_id IS NOT NULL;

-- Run these primary key conversions only once on schemas that still use composite primary keys.
ALTER TABLE role_permissions DROP PRIMARY KEY;
ALTER TABLE role_permissions ADD COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;
ALTER TABLE role_permissions ADD UNIQUE KEY uq_role_permissions_pair (role_id, permission_id);

ALTER TABLE post_tags DROP PRIMARY KEY;
ALTER TABLE post_tags ADD COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;
ALTER TABLE post_tags ADD UNIQUE KEY uq_post_tags_pair (post_id, tag_id);

ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER location;

UPDATE menus SET status = IF(active = 1, 'active', 'inactive');

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS type ENUM('custom','page','category','post') NOT NULL DEFAULT 'custom' AFTER title,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0 AFTER parent_id,
  ADD COLUMN IF NOT EXISTS status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER target;

UPDATE menu_items
SET type = item_type,
    sort_order = display_order,
    status = IF(active = 1, 'active', 'inactive');

ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER button_link,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0 AFTER status;

UPDATE banners SET status = IF(active = 1, 'active', 'inactive'), sort_order = display_order;

ALTER TABLE sliders
  ADD COLUMN IF NOT EXISTS button_link VARCHAR(500) NULL AFTER button_text,
  ADD COLUMN IF NOT EXISTS status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER button_link,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0 AFTER status;

UPDATE sliders SET button_link = button_url WHERE button_link IS NULL;
UPDATE sliders SET status = IF(active = 1, 'active', 'inactive'), sort_order = display_order;

ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS active_theme VARCHAR(120) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS layout_type ENUM('full-width','boxed') NOT NULL DEFAULT 'full-width' AFTER font_family,
  ADD COLUMN IF NOT EXISTS header_style VARCHAR(80) NOT NULL DEFAULT 'standard' AFTER sidebar_position,
  ADD COLUMN IF NOT EXISTS footer_style VARCHAR(80) NOT NULL DEFAULT 'four-columns' AFTER header_style;

UPDATE theme_settings
SET active_theme = theme_name,
    layout_type = site_layout,
    header_style = header_layout,
    footer_style = footer_layout;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS setting_key VARCHAR(120) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS setting_value TEXT NULL AFTER setting_key,
  ADD COLUMN IF NOT EXISTS setting_type VARCHAR(80) NULL AFTER setting_value;

UPDATE site_settings SET setting_key = `key`, setting_value = `value`, setting_type = `group`;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS comment TEXT NULL AFTER website;

UPDATE comments SET comment = content WHERE comment IS NULL AND content IS NOT NULL;

ALTER TABLE login_attempts
  ADD COLUMN IF NOT EXISTS status ENUM('success','failed') NOT NULL DEFAULT 'failed' AFTER user_agent;

UPDATE login_attempts SET status = IF(success = 1, 'success', 'failed');

ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS module VARCHAR(80) NULL AFTER action,
  ADD COLUMN IF NOT EXISTS description TEXT NULL AFTER module;

UPDATE activity_logs SET module = entity_type WHERE module IS NULL AND entity_type IS NOT NULL;

ALTER TABLE blocked_ips
  ADD COLUMN IF NOT EXISTS created_by INT UNSIGNED NULL AFTER reason;

UPDATE blocked_ips SET created_by = blocked_by WHERE created_by IS NULL AND blocked_by IS NOT NULL;

ALTER TABLE security_settings
  ADD COLUMN IF NOT EXISTS setting_key VARCHAR(120) NULL AFTER id,
  ADD COLUMN IF NOT EXISTS setting_value TEXT NULL AFTER setting_key;

UPDATE security_settings SET setting_key = `key`, setting_value = `value`;
