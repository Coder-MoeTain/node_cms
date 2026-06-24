-- WAF enhancements: additional columns, settings, and seed metadata

ALTER TABLE waf_rules
  ADD COLUMN pattern_type ENUM('regex','contains','equals') NOT NULL DEFAULT 'regex' AFTER pattern;

ALTER TABLE waf_rules
  ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE AFTER status;

ALTER TABLE waf_rules
  ADD COLUMN deleted_at DATETIME NULL AFTER updated_at;

ALTER TABLE waf_rules
  MODIFY COLUMN category ENUM(
    'sql_injection','xss','command_injection','path_traversal','file_attack',
    'bad_bot','scanner','brute_force','spam','cms_probe','custom'
  ) NOT NULL DEFAULT 'custom';

ALTER TABLE waf_rules
  MODIFY COLUMN target ENUM('url','query','body','headers','user_agent','ip','file_name','all') NOT NULL DEFAULT 'all';

ALTER TABLE waf_rules
  MODIFY COLUMN action ENUM('log','block','rate_limit','temporary_block','challenge') NOT NULL DEFAULT 'block';

ALTER TABLE waf_logs
  ADD COLUMN route_type VARCHAR(40) NULL AFTER url;

ALTER TABLE waf_logs
  ADD COLUMN file_snapshot JSON NULL AFTER body_snapshot;

ALTER TABLE waf_logs
  ADD COLUMN response_status INT UNSIGNED NULL AFTER user_id;

INSERT INTO waf_settings (setting_key, setting_value, setting_type) VALUES
('block_cms_probes', 'true', 'boolean'),
('max_risk_score_public', '50', 'number'),
('max_risk_score_admin', '40', 'number'),
('log_all_suspicious', 'true', 'boolean'),
('auto_block_window_minutes', '10', 'number'),
('waf_response_message', 'Request blocked by Web Application Firewall.', 'string')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

UPDATE waf_rules SET is_system = TRUE, pattern_type = 'regex' WHERE rule_key IS NOT NULL;

INSERT INTO waf_rules (name, rule_key, description, category, pattern, pattern_type, target, action, severity, status, score, is_system) VALUES
('CMS Adminer Probe', 'cms_adminer_probe', 'Detects adminer.php probes.', 'cms_probe', 'adminer\\.php', 'regex', 'url', 'block', 'critical', TRUE, 50, TRUE),
('Dangerous PHP Upload', 'file_php_upload', 'Detects dangerous PHP upload filenames.', 'file_attack', '\\.(php|phtml)$', 'regex', 'file_name', 'block', 'critical', TRUE, 60, TRUE),
('Dangerous Executable Upload', 'file_exe_upload', 'Detects executable upload filenames.', 'file_attack', '\\.(exe|bat|cmd|sh)$', 'regex', 'file_name', 'block', 'critical', TRUE, 60, TRUE),
('Dangerous Script Upload', 'file_script_upload', 'Detects server script upload filenames.', 'file_attack', '\\.(jsp|asp|aspx)$', 'regex', 'file_name', 'block', 'critical', TRUE, 60, TRUE)
ON DUPLICATE KEY UPDATE
name = VALUES(name),
description = VALUES(description),
category = VALUES(category),
pattern = VALUES(pattern),
pattern_type = VALUES(pattern_type),
target = VALUES(target),
action = VALUES(action),
severity = VALUES(severity),
score = VALUES(score),
is_system = VALUES(is_system);
