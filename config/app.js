require('dotenv').config();

module.exports = {
  name: process.env.APP_NAME || 'NodePress CMS',
  url: process.env.APP_URL || 'http://localhost:3000',
  port: Number(process.env.PORT || 3000),
  env: process.env.NODE_ENV || 'development',
  sessionName: process.env.SESSION_NAME || 'nodepress.sid',
  sessionSecret: process.env.SESSION_SECRET || 'change-this-long-random-secret',
  sessionMaxAge: Number(process.env.SESSION_MAX_AGE || 86400000),
  uploadMaxSizeMb: Number(process.env.UPLOAD_MAX_SIZE_MB || 25),
  mediaUploadMaxFiles: Math.min(500, Math.max(1, Number(process.env.MEDIA_UPLOAD_MAX_FILES || 100))),
  adminSessionTimeoutMinutes: Number(process.env.ADMIN_SESSION_TIMEOUT_MINUTES || 60),
  trustProxy: process.env.TRUST_PROXY === 'true' ? 1 : false,
  corsOrigin: process.env.CORS_ORIGIN || process.env.APP_URL || 'http://localhost:3000',
  uploadsQuarantine: process.env.UPLOADS_QUARANTINE === 'true',
  apiKey: process.env.API_KEY || '',
  jwtSecret: process.env.JWT_SECRET || process.env.SESSION_SECRET || 'change-this-long-random-secret',
  updateCheckUrl: process.env.UPDATE_CHECK_URL || '',
  multisiteEnabled: process.env.MULTISITE_ENABLED === 'true',
  loginBruteForce: {
    enabled: process.env.LOGIN_BRUTE_FORCE !== 'false',
    maxAccountAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS || 5),
    lockoutMinutes: Number(process.env.LOGIN_LOCKOUT_MINUTES || 15),
    maxIpAttempts: Number(
      process.env.LOGIN_MAX_IP_ATTEMPTS || (process.env.NODE_ENV === 'test' ? 1000 : 10)
    ),
    ipWindowMinutes: Number(process.env.LOGIN_IP_WINDOW_MINUTES || 15),
    autoBlockIpAttempts: Number(
      process.env.LOGIN_AUTO_BLOCK_IP_ATTEMPTS || (process.env.NODE_ENV === 'test' ? 1000 : 25)
    ),
    rateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
    rateLimitWindowMinutes: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES || 15)
  },
  webguard: {
    enabled: Boolean(process.env.WEBGUARD_API_URL && (process.env.WEBGUARD_API_KEY || process.env.WEBGUARD_API_TOKEN)),
    baseUrl: process.env.WEBGUARD_API_URL || '',
    apiKey: process.env.WEBGUARD_API_KEY || '',
    bearerToken: process.env.WEBGUARD_API_TOKEN || '',
    timeoutMs: Number(process.env.WEBGUARD_TIMEOUT_MS || 500),
    allowLocalhost: process.env.WEBGUARD_ALLOW_LOCALHOST === 'true',
    failOpen: process.env.WEBGUARD_FAIL_OPEN !== 'false'
  }
};
