const DEFAULT_TIMEZONE = 'UTC';

const FALLBACK_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/New_York',
  'America/Sao_Paulo',
  'America/Toronto',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Asia/Yangon',
  'Australia/Melbourne',
  'Australia/Sydney',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Paris',
  'Pacific/Auckland'
];

function isValidTimezone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveSiteTimezone(siteSettings = {}) {
  const candidate = siteSettings?.site_timezone || process.env.SITE_TIMEZONE || DEFAULT_TIMEZONE;
  return isValidTimezone(candidate) ? candidate : DEFAULT_TIMEZONE;
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatInTimezone(value, timeZone, options = {}) {
  const date = toDate(value);
  if (!date) return '';
  const tz = resolveSiteTimezone({ site_timezone: timeZone });
  const { locale, ...intlOptions } = options;
  return new Intl.DateTimeFormat(locale || undefined, {
    timeZone: tz,
    ...intlOptions
  }).format(date);
}

function toDatetimeLocalValue(value, timeZone) {
  const date = toDate(value);
  if (!date) return '';
  const tz = resolveSiteTimezone({ site_timezone: timeZone });
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function parseDatetimeLocal(localValue, timeZone) {
  if (!localValue) return null;
  const tz = resolveSiteTimezone({ site_timezone: timeZone });
  const normalized = String(localValue).trim();
  const target = normalized.length >= 16 ? normalized.slice(0, 16) : normalized;
  const [datePart, timePart = '00:00'] = target.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if (!year || !month || !day) return null;

  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const formatted = toDatetimeLocalValue(new Date(utc), tz);
    if (formatted === target) return new Date(utc);
    const [fy, fm, fd] = formatted.split('T')[0].split('-').map(Number);
    const [fh, fmin] = formatted.split('T')[1].split(':').map(Number);
    utc += Date.UTC(year, month - 1, day, hour, minute) - Date.UTC(fy, fm - 1, fd, fh, fmin);
  }
  return new Date(utc);
}

function createDateFormatters({ timeZone, locale } = {}) {
  const tz = resolveSiteTimezone({ site_timezone: timeZone });
  const loc = locale || undefined;

  const formatDate = (value, options = {}) => formatInTimezone(value, tz, {
    locale: loc,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  });

  const formatDateTime = (value, options = {}) => formatInTimezone(value, tz, {
    locale: loc,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options
  });

  const formatTime = (value, options = {}) => formatInTimezone(value, tz, {
    locale: loc,
    hour: 'numeric',
    minute: '2-digit',
    ...options
  });

  return {
    siteTimezone: tz,
    formatDate,
    formatDateTime,
    formatTime,
    toDatetimeLocalValue: (value) => toDatetimeLocalValue(value, tz),
    parseDatetimeLocal: (value) => parseDatetimeLocal(value, tz)
  };
}

function listTimezones() {
  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('timeZone').slice().sort();
  }
  return FALLBACK_TIMEZONES.slice();
}

function getTimezoneOptions() {
  return listTimezones().map((value) => ({
    value,
    label: value.replace(/_/g, ' ')
  }));
}

module.exports = {
  DEFAULT_TIMEZONE,
  isValidTimezone,
  resolveSiteTimezone,
  formatInTimezone,
  toDatetimeLocalValue,
  parseDatetimeLocal,
  createDateFormatters,
  listTimezones,
  getTimezoneOptions
};
