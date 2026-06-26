const fs = require('fs');
const path = require('path');
const semver = require('semver');
const pkg = require('../package.json');

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const DANGEROUS_PATH = /(\.\.|^[a-zA-Z]:|^\/|\\)/;

const KNOWN_PERMISSIONS = new Set([
  'view_dashboard',
  'manage_posts', 'create_posts', 'edit_posts', 'delete_posts', 'publish_posts',
  'manage_pages', 'manage_categories', 'manage_tags',
  'manage_media', 'upload_media',
  'manage_menus', 'manage_banners', 'manage_sliders',
  'manage_users', 'manage_roles',
  'manage_themes', 'manage_comments', 'manage_messages',
  'manage_plugins', 'manage_settings', 'manage_security', 'manage_waf',
  'manage_custom_post_types', 'manage_custom_content', 'manage_custom_fields'
]);

const DANGEROUS_MANIFEST_KEYS = ['__proto__', 'constructor', 'prototype'];

function assertSafeManifestObject(manifest, label = 'manifest') {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  for (const key of Object.keys(manifest)) {
    if (DANGEROUS_MANIFEST_KEYS.includes(key)) {
      throw new Error(`${label} contains disallowed key "${key}".`);
    }
    const value = manifest[key];
    if (typeof value === 'string' && DANGEROUS_PATH.test(value.replace(/\\/g, '/'))) {
      throw new Error(`${label} field "${key}" contains an unsafe path.`);
    }
  }
}

function normalizeSettingsSchema(manifest) {
  if (!manifest.settings) return [];
  if (Array.isArray(manifest.settings)) return manifest.settings;
  if (typeof manifest.settings === 'object') {
    return Object.entries(manifest.settings).map(([key, field]) => ({
      key,
      ...field,
      label: field.label || key
    }));
  }
  throw new Error('Plugin manifest "settings" must be an array or object.');
}

function validateManifest(manifest, { pluginPath = null, strict = true } = {}) {
  assertSafeManifestObject(manifest);

  for (const key of ['name', 'slug', 'version']) {
    if (!manifest[key] || typeof manifest[key] !== 'string') {
      throw new Error(`Plugin manifest is missing ${key}.`);
    }
  }

  if (!SLUG_PATTERN.test(manifest.slug)) {
    throw new Error(`Plugin slug "${manifest.slug}" must be lowercase kebab-case.`);
  }

  if (!semver.valid(semver.coerce(manifest.version))) {
    throw new Error(`Plugin version "${manifest.version}" is not valid semver.`);
  }

  const mainFile = manifest.main || 'index.js';
  if (typeof mainFile !== 'string' || DANGEROUS_PATH.test(mainFile.replace(/\\/g, '/'))) {
    throw new Error('Plugin manifest "main" must be a safe relative path.');
  }

  if (pluginPath) {
    const entryPath = path.resolve(pluginPath, mainFile);
    const root = path.resolve(pluginPath);
    if (!entryPath.startsWith(root + path.sep) && entryPath !== root) {
      throw new Error(`Plugin main file "${mainFile}" escapes the plugin directory.`);
    }
    if (!fs.existsSync(entryPath)) {
      throw new Error(`Plugin entry file "${mainFile}" is missing.`);
    }
  }

  const nodepressVersion = manifest.nodepressVersion || manifest.nodepress_version || manifest.requires;
  if (nodepressVersion && strict) {
    const range = String(nodepressVersion).replace(/^nodepress\s*/i, '').trim() || `>=${nodepressVersion}`;
    const coerced = semver.coerce(pkg.version);
    if (coerced && !semver.satisfies(coerced, range.startsWith('>') || range.startsWith('<') || range.startsWith('=') ? range : `>=${range}`)) {
      throw new Error(`Plugin requires NodePress ${range}; current version is ${pkg.version}.`);
    }
  }

  if (manifest.dependencies !== undefined && !Array.isArray(manifest.dependencies)) {
    throw new Error('Plugin manifest "dependencies" must be an array.');
  }

  if (manifest.permissions !== undefined) {
    if (!Array.isArray(manifest.permissions)) {
      throw new Error('Plugin manifest "permissions" must be an array.');
    }
    for (const perm of manifest.permissions) {
      if (typeof perm !== 'string' || !KNOWN_PERMISSIONS.has(perm)) {
        throw new Error(`Unknown or invalid plugin permission "${perm}".`);
      }
    }
  }

  if (manifest.hooks !== undefined && !Array.isArray(manifest.hooks)) {
    throw new Error('Plugin manifest "hooks" must be an array.');
  }

  manifest._normalizedSettings = normalizeSettingsSchema(manifest);
  return manifest;
}

function validatePluginDirectory(pluginPath) {
  const manifestPath = path.join(pluginPath, 'plugin.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('plugin.json was not found.');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return validateManifest(manifest, { pluginPath, strict: false });
}

module.exports = {
  SLUG_PATTERN,
  KNOWN_PERMISSIONS,
  validateManifest,
  validatePluginDirectory,
  normalizeSettingsSchema,
  assertSafeManifestObject
};
