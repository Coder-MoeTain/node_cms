const { Plugin, PluginSetting } = require('../models');

function defaultsFromManifest(manifest) {
  const map = {};
  for (const field of manifest?.settings || []) {
    if (!field.key) continue;
    if (field.default !== undefined) map[field.key] = String(field.default);
    else if (field.type === 'checkbox') map[field.key] = 'false';
    else map[field.key] = '';
  }
  return map;
}

function resolvePluginSettings(stored, manifest) {
  const defaults = defaultsFromManifest(manifest);
  const merged = { ...defaults };
  for (const [key, value] of Object.entries(stored || {})) {
    if (value !== undefined && value !== null && value !== '') merged[key] = String(value);
  }
  return merged;
}

async function loadPluginSettings(slug, manifest = null) {
  const plugin = await Plugin.findOne({ where: { slug } });
  const manifestData = manifest || plugin?.manifest || {};
  if (!plugin) return defaultsFromManifest(manifestData);

  const rows = await PluginSetting.findAll({ where: { plugin_id: plugin.id } });
  const stored = rows.reduce((map, row) => {
    map[row.key] = row.value;
    return map;
  }, {});

  return resolvePluginSettings(stored, manifestData);
}

function settingBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === 'true' || value === 'on' || value === '1' || value === true;
}

function settingValue(settings, key, fallback = '') {
  const value = settings?.[key];
  if (value === undefined || value === null || value === '') return fallback;
  return value;
}

async function seedPluginDefaults(pluginRow, manifest) {
  const fields = manifest?.settings || [];
  for (const field of fields) {
    if (!field.key) continue;
    const defaultValue = field.default !== undefined
      ? String(field.default)
      : (field.type === 'checkbox' ? 'false' : '');
    await PluginSetting.findOrCreate({
      where: { plugin_id: pluginRow.id, key: field.key },
      defaults: {
        value: defaultValue,
        value_type: field.type === 'checkbox' ? 'boolean' : 'string'
      }
    });
  }
}

module.exports = {
  defaultsFromManifest,
  resolvePluginSettings,
  loadPluginSettings,
  settingBool,
  settingValue,
  seedPluginDefaults
};
