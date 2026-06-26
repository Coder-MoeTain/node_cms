const {
  DEFAULT_TIMEZONE,
  isValidTimezone,
  resolveSiteTimezone,
  formatInTimezone,
  toDatetimeLocalValue,
  parseDatetimeLocal,
  createDateFormatters
} = require('../utils/timezoneHelper');

describe('timezoneHelper', () => {
  test('resolveSiteTimezone falls back to UTC for invalid values', () => {
    expect(resolveSiteTimezone({ site_timezone: 'Not/A/Zone' })).toBe(DEFAULT_TIMEZONE);
    expect(resolveSiteTimezone({ site_timezone: 'Asia/Yangon' })).toBe('Asia/Yangon');
  });

  test('isValidTimezone accepts IANA zones', () => {
    expect(isValidTimezone('Asia/Yangon')).toBe(true);
    expect(isValidTimezone('bogus')).toBe(false);
  });

  test('formatInTimezone formats using site timezone', () => {
    const value = new Date('2024-06-15T08:00:00.000Z');
    expect(formatInTimezone(value, 'Asia/Yangon', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })).toMatch(/14:30/);
  });

  test('datetime-local round trip in site timezone', () => {
    const utc = new Date('2024-06-15T08:00:00.000Z');
    const local = toDatetimeLocalValue(utc, 'Asia/Yangon');
    expect(local).toBe('2024-06-15T14:30');
    const parsed = parseDatetimeLocal(local, 'Asia/Yangon');
    expect(parsed.toISOString()).toBe(utc.toISOString());
  });

  test('createDateFormatters exposes helpers', () => {
    const formatters = createDateFormatters({ timeZone: 'UTC', locale: 'en-US' });
    expect(formatters.siteTimezone).toBe('UTC');
    expect(formatters.formatDate('2024-01-02T12:00:00.000Z')).toMatch(/Jan/);
    expect(formatters.formatDateTime('2024-01-02T12:00:00.000Z')).toMatch(/Jan/);
  });
});
