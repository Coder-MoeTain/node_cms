-- Core CMS 10/10: page hierarchy, FULLTEXT pages, revision + comment settings

ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS parent_id INT UNSIGNED NULL AFTER author_id,
  ADD COLUMN IF NOT EXISTS menu_order INT NOT NULL DEFAULT 0 AFTER parent_id;

CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages (parent_id);

CREATE FULLTEXT INDEX idx_pages_search ON pages (title, excerpt, content);

INSERT INTO site_settings (`key`, `value`, `group`, created_at, updated_at)
VALUES ('revision_limit', '25', 'general', NOW(), NOW())
ON DUPLICATE KEY UPDATE `key` = VALUES(`key`);

INSERT INTO site_settings (`key`, `value`, `group`, created_at, updated_at)
VALUES ('comment_max_depth', '5', 'general', NOW(), NOW())
ON DUPLICATE KEY UPDATE `key` = VALUES(`key`);
