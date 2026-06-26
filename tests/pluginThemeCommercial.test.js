const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');
const { extractZipArchive, isSafeEntryName } = require('../utils/packageArchive');
const { isZipMagicBytes, scanExtractedDirectory, MAX_ARCHIVE_FILES } = require('../utils/packageScan');
const pluginValidator = require('../utils/pluginValidator');
const themeValidator = require('../utils/themeValidator');
const { createZipArchive, pluginFixtureFiles, themeTemplateFiles } = require('./helpers/zipFixtures');

function writeZip(entries, zipPath) {
  return createZipArchive(entries, zipPath);
}

describe('pluginValidator', () => {
  test('accepts valid manifest', () => {
    const manifest = pluginValidator.validateManifest({
      name: 'Test', slug: 'test-plugin', version: '1.0.0', main: 'index.js'
    }, { strict: false });
    expect(manifest.slug).toBe('test-plugin');
  });

  test('rejects invalid slug', () => {
    expect(() => pluginValidator.validateManifest({
      name: 'Bad', slug: 'Bad Slug', version: '1.0.0'
    })).toThrow(/slug/i);
  });

  test('rejects unknown permission', () => {
    expect(() => pluginValidator.validateManifest({
      name: 'Bad', slug: 'bad-plugin', version: '1.0.0', permissions: ['hack_everything']
    })).toThrow(/permission/i);
  });
});

describe('hookManager commercial features', () => {
  const hookManager = require('../utils/hookManager');

  beforeEach(() => hookManager.clearHooks());

  test('supports priority ordering', async () => {
    const order = [];
    hookManager.addAction('test:order', () => order.push('b'), 20);
    hookManager.addAction('test:order', () => order.push('a'), 5);
    await hookManager.doAction('test:order');
    expect(order).toEqual(['a', 'b']);
  });

  test('isolates filter errors', async () => {
    hookManager.addFilter('test:filter', () => { throw new Error('boom'); }, 10);
    hookManager.addFilter('test:filter', (v) => `${v}!`, 20);
    const result = await hookManager.applyFilters('test:filter', 'ok');
    expect(result).toBe('ok!');
  });

  test('removeAction and hasHook work', () => {
    const fn = () => {};
    hookManager.addAction('test:remove', fn, 10);
    expect(hookManager.hasHook('test:remove')).toBe(true);
    hookManager.removeAction('test:remove', fn);
    expect(hookManager.hasHook('test:remove')).toBe(false);
  });
});

describe('templateResolver hierarchy', () => {
  const templateResolver = require('../utils/templateResolver');
  const themeLoader = require('../utils/themeLoader');

  test('single post hierarchy prefers post template', () => {
    const chain = themeLoader.resolveThemeChain('classic-blog');
    const resolved = templateResolver.resolveTemplatePath('post', { postType: 'post' }, { chain, themesRoot: themeLoader.themesRoot });
    expect(resolved).toMatch(/post|single|index/);
  });

  test('category hierarchy falls back to archive', () => {
    const chain = themeLoader.resolveThemeChain('classic-blog');
    const resolved = templateResolver.resolveTemplatePath('category', { slug: 'news' }, { chain, themesRoot: themeLoader.themesRoot });
    expect(resolved).toMatch(/archive|category|blog|home/);
  });
});

describe('malicious ZIP rejection', () => {
  const targetRoot = path.join(os.tmpdir(), `zip-sec-${Date.now()}`);

  afterAll(() => {
    if (fs.existsSync(targetRoot)) fs.rmSync(targetRoot, { recursive: true, force: true });
  });

  test('rejects non-zip file', async () => {
    const fake = path.join(targetRoot, 'fake.zip');
    fs.mkdirSync(targetRoot, { recursive: true });
    fs.writeFileSync(fake, 'not a zip');
    await expect(extractZipArchive(fake, targetRoot, 'plugin.json')).rejects.toThrow(/valid ZIP/i);
  });

  test('rejects zip slip paths', () => {
    expect(isSafeEntryName('../evil.php')).toBe(false);
    expect(isSafeEntryName('/etc/passwd')).toBe(false);
    expect(isSafeEntryName('plugin/plugin.json')).toBe(true);
  });

  test('rejects archive missing plugin.json', async () => {
    const zipPath = path.join(targetRoot, 'no-manifest.zip');
    writeZip({ 'index.js': 'module.exports = {};' }, zipPath);
    await expect(extractZipArchive(zipPath, targetRoot, 'plugin.json')).rejects.toThrow(/plugin.json/i);
  });

  test('rejects .env in plugin archive', async () => {
    const zipPath = path.join(targetRoot, 'env-plugin.zip');
    writeZip({
      ...pluginFixtureFiles('env-leak-plugin'),
      '.env': 'SECRET=1'
    }, zipPath);
    await expect(extractZipArchive(zipPath, targetRoot, 'plugin.json')).rejects.toThrow(/Blocked|\.env/i);
  });

  test('accepts valid plugin zip', async () => {
    const pluginsDir = path.join(targetRoot, 'plugins');
    fs.mkdirSync(pluginsDir, { recursive: true });
    const zipPath = path.join(targetRoot, 'valid-plugin.zip');
    writeZip(pluginFixtureFiles('valid-zip-plugin'), zipPath);
    const { manifest } = await extractZipArchive(zipPath, pluginsDir, 'plugin.json');
    expect(manifest.slug).toBe('valid-zip-plugin');
  });

  test('rejects theme zip missing theme.json', async () => {
    const zipPath = path.join(targetRoot, 'no-theme-json.zip');
    writeZip({ 'templates/index.ejs': '<%= title %>' }, zipPath);
    await expect(extractZipArchive(zipPath, targetRoot, 'theme.json')).rejects.toThrow(/theme.json/i);
  });
});

describe('plugin safe mode', () => {
  const pluginLoader = require('../utils/pluginLoader');

  test('isSafeMode respects env flag', () => {
    const prev = process.env.PLUGIN_SAFE_MODE;
    process.env.PLUGIN_SAFE_MODE = 'true';
    expect(pluginLoader.isSafeMode()).toBe(true);
    process.env.PLUGIN_SAFE_MODE = prev;
  });
});

describe('broken plugin isolation', () => {
  const pluginLoader = require('../utils/pluginLoader');
  const { Plugin } = require('../models');

  const SLUG = 'broken-plugin-test';

  afterEach(async () => {
    await Plugin.update({ active: false }, { where: { slug: SLUG } });
    pluginLoader.removePluginDirectory(SLUG);
  });

  test('broken plugin is marked error and does not crash load', async () => {
    const dir = path.join(pluginLoader.pluginsRoot, SLUG);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({
      name: 'Broken', slug: SLUG, version: '1.0.0', main: 'index.js'
    }));
    fs.writeFileSync(path.join(dir, 'index.js'), 'throw new Error("broken");');
    await pluginLoader.syncInstalledPlugins();
    await Plugin.update({ active: true }, { where: { slug: SLUG } });
    await expect(pluginLoader.loadActivePlugins()).resolves.toEqual(expect.any(Array));
    const health = await pluginLoader.getPluginHealth(SLUG);
    expect(health.error_state).toBe('error');
  });
});
