const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const { app, models, sequelize } = require('../server');
const pluginLoader = require('../utils/pluginLoader');
const { login, getCsrf } = require('./helpers');
const { createZipArchive, pluginFixtureFiles } = require('./helpers/zipFixtures');

const TEST_PLUGIN_SLUG = 'lifecycle-test-plugin';

function installTestPlugin() {
  const pluginDir = path.join(pluginLoader.pluginsRoot, TEST_PLUGIN_SLUG);
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({
    name: 'Lifecycle Test Plugin',
    slug: TEST_PLUGIN_SLUG,
    version: '1.0.0',
    description: 'Plugin used for admin lifecycle integration tests',
    author: 'NodePress Tests'
  }, null, 2));
  fs.writeFileSync(path.join(pluginDir, 'index.js'), `let activated = false;
module.exports = {
  register({ hooks }) {
    hooks.register('publicFooter', () => '<!-- lifecycle-test-active -->', 10);
  },
  onInstall() { global.__lifecycleInstall = true; },
  onActivate() { activated = true; global.__lifecycleActivate = true; },
  onDeactivate() { activated = false; },
  onUninstall() { global.__lifecycleUninstall = true; }
};
`);
  return pluginDir;
}

async function cleanupTestPlugin() {
  await models.Plugin.update({ active: false }, { where: { slug: TEST_PLUGIN_SLUG } });
  const testPlugin = await models.Plugin.findOne({ where: { slug: TEST_PLUGIN_SLUG } });
  if (testPlugin) {
    await models.PluginMigration.destroy({ where: { plugin_id: testPlugin.id }, force: true });
    await models.PluginSetting.destroy({ where: { plugin_id: testPlugin.id }, force: true });
    await testPlugin.destroy({ force: true });
  }
  await sequelize.query('DELETE FROM plugins WHERE slug = ?', { replacements: [TEST_PLUGIN_SLUG] });
  pluginLoader.removePluginDirectory(TEST_PLUGIN_SLUG);
  await pluginLoader.loadActivePlugins(app);
}

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
  await cleanupTestPlugin();
});

afterEach(cleanupTestPlugin);

test('admin can view plugin detail page', async () => {
  await pluginLoader.syncInstalledPlugins();
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page = await agent.get('/admin/plugins/seo-booster');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/Plugin Details/i);
  expect(page.text).toMatch(/seo-booster/i);
});

test('admin can view plugin manager', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page = await agent.get('/admin/plugins');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/Install Plugin/i);
  expect(page.text).toMatch(/Registered hooks/i);
});

test('admin can activate and deactivate a plugin', async () => {
  await pluginLoader.syncInstalledPlugins();
  const plugin = await models.Plugin.findOne({ where: { slug: 'cookie-notice' } });
  expect(plugin).toBeTruthy();

  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/plugins');

  const deactivate = await agent.post(`/admin/plugins/${plugin.slug}/deactivate`).type('form').send({ _csrf: csrf });
  expect(deactivate.status).toBe(302);
  await plugin.reload();
  expect(plugin.active).toBe(false);

  const activate = await agent.post(`/admin/plugins/${plugin.slug}/activate`).type('form').send({ _csrf: csrf });
  expect(activate.status).toBe(302);
  await plugin.reload();
  expect(plugin.active).toBe(true);
});

test('plugin lifecycle registers and clears hooks', async () => {
  installTestPlugin();
  await pluginLoader.syncInstalledPlugins();
  await models.Plugin.update({ active: true }, { where: { slug: TEST_PLUGIN_SLUG } });
  await pluginLoader.loadActivePlugins(app);
  expect(pluginLoader.listRegisteredHooks()).toContain('publicFooter');

  await pluginLoader.deactivatePlugin(TEST_PLUGIN_SLUG, app);
  const row = await models.Plugin.findOne({ where: { slug: TEST_PLUGIN_SLUG } });
  expect(row.active).toBe(false);
});

test('plugin lifecycle invokes install activate and uninstall hooks', async () => {
  installTestPlugin();
  await pluginLoader.syncInstalledPlugins();
  await pluginLoader.invokePluginLifecycle(TEST_PLUGIN_SLUG, 'onInstall');
  expect(global.__lifecycleInstall).toBe(true);

  await pluginLoader.activatePlugin(TEST_PLUGIN_SLUG, app);
  expect(global.__lifecycleActivate).toBe(true);
  expect(pluginLoader.listRegisteredHooks()).toContain('publicFooter');

  await pluginLoader.deactivatePlugin(TEST_PLUGIN_SLUG, app);
  await pluginLoader.invokePluginLifecycle(TEST_PLUGIN_SLUG, 'onUninstall');
  expect(global.__lifecycleUninstall).toBe(true);

  delete global.__lifecycleInstall;
  delete global.__lifecycleActivate;
  delete global.__lifecycleUninstall;
});

test('active plugin cannot be uninstalled', async () => {
  await models.Plugin.update({ active: true }, { where: { slug: 'seo-booster' } });
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/plugins');
  const response = await agent.post('/admin/plugins/seo-booster/uninstall').type('form').send({ _csrf: csrf });
  expect(response.status).toBe(302);
  const stillThere = await models.Plugin.findOne({ where: { slug: 'seo-booster' } });
  expect(stillThere).toBeTruthy();
});

const HTTP_PLUGIN_SLUG = 'http-upload-plugin';

async function cleanupHttpPlugin() {
  await models.Plugin.update({ active: false }, { where: { slug: HTTP_PLUGIN_SLUG } });
  const plugin = await models.Plugin.findOne({ where: { slug: HTTP_PLUGIN_SLUG } });
  if (plugin) {
    await models.PluginSetting.destroy({ where: { plugin_id: plugin.id }, force: true });
    await plugin.destroy({ force: true });
  }
  pluginLoader.removePluginDirectory(HTTP_PLUGIN_SLUG);
  delete global.__http_upload_pluginInstall;
}

test('admin can upload a plugin zip and trigger onInstall lifecycle', async () => {
  await cleanupHttpPlugin();
  const zipPath = path.join(os.tmpdir(), `${HTTP_PLUGIN_SLUG}-${Date.now()}.zip`);
  createZipArchive(pluginFixtureFiles(HTTP_PLUGIN_SLUG, { name: 'HTTP Upload Plugin' }), zipPath);

  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/plugins');
  const response = await agent
    .post('/admin/plugins/upload')
    .set('x-csrf-token', csrf)
    .attach('archive', zipPath);

  expect(response.status).toBe(302);
  const row = await models.Plugin.findOne({ where: { slug: HTTP_PLUGIN_SLUG } });
  expect(row).toBeTruthy();
  expect(global.__http_upload_pluginInstall).toBe(true);
  await cleanupHttpPlugin();
});

test('activated lifecycle plugin renders public footer hook', async () => {
  installTestPlugin();
  await pluginLoader.syncInstalledPlugins();
  await pluginLoader.activatePlugin(TEST_PLUGIN_SLUG, app);

  const page = await request(app).get('/');
  expect(page.status).toBe(200);
  expect(page.text).toContain('<!-- lifecycle-test-active -->');
});
