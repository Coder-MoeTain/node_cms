const fs = require('fs');
const path = require('path');
const os = require('os');
const { QueryTypes } = require('sequelize');
const { execFile } = require('child_process');
const { promisify } = require('util');
const pkg = require('../package.json');
const sequelize = require('../config/database');
const appConfig = require('../config/app');
const pluginLoader = require('./pluginLoader');

const execFileAsync = promisify(execFile);

function check(category, payload) {
  return { category, ...payload };
}

async function getPendingMigrationCount() {
  try {
    const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
    const rows = await sequelize.query('SELECT name FROM migrations', { type: QueryTypes.SELECT });
    const completed = new Set(rows.map((row) => row.name));
    return files.filter((file) => !completed.has(file)).length;
  } catch {
    return null;
  }
}

async function runChecks() {
  const checks = [];

  checks.push(check('configuration', {
    id: 'core_version',
    label: 'NodePress version',
    status: 'good',
    value: `v${pkg.version}`,
    description: 'Installed application version.',
    badge: 'Passed'
  }));

  checks.push(check('configuration', {
    id: 'node_version',
    label: 'Node.js runtime',
    status: Number(process.version.slice(1).split('.')[0]) >= 18 ? 'good' : 'recommended',
    value: process.version,
    description: 'Node.js 18 or newer is recommended.',
    badge: Number(process.version.slice(1).split('.')[0]) >= 18 ? 'Passed' : 'Should be improved'
  }));

  try {
    await sequelize.authenticate();
    const [versionRows] = await sequelize.query('SELECT VERSION() AS version');
    checks.push(check('performance', {
      id: 'mysql',
      label: 'Database connection',
      status: 'good',
      value: versionRows?.[0]?.version || 'Connected',
      description: 'MySQL is reachable with your configured credentials.',
      badge: 'Passed'
    }));
  } catch (error) {
    checks.push(check('performance', {
      id: 'mysql',
      label: 'Database connection',
      status: 'critical',
      value: error.message,
      description: 'The application cannot connect to MySQL.',
      badge: 'Critical'
    }));
  }

  const pendingMigrations = await getPendingMigrationCount();
  if (pendingMigrations !== null) {
    checks.push(check('performance', {
      id: 'migrations',
      label: 'Database migrations',
      status: pendingMigrations === 0 ? 'good' : 'recommended',
      value: pendingMigrations === 0 ? 'Up to date' : `${pendingMigrations} pending`,
      description: pendingMigrations === 0
        ? 'All migration files have been applied.'
        : 'Pending migrations may leave features or security fixes unapplied.',
      action: '/admin/settings/database',
      actionLabel: 'Database tools',
      badge: pendingMigrations === 0 ? 'Passed' : 'Should be improved'
    }));
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const backupsDir = path.join(process.cwd(), 'database', 'backups');
  let uploadsWritable = false;
  try {
    fs.accessSync(uploadsDir, fs.constants.W_OK);
    uploadsWritable = true;
  } catch {
    uploadsWritable = false;
  }

  checks.push(check('performance', {
    id: 'uploads_writable',
    label: 'Uploads directory',
    status: uploadsWritable ? 'good' : 'critical',
    value: uploadsWritable ? 'Writable' : 'Not writable',
    description: 'Media uploads require write access to public/uploads.',
    action: '/admin/media',
    actionLabel: 'Media library',
    badge: uploadsWritable ? 'Passed' : 'Critical'
  }));

  checks.push(check('performance', {
    id: 'disk_space',
    label: 'Free system memory',
    status: os.freemem() > 256 * 1024 * 1024 ? 'good' : 'recommended',
    value: `${Math.round(os.freemem() / 1024 / 1024)} MB free`,
    description: 'Low memory can cause slow responses or failed background tasks.',
    badge: os.freemem() > 256 * 1024 * 1024 ? 'Passed' : 'Should be improved'
  }));

  if (fs.existsSync(backupsDir)) {
    const backups = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.sql'));
    checks.push(check('performance', {
      id: 'backups',
      label: 'Database backups',
      status: backups.length ? 'good' : 'recommended',
      value: backups.length ? `${backups.length} on disk` : 'No backups found',
      description: 'Regular backups protect against data loss.',
      action: '/admin/settings/database',
      actionLabel: 'Create backup',
      badge: backups.length ? 'Passed' : 'Should be improved'
    }));
  }

  checks.push(check('security', {
    id: 'session_secret',
    label: 'Session secret',
    status: appConfig.sessionSecret && appConfig.sessionSecret !== 'change-this-long-random-secret' ? 'good' : 'critical',
    value: appConfig.sessionSecret === 'change-this-long-random-secret' ? 'Default secret in use' : 'Strong secret configured',
    description: 'A unique SESSION_SECRET is required in production.',
    action: '/admin/settings',
    actionLabel: 'Site settings',
    badge: appConfig.sessionSecret === 'change-this-long-random-secret' ? 'Critical' : 'Passed'
  }));

  checks.push(check('security', {
    id: 'https',
    label: 'HTTPS URL',
    status: appConfig.url.startsWith('https://') || appConfig.env !== 'production' ? 'good' : 'recommended',
    value: appConfig.url,
    description: 'Production sites should use HTTPS in APP_URL.',
    action: '/admin/settings',
    actionLabel: 'Update APP_URL',
    badge: appConfig.url.startsWith('https://') || appConfig.env !== 'production' ? 'Passed' : 'Should be improved'
  }));

  checks.push(check('security', {
    id: 'debug_mode',
    label: 'Debug mode',
    status: appConfig.env === 'production' ? 'good' : 'recommended',
    value: appConfig.env,
    description: 'NODE_ENV should be production on live servers.',
    badge: appConfig.env === 'production' ? 'Passed' : 'Should be improved'
  }));

  try {
    const { SecuritySetting } = require('../models');
    const maintenance = await SecuritySetting.findOne({ where: { key: 'maintenance_mode' } });
    checks.push(check('security', {
      id: 'maintenance_mode',
      label: 'Maintenance mode',
      status: maintenance?.value === 'true' ? 'recommended' : 'good',
      value: maintenance?.value === 'true' ? 'Enabled — public site hidden' : 'Disabled',
      description: 'Turn off maintenance mode when the site should be public.',
      action: '/admin/security',
      actionLabel: 'Security settings',
      badge: maintenance?.value === 'true' ? 'Should be improved' : 'Passed'
    }));
  } catch {
    // optional table
  }

  try {
    const { WafSetting } = require('../models');
    const wafEnabled = await WafSetting.findOne({ where: { setting_key: 'waf_enabled' } });
    const wafMode = await WafSetting.findOne({ where: { setting_key: 'waf_mode' } });
    const enabled = wafEnabled?.setting_value === 'true';
    checks.push(check('security', {
      id: 'waf',
      label: 'Web Application Firewall',
      status: enabled && wafMode?.setting_value === 'block' ? 'good' : enabled ? 'recommended' : 'recommended',
      value: enabled ? `Enabled (${wafMode?.setting_value || 'monitor'})` : 'Disabled',
      description: 'WAF helps block malicious traffic. Use monitor mode first, then block.',
      action: '/admin/waf',
      actionLabel: 'WAF dashboard',
      badge: enabled ? (wafMode?.setting_value === 'block' ? 'Passed' : 'Should be improved') : 'Should be improved'
    }));
  } catch {
    checks.push(check('security', {
      id: 'waf',
      label: 'Web Application Firewall',
      status: 'recommended',
      value: 'Could not read WAF settings',
      description: 'Verify WAF tables exist and migrations have run.',
      action: '/admin/waf',
      actionLabel: 'WAF dashboard',
      badge: 'Should be improved'
    }));
  }

  const { smtpConfigured } = require('./mailer');
  checks.push(check('configuration', {
    id: 'email',
    label: 'Outgoing email (SMTP)',
    status: smtpConfigured() ? 'good' : 'recommended',
    value: smtpConfigured() ? 'Configured' : 'Not configured',
    description: 'SMTP is needed for password reset and comment notifications.',
    action: '/admin/settings',
    actionLabel: 'Configure SMTP',
    badge: smtpConfigured() ? 'Passed' : 'Optional'
  }));

  checks.push(check('configuration', {
    id: 'plugins',
    label: 'Plugin system',
    status: typeof pluginLoader.loadActivePlugins === 'function' ? 'good' : 'critical',
    value: typeof pluginLoader.loadActivePlugins === 'function' ? 'Available' : 'Unavailable',
    description: 'Plugin hooks power extensions and dashboard widgets.',
    action: '/admin/plugins',
    actionLabel: 'Manage plugins',
    badge: 'Passed'
  }));

  let healthEndpoint = 'Unavailable';
  try {
    const port = appConfig.port;
    const base = appConfig.url || `http://127.0.0.1:${port}`;
    const http = require('http');
    const status = await new Promise((resolve, reject) => {
      const url = new URL('/health', base);
      const req = http.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ code: res.statusCode, body }));
      });
      req.on('error', reject);
      req.setTimeout(3000, () => req.destroy(new Error('Health check timed out')));
    });
    healthEndpoint = status.code === 200 ? 'OK' : `HTTP ${status.code}`;
    checks.push(check('configuration', {
      id: 'health_endpoint',
      label: 'Health endpoint',
      status: status.code === 200 ? 'good' : 'recommended',
      value: healthEndpoint,
      description: 'GET /health should return 200 for uptime monitoring.',
      badge: status.code === 200 ? 'Passed' : 'Should be improved'
    }));
  } catch (error) {
    checks.push(check('configuration', {
      id: 'health_endpoint',
      label: 'Health endpoint',
      status: 'recommended',
      value: error.message,
      description: 'GET /health should return 200 for uptime monitoring.',
      badge: 'Should be improved'
    }));
  }

  try {
    await execFileAsync('mysqldump', ['--version'], { timeout: 3000 });
    checks.push(check('configuration', {
      id: 'mysqldump',
      label: 'Backup tools',
      status: 'good',
      value: 'mysqldump available',
      description: 'CLI backup tools are available for database exports.',
      badge: 'Passed'
    }));
  } catch {
    checks.push(check('configuration', {
      id: 'mysqldump',
      label: 'Backup tools',
      status: 'recommended',
      value: 'mysqldump not found in PATH',
      description: 'Install MySQL client tools to enable one-click backups.',
      action: '/admin/settings/database',
      actionLabel: 'Database tools',
      badge: 'Should be improved'
    }));
  }

  const critical = checks.filter((c) => c.status === 'critical').length;
  const recommended = checks.filter((c) => c.status === 'recommended').length;
  const good = checks.filter((c) => c.status === 'good').length;
  const score = Math.max(0, Math.min(100, 100 - critical * 25 - recommended * 8));

  const groups = [
    { id: 'performance', label: 'Performance & database', icon: 'bi-speedometer2' },
    { id: 'security', label: 'Security', icon: 'bi-shield-check' },
    { id: 'configuration', label: 'Configuration', icon: 'bi-gear' }
  ].map((group) => ({
    ...group,
    checks: checks.filter((c) => c.category === group.id)
  }));

  return {
    status: critical ? 'critical' : recommended ? 'recommended' : 'good',
    score,
    checks,
    groups,
    summary: { critical, recommended, good, total: checks.length },
    generatedAt: new Date()
  };
}

module.exports = { runChecks };
