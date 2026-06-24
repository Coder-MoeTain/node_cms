const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');

function isExcluded(pathname, excludePaths) {
  return excludePaths.some((rule) => {
    const trimmed = rule.trim();
    if (!trimmed) return false;
    return pathname === trimmed || pathname.startsWith(`${trimmed}/`);
  });
}

module.exports = {
  async register({ hooks, manifest }) {
    const settings = await loadPluginSettings(manifest.slug, manifest);
    const enabled = settingBool(settings.enabled, true);
    const maxAge = Number(settingValue(settings, 'max_age', '3600'));
    const cacheHome = settingBool(settings.cache_home, true);
    const cachePosts = settingBool(settings.cache_posts, true);
    const cacheStatic = settingBool(settings.cache_static, true);
    const excludePaths = settingValue(settings, 'exclude_paths', '/contact,/search,/admin')
      .split(',');

    hooks.register('cacheControl', (value, { req }) => {
      if (!enabled || req.method !== 'GET') return value;
      if (req.path.startsWith('/admin') || req.path.startsWith('/api')) return value;
      if (isExcluded(req.path, excludePaths)) return value;
      if (!cacheHome && (req.path === '/' || req.path === '')) return value;
      if (!cachePosts && req.path.startsWith('/post/')) return value;
      if (req.path.startsWith('/uploads/')) {
        return cacheStatic ? `public, max-age=${maxAge * 4}, immutable` : value;
      }
      return `public, max-age=${maxAge}, stale-while-revalidate=60`;
    });

    hooks.register('dashboardWidgets', () => ({
      title: 'Super Cache',
      body: enabled
        ? `Public pages cached for <strong>${maxAge}s</strong> in browsers.`
        : 'Caching headers are disabled.'
    }));
  }
};
