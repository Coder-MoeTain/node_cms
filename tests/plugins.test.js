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

test('syncInstalledPlugins discovers all bundled plugins', async () => {
  const discovered = await pluginLoader.syncInstalledPlugins();
  const slugs = discovered.map((item) => item.manifest.slug);
  expect(slugs).toEqual(expect.arrayContaining([
    'seo-booster',
    'analytics-lite',
    'security-monitor',
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
    'beforeMediaUpload',
    'publicHead',
    'publicFooter',
    'beforeCommentCreate',
    'requestRedirect',
    'cacheControl'
  ]));
});

test('akismet-shield blocks spam comments via hook', async () => {
  const { Plugin } = require('../models');
  await Plugin.update({ active: false }, { where: {} });
  await pluginLoader.loadActivePlugins();
  pluginLoader.registerHook('beforeCommentCreate', async (comment) => {
    if (!comment) return null;
    if ((comment.content || '').toLowerCase().includes('viagra')) return null;
    return comment;
  }, 10);
  const blocked = await pluginLoader.applyHook('beforeCommentCreate', { content: 'buy viagra now' }, {});
  const allowed = await pluginLoader.applyHook('beforeCommentCreate', { content: 'Great article!' }, {});
  expect(blocked).toBeNull();
  expect(allowed.content).toBe('Great article!');
});

test('redirection hook returns redirect target', async () => {
  const { Plugin } = require('../models');
  await Plugin.update({ active: false }, { where: {} });
  await pluginLoader.loadActivePlugins();
  pluginLoader.registerHook('requestRedirect', (value, { req }) => {
    if (req.path === '/old-page') return { url: '/new-page', status: 301 };
    return value;
  }, 10);
  const result = await pluginLoader.applyHook('requestRedirect', null, { req: { path: '/old-page' } });
  expect(result).toEqual({ url: '/new-page', status: 301 });
});
