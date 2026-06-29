-- WebGuard ML integration settings for WAF

INSERT INTO waf_settings (setting_key, setting_value, setting_type, created_at, updated_at) VALUES
('ml_waf_enabled', 'false', 'boolean', NOW(), NOW()),
('ml_waf_confidence_threshold', '0.7', 'number', NOW(), NOW()),
('ml_waf_model_id', '', 'string', NOW(), NOW()),
('ml_waf_block_standalone', 'true', 'boolean', NOW(), NOW()),
('ml_waf_reject_uncertain', 'true', 'boolean', NOW(), NOW())
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);
