const pkg = require('../package.json');
const appConfig = require('../config/app');
const models = require('../models');

const { assertSafeOutboundUrlResolved } = require('./ssrfGuard');

async function checkCoreUpdates() {
  const current = pkg.version;
  let latest = current;
  let message = 'You are running the latest known version.';
  let available = false;

  if (appConfig.updateCheckUrl) {
    try {
      await assertSafeOutboundUrlResolved(appConfig.updateCheckUrl, { allowHttp: appConfig.env !== 'production' });
      const res = await fetch(appConfig.updateCheckUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        latest = data.version || data.latest || current;
        available = latest !== current;
        message = available ? `Version ${latest} is available.` : message;
      }
    } catch (error) {
      message = `Could not reach update server: ${error.message}`;
    }
  }

  await models.UpdateLog.create({
    component_type: 'core',
    component_slug: 'nodepress-cms',
    from_version: current,
    to_version: latest,
    status: available ? 'available' : 'checked',
    message
  });

  return { current, latest, available, message };
}

async function checkPluginUpdates() {
  const plugins = await models.Plugin.findAll({ where: { installed: true } });
  return plugins.map((plugin) => ({
    slug: plugin.slug,
    name: plugin.name,
    current: plugin.version,
    latest: plugin.latest_version || plugin.version,
    available: Boolean(plugin.update_available),
    updateUrl: plugin.manifest?.updateUrl || null,
    changelogUrl: plugin.manifest?.changelogUrl || null,
    lastCheckedAt: plugin.last_checked_at || null
  }));
}

async function checkThemeUpdates() {
  const { discoverThemes } = require('./themeLoader');
  const themes = discoverThemes();
  const rows = await models.Theme.findAll();
  const rowMap = new Map(rows.map((r) => [r.slug, r]));
  return themes.map((theme) => {
    const slug = theme.manifest?.slug;
    const row = rowMap.get(slug);
    return {
      slug,
      name: theme.manifest?.name || slug,
      current: theme.manifest?.version || '1.0.0',
      latest: row?.latest_version || theme.manifest?.version || '1.0.0',
      available: Boolean(row?.update_available),
      updateUrl: theme.manifest?.updateUrl || null,
      changelogUrl: theme.manifest?.changelogUrl || null,
      lastCheckedAt: row?.last_checked_at || null
    };
  });
}

async function runUpdateCheck() {
  const [core, plugins, themes] = await Promise.all([
    checkCoreUpdates(),
    checkPluginUpdates(),
    checkThemeUpdates()
  ]);
  return { core, plugins, themes };
}

module.exports = { runUpdateCheck, checkCoreUpdates };
