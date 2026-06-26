-- Plugin and theme commercial admin columns
--
-- Required by Plugin/Theme models and:
--   utils/pluginLoader.js   (activation error_state / last_error)
--   utils/pluginAdmin.js    (admin plugin cards)
--   utils/themeManager.js   (theme health)
--   utils/updateChecker.js  (latest_version / update_available / last_checked_at)
--
-- Apply with: npm run migrate

ALTER TABLE plugins
  ADD COLUMN IF NOT EXISTS error_state ENUM('none','error') NOT NULL DEFAULT 'none' AFTER manifest,
  ADD COLUMN IF NOT EXISTS last_error TEXT NULL AFTER error_state,
  ADD COLUMN IF NOT EXISTS latest_version VARCHAR(40) NULL AFTER last_error,
  ADD COLUMN IF NOT EXISTS update_available BOOLEAN NOT NULL DEFAULT FALSE AFTER latest_version,
  ADD COLUMN IF NOT EXISTS last_checked_at DATETIME NULL AFTER update_available;

ALTER TABLE themes
  ADD COLUMN IF NOT EXISTS error_state ENUM('none','error') NOT NULL DEFAULT 'none' AFTER active,
  ADD COLUMN IF NOT EXISTS last_error TEXT NULL AFTER error_state,
  ADD COLUMN IF NOT EXISTS latest_version VARCHAR(40) NULL AFTER last_error,
  ADD COLUMN IF NOT EXISTS update_available BOOLEAN NOT NULL DEFAULT FALSE AFTER latest_version,
  ADD COLUMN IF NOT EXISTS last_checked_at DATETIME NULL AFTER update_available;
