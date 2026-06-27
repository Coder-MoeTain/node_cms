const fs = require('fs');
const path = require('path');
const { extractZipArchive } = require('./packageArchive');
const themeValidator = require('./themeValidator');
const themeLoader = require('./themeLoader');
const { Theme } = require('../models');

async function installFromZip(zipPath, { overwrite = true } = {}) {
  const themesRoot = themeLoader.themesRoot;
  const slugBefore = await peekZipSlug(zipPath, 'theme.json');
  if (slugBefore && !overwrite) {
    const existing = await Theme.findOne({ where: { slug: slugBefore } });
    if (existing) throw new Error(`Theme "${slugBefore}" already exists. Confirm overwrite to replace it.`);
  }

  const { manifest, installPath } = await extractZipArchive(zipPath, themesRoot, 'theme.json', { archiveType: 'theme' });
  themeValidator.validateManifest(manifest, {
    themePath: installPath,
    themesRoot,
    strict: false,
    requireTemplates: !manifest.parent,
    validateScreenshot: true
  });

  const scanIssues = scanThemeDirectory(installPath);
  if (scanIssues.length) {
    themeLoader.removeThemeDirectory(manifest.slug);
    throw new Error(`Theme archive contains blocked files: ${scanIssues.slice(0, 3).join('; ')}`);
  }

  if (manifest.parent) {
    const parentExists = fs.existsSync(path.join(themesRoot, manifest.parent, 'theme.json'));
    if (!parentExists) {
      themeLoader.removeThemeDirectory(manifest.slug);
      throw new Error(`Parent theme "${manifest.parent}" is not installed. Install the parent theme first.`);
    }
  }

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

const BLOCKED_THEME_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.jar', '.dll', '.msi', '.vbs', '.ps1', '.htaccess'
]);

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
  for (const filePath of listThemeFiles(themePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const relative = path.relative(themePath, filePath).replace(/\\/g, '/');
    if (BLOCKED_THEME_EXTENSIONS.has(ext)) {
      issues.push(`Blocked file type "${ext}" in ${relative}`);
    }
    if (relative.includes('..')) issues.push(`Unsafe path "${relative}"`);
    const base = path.basename(relative).toLowerCase();
    if (base === '.env' || ext === '.pem' || ext === '.key') {
      issues.push(`Blocked sensitive file in ${relative}`);
    }
    if (ext === '.js' || ext === '.mjs') {
      if (!relative.startsWith('public/') && !relative.startsWith('assets/')) {
        issues.push(`Theme JS must live under public/ or assets/: ${relative}`);
      }
    }
  }
  return issues;
}

module.exports = {
  installFromZip,
  scanThemeDirectory,
  peekZipSlug
};
