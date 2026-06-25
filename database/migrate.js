const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { executeMigrationStatement } = require('./migrationHelpers');

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
        await executeMigrationStatement(sequelize, statement, transaction);
      }
      await sequelize.query('INSERT INTO migrations (name) VALUES (?)', { replacements: [file], transaction });
    });
    console.log(`Migrated ${file}`);
  }
  await sequelize.close();
}

async function status() {
  await sequelize.authenticate();
  await ensureMigrationTable();
  const completed = await sequelize.query('SELECT name, ran_at FROM migrations ORDER BY name', { type: QueryTypes.SELECT });
  const completedNames = new Set(completed.map((row) => row.name));
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  const pending = files.filter((file) => !completedNames.has(file));

  console.log(`Applied: ${completed.length}`);
  completed.forEach((row) => console.log(`  ✓ ${row.name} (${row.ran_at})`));
  console.log(`Pending: ${pending.length}`);
  pending.forEach((file) => console.log(`  ○ ${file}`));
  await sequelize.close();
  process.exit(pending.length ? 1 : 0);
}

const command = process.argv[2];
if (command === 'status') {
  status().catch(async (error) => {
    console.error(error);
    await sequelize.close();
    process.exit(1);
  });
} else {
  run().catch(async (error) => {
    console.error(error);
    await sequelize.close();
    process.exit(1);
  });
}
