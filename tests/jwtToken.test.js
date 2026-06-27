const { signJwt, verifyJwt, normalizeScopes, hasApiScope, API_SCOPES } = require('../utils/jwtToken');

describe('JWT API tokens', () => {
  test('signJwt and verifyJwt round-trip', () => {
    const token = signJwt({ sub: 'client-1', scopes: ['read', 'write:posts'] }, { secret: 'test-secret', expiresInSec: 3600 });
    const payload = verifyJwt(token, { secret: 'test-secret' });
    expect(payload.sub).toBe('client-1');
    expect(payload.scopes).toEqual(['read', 'write:posts']);
  });

  test('normalizeScopes accepts admin alias', () => {
    expect(normalizeScopes('admin')).toEqual(expect.arrayContaining(API_SCOPES));
  });

  test('hasApiScope enforces write scopes', () => {
    expect(hasApiScope({ auth: 'jwt', scopes: ['read'] }, ['manage_posts'])).toBe(false);
    expect(hasApiScope({ auth: 'jwt', scopes: ['write:posts'] }, ['manage_posts'])).toBe(true);
    expect(hasApiScope({ auth: 'api_key', scopes: ['admin'] }, ['manage_posts'])).toBe(true);
  });
});
