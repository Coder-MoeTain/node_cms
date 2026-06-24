const themeLoader = require('../utils/themeLoader');

test('discoverThemes finds bundled themes', () => {
  const themes = themeLoader.discoverThemes();
  expect(themes.length).toBeGreaterThanOrEqual(3);
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
