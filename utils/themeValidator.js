const fs = require('fs');
const path = require('path');
const semver = require('semver');
const pkg = require('../package.json');

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const DANGEROUS_PATH = /(\.\.|^[a-zA-Z]:|^\/)/;

function assertSafeManifestObject(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Theme manifest must be a JSON object.');
  }
}

function normalizeSettingsSchema(manifest) {
  if (!manifest.settings) return {};
  if (typeof manifest.settings === 'object' && !Array.isArray(manifest.settings)) {
    return manifest.settings;
  }
  throw new Error('Theme manifest "settings" must be an object.');
}

function validateScreenshotPath(manifest, themePath) {
  if (!manifest.screenshot) return;
  const screenshot = String(manifest.screenshot);
  if (screenshot.startsWith('http://') || screenshot.startsWith('https://')) return;
  const match = screenshot.match(/^\/themes\/[^/]+\/(.+)$/);
  const relative = match ? match[1] : screenshot;
  if (DANGEROUS_PATH.test(relative.replace(/\\/g, '/'))) {
    throw new Error('Theme screenshot path is not safe.');
  }
  if (themePath && !fs.existsSync(path.join(themePath, relative))) {
    throw new Error(`Theme screenshot "${relative}" was not found.`);
  }
}

function validateManifest(manifest, {
  themePath = null,
  themesRoot = null,
  strict = true,
  requireTemplates = false,
  validateScreenshot = false
} = {}) {
  assertSafeManifestObject(manifest);

  for (const key of ['name', 'slug', 'version']) {
    if (!manifest[key] || typeof manifest[key] !== 'string') {
      throw new Error(`Theme manifest missing ${key}.`);
    }
  }

  if (!SLUG_PATTERN.test(manifest.slug)) {
    throw new Error(`Theme slug "${manifest.slug}" must be lowercase kebab-case.`);
  }

  if (!semver.valid(semver.coerce(manifest.version))) {
    throw new Error(`Theme version "${manifest.version}" is not valid semver.`);
  }

  if (manifest.parent) {
    if (!SLUG_PATTERN.test(manifest.parent)) {
      throw new Error(`Parent theme slug "${manifest.parent}" is invalid.`);
    }
    if (manifest.parent === manifest.slug) {
      throw new Error('Theme cannot be its own parent.');
    }
    if (themesRoot && !fs.existsSync(path.join(themesRoot, manifest.parent, 'theme.json'))) {
      throw new Error(`Parent theme "${manifest.parent}" is not installed.`);
    }
  }

  const nodepressVersion = manifest.nodepressVersion || manifest.nodepress_version;
  if (nodepressVersion && strict) {
    const range = String(nodepressVersion).trim();
    const coerced = semver.coerce(pkg.version);
    const testRange = range.startsWith('>') || range.startsWith('<') || range.startsWith('=') ? range : range;
    if (coerced && !semver.satisfies(coerced, testRange)) {
      throw new Error(`Theme requires NodePress ${range}; current version is ${pkg.version}.`);
    }
  }

  if (manifest.templates && !Array.isArray(manifest.templates)) {
    throw new Error('Theme manifest "templates" must be an array.');
  }
  if (manifest.layouts && !Array.isArray(manifest.layouts)) {
    throw new Error('Theme manifest "layouts" must be an array.');
  }

  if (themePath && requireTemplates) {
    const bases = ['index', 'home', 'blog'];
    const hasBase = bases.some((name) => fs.existsSync(path.join(themePath, 'templates', `${name}.ejs`)));
    if (!hasBase) {
      throw new Error('Theme must include templates/index.ejs, templates/home.ejs, or templates/blog.ejs.');
    }
  }

  if (themePath && validateScreenshot) {
    validateScreenshotPath(manifest, themePath);
  }

  manifest._normalizedSettings = normalizeSettingsSchema(manifest);
  return manifest;
}

module.exports = {
  SLUG_PATTERN,
  validateManifest,
  normalizeSettingsSchema,
  validateScreenshotPath
};
