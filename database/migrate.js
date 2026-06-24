const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

const migrationsDir = path.join(__dirname, 'migrations');

async function ensureMigrationTable() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function run() {
  await sequelize.authenticate();
  await ensureMigrationTable();
  const completed = await sequelize.query('SELECT name FROM migrations', { type: QueryTypes.SELECT });
  const completedNames = new Set(completed.map((row) => row.name));
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    if (completedNames.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await sequelize.transaction(async (transaction) => {
      for (const statement of splitStatements(sql)) {
        await sequelize.query(statement, { transaction });
      }
      await sequelize.query('INSERT INTO migrations (name) VALUES (?)', { replacements: [file], transaction });
    });
    console.log(`Migrated ${file}`);
  }
  await sequelize.close();
}

run().catch(async (error) => {
  console.error(error);
  await sequelize.close();
  process.exit(1);
});
