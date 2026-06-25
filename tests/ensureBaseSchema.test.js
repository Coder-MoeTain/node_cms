const { prepareSchemaStatements } = require('../database/ensureBaseSchema');

test('prepareSchemaStatements skips CREATE DATABASE and USE', () => {
  const sql = `
CREATE DATABASE IF NOT EXISTS nodepress_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nodepress_cms;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
);
`;
  const statements = prepareSchemaStatements(sql);
  expect(statements).toHaveLength(1);
  expect(statements[0]).toMatch(/^CREATE TABLE users/i);
});
