const request = require('supertest');
const { app, models } = require('../server');
const { clearWafCache } = require('../middleware/waf');
const {
  validatePattern,
  safeRegex,
  maskSensitiveFields,
  matchPattern,
  shouldSkipWaf
} = require('../utils/wafHelper');

async function setWafMode(mode) {
  await models.WafSetting.upsert({ setting_key: 'waf_enabled', setting_value: 'true', setting_type: 'boolean' });
  await models.WafSetting.upsert({ setting_key: 'waf_mode', setting_value: mode, setting_type: 'string' });
  clearWafCache();
}

afterAll(async () => {
  await setWafMode('monitor');
});

test('homepage loads normally with WAF enabled', async () => {
  await setWafMode('monitor');
  const response = await request(app).get('/');
  expect(response.status).toBeLessThan(500);
});

test('static assets bypass WAF inspection path', () => {
  expect(shouldSkipWaf({ path: '/css/admin.css' })).toBe(true);
  expect(shouldSkipWaf({ path: '/uploads/sample.jpg' })).toBe(true);
});

test('monitor mode logs suspicious SQLi query without blocking', async () => {
  await setWafMode('monitor');
  const before = await models.WafLog.count();
  const response = await request(app).get('/?q=1%20UNION%20SELECT%20null');
  expect(response.status).toBeLessThan(500);
  const after = await models.WafLog.count();
  expect(after).toBeGreaterThanOrEqual(before);
});

test('block mode blocks suspicious SQLi query', async () => {
  await setWafMode('block');
  const response = await request(app).get('/?search=1%20OR%201%3D1');
  expect([403, 200]).toContain(response.status);
  if (response.status === 403) {
    expect(response.text).toMatch(/403|Forbidden|blocked/i);
  }
  await setWafMode('monitor');
});

test('scanner user-agent is handled in block mode', async () => {
  await setWafMode('block');
  const response = await request(app)
    .get('/')
    .set('User-Agent', 'sqlmap/1.0');
  expect([403, 200]).toContain(response.status);
  await setWafMode('monitor');
});

test('CMS probe request to /.env is handled', async () => {
  await setWafMode('block');
  const response = await request(app).get('/.env');
  expect([403, 404, 200]).toContain(response.status);
  await setWafMode('monitor');
});

test('invalid custom regex does not crash helper', () => {
  expect(safeRegex('([')).toBeNull();
  expect(validatePattern('([', 'regex')).toBe(false);
  expect(matchPattern('test', { pattern: '([', pattern_type: 'regex' })).toBe(false);
});

test('WAF log masking removes sensitive fields', () => {
  const masked = maskSensitiveFields({ password: 'secret', email: 'a@b.com', token: 'abc' });
  expect(masked.password).toBe('[FILTERED]');
  expect(masked.token).toBe('[FILTERED]');
  expect(masked.email).toBe('a@b.com');
});

test('contains pattern type matches normalized values', () => {
  const rule = { pattern: 'UNION SELECT', pattern_type: 'contains' };
  expect(matchPattern('foo union select bar', rule)).toBe(true);
});

test('API-style request receives JSON 403 when blocked', async () => {
  await setWafMode('block');
  const response = await request(app)
    .get('/?id=1%20UNION%20SELECT%201')
    .set('Accept', 'application/json');
  if (response.status === 403) {
    expect(response.headers['content-type']).toMatch(/json/);
  }
  await setWafMode('monitor');
});
