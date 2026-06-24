const pluginLoader = require('../utils/pluginLoader');

test('collectHook merges plugin widget output', async () => {
  pluginLoader.registerHook('widget-demo', () => ({ title: 'A', body: 'one' }), 10);
  pluginLoader.registerHook('widget-demo', () => ({ title: 'B', body: 'two' }), 20);
  const widgets = await pluginLoader.collectHook('widget-demo', {});
  expect(widgets.length).toBeGreaterThanOrEqual(2);
});

test('applyHook chains handlers', async () => {
  pluginLoader.registerHook('apply-demo', (value) => ({ ...value, changed: true }), 10);
  const result = await pluginLoader.applyHook('apply-demo', { ok: true }, {});
  expect(result.changed).toBe(true);
});

test('syncInstalledPlugins discovers sample plugins', async () => {
  const discovered = await pluginLoader.syncInstalledPlugins();
  const slugs = discovered.map((item) => item.manifest.slug);
  expect(slugs).toEqual(expect.arrayContaining(['seo-booster', 'analytics-lite', 'security-monitor']));
});

test('active plugins register dashboard and media hooks', async () => {
  await pluginLoader.loadActivePlugins();
  const names = pluginLoader.listRegisteredHooks();
  expect(names).toEqual(expect.arrayContaining(['dashboardWidgets', 'beforeMediaUpload']));
});
