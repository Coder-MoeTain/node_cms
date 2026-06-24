const { getPortalStats, formatCount } = require('../utils/portalStats');

describe('portalStats', () => {
  test('formatCount adds thousands separators', () => {
    expect(formatCount(1240)).toBe('1,240');
    expect(formatCount(85420)).toBe('85,420');
  });

  test('returns live stat items with urls', async () => {
    const stats = await getPortalStats({ portal_visit_count: '5' });
    expect(Array.isArray(stats.items)).toBe(true);
    expect(stats.items).toHaveLength(7);
    expect(stats.items[0]).toMatchObject({
      key: 'users',
      label: 'Registered users',
      url: '/contact?subject=Citizen+registration+request'
    });
    expect(stats.items[1].key).toBe('visitors');
    expect(stats.items[4].key).toBe('blogs');
    expect(stats.items[6]).toMatchObject({
      key: 'apps',
      label: 'Mobile App Gallery',
      url: '#portal-mobile-app'
    });
    expect(typeof stats.visitors).toBe('number');
    expect(typeof stats.registeredUsers).toBe('number');
  });
});
