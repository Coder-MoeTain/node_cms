const fs = require('fs');
const path = require('path');
const { Theme, ThemeSetting } = require('../models');
const themeLoader = require('./themeLoader');
const { extractZipArchive } = require('./packageArchive');

const REQUIRED_TEMPLATES = ['home', 'blog', 'post', 'page', 'search', 'contact'];
const RECOMMENDED_TEMPLATES = ['archive', 'error'];
const TEMPLATE_ALIASES = themeLoader.TEMPLATE_ALIASES;

const BLOCKED_THEME_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.jar', '.dll', '.msi', '.vbs', '.ps1', '.htaccess'
]);

const BUILT_IN_THEMES = ['classic-blog', 'modern-news', 'minimal-personal', 'myanmar-portal', 'government-portal'];

function normalizeTemplateName(template) {
  return themeLoader.normalizeTemplateName(template);
}

function listThemeFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) listThemeFiles(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function scanThemeDirectory(themePath) {
  const issues = [];
  const files = listThemeFiles(themePath);
  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const relative = path.relative(themePath, filePath).replace(/\\/g, '/');
    if (BLOCKED_THEME_EXTENSIONS.has(ext)) {
      issues.push(`Blocked file type "${ext}" in ${relative}`);
    }
    if (relative.includes('..')) {
      issues.push(`Unsafe path "${relative}"`);
    }
  }
  return issues;
}

function templateAvailable(slug, template) {
  const normalized = normalizeTemplateName(template);
  const chain = themeLoader.resolveThemeChain(slug);
  for (const theme of chain) {
    const candidate = path.join(theme.path, 'templates', `${normalized}.ejs`);
    if (fs.existsSync(candidate)) return true;
  }
  const publicTemplate = path.join(process.cwd(), 'views', 'public', `${normalized}.ejs`);
  return fs.existsSync(publicTemplate);
}

function validateThemeForActivation(slug) {
  const theme = themeLoader.getThemeBySlug(slug);
  if (!theme) throw new Error(`Theme "${slug}" is not installed.`);

  const manifest = themeLoader.validateManifest({ ...theme.manifest });
  if (manifest.parent) {
    const parent = themeLoader.getThemeBySlug(manifest.parent);
    if (!parent) {
      throw new Error(`Theme "${slug}" requires parent "${manifest.parent}" which is not installed.`);
    }
  }

  const missingRequired = REQUIRED_TEMPLATES.filter((name) => !templateAvailable(slug, name));
  if (missingRequired.length) {
    throw new Error(`Theme "${slug}" is missing required templates (including public fallbacks): ${missingRequired.join(', ')}`);
  }

  const scanIssues = scanThemeDirectory(theme.path);
  if (scanIssues.length) {
    throw new Error(`Theme "${slug}" contains unsafe files: ${scanIssues.slice(0, 3).join('; ')}`);
  }

  return { manifest, missingRecommended: RECOMMENDED_TEMPLATES.filter((name) => !templateAvailable(slug, name)) };
}

async function syncInstalledThemes() {
  return themeLoader.syncInstalledThemes();
}

async function installThemeFromArchive(zipPath) {
  const { manifest, installPath } = await extractZipArchive(zipPath, themeLoader.themesRoot, 'theme.json');
  themeLoader.validateManifest(manifest);

  const scanIssues = scanThemeDirectory(installPath);
  if (scanIssues.length) {
    themeLoader.removeThemeDirectory(manifest.slug);
    throw new Error(`Theme archive contains blocked files: ${scanIssues.slice(0, 3).join('; ')}`);
  }

  if (manifest.parent) {
    const parentExists = fs.existsSync(path.join(themeLoader.themesRoot, manifest.parent, 'theme.json'));
    if (!parentExists) {
      themeLoader.removeThemeDirectory(manifest.slug);
      throw new Error(`Parent theme "${manifest.parent}" is not installed. Install the parent theme first.`);
    }
  }

  await syncInstalledThemes();
  return manifest;
}

async function activateTheme(themeId) {
  const theme = await Theme.findByPk(themeId);
  if (!theme) throw new Error('Theme not found.');

  validateThemeForActivation(theme.slug);

  await Theme.update({ active: false }, { where: {} });
  await theme.update({ active: true });
  await ThemeSetting.update({ active: false }, { where: {} });
  await ThemeSetting.findOrCreate({
    where: { theme_name: theme.slug },
    defaults: themeLoader.buildThemeSettingDefaults(theme.slug)
  });
  await ThemeSetting.update({ active: true }, { where: { theme_name: theme.slug } });
  return theme;
}

async function resetThemeSettings() {
  const active = await ThemeSetting.findOne({ where: { active: true } });
  const slug = active?.theme_name || 'classic-blog';
  const defaults = themeLoader.buildThemeSettingDefaults(slug);
  if (active) {
    await active.update(defaults);
    return active;
  }
  return ThemeSetting.create(defaults);
}

function getThemeDetails(slug) {
  const theme = themeLoader.getThemeBySlug(slug);
  if (!theme) return null;
  const assets = themeLoader.discoverThemeAssets(slug);
  let activationCheck = null;
  try {
    activationCheck = validateThemeForActivation(slug);
  } catch (error) {
    activationCheck = { error: error.message };
  }
  return {
    ...theme,
    assets,
    activationCheck,
    screenshotPath: [
      path.join(theme.path, 'screenshot.png'),
      path.join(theme.path, 'screenshot.svg')
    ].find((file) => fs.existsSync(file))
  };
}

module.exports = {
  REQUIRED_TEMPLATES,
  RECOMMENDED_TEMPLATES,
  TEMPLATE_ALIASES,
  BUILT_IN_THEMES,
  BLOCKED_THEME_EXTENSIONS,
  normalizeTemplateName,
  scanThemeDirectory,
  templateAvailable,
  validateThemeForActivation,
  syncInstalledThemes,
  installThemeFromArchive,
  activateTheme,
  resetThemeSettings,
  getThemeDetails,
  ...themeLoader
};
