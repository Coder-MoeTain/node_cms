const fs = require('fs');
const path = require('path');
const { Theme, ThemeSetting } = require('../models');

const themesRoot = path.join(process.cwd(), 'themes');
const defaultPublicRoot = path.join(process.cwd(), 'views', 'public');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateManifest(manifest) {
  for (const key of ['name', 'slug', 'version']) {
    if (!manifest[key] || typeof manifest[key] !== 'string') throw new Error(`Theme manifest missing ${key}.`);
  }
  return manifest;
}

function discoverThemes() {
  if (!fs.existsSync(themesRoot)) return [];
  return fs.readdirSync(themesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const themePath = path.join(themesRoot, entry.name);
      const manifestPath = path.join(themePath, 'theme.json');
      if (!fs.existsSync(manifestPath)) return null;
      return { path: themePath, manifest: validateManifest(readJson(manifestPath)) };
    })
    .filter(Boolean);
}

async function syncInstalledThemes() {
  const discovered = discoverThemes();
  for (const item of discovered) {
    const manifest = item.manifest;
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
  return discoverThemes().find((theme) => theme.manifest.slug === slug) || null;
}

function templateExists(theme, template) {
  if (!theme) return null;
  const candidate = path.join(theme.path, 'templates', `${template}.ejs`);
  return fs.existsSync(candidate) ? candidate : null;
}

async function resolveTemplate(template) {
  const active = await getActiveThemeManifest();
  const activeTemplate = templateExists(active, template);
  if (activeTemplate) return path.relative(process.cwd(), activeTemplate).replace(/\\/g, '/').replace(/\.ejs$/, '');

  if (active?.manifest.parent) {
    const parent = discoverThemes().find((theme) => theme.manifest.slug === active.manifest.parent);
    const parentTemplate = templateExists(parent, template);
    if (parentTemplate) return path.relative(process.cwd(), parentTemplate).replace(/\\/g, '/').replace(/\.ejs$/, '');
  }

  const publicTemplate = path.join(defaultPublicRoot, `${template}.ejs`);
  if (fs.existsSync(publicTemplate)) return `public/${template}`;
  return 'errors/404';
}

function partialExists(theme, partial) {
  if (!theme) return null;
  const candidate = path.join(theme.path, 'partials', `${partial}.ejs`);
  return fs.existsSync(candidate) ? candidate : null;
}

async function resolvePartial(partial) {
  const active = await getActiveThemeManifest();
  const activePartial = partialExists(active, partial);
  if (activePartial) {
    return path.relative(process.cwd(), activePartial).replace(/\\/g, '/').replace(/\.ejs$/, '');
  }

  if (active?.manifest.parent) {
    const parent = discoverThemes().find((theme) => theme.manifest.slug === active.manifest.parent);
    const parentPartial = partialExists(parent, partial);
    if (parentPartial) {
      return path.relative(process.cwd(), parentPartial).replace(/\\/g, '/').replace(/\.ejs$/, '');
    }
  }

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

module.exports = {
  themesRoot,
  discoverThemes,
  syncInstalledThemes,
  getActiveThemeManifest,
  resolveTemplate,
  resolvePartial,
  getLayoutClasses
};
