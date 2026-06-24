const fs = require('fs');
const path = require('path');
const { Theme, ThemeSetting } = require('../models');
const { buildPortalConfigBlock } = require('./portalConfig');

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
  dark_mode: false
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateManifest(manifest) {
  for (const key of ['name', 'slug', 'version']) {
    if (!manifest[key] || typeof manifest[key] !== 'string') throw new Error(`Theme manifest missing ${key}.`);
  }
  if (!SLUG_PATTERN.test(manifest.slug)) {
    throw new Error(`Theme slug "${manifest.slug}" must be lowercase alphanumeric with hyphens.`);
  }
  if (manifest.parent && !SLUG_PATTERN.test(manifest.parent)) {
    throw new Error(`Parent theme slug "${manifest.parent}" is invalid.`);
  }
  if (manifest.parent === manifest.slug) {
    throw new Error('Theme cannot be its own parent.');
  }
  if (manifest.templates && !Array.isArray(manifest.templates)) {
    throw new Error('Theme manifest "templates" must be an array.');
  }
  if (manifest.layouts && !Array.isArray(manifest.layouts)) {
    throw new Error('Theme manifest "layouts" must be an array.');
  }
  return manifest;
}

function discoverThemes() {
  if (!fs.existsSync(themesRoot)) return [];
  return fs.readdirSync(themesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => {
      const themePath = path.join(themesRoot, entry.name);
      const manifestPath = path.join(themePath, 'theme.json');
      if (!fs.existsSync(manifestPath)) return null;
      return { path: themePath, manifest: validateManifest(readJson(manifestPath)) };
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

function discoverThemeAssets(slug) {
  const chain = resolveThemeChain(slug);
  const templates = new Set();
  const partials = new Set();
  const assets = [];

  for (const theme of chain) {
    listTemplateFiles(theme.path).forEach((name) => templates.add(name));
    listPartialFiles(theme.path).forEach((name) => partials.add(name));
    const assetsDir = path.join(theme.path, 'assets');
    if (fs.existsSync(assetsDir)) {
      fs.readdirSync(assetsDir).forEach((file) => {
        assets.push(`/themes/${theme.manifest.slug}/assets/${file}`);
      });
    }
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
        throw new Error(`Theme "${manifest.slug}" requires parent "${manifest.parent}" which is not installed.`);
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
  const activeSetting = await ThemeSetting.findOne({ where: { active: true } });
  const slug = activeSetting?.theme_name || 'classic-blog';
  return getThemeBySlug(slug);
}

function templateExistsInChain(chain, template) {
  for (const theme of chain) {
    const candidate = path.join(theme.path, 'templates', `${template}.ejs`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function partialExistsInChain(chain, partial) {
  for (const theme of chain) {
    const candidate = path.join(theme.path, 'partials', `${partial}.ejs`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function toViewPath(absolutePath) {
  return path.relative(process.cwd(), absolutePath).replace(/\\/g, '/').replace(/\.ejs$/, '');
}

async function resolveTemplate(template) {
  const active = await getActiveThemeManifest();
  const chain = active ? resolveThemeChain(active.manifest.slug) : [];
  const resolved = templateExistsInChain(chain, template);
  if (resolved) return toViewPath(resolved);

  const publicTemplate = path.join(defaultPublicRoot, `${template}.ejs`);
  if (fs.existsSync(publicTemplate)) return `public/${template}`;
  return 'errors/404';
}

async function resolvePartial(partial) {
  const active = await getActiveThemeManifest();
  const chain = active ? resolveThemeChain(active.manifest.slug) : [];
  const resolved = partialExistsInChain(chain, partial);
  if (resolved) return toViewPath(resolved);
  return `public/partials/${partial}`;
}

function getLayoutClasses(themeSetting = {}) {
  return [
    themeSetting.dark_mode ? 'theme-dark' : '',
    themeSetting.site_layout === 'boxed' ? 'boxed-layout' : '',
    `header-layout-${themeSetting.header_layout || 'standard'}`,
    `footer-layout-${themeSetting.footer_layout || 'four-columns'}`,
    `sidebar-${themeSetting.sidebar_position || 'right'}`,
    `blog-layout-${themeSetting.blog_layout || 'grid'}`
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
  return discoverThemes()
    .filter((theme) => theme.manifest.parent === parentSlug)
    .map((theme) => theme.manifest.slug);
}

module.exports = {
  themesRoot,
  BASE_THEME_DEFAULTS,
  SLUG_PATTERN,
  discoverThemes,
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
  listTemplateFiles,
  listPartialFiles,
  validateManifest
};
