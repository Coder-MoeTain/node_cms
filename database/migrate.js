const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');
const { ensureDatabase } = require('./ensureDatabase');
const { ensureBaseSchema } = require('./ensureBaseSchema');
const { applyPendingMigrations } = require('./migrationRunner');
const { ensureSiteScopeColumns } = require('./ensureMultisiteSchema');

const migrationsDir = path.join(__dirname, 'migrations');

async function run() {
  await ensureDatabase();
  await sequelize.authenticate();
  if (await ensureBaseSchema(sequelize)) {
    console.log('Applied base schema from database/schema.sql');
  }
  const applied = await applyPendingMigrations(sequelize);
  applied.forEach((file) => console.log(`Migrated ${file}`));
  const repaired = await ensureSiteScopeColumns(sequelize);
  if (repaired.length) {
    console.log(`Ensured multisite columns: ${repaired.join(', ')}`);
  }
  await sequelize.close();
}

async function status() {
  await ensureDatabase();
  await sequelize.authenticate();
  const { ensureMigrationTable } = require('./migrationRunner');
  await ensureMigrationTable(sequelize);
  const completed = await sequelize.query('SELECT name, ran_at FROM migrations ORDER BY name', { type: require('sequelize').QueryTypes.SELECT });
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
