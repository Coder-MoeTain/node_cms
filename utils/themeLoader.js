const fs = require('fs');
const path = require('path');
const { Theme, ThemeSetting } = require('../models');
const { buildPortalConfigBlock } = require('./portalConfig');
const themeValidator = require('./themeValidator');
const templateResolver = require('./templateResolver');

const themesRoot = path.join(process.cwd(), 'themes');
const defaultPublicRoot = path.join(process.cwd(), 'views', 'public');

const BASE_THEME_DEFAULTS = {
  primary_color: '#2271b1',
  secondary_color: '#50575e',
  background_color: '#ffffff',
  text_color: '#1d2327',
  font_family: 'Inter, Arial, sans-serif',
  header_layout: 'standard',
  footer_layout: 'four-columns',
  sidebar_position: 'right',
  blog_layout: 'grid',
  site_layout: 'full-width',
  dark_mode: false,
  logo_max_height: 64,
  logo_max_width: 180,
  logo_placement: 'left'
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const TEMPLATE_ALIASES = {
  category: 'archive',
  tag: 'archive',
  '404': 'error'
};

function normalizeTemplateName(template) {
  return TEMPLATE_ALIASES[template] || template;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateManifest(manifest, options = {}) {
  return themeValidator.validateManifest(manifest, {
    themePath: options.themePath,
    themesRoot,
    strict: options.strict === true,
    requireTemplates: Boolean(options.requireTemplates),
    validateScreenshot: Boolean(options.validateScreenshot)
  });
}

function discoverThemes() {
  if (!fs.existsSync(themesRoot)) return [];
  return fs.readdirSync(themesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => {
      const themePath = path.join(themesRoot, entry.name);
      const manifestPath = path.join(themePath, 'theme.json');
      if (!fs.existsSync(manifestPath)) return null;
      try {
        return { path: themePath, manifest: validateManifest(readJson(manifestPath), { themePath, strict: false }) };
      } catch (error) {
        console.warn(`Skipping invalid theme "${entry.name}": ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

function getThemeBySlug(slug) {
  return discoverThemes().find((theme) => theme.manifest.slug === slug) || null;
}

function resolveThemeChain(slug) {
  const chain = [];
  const seen = new Set();
  let current = slug;
  while (current && !seen.has(current)) {
    seen.add(current);
    const theme = getThemeBySlug(current);
    if (!theme) break;
    chain.push(theme);
    current = theme.manifest.parent || null;
  }
  return chain;
}

function listTemplateFiles(themePath) {
  const dir = path.join(themePath, 'templates');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.ejs'))
    .map((file) => file.replace(/\.ejs$/, ''));
}

function listPartialFiles(themePath) {
  const dir = path.join(themePath, 'partials');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.ejs'))
    .map((file) => file.replace(/\.ejs$/, ''));
}

function walkAssets(dir, slug, prefix = 'assets', list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      walkAssets(path.join(dir, entry.name), slug, rel, list);
    } else {
      list.push(`/themes/${slug}/${rel.replace(/\\/g, '/')}`);
    }
  }
  return list;
}

function discoverThemeAssets(slug) {
  const chain = resolveThemeChain(slug);
  const templates = new Set();
  const partials = new Set();
  const assets = [];

  for (const theme of chain) {
    listTemplateFiles(theme.path).forEach((name) => templates.add(name));
    listPartialFiles(theme.path).forEach((name) => partials.add(name));
    walkAssets(path.join(theme.path, 'assets'), theme.manifest.slug, 'assets', assets);
  }

  const manifest = getManifestBySlug(slug);
  if (manifest?.templates) manifest.templates.forEach((name) => templates.add(name));
  if (manifest?.layouts) manifest.layouts.forEach((name) => templates.add(name));

  return {
    slug,
    chain: chain.map((t) => t.manifest.slug),
    templates: [...templates].sort(),
    partials: [...partials].sort(),
    assets: [...new Set(assets)].sort()
  };
}

async function syncInstalledThemes() {
  const discovered = discoverThemes();
  for (const item of discovered) {
    const manifest = item.manifest;
    if (manifest.parent) {
      const parentExists = fs.existsSync(path.join(themesRoot, manifest.parent, 'theme.json'));
      if (!parentExists) {
        console.warn(`Theme "${manifest.slug}" requires parent "${manifest.parent}" which is not installed.`);
        continue;
      }
    }
    await Theme.findOrCreate({
      where: { slug: manifest.slug },
      defaults: {
        name: manifest.name,
        description: manifest.description,
        preview_image: manifest.screenshot || `/themes/${manifest.slug}/screenshot.svg`,
        manifest,
        parent_slug: manifest.parent || null,
        active: false
      }
    });
    await Theme.update({
      name: manifest.name,
      description: manifest.description,
      preview_image: manifest.screenshot || `/themes/${manifest.slug}/screenshot.svg`,
      manifest,
      parent_slug: manifest.parent || null
    }, { where: { slug: manifest.slug } });
  }
  return discovered;
}

async function getActiveThemeManifest() {
  try {
    const activeSetting = await ThemeSetting.findOne({ where: { active: true } });
    let slug = activeSetting?.theme_name || templateResolver.DEFAULT_THEME;
    let theme = getThemeBySlug(slug);
    if (!theme) {
      slug = templateResolver.DEFAULT_THEME;
      theme = getThemeBySlug(slug);
    }
    if (theme) {
      try {
        validateManifest({ ...theme.manifest }, { themePath: theme.path, themesRoot, strict: false });
      } catch (error) {
        console.warn(`Active theme "${slug}" failed validation: ${error.message}. Falling back to ${templateResolver.DEFAULT_THEME}.`);
        try {
          await Theme.update({ error_state: 'error', last_error: error.message }, { where: { slug } });
        } catch {
          // ignore missing columns
        }
        return getThemeBySlug(templateResolver.DEFAULT_THEME);
      }
    }
    return theme;
  } catch {
    return getThemeBySlug(templateResolver.DEFAULT_THEME);
  }
}

async function resolveTemplate(template, context = {}) {
  const normalized = normalizeTemplateName(template);
  const active = await getActiveThemeManifest();
  const chain = active ? resolveThemeChain(active.manifest.slug) : [];
  return templateResolver.resolveTemplatePath(normalized, context, { chain, themesRoot });
}

async function resolvePartial(partial, context = {}) {
  const active = await getActiveThemeManifest();
  const chain = active ? resolveThemeChain(active.manifest.slug) : [];
  return templateResolver.resolvePartialPath(partial, { chain });
}

function getLayoutClasses(themeSetting = {}) {
  return [
    themeSetting.dark_mode ? 'theme-dark' : '',
    themeSetting.site_layout === 'boxed' ? 'boxed-layout' : '',
    `header-layout-${themeSetting.header_layout || 'standard'}`,
    `footer-layout-${themeSetting.footer_layout || 'four-columns'}`,
    `sidebar-${themeSetting.sidebar_position || 'right'}`,
    `blog-layout-${themeSetting.blog_layout || 'grid'}`,
    `logo-placement-${themeSetting.logo_placement || 'left'}`
  ].filter(Boolean).join(' ');
}

function getManifestBySlug(slug) {
  return getThemeBySlug(slug)?.manifest || null;
}

function buildThemeSettingDefaults(slug) {
  const manifest = getManifestBySlug(slug);
  const manifestDefaults = manifest?.defaults || {};
  const { portal_config: portalConfig, preset, ...directDefaults } = manifestDefaults;

  const settings = {
    theme_name: slug,
    active: true,
    ...BASE_THEME_DEFAULTS,
    ...directDefaults
  };

  if (portalConfig || preset) {
    const config = portalConfig ? { ...portalConfig } : { preset };
    if (preset && !config.preset) config.preset = preset;
    settings.custom_css = buildPortalConfigBlock(config);
    if (config.header?.layout === 'portal') {
      settings.header_layout = 'portal';
    }
  }

  return settings;
}

function removeThemeDirectory(slug) {
  const dir = path.join(themesRoot, slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function getChildThemeSlugs(parentSlug) {
  const fromDisk = discoverThemes()
    .filter((theme) => theme.manifest.parent === parentSlug)
    .map((theme) => theme.manifest.slug);
  return fromDisk;
}

async function getChildThemeSlugsFromDb(parentSlug) {
  const { Theme } = require('../models');
  const rows = await Theme.findAll({
    where: { parent_slug: parentSlug },
    attributes: ['slug']
  });
  return [...new Set([...getChildThemeSlugs(parentSlug), ...rows.map((row) => row.slug)])];
}

const SCREENSHOT_FILENAMES = [
  'screenshot.png',
  'screenshot.jpg',
  'screenshot.jpeg',
  'screenshot.webp',
  'screenshot.svg'
];

function resolveThemePreviewImage(slug) {
  const theme = getThemeBySlug(slug);
  if (!theme) return null;

  const manifestPath = theme.manifest.screenshot;
  if (manifestPath && typeof manifestPath === 'string') {
    const match = manifestPath.match(/^\/themes\/[^/]+\/(.+)$/);
    if (match && fs.existsSync(path.join(theme.path, match[1]))) {
      return manifestPath;
    }
    if (manifestPath.startsWith('http://') || manifestPath.startsWith('https://')) {
      return manifestPath;
    }
  }

  for (const name of SCREENSHOT_FILENAMES) {
    if (fs.existsSync(path.join(theme.path, name))) {
      return `/themes/${slug}/${name}`;
    }
  }

  return null;
}

module.exports = {
  themesRoot,
  BASE_THEME_DEFAULTS,
  SLUG_PATTERN,
  discoverThemes,
  getThemeBySlug,
  discoverThemeAssets,
  resolveThemeChain,
  syncInstalledThemes,
  getActiveThemeManifest,
  getManifestBySlug,
  buildThemeSettingDefaults,
  resolveTemplate,
  resolvePartial,
  getLayoutClasses,
  removeThemeDirectory,
  getChildThemeSlugs,
  getChildThemeSlugsFromDb,
  resolveThemePreviewImage,
  listTemplateFiles,
  listPartialFiles,
  validateManifest,
  normalizeTemplateName,
  TEMPLATE_ALIASES
};
