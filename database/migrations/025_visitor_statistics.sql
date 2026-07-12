CREATE TABLE IF NOT EXISTS visitor_page_views (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  path VARCHAR(512) NOT NULL,
  referrer VARCHAR(512) NULL,
  user_agent VARCHAR(512) NULL,
  session_hash VARCHAR(64) NULL,
  ip_hash VARCHAR(64) NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vpv_viewed (viewed_at),
  INDEX idx_vpv_path (path(191)),
  INDEX idx_vpv_site (site_id),
  INDEX idx_vpv_session (session_hash),
  INDEX idx_vpv_site_viewed (site_id, viewed_at)
);
