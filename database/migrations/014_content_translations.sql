CREATE TABLE IF NOT EXISTS content_translations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  resource_type ENUM('post', 'page', 'custom_post', 'category', 'tag') NOT NULL,
  resource_id INT UNSIGNED NOT NULL,
  locale VARCHAR(10) NOT NULL,
  title VARCHAR(220) NULL,
  excerpt TEXT NULL,
  content MEDIUMTEXT NULL,
  seo_title VARCHAR(220) NULL,
  seo_description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_content_translations (resource_type, resource_id, locale)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
