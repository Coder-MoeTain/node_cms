const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');
const { executeMigrationStatement } = require('./migrationHelpers');

const migrationsDir = path.join(__dirname, 'migrations');

function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function ensureMigrationTable(sequelize) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function applyPendingMigrations(sequelize) {
  await ensureMigrationTable(sequelize);
  const completed = await sequelize.query('SELECT name FROM migrations', { type: QueryTypes.SELECT });
  const completedNames = new Set(completed.map((row) => row.name));
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  const applied = [];

  for (const file of files) {
    if (completedNames.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await sequelize.transaction(async (transaction) => {
      for (const statement of splitStatements(sql)) {
        try {
          await executeMigrationStatement(sequelize, statement, transaction);
        } catch (error) {
          if (error?.parent?.code === 'ER_NO_SUCH_TABLE' || /doesn't exist/i.test(error.message)) {
            continue;
          }
          throw error;
        }
      }
      await sequelize.query('INSERT INTO migrations (name) VALUES (?)', { replacements: [file], transaction });
    });
    applied.push(file);
  }

  return applied;
}

module.exports = {
  applyPendingMigrations,
  ensureMigrationTable,
  splitStatements
};
