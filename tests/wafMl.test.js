const {
  mapPredictionCategory,
  confidenceToSeverity,
  buildWebGuardAnalyzePayload,
  mlResultToMatch,
  shouldUseMlWaf
} = require('../utils/wafMlHelper');

describe('wafMlHelper', () => {
  test('maps WebGuard labels to WAF categories', () => {
    expect(mapPredictionCategory('sqli')).toBe('sql_injection');
    expect(mapPredictionCategory('xss')).toBe('xss');
    expect(mapPredictionCategory('csrf')).toBe('custom');
    expect(mapPredictionCategory('unknown')).toBe('custom');
  });

  test('builds analyze payload from request data', () => {
    const req = {
      method: 'POST',
      originalUrl: '/search?q=test',
      query: { q: 'test' },
      get: (name) => ({ referer: 'https://example.com' }[name.toLowerCase()])
    };
    const normalized = {
      url: '/search?q=test',
      body: [{ key: 'body.email', value: 'a@b.com' }]
    };
    const payload = buildWebGuardAnalyzePayload(req, normalized, 'rf_demo');
    expect(payload.method).toBe('POST');
    expect(payload.url).toBe('/search');
    expect(payload.query_params).toBe('q=test');
    expect(payload.model_id).toBe('rf_demo');
    expect(payload.headers.referer).toBe('https://example.com');
  });

  test('converts confident attack analysis into WAF match', () => {
    const match = mlResultToMatch({
      prediction: 'sqli',
      confidence: 0.92,
      is_attack: true,
      uncertain: false
    }, { ml_waf_confidence_threshold: 0.7 });
    expect(match).not.toBeNull();
    expect(match.rule.category).toBe('sql_injection');
    expect(match.rule.action).toBe('block');
    expect(match.rule.score).toBe(92);
    expect(confidenceToSeverity(0.92)).toBe('critical');
  });

  test('skips uncertain or low-confidence predictions', () => {
    expect(mlResultToMatch({
      prediction: 'xss',
      confidence: 0.8,
      is_attack: true,
      uncertain: true
    }, { ml_waf_confidence_threshold: 0.7 })).toBeNull();

    expect(mlResultToMatch({
      prediction: 'xss',
      confidence: 0.4,
      is_attack: true,
      uncertain: false
    }, { ml_waf_confidence_threshold: 0.7 })).toBeNull();
  });

  test('shouldUseMlWaf respects WebGuard config and setting flag', () => {
    const enabledSettings = {
      ml_waf_enabled: true,
      webguard_api_url: 'http://127.0.0.1:8001',
      webguard_api_key: 'test-key'
    };
    expect(shouldUseMlWaf(enabledSettings)).toBe(true);
    expect(shouldUseMlWaf({ ...enabledSettings, ml_waf_enabled: false })).toBe(false);
    expect(shouldUseMlWaf({ ml_waf_enabled: true, webguard_api_url: '', webguard_api_key: '' })).toBe(false);
  });
});
