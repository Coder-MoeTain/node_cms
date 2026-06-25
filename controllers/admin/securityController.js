const { SecuritySetting, LoginAttempt, BlockedIp, ActivityLog } = require('../../models');
const dbBackup = require('../../utils/databaseBackup');
const loginBruteForce = require('../../utils/loginBruteForce');

const BOOLEAN_SETTINGS = [
  'login_attempt_limiter',
  'csrf_protection',
  'xss_protection',
  'file_upload_validation',
  'admin_session_timeout',
  'force_strong_password',
  'two_factor_auth',
  'maintenance_mode'
];

const NUMERIC_SETTINGS = [
  'login_max_account_attempts',
  'login_lockout_minutes',
  'login_max_ip_attempts',
  'login_ip_window_minutes',
  'login_auto_block_ip_attempts'
];

async function index(req, res, next) {
  try {
    const [settings, attempts, blockedIps, activityLogs] = await Promise.all([
      SecuritySetting.findAll({ order: [['key', 'ASC']] }),
      LoginAttempt.findAll({ limit: 50, order: [['created_at', 'DESC']] }),
      BlockedIp.findAll({ order: [['created_at', 'DESC']] }),
      ActivityLog.findAll({ limit: 50, order: [['created_at', 'DESC']] })
    ]);
    return res.render('admin/security/index', { title: 'Security Plugins', settings, attempts, blockedIps, activityLogs });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    for (const key of BOOLEAN_SETTINGS) {
      await SecuritySetting.upsert({ key, value: req.body[key] === 'on' ? 'true' : 'false', enabled: req.body[key] === 'on' });
    }
    for (const key of NUMERIC_SETTINGS) {
      const raw = String(req.body[key] || '').trim();
      if (!raw) continue;
      const value = Math.max(1, Number.parseInt(raw, 10) || 1);
      await SecuritySetting.upsert({ key, value: String(value), enabled: true });
    }
    loginBruteForce.clearSettingsCache();
    req.flash('success', 'Security settings updated.');
    return res.redirect('/admin/security');
  } catch (error) {
    return next(error);
  }
}

async function blockIp(req, res, next) {
  try {
    await BlockedIp.findOrCreate({
      where: { ip_address: req.body.ip_address },
      defaults: { reason: req.body.reason, blocked_by: req.session.user.id, active: true }
    });
    req.flash('success', 'IP blocked.');
    return res.redirect('/admin/security');
  } catch (error) {
    return next(error);
  }
}

async function unblockIp(req, res, next) {
  try {
    const row = await BlockedIp.findByPk(req.params.id);
    if (row) await row.update({ active: false });
    req.flash('success', 'IP unblocked.');
    return res.redirect('/admin/security');
  } catch (error) {
    return next(error);
  }
}

async function backupDatabase(req, res, next) {
  try {
    const { filename } = await dbBackup.createBackup();

    await ActivityLog.create({
      user_id: req.session.user.id,
      action: 'Database backup created',
      entity_type: 'security',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      metadata: { filename }
    });

    req.flash('success', `Database backup created: ${filename}`);
    return res.redirect('/admin/settings/database');
  } catch (error) {
    req.flash('error', 'Database backup failed. Make sure mysqldump is installed and available in PATH.');
    return res.redirect('/admin/settings/database');
  }
}

module.exports = { index, updateSettings, blockIp, unblockIp, backupDatabase };
