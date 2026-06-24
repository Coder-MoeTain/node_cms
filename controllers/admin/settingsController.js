const fs = require('fs');
const path = require('path');
const { SiteSetting, Theme, ThemeSetting, Media } = require('../../models');
const themeLoader = require('../../utils/themeLoader');
const { resolvePortalConfig, stripManagedBlocks, parseThemeVars } = require('../../utils/portalConfig');
const { ensurePortalSettings, SETTING_GROUP_LABELS, SETTING_GROUP_ORDER, getSettingGroup } = require('../../utils/portalSettings');
const { resolveImageValue } = require('../../utils/uploadHelper');
const { extractZipArchive } = require('../../utils/packageArchive');

async function settings(req, res, next) {
  try {
    await ensurePortalSettings(SiteSetting);
    const rows = await SiteSetting.findAll({ order: [['group', 'ASC'], ['key', 'ASC']] });
    const grouped = {};
    rows.forEach((row) => {
      const group = row.group || getSettingGroup(row.key);
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(row);
    });
    return res.render('admin/settings/index', {
      title: 'Site Settings',
      rows,
      grouped,
      groupLabels: SETTING_GROUP_LABELS,
      groupOrder: SETTING_GROUP_ORDER
    });
  } catch (error) {
    return next(error);
  }
}

const brandingImageFields = {
  site_logo: 'site_logo_file',
  favicon: 'favicon_file'
};

async function updateSettings(req, res, next) {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      if (key === '_csrf' || key === '_method' || key.endsWith('_file') || key.startsWith('remove_')) continue;

      let finalValue = Array.isArray(value) ? value.join(',') : value;
      if (brandingImageFields[key]) {
        const existing = await SiteSetting.findOne({ where: { key } });
        finalValue = await resolveImageValue(req, {
          fileField: brandingImageFields[key],
          pathField: key,
          record: existing || { [key]: finalValue }
        });
      }

      await SiteSetting.upsert({
        key,
        value: finalValue,
        group: getSettingGroup(key)
      });
    }
    req.flash('success', 'Settings updated.');
    return res.redirect('/admin/settings');
  } catch (error) {
    return next(error);
  }
}

async function mediaGallery(req, res, next) {
  try {
    const mediaType = req.query.type || 'image';
    const rows = await Media.findAll({
      where: { file_type: mediaType },
      limit: 60,
      order: [['created_at', 'DESC']]
    });
    return res.json({
      items: rows.map((item) => ({
        id: item.id,
        originalName: item.original_name,
        filePath: item.file_path,
        thumbnailPath: item.thumbnail_path,
        fileType: item.file_type,
        mimeType: item.mime_type,
        fileSize: item.file_size,
        createdAt: item.created_at
      }))
    });
  } catch (error) {
    return next(error);
  }
}

async function themes(req, res, next) {
  try {
    await themeLoader.syncInstalledThemes();
    const [themes, themeSetting] = await Promise.all([Theme.findAll(), ThemeSetting.findOne({ where: { active: true } })]);
    return res.render('admin/themes/index', { title: 'Themes', themes, themeSetting: themeSetting || {} });
  } catch (error) {
    return next(error);
  }
}

async function activateTheme(req, res, next) {
  try {
    await Theme.update({ active: false }, { where: {} });
    const theme = await Theme.findByPk(req.body.theme_id);
    if (theme) {
      await theme.update({ active: true });
      await ThemeSetting.update({ active: false }, { where: {} });
      await ThemeSetting.findOrCreate({ where: { theme_name: theme.slug }, defaults: { active: true } });
      await ThemeSetting.update({ active: true }, { where: { theme_name: theme.slug } });
    }
    req.flash('success', 'Theme activated.');
    return res.redirect('/admin/themes');
  } catch (error) {
    return next(error);
  }
}

async function updateThemeSettings(req, res, next) {
  try {
    const [setting] = await ThemeSetting.findOrCreate({ where: { active: true }, defaults: { theme_name: 'classic-blog' } });
    const [logo, favicon] = await Promise.all([
      resolveImageValue(req, { fileField: 'logo_file', pathField: 'logo', record: setting }),
      resolveImageValue(req, { fileField: 'favicon_file', pathField: 'favicon', record: setting })
    ]);
    await setting.update({
      primary_color: req.body.primary_color,
      secondary_color: req.body.secondary_color,
      background_color: req.body.background_color,
      text_color: req.body.text_color,
      font_family: req.body.font_family,
      header_layout: req.body.header_layout,
      footer_layout: req.body.footer_layout,
      sidebar_position: req.body.sidebar_position,
      blog_layout: req.body.blog_layout,
      site_layout: req.body.site_layout,
      dark_mode: req.body.dark_mode === 'on',
      logo,
      favicon,
      custom_css: req.body.custom_css || '',
      custom_js: req.body.custom_js || ''
    });
    req.flash('success', 'Theme settings updated.');
    return res.redirect('/admin/themes');
  } catch (error) {
    return next(error);
  }
}

async function themeEditor(req, res, next) {
  try {
    await themeLoader.syncInstalledThemes();
    const [themes, themeSetting] = await Promise.all([Theme.findAll(), ThemeSetting.findOne({ where: { active: true } })]);
    const themePlain = themeSetting ? themeSetting.get({ plain: true }) : {};
    return res.render('admin/themes/customize', {
      title: 'Customize',
      themes,
      themeSetting: themePlain,
      portalConfig: resolvePortalConfig(themePlain),
      themeVars: parseThemeVars(themePlain.custom_css || ''),
      cssWithoutManaged: stripManagedBlocks(themePlain.custom_css || '')
    });
  } catch (error) {
    return next(error);
  }
}

async function uploadTheme(req, res, next) {
  try {
    if (!req.file) {
      req.flash('error', 'Choose a theme .zip archive to upload.');
      return res.redirect('/admin/themes');
    }
    const { manifest } = await extractZipArchive(req.file.path, themeLoader.themesRoot, 'theme.json');
    if (manifest.parent) {
      const parentExists = fs.existsSync(path.join(themeLoader.themesRoot, manifest.parent, 'theme.json'));
      if (!parentExists) {
        req.flash('error', `Parent theme "${manifest.parent}" is not installed. Install the parent theme first.`);
        return res.redirect('/admin/themes');
      }
    }
    await themeLoader.syncInstalledThemes();
    req.flash('success', `Theme "${manifest.name}" installed successfully.`);
    return res.redirect('/admin/themes');
  } catch (error) {
    req.flash('error', error.message || 'Theme upload failed.');
    return res.redirect('/admin/themes');
  }
}

module.exports = { settings, updateSettings, mediaGallery, themes, activateTheme, updateThemeSettings, themeEditor, uploadTheme };
