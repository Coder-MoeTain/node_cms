const fs = require('fs');
const path = require('path');
const os = require('os');
const pkg = require('../package.json');
const sequelize = require('../config/database');
const appConfig = require('../config/app');
const pluginLoader = require('./pluginLoader');

async function runChecks() {
  const checks = [];

  checks.push({
    id: 'node_version',
    label: 'Node.js version',
    status: Number(process.version.slice(1).split('.')[0]) >= 18 ? 'good' : 'recommended',
    value: process.version
  });

  try {
    await sequelize.authenticate();
    checks.push({ id: 'mysql', label: 'MySQL connection', status: 'good', value: 'Connected' });
  } catch (error) {
    checks.push({ id: 'mysql', label: 'MySQL connection', status: 'critical', value: error.message });
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  checks.push({
    id: 'uploads_writable',
    label: 'Uploads directory writable',
    status: fs.existsSync(uploadsDir) ? 'good' : 'critical',
    value: uploadsDir
  });

  checks.push({
    id: 'session_secret',
    label: 'Session secret configured',
    status: appConfig.sessionSecret && appConfig.sessionSecret !== 'change-this-long-random-secret' ? 'good' : 'recommended',
    value: appConfig.sessionSecret === 'change-this-long-random-secret' ? 'Default secret in use' : 'Configured'
  });

  checks.push({
    id: 'https',
    label: 'HTTPS / production URL',
    status: appConfig.url.startsWith('https://') || appConfig.env !== 'production' ? 'good' : 'recommended',
    value: appConfig.url
  });

  checks.push({
    id: 'core_version',
    label: 'NodePress core version',
    status: 'good',
    value: pkg.version
  });

  const freeMem = os.freemem();
  checks.push({
    id: 'disk_space',
    label: 'Free system memory',
    status: freeMem > 256 * 1024 * 1024 ? 'good' : 'recommended',
    value: `${Math.round(freeMem / 1024 / 1024)} MB free`
  });

  checks.push({
    id: 'plugins',
    label: 'Plugin loader',
    status: 'good',
    value: typeof pluginLoader.loadActivePlugins === 'function' ? 'Available' : 'Missing'
  });

  try {
    const { WafSetting } = require('../models');
    const wafEnabled = await WafSetting.findOne({ where: { setting_key: 'waf_enabled' } });
    const wafMode = await WafSetting.findOne({ where: { setting_key: 'waf_mode' } });
    checks.push({
      id: 'waf',
      label: 'WAF status',
      status: wafEnabled?.setting_value === 'true' ? 'good' : 'recommended',
      value: wafEnabled?.setting_value === 'true' ? `Enabled (${wafMode?.setting_value || 'monitor'})` : 'Disabled'
    });
  } catch {
    checks.push({ id: 'waf', label: 'WAF status', status: 'recommended', value: 'Could not read settings' });
  }

  try {
    fs.accessSync(uploadsDir, fs.constants.W_OK);
    checks.push({ id: 'uploads_writable_test', label: 'Uploads write test', status: 'good', value: 'Writable' });
  } catch {
    checks.push({ id: 'uploads_writable_test', label: 'Uploads write test', status: 'critical', value: 'Not writable' });
  }

  const { smtpConfigured } = require('./mailer');
  checks.push({
    id: 'email',
    label: 'Email (SMTP)',
    status: smtpConfigured() ? 'good' : 'recommended',
    value: smtpConfigured() ? 'Configured' : 'Log-only (set SMTP_HOST and SMTP_FROM)'
  });

  const critical = checks.filter((c) => c.status === 'critical').length;
  const recommended = checks.filter((c) => c.status === 'recommended').length;

  return {
    status: critical ? 'critical' : recommended ? 'recommended' : 'good',
    checks,
    summary: { critical, recommended, good: checks.filter((c) => c.status === 'good').length }
  };
}

module.exports = { runChecks };
