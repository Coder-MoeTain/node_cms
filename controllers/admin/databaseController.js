const { ActivityLog } = require('../../models');
const dbBackup = require('../../utils/databaseBackup');

async function index(req, res, next) {
  try {
    const backups = dbBackup.listBackups();
    const dbConfig = dbBackup.getDbConfig();
    return res.render('admin/settings/database', {
      title: 'Database Backup & Restore',
      backups,
      dbConfig: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function createBackup(req, res, next) {
  try {
    const includeUploads = req.body.include_uploads === 'on';
    const { filename } = await dbBackup.createBackup({ includeUploads });

    await ActivityLog.create({
      user_id: req.session.user.id,
      action: 'Database backup created',
      entity_type: 'database',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      metadata: { filename, includeUploads }
    });

    req.flash('success', `Backup created: ${filename}`);
    return res.redirect('/admin/settings/database');
  } catch (error) {
    req.flash('error', `Backup failed. Ensure mysqldump is installed and in PATH. ${error.message}`);
    return res.redirect('/admin/settings/database');
  }
}

async function restoreBackup(req, res, next) {
  try {
    const filename = req.params.filename;
    const includeUploads = req.body.include_uploads === 'on';
    await dbBackup.restoreBackup(filename, { includeUploads });

    await ActivityLog.create({
      user_id: req.session.user.id,
      action: 'Database restored from backup',
      entity_type: 'database',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      metadata: { filename, includeUploads }
    });

    req.flash('success', `Database restored from ${filename}. You may need to sign in again.`);
    return res.redirect('/admin/settings/database');
  } catch (error) {
    req.flash('error', `Restore failed. Ensure mysql client is installed and in PATH. ${error.message}`);
    return res.redirect('/admin/settings/database');
  }
}

async function destroyBackup(req, res, next) {
  try {
    const filename = req.params.filename;
    dbBackup.deleteBackup(filename);

    await ActivityLog.create({
      user_id: req.session.user.id,
      action: 'Database backup deleted',
      entity_type: 'database',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      metadata: { filename }
    });

    req.flash('success', `Deleted backup: ${filename}`);
    return res.redirect('/admin/settings/database');
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect('/admin/settings/database');
  }
}

async function resetDatabase(req, res, next) {
  try {
    await dbBackup.resetDatabase();

    await ActivityLog.create({
      user_id: req.session.user.id,
      action: 'Database reset to defaults',
      entity_type: 'database',
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    req.flash('success', 'Database reset complete. Default admin: admin@example.com / Admin@12345');
    return req.session.destroy(() => res.redirect('/admin/login'));
  } catch (error) {
    req.flash('error', `Database reset failed: ${error.message}`);
    return res.redirect('/admin/settings/database');
  }
}

module.exports = { index, createBackup, restoreBackup, destroyBackup, resetDatabase };
