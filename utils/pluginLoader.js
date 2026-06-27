const fs = require('fs');
const path = require('path');
const express = require('express');
const { Plugin, PluginMigration } = require('../models');
const sequelize = require('../config/database');
const { seedPluginDefaults } = require('./pluginSettings');
const hookManager = require('./hookManager');
const pluginValidator = require('./pluginValidator');

const pluginsRoot = path.join(process.cwd(), 'plugins');
let activePlugins = [];
let lastActivationErrors = new Map();
const registeredRoutes = [];
const registeredAssetMounts = new Set();

function isSafeMode() {
  return process.env.PLUGIN_SAFE_MODE === 'true' || process.env.PLUGIN_SAFE_MODE === '1';
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateManifest(manifest, options = {}) {
  return pluginValidator.validateManifest(manifest, options);
}

function discoverPluginManifests() {
  if (!fs.existsSync(pluginsRoot)) return [];
  return fs.readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => {
      const pluginPath = path.join(pluginsRoot, entry.name);
      const manifestPath = path.join(pluginPath, 'plugin.json');
      if (!fs.existsSync(manifestPath)) return null;
      try {
        return { path: pluginPath, manifest: validateManifest(readJson(manifestPath), { pluginPath, strict: false }) };
      } catch (error) {
        console.warn(`Skipping invalid plugin "${entry.name}": ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

async function upsertPluginRow(item) {
  try {
    validateManifest(item.manifest, { pluginPath: item.path, strict: true });
  } catch (error) {
    console.warn(`Skipping invalid plugin "${item.manifest?.slug || 'unknown'}": ${error.message}`);
    return null;
  }

  const payload = {
    name: item.manifest.name,
    version: item.manifest.version,
    description: item.manifest.description,
    author: item.manifest.author,
    manifest: item.manifest,
    installed: true
  };

  let pluginRow = await Plugin.findOne({ where: { slug: item.manifest.slug } });
  if (!pluginRow) {
    try {
      [pluginRow] = await Plugin.findOrCreate({
        where: { slug: item.manifest.slug },
        defaults: payload
      });
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') throw error;
      pluginRow = await Plugin.findOne({ where: { slug: item.manifest.slug } });
    }
  }

  if (pluginRow) {
    await pluginRow.update(payload);
    await seedPluginDefaults(pluginRow, item.manifest);
  }
  return pluginRow;
}

async function syncPluginBySlug(slug) {
  const manifestPath = path.join(pluginsRoot, slug, 'plugin.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = validateManifest(readJson(manifestPath), { pluginPath: path.join(pluginsRoot, slug), strict: false });
  return upsertPluginRow({ path: path.join(pluginsRoot, slug), manifest });
}

async function syncInstalledPlugins() {
  const discovered = discoverPluginManifests();
  for (const item of discovered) {
    await upsertPluginRow(item);
  }
  return discovered;
}

async function runPluginMigrations(pluginSlug) {
  const plugin = await Plugin.findOne({ where: { slug: pluginSlug } });
  if (!plugin) return [];

  const migrationsDir = path.join(pluginsRoot, pluginSlug, 'migrations');
  if (!fs.existsSync(migrationsDir)) return [];

  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const ran = [];
  const maxBatch = await PluginMigration.max('batch');
  const batch = Number(maxBatch || 0) + 1;

  for (const file of files) {
    const existing = await PluginMigration.findOne({
      where: { plugin_id: plugin.id, migration: file }
    });
    if (existing) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const statement of statements) {
      await sequelize.query(statement);
    }
    await PluginMigration.create({
      plugin_id: plugin.id,
      migration: file,
      batch,
      ran_at: new Date()
    });
    ran.push(file);
  }
  return ran;
}

async function markPluginError(slug, message) {
  lastActivationErrors.set(slug, message);
  try {
    await Plugin.update({ active: false, error_state: 'error', last_error: message }, { where: { slug } });
  } catch {
    await Plugin.update({ active: false }, { where: { slug } });
  }
}

async function clearPluginError(slug) {
  lastActivationErrors.delete(slug);
  try {
    await Plugin.update({ error_state: 'none', last_error: null }, { where: { slug } });
  } catch {
    // columns may be missing on older DBs
  }
}

async function checkPluginDependencies(manifest) {
  const deps = manifest.dependencies || [];
  for (const dep of deps) {
    const slug = typeof dep === 'string' ? dep : dep.slug;
    if (!slug) continue;
    const row = await Plugin.findOne({ where: { slug, active: true } });
    if (!row) {
      throw new Error(`Plugin "${manifest.slug}" requires active dependency "${slug}".`);
    }
  }
}

function registerPluginAssets(app) {
  if (!app) return;
  for (const item of activePlugins) {
    const slug = item.manifest.slug;
    for (const sub of ['public', 'assets']) {
      const assetDir = path.join(item.path, sub);
      if (!fs.existsSync(assetDir)) continue;
      const mount = `/plugins/${slug}/${sub}`;
      if (registeredAssetMounts.has(mount)) continue;
      app.use(mount, express.static(assetDir));
      registeredAssetMounts.add(mount);
    }
  }
}

function registerPluginRoutes(app) {
  if (!app) return;
  const { requireAuth } = require('../middleware/auth');
  const { canAny } = require('../middleware/permission');

  for (const entry of registeredRoutes) {
    const { method, routePath, handler, admin, pluginSlug, permissions } = entry;
    const wrapped = async (req, res, next) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Plugin route error (${pluginSlug}): ${error.message}`);
        }
        return next(error);
      }
    };
    const adminPermissions = Array.isArray(permissions) && permissions.length ? permissions : ['manage_plugins'];
    const middlewares = admin ? [requireAuth, canAny(adminPermissions), wrapped] : [wrapped];
    app[method.toLowerCase()](routePath, ...middlewares);
  }
}

function trackPluginRoute(pluginSlug, method, routePath, handler, { admin = false, permissions = null } = {}) {
  registeredRoutes.push({ pluginSlug, method, routePath, handler, admin, permissions });
}

async function loadActivePlugins(app = null) {
  hookManager.clear();
  lastActivationErrors = new Map();
  registeredRoutes.length = 0;
  registeredAssetMounts.clear();
  if (isSafeMode()) {
    activePlugins = [];
    return activePlugins;
  }

  const discovered = await syncInstalledPlugins();
  const activeRows = await Plugin.findAll({ where: { active: true } });
  activePlugins = [];

  for (const row of activeRows) {
    const item = discovered.find((plugin) => plugin.manifest.slug === row.slug);
    if (!item) {
      await markPluginError(row.slug, 'Plugin files are missing from disk.');
      continue;
    }
    try {
      validateManifest(item.manifest, { pluginPath: item.path, strict: false });
      await runPluginMigrations(row.slug);
      const mainFile = item.manifest.main || 'index.js';
      const entryPath = path.join(item.path, mainFile);
      if (!fs.existsSync(entryPath)) {
        throw new Error(`Plugin entry file ${mainFile} is missing.`);
      }
      delete require.cache[require.resolve(entryPath)];
      const plugin = require(entryPath);
      const hooks = hookManager.createPluginApi(row.slug);
      hooks.registerRoute = (method, routePath, handler, opts) => trackPluginRoute(row.slug, method, routePath, handler, {
        ...opts,
        permissions: item.manifest.permissions
      });
      if (typeof plugin.register === 'function') {
        await plugin.register({ app, hooks, manifest: item.manifest });
      }
      activePlugins.push({ ...item, row, module: plugin });
      await clearPluginError(row.slug);
    } catch (error) {
      await markPluginError(row.slug, error.message || 'Plugin failed to register.');
    }
  }

  registerPluginAssets(app);
  registerPluginRoutes(app);
  return activePlugins;
}

function getActivePlugins() {
  return activePlugins;
}

function getActivationErrors() {
  return new Map(lastActivationErrors);
}

async function activatePlugin(slug, app = null, user = null) {
  const plugin = await Plugin.findOne({ where: { slug } });
  if (!plugin) throw new Error('Plugin not found.');

  const item = discoverPluginManifests().find((p) => p.manifest.slug === slug);
  if (!item) throw new Error('Plugin files are missing from disk.');

  validateManifest(item.manifest, { pluginPath: item.path, strict: true });
  await checkPluginDependencies(item.manifest);
  await runPluginMigrations(slug);
  if (plugin) await seedPluginDefaults(plugin, plugin.manifest || item.manifest || {});
  await Plugin.update({ active: true, error_state: 'none', last_error: null }, { where: { slug } });
  await invokePluginLifecycle(slug, 'onActivate', app);
  await loadActivePlugins(app);
  const error = lastActivationErrors.get(slug);
  if (error) throw new Error(error);
  return plugin;
}

function listRegisteredHooks() {
  return hookManager.listRegisteredHooks();
}

async function invokePluginLifecycle(slug, event, app = null) {
  const manifest = getManifestBySlug(slug);
  const mainFile = manifest?.main || 'index.js';
  const entryPath = path.join(pluginsRoot, slug, mainFile);
  if (!fs.existsSync(entryPath)) return;
  delete require.cache[require.resolve(entryPath)];
  const plugin = require(entryPath);
  if (typeof plugin[event] === 'function') {
    await plugin[event]({ app, manifest });
  }
}

function getManifestBySlug(slug) {
  const item = discoverPluginManifests().find((plugin) => plugin.manifest.slug === slug);
  return item?.manifest || null;
}

async function getPluginManagerStats() {
  const discovered = discoverPluginManifests();
  const rows = await Plugin.findAll();
  const active = rows.filter((row) => row.active).length;
  return {
    total: discovered.length,
    active,
    inactive: discovered.length - active,
    hooks: listRegisteredHooks().length
  };
}

async function checkPluginDependents(slug) {
  const activeRows = await Plugin.findAll({ where: { active: true } });
  for (const row of activeRows) {
    if (row.slug === slug) continue;
    const manifest = row.manifest || getManifestBySlug(row.slug);
    if (!manifest) continue;
    for (const dep of manifest.dependencies || []) {
      const depSlug = typeof dep === 'string' ? dep : dep.slug;
      if (depSlug === slug) {
        throw new Error(`Cannot deactivate "${slug}": active plugin "${manifest.slug}" depends on it.`);
      }
    }
  }
}

async function deactivatePlugin(slug, app = null, user = null) {
  await checkPluginDependents(slug);
  await invokePluginLifecycle(slug, 'onDeactivate', app);
  await Plugin.update({ active: false }, { where: { slug } });
  await clearPluginError(slug);
  await loadActivePlugins(app);
}

async function uninstallPlugin(slug, app = null, user = null, options = {}) {
  const { PluginSetting, PluginMigration } = require('../models');
  const plugin = await Plugin.findOne({ where: { slug } });
  if (!plugin) throw new Error('Plugin not found.');
  if (plugin.active) throw new Error('Deactivate the plugin before uninstalling.');
  await invokePluginLifecycle(slug, 'onUninstall', app);
  if (options.removeData !== false) {
    await PluginMigration.destroy({ where: { plugin_id: plugin.id } });
    await PluginSetting.destroy({ where: { plugin_id: plugin.id } });
  }
  await plugin.destroy();
  removePluginDirectory(slug);
  await loadActivePlugins(app);
  return true;
}

function discoverPlugins() {
  return discoverPluginManifests();
}

function getPlugin(slug) {
  const item = discoverPluginManifests().find((p) => p.manifest.slug === slug);
  if (!item) return null;
  return item;
}

async function validatePlugin(slug) {
  const item = getPlugin(slug);
  if (!item) return { valid: false, errors: ['Plugin not found on disk.'] };
  try {
    validateManifest(item.manifest, { pluginPath: item.path, strict: true });
    return { valid: true, errors: [], manifest: item.manifest };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

async function getPluginHealth(slug) {
  const row = await Plugin.findOne({ where: { slug } });
  const disk = getPlugin(slug);
  const activationError = lastActivationErrors.get(slug) || row?.last_error || null;
  return {
    slug,
    active: Boolean(row?.active),
    installed: Boolean(row?.installed),
    error_state: row?.error_state || (activationError ? 'error' : 'none'),
    last_error: activationError,
    on_disk: Boolean(disk),
    update_available: Boolean(row?.update_available),
    latest_version: row?.latest_version || null
  };
}

async function reloadPlugin(slug, app = null) {
  await loadActivePlugins(app);
  return getPluginHealth(slug);
}

async function getPluginSettings(slug) {
  const { loadPluginSettings } = require('./pluginSettings');
  const plugin = await Plugin.findOne({ where: { slug } });
  return loadPluginSettings(slug, plugin?.manifest || {});
}

async function savePluginSettings(slug, settings, user = null) {
  const { PluginSetting } = require('../models');
  const { resolvePluginSettings } = require('./pluginSettings');
  const plugin = await Plugin.findOne({ where: { slug } });
  if (!plugin) throw new Error('Plugin not found.');
  const manifest = plugin.manifest || {};
  const fields = manifest._normalizedSettings || manifest.settings || [];
  const fieldMap = Array.isArray(fields)
    ? fields.reduce((m, f) => { if (f.key) m[f.key] = f; return m; }, {})
    : fields;

  for (const [key, value] of Object.entries(settings || {})) {
    const field = fieldMap[key];
    if (field) validateSettingValue(field, value);
    await PluginSetting.upsert({
      plugin_id: plugin.id,
      key,
      value: String(value ?? ''),
      value_type: field?.type === 'checkbox' || field?.type === 'boolean' ? 'boolean' : 'string'
    });
  }
  return resolvePluginSettings(settings, manifest);
}

function validateSettingValue(field, value) {
  const type = field.type || 'text';
  if (type === 'boolean' || type === 'checkbox') return;
  if (type === 'number' || type === 'range') {
    if (value !== '' && Number.isNaN(Number(value))) throw new Error(`Invalid number for ${field.key}.`);
    return;
  }
  if (type === 'color' && value && !/^#[0-9a-f]{3,8}$/i.test(String(value))) {
    throw new Error(`Invalid color for ${field.key}.`);
  }
  if (type === 'select' && field.options && !field.options.includes(value)) {
    throw new Error(`Invalid option for ${field.key}.`);
  }
}

async function rollbackPluginMigration(slug, migrationId) {
  throw new Error('Plugin migration rollback is not supported for SQL migrations.');
}

function getPluginDiskInfo(slug) {
  const { getPluginDiskInfo: diskInfo } = require('./pluginAdmin');
  return diskInfo(slug);
}

function removePluginDirectory(slug) {
  const dir = path.join(pluginsRoot, slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function registerHook(name, handler, priority = 10) {
  return hookManager.registerLegacy(name, handler, priority);
}

module.exports = {
  pluginsRoot,
  discoverPluginManifests,
  discoverPlugins,
  validateManifest,
  syncInstalledPlugins,
  syncPluginBySlug,
  runPluginMigrations,
  rollbackPluginMigration,
  loadActivePlugins,
  activatePlugin,
  deactivatePlugin,
  uninstallPlugin,
  getActivePlugins,
  getActivationErrors,
  getPluginManagerStats,
  getManifestBySlug,
  getPlugin,
  validatePlugin,
  getPluginHealth,
  reloadPlugin,
  getPluginSettings,
  savePluginSettings,
  invokePluginLifecycle,
  registerHook,
  registerPluginRoutes,
  registerPluginAssets,
  isSafeMode,
  applyHook: hookManager.applyFilters,
  collectHook: hookManager.collect,
  addAction: hookManager.addAction,
  doAction: hookManager.doAction,
  addFilter: hookManager.addFilter,
  applyFilters: hookManager.applyFilters,
  removeAction: hookManager.removeAction,
  removeFilter: hookManager.removeFilter,
  hasHook: hookManager.hasHook,
  listHooks: hookManager.listHooks,
  clearHooks: hookManager.clearHooks,
  listRegisteredHooks,
  removePluginDirectory,
  hookManager
};
