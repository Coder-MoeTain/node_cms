const path = require('path');
const { execFile } = require('child_process');
const { SecuritySetting, LoginAttempt, BlockedIp, ActivityLog } = require('../../models');
const { ensureDirectory } = require('../../utils/fileHelper');

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
    const keys = [
      'login_attempt_limiter',
      'csrf_protection',
      'xss_protection',
      'file_upload_validation',
      'admin_session_timeout',
      'force_strong_password',
      'two_factor_auth',
      'maintenance_mode'
    ];
    for (const key of keys) {
      await SecuritySetting.upsert({ key, value: req.body[key] === 'on' ? 'true' : 'false', enabled: req.body[key] === 'on' });
    }
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
    const backupDir = path.join(process.cwd(), 'database', 'backups');
    ensureDirectory(backupDir);

    const dbName = process.env.DB_NAME || 'nodepress_cms';
    const filename = `${dbName}-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
    const outputPath = path.join(backupDir, filename);
    const args = [
      `--host=${process.env.DB_HOST || '127.0.0.1'}`,
      `--port=${process.env.DB_PORT || '3306'}`,
      `--user=${process.env.DB_USER || 'root'}`
    ];

    args.push(dbName, `--result-file=${outputPath}`);

    execFile('mysqldump', args, { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' } }, async (error) => {
      if (error) {
        req.flash('error', 'Database backup failed. Make sure mysqldump is installed and available in PATH.');
        return res.redirect('/admin/security');
      }

      await ActivityLog.create({
        user_id: req.session.user.id,
        action: 'Database backup created',
        entity_type: 'security',
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        metadata: { filename }
      });

      req.flash('success', `Database backup created: ${filename}`);
      return res.redirect('/admin/security');
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, updateSettings, blockIp, unblockIp, backupDatabase };
