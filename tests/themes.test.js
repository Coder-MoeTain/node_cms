const themeLoader = require('../utils/themeLoader');
const themeManager = require('../utils/themeManager');

test('discoverThemes finds bundled themes', () => {
  const themes = themeLoader.discoverThemes();
  expect(themes.length).toBeGreaterThanOrEqual(10);
});

test('buildThemeSettingDefaults applies manifest colors', () => {
  const defaults = themeLoader.buildThemeSettingDefaults('dark-elegant');
  expect(defaults.dark_mode).toBe(true);
  expect(defaults.primary_color).toBe('#38bdf8');
});

test('government-portal theme includes portal config', () => {
  const defaults = themeLoader.buildThemeSettingDefaults('government-portal');
  expect(defaults.header_layout).toBe('portal');
  expect(defaults.custom_css).toContain('np-portal-config');
});

test('resolveTemplate maps category to archive fallback', async () => {
  const template = await themeManager.resolveTemplate('category');
  expect(template).toMatch(/archive|home/);
});

test('resolveTemplate falls back to public views', async () => {
  const template = await themeLoader.resolveTemplate('home');
  expect(template).toMatch(/home/);
});

test('resolvePartial falls back to public partials', async () => {
  const partial = await themeLoader.resolvePartial('header');
  expect(partial).toBe('public/partials/header');
});

test('getLayoutClasses builds body class string', () => {
  const classes = themeLoader.getLayoutClasses({
    header_layout: 'centered',
    footer_layout: 'minimal',
    sidebar_position: 'left',
    blog_layout: 'list',
    site_layout: 'boxed',
    dark_mode: true
  });
  expect(classes).toContain('header-layout-centered');
  expect(classes).toContain('footer-layout-minimal');
  expect(classes).toContain('theme-dark');
});

test('child theme manifest declares parent', () => {
  const child = themeLoader.discoverThemes().find((t) => t.manifest.slug === 'minimal-personal');
  expect(child?.manifest.parent).toBe('classic-blog');
});

test('discoverThemeAssets lists inheritance chain', () => {
  const assets = themeLoader.discoverThemeAssets('minimal-personal');
  expect(assets.chain).toContain('classic-blog');
  expect(Array.isArray(assets.templates)).toBe(true);
});

test('resolveThemePreviewImage finds bundled screenshot', () => {
  const image = themeLoader.resolveThemePreviewImage('classic-blog');
  expect(image).toMatch(/screenshot\.(svg|png|jpe?g|webp)$/);
});

test('validateManifest rejects invalid slug', () => {
  expect(() => themeLoader.validateManifest({ name: 'Bad', slug: 'Bad Theme', version: '1.0.0' }))
    .toThrow(/slug/i);
});
