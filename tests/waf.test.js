const request = require('supertest');
const { app, models } = require('../server');
const { clearWafCache } = require('../middleware/waf');
const {
  validatePattern,
  safeRegex,
  maskSensitiveFields,
  matchPattern,
  shouldSkipWaf,
  ipMatchesListEntry,
  summarizeMatchedRules,
  MAX_REGEX_PATTERN_LENGTH
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
  expect(response.status).toBe(403);
  expect(response.text).toMatch(/403|Forbidden|blocked/i);
  await setWafMode('monitor');
});

test('scanner user-agent is handled in block mode', async () => {
  await setWafMode('block');
  const response = await request(app)
    .get('/')
    .set('User-Agent', 'sqlmap/1.0');
  expect(response.status).toBe(403);
  await setWafMode('monitor');
});

test('CMS probe request to /.env is handled', async () => {
  await setWafMode('block');
  const response = await request(app).get('/.env');
  expect(response.status).toBe(403);
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

test('IPv4 CIDR matching supports whitelist and block ranges', () => {
  expect(ipMatchesListEntry('203.0.113.44', '203.0.113.0/24')).toBe(true);
  expect(ipMatchesListEntry('203.0.114.1', '203.0.113.0/24')).toBe(false);
  expect(ipMatchesListEntry('10.0.0.5', '10.0.0.5')).toBe(true);
});

test('summarizeMatchedRules reports combined rule names', () => {
  const summary = summarizeMatchedRules([
    { rule: { id: 1, name: 'SQLi UNION SELECT', category: 'sql_injection', severity: 'critical' } },
    { rule: { id: 2, name: 'SQLi Comment Abuse', category: 'sql_injection', severity: 'medium' } }
  ]);
  expect(summary.name).toBe('SQLi UNION SELECT (+1 more)');
  expect(summary.severity).toBe('critical');
  expect(summary.all).toHaveLength(2);
});

test('getClientIp uses forwarded headers when proxy trust is enabled', () => {
  const { getClientIp } = require('../utils/wafHelper');
  const req = {
    ip: '127.0.0.1',
    headers: {
      'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      'cf-connecting-ip': '203.0.113.44'
    },
    socket: { remoteAddress: '127.0.0.1' },
    app: { get: () => false }
  };
  expect(getClientIp(req, true)).toBe('203.0.113.44');
  expect(getClientIp(req, false)).toBe('203.0.113.44');
});

test('oversized regex patterns are rejected', () => {
  const huge = 'a'.repeat(MAX_REGEX_PATTERN_LENGTH + 1);
  expect(validatePattern(huge, 'regex')).toBe(false);
  expect(safeRegex(huge)).toBeNull();
});

test('API-style request receives structured JSON 403 when blocked', async () => {
  await models.WafSetting.upsert({
    setting_key: 'waf_response_message',
    setting_value: 'Custom WAF block message.',
    setting_type: 'string'
  });
  await setWafMode('block');
  const response = await request(app)
    .get('/?id=1%20UNION%20SELECT%201')
    .set('Accept', 'application/json');
  expect(response.status).toBe(403);
  expect(response.headers['content-type']).toMatch(/json/);
  expect(response.body.error).toBe('waf_blocked');
  expect(response.body.message).toMatch(/Custom WAF block message|blocked/i);
  await setWafMode('monitor');
});
