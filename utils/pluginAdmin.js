const fs = require('fs');
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const pluginLoader = require('./pluginLoader');

const PLUGIN_ICONS = {
  'seo-booster': 'bi-search',
  'analytics-lite': 'bi-graph-up',
  'cookie-notice': 'bi-shield-check',
  'cache-booster': 'bi-lightning',
  'akismet-lite': 'bi-chat-dots',
  'portal-widgets': 'bi-grid',
  'maintenance-mode': 'bi-tools',
  'smtp-mailer': 'bi-envelope',
  'redirect-manager': 'bi-signpost-split',
  'security-headers': 'bi-lock',
  'sitemap-generator': 'bi-diagram-3'
};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function getPluginDiskInfo(slug) {
  const dir = path.join(pluginLoader.pluginsRoot, slug);
  if (!fs.existsSync(dir)) {
    return { exists: false, fileCount: 0, sizeBytes: 0, sizeLabel: '0 B', modifiedAt: null };
  }

  let fileCount = 0;
  let sizeBytes = 0;
  let modifiedAt = null;

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      fileCount += 1;
      const stat = fs.statSync(full);
      sizeBytes += stat.size;
      if (!modifiedAt || stat.mtime > modifiedAt) modifiedAt = stat.mtime;
    }
  }

  walk(dir);
  return {
    exists: true,
    fileCount,
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes),
    modifiedAt
  };
}

function getPendingMigrationFiles(slug, applied = []) {
  const migrationsDir = path.join(pluginLoader.pluginsRoot, slug, 'migrations');
  if (!fs.existsSync(migrationsDir)) return [];
  const appliedNames = new Set((applied || []).map((row) => row.migration || row));
  return fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .filter((file) => !appliedNames.has(file));
}

function getPluginIcon(slug, manifest = {}) {
  if (manifest.icon) return manifest.icon.startsWith('bi-') ? manifest.icon : `bi-${manifest.icon}`;
  return PLUGIN_ICONS[slug] || 'bi-plug';
}

function renderSimpleMarkdown(source) {
  if (!source) return '';
  const escaped = sanitizeHtml(source, { allowedTags: [], allowedAttributes: {} });
  let html = escaped
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
    .replace(/^(?:-|\*) (.+)$/gm, '<li>$1</li>');

  html = html.replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`);
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p><\/p>/g, '');

  return sanitizeHtml(html, {
    allowedTags: ['h1', 'h2', 'h3', 'p', 'ul', 'li', 'strong', 'em', 'code', 'a', 'br'],
    allowedAttributes: { a: ['href', 'rel', 'target'] }
  });
}

function readPluginReadme(slug) {
  const candidates = ['README.md', 'readme.md', 'Readme.md'];
  for (const name of candidates) {
    const filePath = path.join(pluginLoader.pluginsRoot, slug, name);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return { raw, html: renderSimpleMarkdown(raw), filename: name };
    }
  }
  return null;
}

function enrichPlugin(plugin, options = {}) {
  const plain = plugin.get ? plugin.get({ plain: true }) : { ...plugin };
  const diskManifest = pluginLoader.getManifestBySlug(plain.slug);
  const disk = getPluginDiskInfo(plain.slug);
  const pendingMigrations = getPendingMigrationFiles(plain.slug, plain.migrations || []);
  const manifest = plain.manifest || diskManifest || {};
  const manifestHooks = manifest.hooks || [];
  const settingsFields = manifest.settings || [];

  return {
    ...plain,
    diskManifest,
    disk,
    pendingMigrations,
    pendingMigrationCount: pendingMigrations.length,
    settingsCount: settingsFields.length,
    declaredHooksCount: manifestHooks.length,
    icon: getPluginIcon(plain.slug, manifest),
    hasActivationError: Boolean(options.activationErrors?.[plain.slug] || plain.error_state === 'error'),
    activationError: options.activationErrors?.[plain.slug] || plain.last_error || null,
    error_state: plain.error_state || (options.activationErrors?.[plain.slug] ? 'error' : 'none'),
    update_available: Boolean(plain.update_available),
    latest_version: plain.latest_version || null,
    hasSettings: settingsFields.length > 0,
    entryFile: (diskManifest && diskManifest.main) || manifest.main || 'index.js',
    homepage: manifest.homepage || manifest.plugin_uri || null,
    requires: manifest.requires || manifest.nodepress_version || null
  };
}

async function bulkActivate(slugs, app) {
  const results = { succeeded: [], failed: [] };
  for (const slug of slugs) {
    try {
      await pluginLoader.activatePlugin(slug, app);
      results.succeeded.push(slug);
    } catch (error) {
      results.failed.push({ slug, error: error.message || 'Activation failed' });
    }
  }
  return results;
}

async function bulkDeactivate(slugs, app) {
  const results = { succeeded: [], failed: [] };
  for (const slug of slugs) {
    try {
      await pluginLoader.deactivatePlugin(slug, app);
      results.succeeded.push(slug);
    } catch (error) {
      results.failed.push({ slug, error: error.message || 'Deactivation failed' });
    }
  }
  return results;
}

async function bulkUninstall(slugs, app) {
  const { Plugin, PluginSetting, PluginMigration } = require('../models');
  const results = { succeeded: [], failed: [] };

  for (const slug of slugs) {
    try {
      const plugin = await Plugin.findOne({ where: { slug } });
      if (!plugin) {
        results.failed.push({ slug, error: 'Plugin not found' });
        continue;
      }
      if (plugin.active) {
        results.failed.push({ slug, error: 'Deactivate before deleting' });
        continue;
      }
      await pluginLoader.invokePluginLifecycle(slug, 'onUninstall', app);
      await PluginMigration.destroy({ where: { plugin_id: plugin.id } });
      await PluginSetting.destroy({ where: { plugin_id: plugin.id } });
      await plugin.destroy();
      pluginLoader.removePluginDirectory(slug);
      results.succeeded.push(slug);
    } catch (error) {
      results.failed.push({ slug, error: error.message || 'Delete failed' });
    }
  }
  return results;
}

module.exports = {
  formatBytes,
  getPluginDiskInfo,
  getPendingMigrationFiles,
  getPluginIcon,
  renderSimpleMarkdown,
  readPluginReadme,
  enrichPlugin,
  bulkActivate,
  bulkDeactivate,
  bulkUninstall
};
