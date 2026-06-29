-- WebGuard API connection settings (editable in Admin → WAF → Settings)

INSERT INTO waf_settings (setting_key, setting_value, setting_type, created_at, updated_at) VALUES
('webguard_api_url', '', 'string', NOW(), NOW()),
('webguard_api_key', '', 'string', NOW(), NOW()),
('webguard_api_token', '', 'string', NOW(), NOW()),
('webguard_timeout_ms', '500', 'number', NOW(), NOW()),
('webguard_allow_localhost', 'false', 'boolean', NOW(), NOW()),
('webguard_fail_open', 'true', 'boolean', NOW(), NOW())
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);
