INSERT INTO waf_settings (setting_key, setting_value, setting_type) VALUES
  ('waf_rate_limit_public', '1000', 'number'),
  ('waf_rate_limit_admin', '600', 'number'),
  ('waf_rate_limit_login', '8', 'number'),
  ('waf_rate_limit_mutation', '60', 'number'),
  ('waf_path_exclusions', '', 'string'),
  ('waf_log_retention_days', '90', 'number')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
