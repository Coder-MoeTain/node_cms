const fs = require('fs');
const path = require('path');
const { extractZipArchive } = require('./packageArchive');
const pluginValidator = require('./pluginValidator');
const { Plugin } = require('../models');

async function installFromZip(zipPath, { activate = false, overwrite = true } = {}) {
  const pluginsRoot = path.join(process.cwd(), 'plugins');
  const slugBefore = await peekZipSlug(zipPath, 'plugin.json');
  if (slugBefore && !overwrite) {
    const existing = await Plugin.findOne({ where: { slug: slugBefore } });
    if (existing) throw new Error(`Plugin "${slugBefore}" already exists. Confirm overwrite to replace it.`);
  }

  const { manifest, installPath } = await extractZipArchive(zipPath, pluginsRoot, 'plugin.json', { archiveType: 'plugin' });
  pluginValidator.validateManifest(manifest, { pluginPath: installPath, strict: false });
  return { manifest, installPath };
}

async function peekZipSlug(zipPath, manifestName) {
  try {
    const unzipper = require('unzipper');
    const directory = await unzipper.Open.file(zipPath);
    for (const entry of directory.files) {
      if (!entry.path.endsWith(manifestName) || entry.type !== 'File') continue;
      const buf = await entry.buffer();
      const json = JSON.parse(buf.toString('utf8'));
      return json.slug || null;
    }
  } catch {
    return null;
  }
  return null;
}

function scanPluginDirectory(slug) {
  const pluginPath = path.join(process.cwd(), 'plugins', slug);
  if (!fs.existsSync(pluginPath)) return { valid: false, errors: ['Plugin directory missing.'] };
  try {
    pluginValidator.validatePluginDirectory(pluginPath);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

module.exports = {
  installFromZip,
  scanPluginDirectory,
  peekZipSlug
};
