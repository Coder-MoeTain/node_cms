const {
  parseAddColumnIfNotExistsStatements,
  parseCreateIndexIfNotExists
} = require('../database/migrationHelpers');

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

test('returns null for regular ALTER TABLE statements', () => {
  expect(parseAddColumnIfNotExistsStatements('ALTER TABLE users ADD COLUMN avatar VARCHAR(255)')).toBeNull();
});
