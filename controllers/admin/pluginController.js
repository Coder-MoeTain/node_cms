const fs = require('fs');
const path = require('path');
const { Plugin, PluginSetting, PluginMigration } = require('../../models');
const pluginLoader = require('../../utils/pluginLoader');
const { resolvePluginSettings, seedPluginDefaults } = require('../../utils/pluginSettings');
const { extractZipArchive } = require('../../utils/packageArchive');

async function show(req, res, next) {
  try {
    const plugin = await Plugin.findOne({
      where: { slug: req.params.slug },
      include: [
        { model: PluginSetting, as: 'settings' },
        { model: PluginMigration, as: 'migrations' }
      ]
    });
    if (!plugin) return res.status(404).render('errors/404', { title: 'Plugin Not Found' });

    const diskManifest = pluginLoader.getManifestBySlug(plugin.slug);
    const migrationsDir = path.join(pluginLoader.pluginsRoot, plugin.slug, 'migrations');
    const pendingMigrations = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()
          .filter((file) => !(plugin.migrations || []).some((row) => row.migration === file))
      : [];
    const activationErrors = pluginLoader.getActivationErrors();
    const registeredHooks = pluginLoader.listRegisteredHooks();
    const manifestHooks = (plugin.manifest?.hooks || []);

    return res.render('admin/plugins/show', {
      title: plugin.name,
      plugin,
      diskManifest,
      pendingMigrations,
      registeredHooks,
      manifestHooks,
      activationError: activationErrors.get(plugin.slug) || null,
      isActive: plugin.active
    });
  } catch (error) {
    return next(error);
  }
}

async function runMigrations(req, res, next) {
  try {
    const slug = req.params.slug;
    const plugin = await Plugin.findOne({ where: { slug } });
    if (!plugin) {
      req.flash('error', 'Plugin not found.');
      return res.redirect('/admin/plugins');
    }
    const ran = await pluginLoader.runPluginMigrations(slug);
    req.flash('success', ran.length ? `Ran ${ran.length} migration(s): ${ran.join(', ')}` : 'No pending migrations.');
    return res.redirect(`/admin/plugins/${slug}`);
  } catch (error) {
    req.flash('error', error.message || 'Migration failed.');
    return res.redirect(`/admin/plugins/${req.params.slug}`);
  }
}

async function index(req, res, next) {
  try {
    await pluginLoader.syncInstalledPlugins();
    const [plugins, stats, registeredHooks] = await Promise.all([
      Plugin.findAll({ order: [['name', 'ASC']] }),
      pluginLoader.getPluginManagerStats(),
      Promise.resolve(pluginLoader.listRegisteredHooks())
    ]);
    const activationErrors = pluginLoader.getActivationErrors();
    return res.render('admin/plugins/index', {
      title: 'Plugins',
      plugins,
      stats,
      registeredHooks,
      activationErrors: Object.fromEntries(activationErrors)
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
    pluginLoader.validateManifest(manifest);
    const isNew = !(await Plugin.findOne({ where: { slug: manifest.slug } }));
    await pluginLoader.syncInstalledPlugins();
    await pluginLoader.runPluginMigrations(manifest.slug);
    if (isNew) {
      await pluginLoader.invokePluginLifecycle(manifest.slug, 'onInstall', req.app);
    }
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
    await pluginLoader.activatePlugin(slug, req.app);
    req.flash('success', 'Plugin activated.');
    return res.redirect('/admin/plugins');
  } catch (error) {
    req.flash('error', error.message || 'Plugin activation failed.');
    return res.redirect('/admin/plugins');
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
    await pluginLoader.invokePluginLifecycle(plugin.slug, 'onUninstall', req.app);
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
    const manifestFields = manifest.settings || [];
    const fields = manifestFields.length
      ? manifestFields
      : [
        { key: 'note', label: 'Enabled Note', type: 'text', placeholder: 'Internal note' },
        { key: 'public_snippet', label: 'Public Snippet', type: 'textarea', placeholder: 'Snippet for hooks' }
      ];

    return res.render('admin/plugins/settings', {
      title: `${plugin.name} Settings`,
      plugin,
      settingsMap,
      fields,
      usesManifestSettings: manifestFields.length > 0
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
    const manifestFields = manifest.settings || [];
    const fields = manifestFields.length
      ? manifestFields
      : [
        { key: 'note', type: 'text' },
        { key: 'public_snippet', type: 'textarea' }
      ];

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

module.exports = { index, show, upload, activate, deactivate, uninstall, settings, updateSettings, runMigrations };
