const { validateProductionEnv, isWeakSecret, REQUIRED_PRODUCTION } = require('../config/env');

describe('production environment validation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('allows development without strict production checks', () => {
    expect(() => validateProductionEnv({ env: 'development' })).not.toThrow();
  });

  test('rejects production when required variables are missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_URL = 'https://example.com';
    process.env.SESSION_SECRET = 'a'.repeat(40);
    delete process.env.DB_HOST;
    expect(() => validateProductionEnv({ env: 'production' })).toThrow(/DB_HOST/);
  });

  test('rejects weak production session secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_URL = 'https://example.com';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_USER = 'root';
    process.env.DB_NAME = 'nodepress_cms';
    process.env.SESSION_SECRET = 'change-this-long-random-secret';
    expect(() => validateProductionEnv({ env: 'production' })).toThrow(/SESSION_SECRET/);
  });

  test('accepts strong production configuration', () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_URL = 'https://example.com';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_USER = 'root';
    process.env.DB_NAME = 'nodepress_cms';
    process.env.SESSION_SECRET = 'x'.repeat(48);
    expect(validateProductionEnv({ env: 'production' })).toEqual({ valid: true, env: 'production' });
  });

  test('isWeakSecret flags short and default secrets', () => {
    expect(isWeakSecret('short')).toBe(true);
    expect(isWeakSecret('change-this-long-random-secret')).toBe(true);
    expect(isWeakSecret('x'.repeat(40))).toBe(false);
  });

  test('required production keys are documented', () => {
    expect(REQUIRED_PRODUCTION).toEqual(expect.arrayContaining(['SESSION_SECRET', 'APP_URL', 'DB_NAME']));
  });
});
