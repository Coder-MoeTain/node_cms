const { SiteSetting, Theme, ThemeSetting } = require('../../models');

const defaultSettings = {
  site_logo: { value: '', group: 'branding' },
  favicon: { value: '', group: 'branding' }
};

async function settings(req, res, next) {
  try {
    for (const [key, setting] of Object.entries(defaultSettings)) {
      await SiteSetting.findOrCreate({ where: { key }, defaults: setting });
    }
    const rows = await SiteSetting.findAll({ order: [['group', 'ASC'], ['key', 'ASC']] });
    return res.render('admin/settings/index', { title: 'Site Settings', rows });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      if (key !== '_csrf' && key !== '_method') {
        await SiteSetting.upsert({ key, value: Array.isArray(value) ? value.join(',') : value, group: 'general' });
      }
    }
    req.flash('success', 'Settings updated.');
    return res.redirect('/admin/settings');
  } catch (error) {
    return next(error);
  }
}

async function themes(req, res, next) {
  try {
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
      logo: req.body.logo,
      favicon: req.body.favicon
    });
    req.flash('success', 'Theme settings updated.');
    return res.redirect('/admin/themes');
  } catch (error) {
    return next(error);
  }
}

module.exports = { settings, updateSettings, themes, activateTheme, updateThemeSettings };
