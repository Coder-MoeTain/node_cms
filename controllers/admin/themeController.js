const fs = require('fs');
const path = require('path');
const { Theme, ThemeSetting } = require('../../models');
const themeManager = require('../../utils/themeManager');
const themeLoader = require('../../utils/themeLoader');
const { resolvePortalConfig, stripManagedBlocks, parseThemeVars } = require('../../utils/portalConfig');
const { resolveImageValue } = require('../../utils/uploadHelper');
const { zipUpload } = require('../../middleware/zipUpload');

function clampLogoDimension(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeLogoPlacement(value) {
  const allowed = ['left', 'center', 'right', 'above'];
  return allowed.includes(value) ? value : 'left';
}

function enrichThemeRow(theme) {
  const plain = theme.get ? theme.get({ plain: true }) : { ...theme };
  const manifest = plain.manifest || themeLoader.getManifestBySlug(plain.slug) || {};
  return {
    ...plain,
    preview_image: themeLoader.resolveThemePreviewImage(plain.slug) || plain.preview_image || null,
    version: manifest.version || '1.0.0',
    author: manifest.author || null
  };
}

async function index(req, res, next) {
  try {
    await themeManager.syncInstalledThemes();
    const [themes, themeSetting] = await Promise.all([
      Theme.findAll({ order: [['name', 'ASC']] }),
      ThemeSetting.findOne({ where: { active: true } })
    ]);
    const enrichedThemes = themes.map(enrichThemeRow);
    const themeAssets = enrichedThemes.reduce((map, theme) => {
      map[theme.slug] = themeManager.discoverThemeAssets(theme.slug);
      return map;
    }, {});
    const activeTheme = enrichedThemes.find((theme) => theme.active) || null;
    const inactiveThemes = enrichedThemes.filter((theme) => !theme.active);
    return res.render('admin/themes/index', {
      title: 'Themes',
      themes: enrichedThemes,
      activeTheme,
      inactiveThemes,
      themeSetting: themeSetting || {},
      themeAssets,
      builtInThemes: themeManager.BUILT_IN_THEMES
    });
  } catch (error) {
    return next(error);
  }
}

async function show(req, res, next) {
  try {
    await themeManager.syncInstalledThemes();
    const themeRow = await Theme.findOne({ where: { slug: req.params.slug } });
    if (!themeRow) return res.status(404).render('errors/404', { title: 'Theme Not Found' });

    const details = themeManager.getThemeDetails(req.params.slug);
    return res.render('admin/themes/show', {
      title: themeRow.name,
      theme: enrichThemeRow(themeRow),
      details,
      assets: details?.assets || { templates: [], partials: [], chain: [] }
    });
  } catch (error) {
    return next(error);
  }
}

async function activate(req, res, next) {
  try {
    await themeManager.activateTheme(req.body.theme_id);
    req.flash('success', 'Theme activated.');
    return res.redirect('/admin/themes');
  } catch (error) {
    req.flash('error', error.message || 'Theme activation failed.');
    return res.redirect('/admin/themes');
  }
}

async function customize(req, res, next) {
  try {
    await themeManager.syncInstalledThemes();
    const [themes, themeSetting] = await Promise.all([
      Theme.findAll(),
      ThemeSetting.findOne({ where: { active: true } })
    ]);
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

async function updateSettings(req, res, next) {
  try {
    const [setting] = await ThemeSetting.findOrCreate({
      where: { active: true },
      defaults: themeManager.buildThemeSettingDefaults('classic-blog')
    });
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
      logo_max_height: clampLogoDimension(req.body.logo_max_height, 64, 24, 240),
      logo_max_width: clampLogoDimension(req.body.logo_max_width, 180, 48, 480),
      logo_placement: normalizeLogoPlacement(req.body.logo_placement),
      favicon,
      custom_css: req.body.custom_css || '',
      custom_js: req.body.custom_js || ''
    });
    delete req.session.customizerDraft;
    req.flash('success', 'Theme settings updated.');
    return res.redirect('/admin/themes/customize');
  } catch (error) {
    return next(error);
  }
}

async function previewDraft(req, res, next) {
  try {
    req.session.customizerDraft = {
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
      dark_mode: req.body.dark_mode === 'on' || req.body.dark_mode === true,
      logo: req.body.logo || '',
      logo_max_height: clampLogoDimension(req.body.logo_max_height, 64, 24, 240),
      logo_max_width: clampLogoDimension(req.body.logo_max_width, 180, 48, 480),
      logo_placement: normalizeLogoPlacement(req.body.logo_placement),
      favicon: req.body.favicon || '',
      custom_css: req.body.custom_css || '',
      custom_js: req.body.custom_js || ''
    };
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

async function resetSettings(req, res, next) {
  try {
    await themeManager.resetThemeSettings();
    delete req.session.customizerDraft;
    req.flash('success', 'Theme settings reset to theme defaults.');
    return res.redirect('/admin/themes/customize');
  } catch (error) {
    return next(error);
  }
}

async function upload(req, res, next) {
  try {
    if (!req.file) {
      req.flash('error', 'Choose a theme .zip archive to upload.');
      return res.redirect('/admin/themes');
    }
    const manifest = await themeManager.installThemeFromArchive(req.file.path);
    req.flash('success', `Theme "${manifest.name}" installed successfully.`);
    return res.redirect('/admin/themes');
  } catch (error) {
    req.flash('error', error.message || 'Theme upload failed.');
    return res.redirect('/admin/themes');
  }
}

async function uninstall(req, res, next) {
  try {
    const theme = await Theme.findOne({ where: { slug: req.params.slug } });
    if (!theme) {
      req.flash('error', 'Theme not found.');
      return res.redirect('/admin/themes');
    }
    if (theme.active) {
      req.flash('error', 'Cannot uninstall the active theme. Activate another theme first.');
      return res.redirect('/admin/themes');
    }
    const children = await themeManager.getChildThemeSlugsFromDb(theme.slug);
    if (children.length) {
      req.flash('error', `Cannot uninstall: child themes depend on this theme (${children.join(', ')}).`);
      return res.redirect('/admin/themes');
    }
    await ThemeSetting.destroy({ where: { theme_name: theme.slug } });
    await theme.destroy();
    themeManager.removeThemeDirectory(theme.slug);
    req.flash('success', 'Theme removed.');
    return res.redirect('/admin/themes');
  } catch (error) {
    return next(error);
  }
}

async function previewTheme(req, res) {
  return res.redirect('/?customizer_preview=1');
}

async function previewThemeLive(req, res, next) {
  try {
    const slug = req.params.slug;
    const theme = await Theme.findOne({ where: { slug } });
    if (!theme) {
      req.flash('error', 'Theme not found.');
      return res.redirect('/admin/themes');
    }
    return res.redirect(`/?theme_preview=${encodeURIComponent(slug)}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  show,
  activate,
  customize,
  updateSettings,
  previewDraft,
  resetSettings,
  upload,
  uninstall,
  previewTheme,
  previewThemeLive
};
