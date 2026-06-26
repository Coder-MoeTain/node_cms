const request = require('supertest');
const { enrichPlugin, renderSimpleMarkdown } = require('../utils/pluginAdmin');
const { app, models } = require('../server');
const pluginLoader = require('../utils/pluginLoader');
const { login, getCsrf } = require('./helpers');

describe('pluginAdmin utils', () => {
  test('renderSimpleMarkdown converts headings and links', () => {
    const html = renderSimpleMarkdown('# Title\n\nHello **world** [docs](https://example.com)');
    expect(html).toMatch(/<h1>Title<\/h1>/);
    expect(html).toMatch(/<strong>world<\/strong>/);
    expect(html).toMatch(/href="https:\/\/example.com"/);
  });

  test('enrichPlugin adds icon and disk metadata', async () => {
    await pluginLoader.syncInstalledPlugins();
    const plugin = await models.Plugin.findOne({ where: { slug: 'seo-booster' } });
    expect(plugin).toBeTruthy();
    const enriched = enrichPlugin(plugin);
    expect(enriched.icon).toMatch(/^bi-/);
    expect(enriched.disk.exists).toBe(true);
    expect(enriched.entryFile).toBeTruthy();
  });
});

describe('plugins admin UI routes', () => {
  test('plugins json endpoint returns enriched list', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/plugins.json');
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeTruthy();
    expect(Array.isArray(res.body.plugins)).toBe(true);
    expect(res.body.plugins.length).toBeGreaterThan(0);
  });

  test('sync plugins route redirects with success', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const csrf = await getCsrf(agent, '/admin/plugins');
    const res = await agent.post('/admin/plugins/sync').type('form').send({ _csrf: csrf });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/plugins');
  });

  test('bulk deactivate works for inactive-safe selection', async () => {
    await pluginLoader.syncInstalledPlugins();
    const plugin = await models.Plugin.findOne({ where: { slug: 'cookie-notice' } });
    expect(plugin).toBeTruthy();
    await pluginLoader.activatePlugin('cookie-notice', app);

    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const csrf = await getCsrf(agent, '/admin/plugins');
    const res = await agent.post('/admin/plugins/bulk').type('form').send({
      _csrf: csrf,
      action: 'deactivate',
      'slugs[]': ['cookie-notice']
    });
    expect(res.status).toBe(302);
    await plugin.reload();
    expect(plugin.active).toBe(false);
  });

  test('plugins index shows list view and bulk toolbar markup', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/plugins');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Sync from disk/i);
    expect(res.text).toMatch(/np-plugin-table/i);
    expect(res.text).toMatch(/Bulk actions/i);
    expect(res.text).toMatch(/admin-plugins\.js/);
  });

  test('plugin detail page shows overview section', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/plugins/seo-booster');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Overview/i);
    expect(res.text).toMatch(/At a glance/i);
  });
});

describe('bulkDeactivate helper', () => {
  test('bulkActivate reports failure for missing plugin', async () => {
    const { bulkActivate } = require('../utils/pluginAdmin');
    const result = await bulkActivate(['missing-plugin-slug-xyz'], app);
    expect(result.failed.length).toBe(1);
    expect(result.succeeded.length).toBe(0);
  });
});
