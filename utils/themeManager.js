const fs = require('fs');
const path = require('path');
const { Theme, ThemeSetting } = require('../models');
const themeLoader = require('./themeLoader');
const themeValidator = require('./themeValidator');
const themeInstaller = require('./themeInstaller');
const templateResolver = require('./templateResolver');

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

  const manifest = themeLoader.validateManifest({ ...theme.manifest }, { themePath: theme.path, themesRoot: themeLoader.themesRoot, strict: false });
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

async function installThemeFromArchive(zipPath, options = {}) {
  const { manifest } = await themeInstaller.installFromZip(zipPath, options);
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

async function getThemeHealth(slug) {
  const row = await Theme.findOne({ where: { slug } });
  const disk = themeLoader.getThemeBySlug(slug);
  let activationCheck = { error: null };
  try {
    validateThemeForActivation(slug);
  } catch (error) {
    activationCheck = { error: error.message };
  }
  return {
    slug,
    active: Boolean(row?.active),
    on_disk: Boolean(disk),
    error_state: row?.error_state || (activationCheck.error ? 'error' : 'none'),
    last_error: row?.last_error || activationCheck.error || null,
    update_available: Boolean(row?.update_available),
    latest_version: row?.latest_version || null,
    parent: disk?.manifest?.parent || row?.parent_slug || null
  };
}

async function exportThemeSettings(slug) {
  const setting = await ThemeSetting.findOne({ where: { theme_name: slug, active: true } })
    || await ThemeSetting.findOne({ where: { theme_name: slug } });
  if (!setting) return themeLoader.buildThemeSettingDefaults(slug);
  return setting.get({ plain: true });
}

async function importThemeSettings(slug, json, _user = null) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  const [setting] = await ThemeSetting.findOrCreate({
    where: { theme_name: slug, active: true },
    defaults: themeLoader.buildThemeSettingDefaults(slug)
  });
  const allowed = Object.keys(themeLoader.buildThemeSettingDefaults(slug));
  const payload = {};
  for (const key of allowed) {
    if (data[key] !== undefined) payload[key] = data[key];
  }
  await setting.update(payload);
  return setting;
}

async function previewTheme(slug, req) {
  if (req?.session) req.session.themePreview = slug;
  return slug;
}

async function resolveTemplate(type, context = {}) {
  return themeLoader.resolveTemplate(type, context);
}

async function resolvePartial(name, context = {}) {
  return themeLoader.resolvePartial(name, context);
}

function getThemeAssets(slug) {
  return themeLoader.discoverThemeAssets(slug);
}

function discoverThemes() {
  return themeLoader.discoverThemes();
}

function getTheme(slug) {
  return themeLoader.getThemeBySlug(slug);
}

function validateTheme(slug) {
  const theme = themeLoader.getThemeBySlug(slug);
  if (!theme) return { valid: false, errors: ['Theme not found.'] };
  try {
    themeValidator.validateManifest(theme.manifest, { themePath: theme.path, themesRoot: themeLoader.themesRoot, strict: false });
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

async function deleteTheme(slug, _user) {
  const theme = await Theme.findOne({ where: { slug } });
  if (!theme) throw new Error('Theme not found.');
  if (theme.active) throw new Error('Cannot delete active theme.');
  const children = await themeLoader.getChildThemeSlugsFromDb(slug);
  if (children.length) throw new Error(`Child themes depend on this theme: ${children.join(', ')}`);
  await ThemeSetting.destroy({ where: { theme_name: slug } });
  await theme.destroy();
  themeLoader.removeThemeDirectory(slug);
  return true;
}

async function getActiveTheme() {
  const row = await Theme.findOne({ where: { active: true } });
  return row || await Theme.findOne({ where: { slug: templateResolver.DEFAULT_THEME } });
}

async function saveThemeSettings(slug, settings, _user = null) {
  const [setting] = await ThemeSetting.findOrCreate({
    where: { theme_name: slug, active: true },
    defaults: themeLoader.buildThemeSettingDefaults(slug)
  });
  await setting.update(settings);
  return setting;
}

module.exports = {
  REQUIRED_TEMPLATES,
  RECOMMENDED_TEMPLATES,
  TEMPLATE_ALIASES,
  BUILT_IN_THEMES,
  BLOCKED_THEME_EXTENSIONS,
  normalizeTemplateName,
  scanThemeDirectory: themeInstaller.scanThemeDirectory,
  templateAvailable,
  validateThemeForActivation,
  validateTheme,
  syncInstalledThemes,
  installThemeFromArchive,
  activateTheme,
  resetThemeSettings,
  getThemeDetails,
  discoverThemes,
  getTheme,
  getActiveTheme,
  getThemeHealth,
  exportThemeSettings,
  importThemeSettings,
  previewTheme,
  resolveTemplate,
  resolvePartial,
  getThemeAssets,
  deleteTheme,
  saveThemeSettings,
  ...themeLoader
};
