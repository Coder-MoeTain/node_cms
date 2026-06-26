describe('webguardClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.WEBGUARD_API_URL;
    delete process.env.WEBGUARD_API_KEY;
    delete process.env.WEBGUARD_ALLOW_LOCALHOST;
  });

  test('returns analyze data when WebGuard responds successfully', async () => {
    process.env.WEBGUARD_API_URL = 'http://127.0.0.1:8001';
    process.env.WEBGUARD_API_KEY = 'test-key';
    process.env.WEBGUARD_ALLOW_LOCALHOST = 'true';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        prediction: 'sqli',
        confidence: 0.95,
        is_attack: true,
        uncertain: false
      })
    });

    const { analyzeRequest } = require('../utils/webguardClient');
    const result = await analyzeRequest({ method: 'GET', url: '/?id=1' });
    expect(result.ok).toBe(true);
    expect(result.data.prediction).toBe('sqli');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8001/api/ids/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': 'test-key' })
      })
    );
  });

  test('fails open by default when analyze request errors', async () => {
    process.env.WEBGUARD_API_URL = 'http://127.0.0.1:8001';
    process.env.WEBGUARD_API_KEY = 'test-key';
    process.env.WEBGUARD_ALLOW_LOCALHOST = 'true';

    global.fetch = jest.fn().mockRejectedValue(new Error('connection refused'));

    const { analyzeRequest } = require('../utils/webguardClient');
    const result = await analyzeRequest({ method: 'GET', url: '/' });
    expect(result.ok).toBe(false);
    expect(result.failOpen).toBe(true);
  });
});
