const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');

let hitCount = 0;

function parseRules(raw) {
  if (!raw || !raw.trim()) return [];
  try {
    const rules = JSON.parse(raw);
    return Array.isArray(rules) ? rules : [];
  } catch {
    return [];
  }
}

function pathMatches(rule, pathname, caseSensitive) {
  const from = caseSensitive ? rule.from : rule.from.toLowerCase();
  const path = caseSensitive ? pathname : pathname.toLowerCase();
  const mode = rule.match || 'exact';

  if (mode === 'prefix') {
    return path === from || path.startsWith(`${from}/`);
  }
  return path === from || path === `${from}/`;
}

function buildTarget(rule, req) {
  let target = rule.to;
  if (rule.preserve_query && req.originalUrl.includes('?')) {
    const query = req.originalUrl.split('?')[1];
    target += (target.includes('?') ? '&' : '?') + query;
  }
  return target;
}

module.exports = {
  async register({ hooks, manifest }) {
    const settings = await loadPluginSettings(manifest.slug, manifest);
    const enabled = settingBool(settings.enabled, true);
    const caseSensitive = settingBool(settings.case_sensitive, false);
    const defaultStatus = Number(settingValue(settings, 'default_status', '301'));
    const logHits = settingBool(settings.log_hits, false);
    const rules = parseRules(settingValue(settings, 'rules', '[]'));

    hooks.register('requestRedirect', (value, { req }) => {
      if (!enabled) return value;
      for (const rule of rules) {
        if (!rule.from || !rule.to) continue;
        if (!pathMatches(rule, req.path, caseSensitive)) continue;
        if (logHits) hitCount += 1;
        return {
          url: buildTarget(rule, req),
          status: Number(rule.status) || defaultStatus
        };
      }
      return value;
    }, 10);

    hooks.register('dashboardWidgets', () => ({
      title: 'URL Redirects',
      body: rules.length
        ? `<strong>${rules.length}</strong> redirect rule(s) active${logHits ? ` · <strong>${hitCount}</strong> hits this session` : ''}.`
        : 'Add redirect rules in plugin settings (JSON format).'
    }));
  }
};
