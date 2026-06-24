CREATE TABLE IF NOT EXISTS translation_cache (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_hash CHAR(64) NOT NULL,
  source_locale VARCHAR(10) NOT NULL DEFAULT 'en',
  target_locale VARCHAR(10) NOT NULL,
  source_text MEDIUMTEXT NOT NULL,
  translated_text MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_translation_cache_lookup (source_hash, source_locale, target_locale),
  INDEX idx_translation_cache_target (target_locale)
) ENGINE=InnoDB;
