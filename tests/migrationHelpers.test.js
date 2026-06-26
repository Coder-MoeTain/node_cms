const {
  parseAddColumnStatements,
  parseAddColumnIfNotExistsStatements,
  parseCreateIndexIfNotExists
} = require('../database/migrationHelpers');

test('parses plain ADD COLUMN statements for idempotent migration handling', () => {
  const sql = `ALTER TABLE waf_rules
  ADD COLUMN pattern_type ENUM('regex','contains','equals') NOT NULL DEFAULT 'regex' AFTER pattern`;
  const parsed = parseAddColumnStatements(sql);
  expect(parsed).toEqual([
    {
      table: 'waf_rules',
      column: 'pattern_type',
      definition: "ENUM('regex','contains','equals') NOT NULL DEFAULT 'regex' AFTER pattern"
    }
  ]);
});

test('parses single ADD COLUMN IF NOT EXISTS statement', () => {
  const sql = `ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar VARCHAR(255) NULL AFTER role_id`;
  const parsed = parseAddColumnIfNotExistsStatements(sql);
  expect(parsed).toEqual([
    { table: 'users', column: 'avatar', definition: 'VARCHAR(255) NULL AFTER role_id' }
  ]);
});

test('parses multiple ADD COLUMN IF NOT EXISTS clauses including ENUM', () => {
  const sql = `ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS type ENUM('custom','page','category','post') NOT NULL DEFAULT 'custom' AFTER title,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0 AFTER parent_id,
  ADD COLUMN IF NOT EXISTS status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER target`;
  const parsed = parseAddColumnIfNotExistsStatements(sql);
  expect(parsed).toHaveLength(3);
  expect(parsed[0].column).toBe('type');
  expect(parsed[1].column).toBe('sort_order');
  expect(parsed[2].column).toBe('status');
});

test('parses CREATE INDEX IF NOT EXISTS statement', () => {
  const parsed = parseCreateIndexIfNotExists(
    'CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts (post_type);'
  );
  expect(parsed).toEqual({
    index: 'idx_posts_post_type',
    table: 'posts',
    columns: 'post_type'
  });
});

test('parses plugin and theme commercial migration columns', () => {
  const sql = `ALTER TABLE plugins
  ADD COLUMN IF NOT EXISTS error_state ENUM('none','error') NOT NULL DEFAULT 'none' AFTER manifest,
  ADD COLUMN IF NOT EXISTS last_error TEXT NULL AFTER error_state,
  ADD COLUMN IF NOT EXISTS latest_version VARCHAR(40) NULL AFTER last_error,
  ADD COLUMN IF NOT EXISTS update_available BOOLEAN NOT NULL DEFAULT FALSE AFTER latest_version,
  ADD COLUMN IF NOT EXISTS last_checked_at DATETIME NULL AFTER update_available`;
  const parsed = parseAddColumnStatements(sql);
  expect(parsed).toHaveLength(5);
  expect(parsed.map((column) => column.column)).toEqual([
    'error_state',
    'last_error',
    'latest_version',
    'update_available',
    'last_checked_at'
  ]);
});
