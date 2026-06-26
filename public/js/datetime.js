(function initNpDatetime(global) {
  function siteTimezone() {
    const meta = document.querySelector('meta[name="site-timezone"]');
    return meta?.content || 'UTC';
  }

  function formatDateTime(value, options = {}) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      timeZone: siteTimezone(),
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...options
    }).format(date);
  }

  function formatDate(value, options = {}) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      timeZone: siteTimezone(),
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    }).format(date);
  }

  global.npFormatDateTime = formatDateTime;
  global.npFormatDate = formatDate;
  global.npFormatTime = (value, options = {}) => formatDateTime(value, {
    year: undefined,
    month: undefined,
    day: undefined,
    ...options
  });
})(window);
