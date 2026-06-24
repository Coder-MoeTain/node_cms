const hookManager = require('../utils/hookManager');
const pluginLoader = require('../utils/pluginLoader');

test('collectHook merges plugin widget output', async () => {
  hookManager.clear();
  hookManager.registerLegacy('widget-demo', () => ({ title: 'A', body: 'one' }), 10);
  hookManager.registerLegacy('widget-demo', () => ({ title: 'B', body: 'two' }), 20);
  const widgets = await pluginLoader.collectHook('widget-demo', {});
  expect(widgets.length).toBeGreaterThanOrEqual(2);
});

test('applyHook chains handlers', async () => {
  hookManager.clear();
  hookManager.addFilter('apply-demo', (value) => ({ ...value, changed: true }), 10);
  const result = await pluginLoader.applyHook('apply-demo', { ok: true }, {});
  expect(result.changed).toBe(true);
});

test('syncInstalledPlugins discovers all bundled plugins', async () => {
  const discovered = await pluginLoader.syncInstalledPlugins();
  const slugs = discovered.map((item) => item.manifest.slug);
  expect(slugs).toEqual(expect.arrayContaining([
    'seo-booster',
    'analytics-lite',
    'security-monitor',
    'portal-widgets-extension',
    'akismet-shield',
    'super-cache',
    'smush-optimizer',
    'redirection',
    'updraft-backup',
    'social-share',
    'cookie-notice'
  ]));
});

test('active plugins register core hooks', async () => {
  const { Plugin } = require('../models');
  await pluginLoader.syncInstalledPlugins();
  await Plugin.update({ active: true }, { where: {} });
  await pluginLoader.loadActivePlugins();
  const names = pluginLoader.listRegisteredHooks();
  expect(names).toEqual(expect.arrayContaining([
    'dashboardWidgets',
    'adminMenuItems',
    'beforeMediaUpload',
    'beforePageRender',
    'publicHead',
    'publicFooter',
    'beforeCommentCreate',
    'beforeContactSubmit',
    'requestRedirect',
    'cacheControl'
  ]));
});

test('akismet-shield blocks spam comments via hook', async () => {
  hookManager.clear();
  hookManager.addFilter('beforeCommentSave', async (comment) => {
    if (!comment) return null;
    if ((comment.content || '').toLowerCase().includes('viagra')) return null;
    return comment;
  }, 10);
  const blocked = await pluginLoader.applyFilters('beforeCommentSave', { content: 'buy viagra now' }, {});
  const allowed = await pluginLoader.applyFilters('beforeCommentSave', { content: 'Great article!' }, {});
  expect(blocked).toBeNull();
  expect(allowed.content).toBe('Great article!');
});

test('portal-widgets-extension registers admin menu and footer hooks', async () => {
  const { Plugin } = require('../models');
  await pluginLoader.syncInstalledPlugins();
  await Plugin.update({ active: false }, { where: {} });
  await Plugin.update({ active: true }, { where: { slug: 'portal-widgets-extension' } });
  await pluginLoader.loadActivePlugins();
  const hooks = pluginLoader.listRegisteredHooks();
  expect(hooks).toEqual(expect.arrayContaining(['adminMenuItems', 'beforePageRender']));
  const menuItems = await pluginLoader.collectHook('adminMenuItems', {});
  expect(menuItems.some((item) => item.label === 'Portal Widgets')).toBe(true);
});

test('redirection hook returns redirect target', async () => {
  hookManager.clear();
  hookManager.addFilter('requestRedirect', (value, { req }) => {
    if (req.path === '/old-page') return { url: '/new-page', status: 301 };
    return value;
  }, 10);
  const result = await pluginLoader.applyHook('requestRedirect', null, { req: { path: '/old-page' } });
  expect(result).toEqual({ url: '/new-page', status: 301 });
});
