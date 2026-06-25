const { execFileSync } = require('child_process');
const path = require('path');

const nodepress = path.join(process.cwd(), 'bin', 'nodepress');
const env = { ...process.env, NODE_ENV: 'test' };

function runCli(args, { expectFail = false } = {}) {
  try {
    return execFileSync(process.execPath, [nodepress, ...args], {
      cwd: process.cwd(),
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (error) {
    if (expectFail) return error.stdout?.toString() || error.stderr?.toString() || '';
    throw error;
  }
}

describe('NodePress CLI', () => {
  test('help lists supported commands', () => {
    const out = runCli(['help']);
    expect(out).toMatch(/nodepress health/i);
    expect(out).toMatch(/nodepress migrate/i);
    expect(out).toMatch(/nodepress export/i);
    expect(out).toMatch(/plugin:list/i);
    expect(out).toMatch(/theme:list/i);
  });

  test('health command returns JSON report', () => {
    const out = runCli(['health']);
    const report = JSON.parse(out);
    expect(Array.isArray(report.checks)).toBe(true);
    expect(['ok', 'warning', 'critical']).toContain(report.status);
  });

  test('theme:list prints installed themes', () => {
    const out = runCli(['theme:list']);
    expect(out).toMatch(/classic-blog|government-portal|myanmar-portal/);
  });

  test('plugin:list prints plugin rows', () => {
    const out = runCli(['plugin:list']);
    expect(out.length).toBeGreaterThan(0);
  });

  test('unknown command exits with error message', () => {
    const out = runCli(['not-a-command'], { expectFail: true });
    expect(out).toMatch(/Unknown command/i);
  });
});
