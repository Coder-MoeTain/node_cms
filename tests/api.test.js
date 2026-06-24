function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('apiAuth middleware', () => {
  const originalKey = process.env.API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = originalKey;
    jest.resetModules();
  });

  test('allows requests when API_KEY is not configured', () => {
    delete process.env.API_KEY;
    const { apiAuth } = require('../middleware/apiAuth');
    const next = jest.fn();
    apiAuth({ get: () => null, query: {} }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects requests without a valid key', () => {
    process.env.API_KEY = 'secret-key';
    const { apiAuth } = require('../middleware/apiAuth');
    const next = jest.fn();
    const res = mockRes();
    apiAuth({ get: () => null, query: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts key from X-API-Key header', () => {
    process.env.API_KEY = 'secret-key';
    const { apiAuth } = require('../middleware/apiAuth');
    const next = jest.fn();
    apiAuth({ get: (name) => (name === 'x-api-key' ? 'secret-key' : null), query: {} }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
