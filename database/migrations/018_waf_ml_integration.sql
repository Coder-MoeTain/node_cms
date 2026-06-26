-- WebGuard ML integration settings for WAF

INSERT INTO waf_settings (setting_key, setting_value, setting_type) VALUES
('ml_waf_enabled', 'false', 'boolean'),
('ml_waf_confidence_threshold', '0.7', 'number'),
('ml_waf_model_id', '', 'string'),
('ml_waf_block_standalone', 'true', 'boolean'),
('ml_waf_reject_uncertain', 'true', 'boolean')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);
