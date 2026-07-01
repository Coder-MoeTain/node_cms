-- Public page traffic logs (realtime analytics for front-end visits)

CREATE TABLE IF NOT EXISTS traffic_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  request_id VARCHAR(64) NOT NULL,
  ip_address VARCHAR(80) NOT NULL,
  method VARCHAR(12) NOT NULL,
  path VARCHAR(512) NOT NULL,
  url TEXT NOT NULL,
  referer TEXT NULL,
  user_agent TEXT NULL,
  response_status INT UNSIGNED NOT NULL DEFAULT 200,
  response_ms INT UNSIGNED NULL,
  device_type ENUM('desktop','mobile','tablet','bot','unknown') NOT NULL DEFAULT 'unknown',
  browser VARCHAR(80) NULL,
  os VARCHAR(80) NULL,
  is_bot BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_traffic_logs_created_at (created_at),
  INDEX idx_traffic_logs_site_id (site_id),
  INDEX idx_traffic_logs_ip (ip_address),
  INDEX idx_traffic_logs_path (path(191)),
  INDEX idx_traffic_logs_status (response_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
