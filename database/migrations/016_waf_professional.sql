INSERT INTO waf_rules (name, rule_key, description, category, pattern, pattern_type, target, action, severity, status, score, is_system) VALUES
('Bad Bot Ahrefs', 'bad_bot_ahrefs', 'Blocks Ahrefs SEO crawler user agents.', 'bad_bot', 'ahrefsbot', 'contains', 'user_agent', 'block', 'medium', TRUE, 25, TRUE),
('Bad Bot Semrush', 'bad_bot_semrush', 'Blocks Semrush crawler user agents.', 'bad_bot', 'semrushbot', 'contains', 'user_agent', 'block', 'medium', TRUE, 25, TRUE),
('Bad Bot MJ12', 'bad_bot_mj12', 'Blocks MJ12bot crawler user agents.', 'bad_bot', 'mj12bot', 'contains', 'user_agent', 'block', 'medium', TRUE, 25, TRUE),
('Bad Bot DotBot', 'bad_bot_dotbot', 'Blocks DotBot crawler user agents.', 'bad_bot', 'dotbot', 'contains', 'user_agent', 'block', 'medium', TRUE, 25, TRUE),
('Bad Bot PetalBot', 'bad_bot_petalbot', 'Blocks PetalBot crawler user agents.', 'bad_bot', 'petalbot', 'contains', 'user_agent', 'block', 'medium', TRUE, 25, TRUE),
('Bad Bot Empty UA', 'bad_bot_empty_ua', 'Blocks requests with missing or very short user agents.', 'bad_bot', '^.{0,2}$', 'regex', 'user_agent', 'log', 'low', TRUE, 10, TRUE),
('Bad Bot Headless Chrome', 'bad_bot_headless', 'Detects common headless automation user agents.', 'bad_bot', 'headlesschrome|phantomjs|selenium', 'regex', 'user_agent', 'block', 'high', TRUE, 35, TRUE)
ON DUPLICATE KEY UPDATE
name = VALUES(name),
description = VALUES(description),
category = VALUES(category),
pattern = VALUES(pattern),
pattern_type = VALUES(pattern_type),
target = VALUES(target),
action = VALUES(action),
severity = VALUES(severity),
score = VALUES(score);
