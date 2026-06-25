const fs = require('fs');
const path = require('path');
const request = require('supertest');
const pluginLoader = require('../utils/pluginLoader');
const { app, models, sequelize } = require('../server');
const { login, getCsrf } = require('./helpers');

const SLUG = 'migration-test-plugin';
const MARKER_TABLE = 'plugin_migration_marker_test';

async function cleanupPlugin() {
  await models.Plugin.update({ active: false }, { where: { slug: SLUG } });
  const row = await models.Plugin.findOne({ where: { slug: SLUG } });
  if (row) {
    await models.PluginMigration.destroy({ where: { plugin_id: row.id }, force: true });
    await row.destroy({ force: true });
  }
  pluginLoader.removePluginDirectory(SLUG);
  try {
    await sequelize.query(`DROP TABLE IF EXISTS ${MARKER_TABLE}`);
  } catch {
    // ignore if table missing
  }
}

function installMigrationPlugin() {
  const pluginDir = path.join(pluginLoader.pluginsRoot, SLUG);
  fs.mkdirSync(path.join(pluginDir, 'migrations'), { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({
    name: 'Migration Test Plugin',
    slug: SLUG,
    version: '1.0.0',
    author: 'NodePress Tests',
    description: 'Plugin used to verify SQL migrations'
  }, null, 2));
  fs.writeFileSync(path.join(pluginDir, 'index.js'), 'module.exports = {};');
  fs.writeFileSync(
    path.join(pluginDir, 'migrations', '001_marker.sql'),
    `CREATE TABLE IF NOT EXISTS ${MARKER_TABLE} (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY)`
  );
}

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
  await cleanupPlugin();
});

afterEach(cleanupPlugin);

test('pluginLoader runs pending SQL migrations', async () => {
  installMigrationPlugin();
  await pluginLoader.syncInstalledPlugins();
  const ran = await pluginLoader.runPluginMigrations(SLUG);
  expect(ran).toContain('001_marker.sql');
  const plugin = await models.Plugin.findOne({ where: { slug: SLUG } });
  const migration = await models.PluginMigration.findOne({
    where: { plugin_id: plugin.id, migration: '001_marker.sql' }
  });
  expect(migration).toBeTruthy();
  const [tables] = await sequelize.query(`SHOW TABLES LIKE '${MARKER_TABLE}'`);
  expect(tables.length).toBe(1);
});

test('admin can run plugin migrations via HTTP', async () => {
  installMigrationPlugin();
  await pluginLoader.syncInstalledPlugins();
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, `/admin/plugins/${SLUG}`);
  const response = await agent.post(`/admin/plugins/${SLUG}/migrate`).type('form').send({ _csrf: csrf });
  expect(response.status).toBe(302);
  const plugin = await models.Plugin.findOne({ where: { slug: SLUG } });
  const migration = await models.PluginMigration.findOne({
    where: { plugin_id: plugin.id, migration: '001_marker.sql' }
  });
  expect(migration).toBeTruthy();
});
