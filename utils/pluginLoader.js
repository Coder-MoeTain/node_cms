const fs = require('fs');
const path = require('path');
const { Plugin, PluginMigration } = require('../models');
const sequelize = require('../config/database');
const { seedPluginDefaults } = require('./pluginSettings');
const hookManager = require('./hookManager');

const pluginsRoot = path.join(process.cwd(), 'plugins');
let activePlugins = [];
let lastActivationErrors = new Map();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateManifest(manifest) {
  const required = ['name', 'slug', 'version'];
  for (const key of required) {
    if (!manifest[key] || typeof manifest[key] !== 'string') {
      throw new Error(`Plugin manifest is missing ${key}.`);
    }
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(manifest.slug)) {
    throw new Error(`Plugin slug "${manifest.slug}" must be lowercase alphanumeric with hyphens.`);
  }
  return manifest;
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
        return { path: pluginPath, manifest: validateManifest(readJson(manifestPath)) };
      } catch (error) {
        console.warn(`Skipping invalid plugin "${entry.name}": ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

async function upsertPluginRow(item) {
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
  const manifest = validateManifest(readJson(manifestPath));
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

async function loadActivePlugins(app = null) {
  hookManager.clear();
  lastActivationErrors = new Map();
  const discovered = await syncInstalledPlugins();
  const activeRows = await Plugin.findAll({ where: { active: true } });
  activePlugins = [];

  for (const row of activeRows) {
    const item = discovered.find((plugin) => plugin.manifest.slug === row.slug);
    if (!item) {
      lastActivationErrors.set(row.slug, 'Plugin files are missing from disk.');
      await Plugin.update({ active: false }, { where: { slug: row.slug } });
      continue;
    }
    try {
      await runPluginMigrations(row.slug);
      const mainFile = item.manifest.main || 'index.js';
      const entryPath = path.join(item.path, mainFile);
      if (!fs.existsSync(entryPath)) {
        throw new Error(`Plugin entry file ${mainFile} is missing.`);
      }
      delete require.cache[require.resolve(entryPath)];
      const plugin = require(entryPath);
      const hooks = hookManager.createPluginApi(row.slug);
      if (typeof plugin.register === 'function') {
        await plugin.register({ app, hooks, manifest: item.manifest });
      }
      activePlugins.push({ ...item, row });
    } catch (error) {
      lastActivationErrors.set(row.slug, error.message || 'Plugin failed to register.');
      await Plugin.update({ active: false }, { where: { slug: row.slug } });
    }
  }
  return activePlugins;
}

function getActivePlugins() {
  return activePlugins;
}

function getActivationErrors() {
  return new Map(lastActivationErrors);
}

async function activatePlugin(slug, app = null) {
  const plugin = await Plugin.findOne({ where: { slug } });
  if (!plugin) throw new Error('Plugin not found.');
  await runPluginMigrations(slug);
  if (plugin) await seedPluginDefaults(plugin, plugin.manifest || {});
  await Plugin.update({ active: true }, { where: { slug } });
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

async function deactivatePlugin(slug, app = null) {
  await invokePluginLifecycle(slug, 'onDeactivate', app);
  await Plugin.update({ active: false }, { where: { slug } });
  await loadActivePlugins(app);
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
  validateManifest,
  syncInstalledPlugins,
  syncPluginBySlug,
  runPluginMigrations,
  loadActivePlugins,
  activatePlugin,
  deactivatePlugin,
  getActivePlugins,
  getActivationErrors,
  getPluginManagerStats,
  getManifestBySlug,
  invokePluginLifecycle,
  registerHook,
  applyHook: hookManager.applyFilters,
  collectHook: hookManager.collect,
  addAction: hookManager.addAction,
  doAction: hookManager.doAction,
  addFilter: hookManager.addFilter,
  applyFilters: hookManager.applyFilters,
  listRegisteredHooks,
  removePluginDirectory,
  hookManager
};
