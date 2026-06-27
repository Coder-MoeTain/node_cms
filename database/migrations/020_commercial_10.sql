-- Commercial 10/10: custom taxonomies, terms, permalink setting

CREATE TABLE IF NOT EXISTS taxonomies (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  description TEXT NULL,
  hierarchical TINYINT(1) NOT NULL DEFAULT 0,
  post_types JSON NULL,
  public TINYINT(1) NOT NULL DEFAULT 1,
  show_in_api TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS taxonomy_terms (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  taxonomy_id INT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description TEXT NULL,
  parent_id INT UNSIGNED NULL,
  seo_title VARCHAR(220) NULL,
  seo_description TEXT NULL,
  count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_taxonomy_term_slug (taxonomy_id, slug),
  KEY idx_taxonomy_terms_parent (parent_id),
  CONSTRAINT fk_taxonomy_terms_taxonomy FOREIGN KEY (taxonomy_id) REFERENCES taxonomies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_taxonomy_terms (
  post_id INT UNSIGNED NOT NULL,
  term_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id, term_id),
  KEY idx_post_taxonomy_terms_term (term_id),
  CONSTRAINT fk_post_taxonomy_terms_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_taxonomy_terms_term FOREIGN KEY (term_id) REFERENCES taxonomy_terms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO site_settings (`key`, `value`, `group`, created_at, updated_at)
VALUES ('permalink_structure', '/post/%slug%', 'seo', NOW(), NOW())
ON DUPLICATE KEY UPDATE `key` = VALUES(`key`);

INSERT INTO site_settings (`key`, `value`, `group`, created_at, updated_at)
VALUES ('page_permalink_structure', '/page/%slug%', 'seo', NOW(), NOW())
ON DUPLICATE KEY UPDATE `key` = VALUES(`key`);

INSERT INTO site_settings (`key`, `value`, `group`, created_at, updated_at)
VALUES ('public_site_title', 'NodePress CMS', 'public', NOW(), NOW())
ON DUPLICATE KEY UPDATE `key` = VALUES(`key`);

INSERT INTO site_settings (`key`, `value`, `group`, created_at, updated_at)
VALUES ('public_site_tagline', 'Official information portal', 'public', NOW(), NOW())
ON DUPLICATE KEY UPDATE `key` = VALUES(`key`);
