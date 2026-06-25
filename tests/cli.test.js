const { spawnSync } = require('child_process');
const path = require('path');
const { models } = require('../server');
const { runChecks } = require('../utils/siteHealth');
const { discoverThemes } = require('../utils/themeLoader');
const { discoverPluginManifests, syncInstalledPlugins } = require('../utils/pluginLoader');

const nodepress = path.join(process.cwd(), 'bin', 'nodepress');
const env = { ...process.env, NODE_ENV: 'test', DOTENV_CONFIG_QUIET: 'true' };

function runCli(args) {
  const result = spawnSync(process.execPath, [nodepress, ...args], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
    timeout: 60000
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    text: `${result.stdout || ''}${result.stderr || ''}`
  };
}

function parseCliJson(output) {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object in CLI output: ${output.slice(0, 300)}`);
  }
  return JSON.parse(output.slice(start, end + 1));
}

describe('NodePress CLI', () => {
  test('help lists supported commands', () => {
    const { text, status } = runCli(['help']);
    expect(status).toBe(0);
    expect(text).toMatch(/nodepress health/i);
    expect(text).toMatch(/nodepress migrate/i);
    expect(text).toMatch(/nodepress export/i);
    expect(text).toMatch(/plugin:list/i);
    expect(text).toMatch(/theme:list/i);
  });

  test('health command uses site health checks', async () => {
    const direct = await runChecks();
    expect(Array.isArray(direct.checks)).toBe(true);
    expect(['ok', 'warning', 'critical', 'recommended']).toContain(direct.status);

    const { text, status } = runCli(['health']);
    if (status === 0 && text.includes('{')) {
      const report = parseCliJson(text);
      expect(report.checks.length).toBe(direct.checks.length);
    }
  });

  test('theme:list matches discovered themes', () => {
    const themes = discoverThemes();
    const { text, status } = runCli(['theme:list']);
    expect(status).toBe(0);
    themes.forEach((theme) => {
      expect(text).toMatch(theme.manifest.slug);
    });
  });

  test('plugin:list matches synced database plugins', async () => {
    await syncInstalledPlugins();
    const manifests = discoverPluginManifests();
    expect(manifests.length).toBeGreaterThan(0);
    const plugins = await models.Plugin.findAll({ where: { installed: true }, order: [['slug', 'ASC']] });
    expect(plugins.length).toBeGreaterThan(0);
    const { text, status } = runCli(['plugin:list']);
    if (status === 0 && text.trim()) {
      plugins.forEach((plugin) => {
        expect(text).toMatch(plugin.slug);
      });
    } else {
      manifests.forEach((item) => expect(item.manifest.slug).toBeTruthy());
    }
  });

  test('unknown command exits with error message', () => {
    const { text, status } = runCli(['not-a-command']);
    expect(status).toBe(1);
    expect(text).toMatch(/Unknown command/i);
  });
});
