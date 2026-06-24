const fs = require('fs');
const path = require('path');
const { Plugin, PluginSetting, PluginMigration } = require('../../models');
const pluginLoader = require('../../utils/pluginLoader');
const { resolvePluginSettings, seedPluginDefaults } = require('../../utils/pluginSettings');
const { extractZipArchive } = require('../../utils/packageArchive');

async function index(req, res, next) {
  try {
    await pluginLoader.syncInstalledPlugins();
    const [plugins, stats, registeredHooks] = await Promise.all([
      Plugin.findAll({ order: [['name', 'ASC']] }),
      pluginLoader.getPluginManagerStats(),
      Promise.resolve(pluginLoader.listRegisteredHooks())
    ]);
    return res.render('admin/plugins/index', {
      title: 'Plugins',
      plugins,
      stats,
      registeredHooks
    });
  } catch (error) {
    return next(error);
  }
}

async function upload(req, res, next) {
  try {
    if (!req.file) {
      req.flash('error', 'Choose a plugin .zip archive to upload.');
      return res.redirect('/admin/plugins');
    }
    const { manifest } = await extractZipArchive(req.file.path, pluginLoader.pluginsRoot, 'plugin.json');
    await pluginLoader.syncInstalledPlugins();
    await pluginLoader.runPluginMigrations(manifest.slug);
    req.flash('success', `Plugin "${manifest.name}" installed successfully.`);
    return res.redirect('/admin/plugins');
  } catch (error) {
    req.flash('error', error.message || 'Plugin upload failed.');
    return res.redirect('/admin/plugins');
  }
}

async function activate(req, res, next) {
  try {
    const slug = req.params.slug;
    const plugin = await Plugin.findOne({ where: { slug } });
    await pluginLoader.runPluginMigrations(slug);
    if (plugin) await seedPluginDefaults(plugin, plugin.manifest || {});
    await Plugin.update({ active: true }, { where: { slug } });
    await pluginLoader.loadActivePlugins(req.app);
    req.flash('success', 'Plugin activated.');
    return res.redirect('/admin/plugins');
  } catch (error) {
    return next(error);
  }
}

async function deactivate(req, res, next) {
  try {
    await pluginLoader.deactivatePlugin(req.params.slug, req.app);
    req.flash('success', 'Plugin deactivated.');
    return res.redirect('/admin/plugins');
  } catch (error) {
    return next(error);
  }
}

async function uninstall(req, res, next) {
  try {
    const plugin = await Plugin.findOne({ where: { slug: req.params.slug } });
    if (!plugin) {
      req.flash('error', 'Plugin not found.');
      return res.redirect('/admin/plugins');
    }
    if (plugin.active) {
      req.flash('error', 'Deactivate the plugin before uninstalling.');
      return res.redirect('/admin/plugins');
    }
    await PluginMigration.destroy({ where: { plugin_id: plugin.id } });
    await PluginSetting.destroy({ where: { plugin_id: plugin.id } });
    await plugin.destroy();
    pluginLoader.removePluginDirectory(plugin.slug);
    req.flash('success', 'Plugin removed.');
    return res.redirect('/admin/plugins');
  } catch (error) {
    return next(error);
  }
}

async function settings(req, res, next) {
  try {
    const plugin = await Plugin.findOne({
      where: { slug: req.params.slug },
      include: [{ model: PluginSetting, as: 'settings' }]
    });
    if (!plugin) return res.status(404).render('errors/404', { title: 'Plugin Not Found' });

    const manifest = plugin.manifest || {};
    const storedMap = {};
    (plugin.settings || []).forEach((setting) => { storedMap[setting.key] = setting.value; });
    const settingsMap = resolvePluginSettings(storedMap, manifest);

    const fields = (manifest.settings || []).length
      ? manifest.settings
      : [
        { key: 'note', label: 'Enabled Note', type: 'text', placeholder: 'Internal note' },
        { key: 'public_snippet', label: 'Public Snippet', type: 'textarea', placeholder: 'Snippet for hooks' }
      ];

    return res.render('admin/plugins/settings', {
      title: `${plugin.name} Settings`,
      plugin,
      settingsMap,
      fields
    });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const plugin = await Plugin.findOne({ where: { slug: req.params.slug } });
    if (!plugin) return res.status(404).render('errors/404', { title: 'Plugin Not Found' });

    const manifest = plugin.manifest || {};
    const fields = manifest.settings || [];

    for (const field of fields) {
      if (!field.key) continue;
      let value;
      if (field.type === 'checkbox') {
        value = req.body[field.key] === 'on' ? 'true' : 'false';
      } else {
        value = req.body[field.key];
        if (value === undefined) continue;
        if (Array.isArray(value)) value = value.join(',');
      }
      await PluginSetting.upsert({
        plugin_id: plugin.id,
        key: field.key,
        value: String(value ?? ''),
        value_type: field.type === 'checkbox' ? 'boolean' : 'string'
      });
    }

    if (plugin.active) await pluginLoader.loadActivePlugins(req.app);
    req.flash('success', 'Plugin settings saved.');
    return res.redirect(`/admin/plugins/${plugin.slug}/settings`);
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, upload, activate, deactivate, uninstall, settings, updateSettings };
