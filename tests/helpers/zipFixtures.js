const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function createZipArchive(files, zipPath) {
  const zip = new AdmZip();
  for (const [relPath, content] of Object.entries(files)) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    zip.addFile(relPath.replace(/\\/g, '/'), buffer);
  }
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  zip.writeZip(zipPath);
  return zipPath;
}

const REQUIRED_THEME_TEMPLATES = ['home', 'blog', 'post', 'page', 'search', 'contact'];

function themeTemplateFiles(slug, extra = {}) {
  const files = {
    'theme.json': JSON.stringify({
      name: extra.name || `Test Theme ${slug}`,
      slug,
      version: '1.0.0',
      author: 'NodePress Tests',
      description: 'Theme fixture for integration tests',
      parent: extra.parent,
      templates: REQUIRED_THEME_TEMPLATES
    }, null, 2)
  };
  for (const template of REQUIRED_THEME_TEMPLATES) {
    files[`templates/${template}.ejs`] = `<section class="theme-${slug}"><%= title || '${template}' %></section>`;
  }
  return files;
}

function pluginFixtureFiles(slug, extra = {}) {
  return {
    'plugin.json': JSON.stringify({
      name: extra.name || `Test Plugin ${slug}`,
      slug,
      version: '1.0.0',
      author: 'NodePress Tests',
      description: 'Plugin fixture for integration tests'
    }, null, 2),
    'index.js': extra.indexJs || `module.exports = {
  register({ hooks }) {
    hooks.register('publicFooter', () => '<!-- ${slug}-active -->', 10);
  },
  onInstall() { global.__${slug.replace(/-/g, '_')}Install = true; },
  onActivate() { global.__${slug.replace(/-/g, '_')}Activate = true; },
  onDeactivate() {},
  onUninstall() { global.__${slug.replace(/-/g, '_')}Uninstall = true; }
};
`
  };
}

module.exports = {
  createZipArchive,
  themeTemplateFiles,
  pluginFixtureFiles,
  REQUIRED_THEME_TEMPLATES
};
