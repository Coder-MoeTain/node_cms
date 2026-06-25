require('dotenv').config();

const DEFAULT_WEAK_SECRETS = new Set([
  'change-this-long-random-secret',
  'replace-with-a-long-random-secret',
  'ci-session-secret-change-me',
  'ci-docker-session-secret-change-me',
  'secret',
  'changeme'
]);

const REQUIRED_PRODUCTION = [
  'NODE_ENV',
  'APP_URL',
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
  'SESSION_SECRET'
];

function isWeakSecret(value) {
  if (!value || typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (trimmed.length < 32) return true;
  if (DEFAULT_WEAK_SECRETS.has(trimmed)) return true;
  if (/^(change|replace|test|demo|secret|password)/i.test(trimmed)) return true;
  return false;
}

function validateProductionEnv(options = {}) {
  const env = options.env || process.env.NODE_ENV || 'development';
  if (env !== 'production') return { valid: true, env };

  const missing = REQUIRED_PRODUCTION.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length) {
    throw new Error(`Production startup blocked. Missing required environment variables: ${missing.join(', ')}`);
  }

  if (isWeakSecret(process.env.SESSION_SECRET)) {
    throw new Error(
      'Production startup blocked. SESSION_SECRET must be at least 32 characters and not a default or weak value.'
    );
  }

  if (!/^https?:\/\/.+/i.test(String(process.env.APP_URL || ''))) {
    throw new Error('Production startup blocked. APP_URL must be a valid http(s) URL.');
  }

  return { valid: true, env };
}

module.exports = {
  DEFAULT_WEAK_SECRETS,
  REQUIRED_PRODUCTION,
  isWeakSecret,
  validateProductionEnv
};
