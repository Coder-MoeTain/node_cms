const fs = require('fs');
const path = require('path');
const themeLoader = require('./themeLoader');
const { renderSimpleMarkdown } = require('./pluginAdmin');

const THEME_TAGS = {
  'myanmar-portal': ['Portal', 'Government'],
  'government-portal': ['Portal', 'Government'],
  'classic-blog': ['Blog', 'Classic'],
  'modern-news': ['News', 'Magazine'],
  'minimal-personal': ['Blog', 'Minimal'],
  'magazine-grid': ['Magazine', 'Grid'],
  'corporate-business': ['Business', 'Corporate'],
  'creative-studio': ['Creative', 'Portfolio'],
  'dark-elegant': ['Dark', 'Elegant'],
  'ecommerce-store': ['Shop', 'Commerce'],
  'education-campus': ['Education', 'Campus']
};

function resolveThemePreviewPaths(slug, plain = {}) {
  const staticPreview = themeLoader.resolveThemePreviewImage(slug) || plain.preview_image || null;
  const dynamicThumb = `/admin/themes/${slug}/thumbnail`;
  return {
    preview_image: staticPreview || dynamicThumb,
    preview_thumb: staticPreview || dynamicThumb,
    has_static_screenshot: Boolean(staticPreview)
  };
}

function getThemeTags(slug, manifest = {}) {
  const tags = [...(THEME_TAGS[slug] || [])];
  if (manifest.parent) tags.push('Child theme');
  if (manifest.defaults?.dark_mode) tags.push('Dark mode');
  if (manifest.defaults?.header_layout === 'portal' || (manifest.layouts || []).includes('portal')) {
    if (!tags.includes('Portal')) tags.push('Portal');
  }
  if ((manifest.defaults?.blog_layout || '') === 'masonry') tags.push('Masonry');
  if (!tags.length) tags.push('Theme');
  return [...new Set(tags)];
}

function readThemeReadme(slug) {
  const candidates = [
    path.join(process.cwd(), 'themes', slug, 'README.md'),
    path.join(process.cwd(), 'views', 'themes', slug, 'README.md')
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return { raw, html: renderSimpleMarkdown(raw), filename: path.basename(filePath) };
    }
  }
  return null;
}

function enrichTheme(theme, options = {}) {
  const plain = theme.get ? theme.get({ plain: true }) : { ...theme };
  const manifest = plain.manifest || themeLoader.getManifestBySlug(plain.slug) || {};
  const defaults = manifest.defaults || {};
  const assets = options.assets || themeLoader.discoverThemeAssets(plain.slug);
  const activationCheck = options.activationCheck || null;
  const previews = resolveThemePreviewPaths(plain.slug, plain);

  return {
    ...plain,
    manifest,
    version: manifest.version || '1.0.0',
    author: manifest.author || plain.author || null,
    description: manifest.description || plain.description || null,
    ...previews,
    colors: {
      primary: defaults.primary_color || '#2271b1',
      secondary: defaults.secondary_color || '#50575e',
      background: defaults.background_color || '#ffffff',
      text: defaults.text_color || '#1d2327'
    },
    tags: getThemeTags(plain.slug, manifest),
    templateCount: (assets.templates || []).length,
    partialCount: (assets.partials || []).length,
    assetCount: (assets.assets || []).length,
    chain: assets.chain || [plain.slug],
    supports: manifest.supports || [],
    preset: defaults.preset || null,
    isChild: Boolean(plain.parent_slug || manifest.parent),
    isPortal: defaults.header_layout === 'portal' || (manifest.layouts || []).includes('portal'),
    isDark: defaults.dark_mode === true,
    activationReady: !(activationCheck && activationCheck.error),
    activationMessage: activationCheck?.error || null
  };
}

function getThemeManagerStats(themes = []) {
  const active = themes.filter((theme) => theme.active).length;
  const childThemes = themes.filter((theme) => theme.parent_slug).length;
  return {
    total: themes.length,
    active,
    inactive: themes.length - active,
    childThemes
  };
}

module.exports = {
  getThemeTags,
  readThemeReadme,
  enrichTheme,
  getThemeManagerStats,
  resolveThemePreviewPaths
};
