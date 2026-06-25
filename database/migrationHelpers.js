const { QueryTypes } = require('sequelize');

function parseAddColumnStatements(sql) {
  if (!/ALTER\s+TABLE/i.test(sql) || !/ADD\s+COLUMN/i.test(sql)) return null;

  const tableMatch = sql.match(/ALTER\s+TABLE\s+`?([\w]+)`?\s+/i);
  if (!tableMatch) return null;

  const table = tableMatch[1];
  const columns = [];
  const pattern = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([\w]+)`?\s+([\s\S]*?)(?=,\s*ADD\s+COLUMN|;?\s*$)/gi;
  let match = pattern.exec(sql);
  while (match) {
    columns.push({
      table,
      column: match[1],
      definition: match[2].trim().replace(/;\s*$/, '')
    });
    match = pattern.exec(sql);
  }

  return columns.length ? columns : null;
}

function parseAddColumnIfNotExistsStatements(sql) {
  return parseAddColumnStatements(sql);
}

function parseCreateIndexIfNotExists(sql) {
  const match = sql.trim().match(
    /^CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+`?([\w]+)`?\s+ON\s+`?([\w]+)`?\s*\((.+)\)\s*;?$/i
  );
  if (!match) return null;
  return { index: match[1], table: match[2], columns: match[3].trim() };
}

async function columnExists(sequelize, table, column, transaction) {
  const rows = await sequelize.query(
    `SELECT 1 AS exists_flag
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :table
       AND COLUMN_NAME = :column
     LIMIT 1`,
    { replacements: { table, column }, type: QueryTypes.SELECT, transaction }
  );
  return rows.length > 0;
}

async function indexExists(sequelize, table, index, transaction) {
  const rows = await sequelize.query(
    `SELECT 1 AS exists_flag
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :table
       AND INDEX_NAME = :index
     LIMIT 1`,
    { replacements: { table, index }, type: QueryTypes.SELECT, transaction }
  );
  return rows.length > 0;
}

async function ensureColumn(sequelize, { table, column, definition }, transaction) {
  if (await columnExists(sequelize, table, column, transaction)) return;
  await sequelize.query(
    `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
    { transaction }
  );
}

async function ensureIndex(sequelize, { table, index, columns }, transaction) {
  if (await indexExists(sequelize, table, index, transaction)) return;
  await sequelize.query(
    `CREATE INDEX \`${index}\` ON \`${table}\` (${columns})`,
    { transaction }
  );
}

async function executeMigrationStatement(sequelize, statement, transaction) {
  const trimmed = statement.trim();
  if (!trimmed) return;

  const addColumns = parseAddColumnStatements(trimmed);
  if (addColumns) {
    for (const column of addColumns) {
      await ensureColumn(sequelize, column, transaction);
    }
    return;
  }

  const createIndex = parseCreateIndexIfNotExists(trimmed);
  if (createIndex) {
    await ensureIndex(sequelize, createIndex, transaction);
    return;
  }

  await sequelize.query(trimmed, { transaction });
}

module.exports = {
  parseAddColumnStatements,
  parseAddColumnIfNotExistsStatements,
  parseCreateIndexIfNotExists,
  executeMigrationStatement
};
