const fs = require('fs');
const path = require('path');
const { Plugin, PluginMigration } = require('../models');
const sequelize = require('../config/database');

const pluginsRoot = path.join(process.cwd(), 'plugins');
const hooks = new Map();
let activePlugins = [];

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
      return { path: pluginPath, manifest: validateManifest(readJson(manifestPath)) };
    })
    .filter(Boolean);
}

async function syncInstalledPlugins() {
  const discovered = discoverPluginManifests();
  for (const item of discovered) {
    await Plugin.findOrCreate({
      where: { slug: item.manifest.slug },
      defaults: {
        name: item.manifest.name,
        version: item.manifest.version,
        description: item.manifest.description,
        author: item.manifest.author,
        manifest: item.manifest,
        installed: true
      }
    });
    await Plugin.update({
      name: item.manifest.name,
      version: item.manifest.version,
      description: item.manifest.description,
      author: item.manifest.author,
      manifest: item.manifest,
      installed: true
    }, { where: { slug: item.manifest.slug } });
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

function registerHook(name, handler, priority = 10) {
  const list = hooks.get(name) || [];
  list.push({ handler, priority });
  list.sort((a, b) => a.priority - b.priority);
  hooks.set(name, list);
}

async function applyHook(name, payload, context = {}) {
  let result = payload;
  for (const item of hooks.get(name) || []) {
    result = await item.handler(result, context);
  }
  return result;
}

async function collectHook(name, context = {}) {
  const output = [];
  for (const item of hooks.get(name) || []) {
    const value = await item.handler(context);
    if (Array.isArray(value)) output.push(...value);
    else if (value) output.push(value);
  }
  return output;
}

async function loadActivePlugins(app = null) {
  hooks.clear();
  const discovered = await syncInstalledPlugins();
  const activeRows = await Plugin.findAll({ where: { active: true } });
  activePlugins = [];

  for (const row of activeRows) {
    const item = discovered.find((plugin) => plugin.manifest.slug === row.slug);
    if (!item) continue;
    await runPluginMigrations(row.slug);
    const entryPath = path.join(item.path, 'index.js');
    if (!fs.existsSync(entryPath)) continue;
    delete require.cache[require.resolve(entryPath)];
    const plugin = require(entryPath);
    if (typeof plugin.register === 'function') {
      await plugin.register({ app, hooks: { register: registerHook }, manifest: item.manifest });
    }
    activePlugins.push({ ...item, row });
  }
  return activePlugins;
}

function getActivePlugins() {
  return activePlugins;
}

function listRegisteredHooks() {
  return [...hooks.keys()];
}

function removePluginDirectory(slug) {
  const dir = path.join(pluginsRoot, slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = {
  pluginsRoot,
  discoverPluginManifests,
  syncInstalledPlugins,
  runPluginMigrations,
  loadActivePlugins,
  getActivePlugins,
  registerHook,
  applyHook,
  collectHook,
  listRegisteredHooks,
  removePluginDirectory
};
