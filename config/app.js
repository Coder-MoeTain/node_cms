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
  adminSessionTimeoutMinutes: Number(process.env.ADMIN_SESSION_TIMEOUT_MINUTES || 60),
  trustProxy: process.env.TRUST_PROXY === 'true' ? 1 : false,
  corsOrigin: process.env.CORS_ORIGIN || process.env.APP_URL || 'http://localhost:3000',
  uploadsQuarantine: process.env.UPLOADS_QUARANTINE === 'true'
};
