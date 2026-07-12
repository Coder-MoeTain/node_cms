const { isPathExcluded, resolveRequestCountry } = require('../utils/wafAdminHelper');

describe('wafAdminHelper', () => {
  test('isPathExcluded matches exact and wildcard paths', () => {
    const raw = '/webhooks/stripe\n/api/public/*\n/health';
    expect(isPathExcluded('/webhooks/stripe', raw)).toBe(true);
    expect(isPathExcluded('/api/public/v1', raw)).toBe(true);
    expect(isPathExcluded('/posts/hello', raw)).toBe(false);
  });

  test('resolveRequestCountry reads proxy headers', () => {
    const req = { get(name) { return name === 'cf-ipcountry' ? 'us' : null; } };
    expect(resolveRequestCountry(req)).toBe('US');
  });
});
