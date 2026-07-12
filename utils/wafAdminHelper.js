const SEVERITY_BADGES = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'muted'
};

const ACTION_BADGES = {
  block: 'danger',
  rate_limit: 'warning',
  temporary_block: 'warning',
  log: 'info',
  allow: 'success'
};

const CATEGORY_LABELS = {
  sql_injection: 'SQL injection',
  xss: 'Cross-site scripting',
  command_injection: 'Command injection',
  path_traversal: 'Path traversal',
  file_attack: 'File attack',
  bad_bot: 'Bad bot',
  scanner: 'Scanner',
  brute_force: 'Brute force',
  spam: 'Spam',
  cms_probe: 'CMS probe',
  custom: 'Custom'
};

function severityBadge(severity) {
  return SEVERITY_BADGES[String(severity || '').toLowerCase()] || 'muted';
}

function actionBadge(action) {
  return ACTION_BADGES[String(action || '').toLowerCase()] || 'muted';
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category || 'Unknown';
}

function formatSnapshot(value) {
  if (value == null) return '';
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(value);
  }
}

function parsePathExclusions(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isPathExcluded(path, exclusionsRaw) {
  const pathValue = String(path || '');
  return parsePathExclusions(exclusionsRaw).some((pattern) => {
    if (pattern.endsWith('*')) {
      return pathValue.startsWith(pattern.slice(0, -1));
    }
    return pathValue === pattern || pathValue.startsWith(`${pattern}/`);
  });
}

function resolveRequestCountry(req) {
  const header = req.get('cf-ipcountry')
    || req.get('x-country-code')
    || req.get('x-appengine-country')
    || null;
  if (!header || header === 'XX' || header === 'T1') return null;
  return String(header).slice(0, 80).toUpperCase();
}

function buildLogFilterUrl(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `/admin/waf/logs?${query}` : '/admin/waf/logs';
}

function riskLevel(score) {
  const value = Number(score || 0);
  if (value >= 70) return { label: 'Critical', class: 'danger' };
  if (value >= 50) return { label: 'High', class: 'danger' };
  if (value >= 30) return { label: 'Medium', class: 'warning' };
  return { label: 'Low', class: 'muted' };
}

module.exports = {
  severityBadge,
  actionBadge,
  categoryLabel,
  formatSnapshot,
  parsePathExclusions,
  isPathExcluded,
  resolveRequestCountry,
  buildLogFilterUrl,
  riskLevel
};
