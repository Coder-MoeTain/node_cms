CREATE TABLE IF NOT EXISTS plugin_analytics_page_views (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  path VARCHAR(512) NOT NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent VARCHAR(512) NULL,
  INDEX idx_analytics_path (path(191)),
  INDEX idx_analytics_viewed (viewed_at)
)
