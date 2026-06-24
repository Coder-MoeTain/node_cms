const themeManager = require('../utils/themeManager');

test('validateThemeForActivation accepts classic-blog', () => {
  const result = themeManager.validateThemeForActivation('classic-blog');
  expect(result.manifest.slug).toBe('classic-blog');
});

test('validateThemeForActivation rejects unknown theme', () => {
  expect(() => themeManager.validateThemeForActivation('does-not-exist-theme'))
    .toThrow(/not installed/i);
});

test('normalizeTemplateName maps category and tag to archive', () => {
  expect(themeManager.normalizeTemplateName('category')).toBe('archive');
  expect(themeManager.normalizeTemplateName('tag')).toBe('archive');
  expect(themeManager.normalizeTemplateName('404')).toBe('error');
});

test('templateAvailable checks chain and public fallbacks', () => {
  expect(themeManager.templateAvailable('classic-blog', 'home')).toBe(true);
  expect(themeManager.templateAvailable('classic-blog', 'contact')).toBe(true);
});

test('discoverThemeAssets includes nested css assets', () => {
  const assets = themeManager.discoverThemeAssets('classic-blog');
  expect(assets.assets.some((url) => url.includes('/assets/css/theme.css'))).toBe(true);
});

test('myanmar-portal theme is discoverable', () => {
  const themes = themeManager.discoverThemes();
  expect(themes.some((theme) => theme.manifest.slug === 'myanmar-portal')).toBe(true);
});

test('scanThemeDirectory flags blocked extensions', () => {
  const theme = themeManager.getThemeBySlug('classic-blog');
  expect(themeManager.scanThemeDirectory(theme.path)).toEqual([]);
});
