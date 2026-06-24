CREATE TABLE IF NOT EXISTS waf_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  rule_key VARCHAR(160) NOT NULL UNIQUE,
  description TEXT NULL,
  category ENUM('sql_injection','xss','command_injection','path_traversal','file_attack','bad_bot','scanner','brute_force','spam','custom') NOT NULL DEFAULT 'custom',
  pattern TEXT NOT NULL,
  target ENUM('url','query','body','headers','user_agent','ip','all') NOT NULL DEFAULT 'all',
  action ENUM('block','log','challenge','rate_limit') NOT NULL DEFAULT 'block',
  severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  status BOOLEAN NOT NULL DEFAULT TRUE,
  score INT UNSIGNED NOT NULL DEFAULT 10,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_waf_rules_category (category),
  INDEX idx_waf_rules_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS waf_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL,
  ip_address VARCHAR(80) NOT NULL,
  method VARCHAR(12) NOT NULL,
  url TEXT NOT NULL,
  user_agent TEXT NULL,
  headers_snapshot JSON NULL,
  query_snapshot JSON NULL,
  body_snapshot JSON NULL,
  matched_rule_id INT UNSIGNED NULL,
  matched_rule_name VARCHAR(160) NULL,
  category VARCHAR(80) NULL,
  severity VARCHAR(20) NULL,
  action_taken VARCHAR(40) NOT NULL DEFAULT 'log',
  risk_score INT UNSIGNED NOT NULL DEFAULT 0,
  country VARCHAR(80) NULL,
  referer TEXT NULL,
  is_admin_route BOOLEAN NOT NULL DEFAULT FALSE,
  user_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_waf_logs_created (created_at),
  INDEX idx_waf_logs_ip (ip_address),
  INDEX idx_waf_logs_category (category),
  INDEX idx_waf_logs_action (action_taken),
  INDEX idx_waf_logs_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS waf_ip_lists (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(80) NOT NULL,
  list_type ENUM('blacklist','whitelist','temporary_block') NOT NULL,
  reason VARCHAR(255) NULL,
  expires_at DATETIME NULL,
  status BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_waf_ip_list (ip_address, list_type),
  INDEX idx_waf_ip_status (ip_address, status),
  INDEX idx_waf_ip_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS waf_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  setting_type ENUM('boolean','string','number') NOT NULL DEFAULT 'string',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS waf_rate_limits (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (name, slug) VALUES ('Manage WAF', 'manage_waf');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
JOIN permissions ON permissions.slug = 'manage_waf'
WHERE roles.slug IN ('super-admin', 'admin');

INSERT INTO waf_settings (setting_key, setting_value, setting_type) VALUES
('waf_enabled', 'true', 'boolean'),
('waf_mode', 'monitor', 'string'),
('block_sql_injection', 'true', 'boolean'),
('block_xss', 'true', 'boolean'),
('block_path_traversal', 'true', 'boolean'),
('block_command_injection', 'true', 'boolean'),
('block_bad_bots', 'true', 'boolean'),
('block_scanners', 'true', 'boolean'),
('max_risk_score', '50', 'number'),
('log_all_requests', 'false', 'boolean'),
('log_blocked_only', 'true', 'boolean'),
('admin_protection_enabled', 'true', 'boolean'),
('public_protection_enabled', 'true', 'boolean'),
('auto_block_enabled', 'true', 'boolean'),
('auto_block_threshold', '5', 'number'),
('auto_block_duration_minutes', '60', 'number'),
('trusted_proxy_enabled', 'false', 'boolean')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);
