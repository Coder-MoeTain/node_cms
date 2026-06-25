const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const { app, models } = require('../server');
const pluginLoader = require('../utils/pluginLoader');
const { login, getCsrf } = require('./helpers');
const { createZipArchive, pluginFixtureFiles } = require('./helpers/zipFixtures');

const SLUG = 'full-lifecycle-plugin';

async function cleanupPlugin() {
  await models.Plugin.update({ active: false }, { where: { slug: SLUG } });
  const row = await models.Plugin.findOne({ where: { slug: SLUG } });
  if (row) {
    await models.PluginMigration.destroy({ where: { plugin_id: row.id }, force: true });
    await models.PluginSetting.destroy({ where: { plugin_id: row.id }, force: true });
    await row.destroy({ force: true });
  }
  pluginLoader.removePluginDirectory(SLUG);
  delete global.__full_lifecycle_pluginInstall;
  delete global.__full_lifecycle_pluginActivate;
  delete global.__full_lifecycle_pluginUninstall;
  await pluginLoader.loadActivePlugins(app);
}

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
  await cleanupPlugin();
});

afterEach(cleanupPlugin);

test('full HTTP plugin lifecycle: upload, activate, deactivate, uninstall', async () => {
  const zipPath = path.join(os.tmpdir(), `${SLUG}-${Date.now()}.zip`);
  createZipArchive(pluginFixtureFiles(SLUG, { name: 'Full Lifecycle Plugin' }), zipPath);

  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  let csrf = await getCsrf(agent, '/admin/plugins');

  const upload = await agent
    .post('/admin/plugins/upload')
    .set('x-csrf-token', csrf)
    .attach('archive', zipPath);
  expect(upload.status).toBe(302);
  expect(global.__full_lifecycle_pluginInstall).toBe(true);

  const installed = await models.Plugin.findOne({ where: { slug: SLUG } });
  expect(installed).toBeTruthy();
  expect(installed.active).toBe(false);

  csrf = await getCsrf(agent, '/admin/plugins');
  const activate = await agent.post(`/admin/plugins/${SLUG}/activate`).type('form').send({ _csrf: csrf });
  expect(activate.status).toBe(302);
  await installed.reload();
  expect(installed.active).toBe(true);
  expect(global.__full_lifecycle_pluginActivate).toBe(true);

  const publicPage = await request(app).get('/');
  expect(publicPage.status).toBe(200);
  expect(publicPage.text).toContain('<!-- full-lifecycle-plugin-active -->');

  csrf = await getCsrf(agent, '/admin/plugins');
  const deactivate = await agent.post(`/admin/plugins/${SLUG}/deactivate`).type('form').send({ _csrf: csrf });
  expect(deactivate.status).toBe(302);
  await installed.reload();
  expect(installed.active).toBe(false);

  const afterDeactivate = await request(app).get('/');
  expect(afterDeactivate.text).not.toContain('<!-- full-lifecycle-plugin-active -->');

  csrf = await getCsrf(agent, '/admin/plugins');
  const uninstall = await agent.post(`/admin/plugins/${SLUG}/uninstall`).type('form').send({ _csrf: csrf });
  expect(uninstall.status).toBe(302);
  expect(global.__full_lifecycle_pluginUninstall).toBe(true);

  const removed = await models.Plugin.findOne({ where: { slug: SLUG } });
  expect(removed).toBeNull();
  expect(fs.existsSync(path.join(pluginLoader.pluginsRoot, SLUG))).toBe(false);
});
