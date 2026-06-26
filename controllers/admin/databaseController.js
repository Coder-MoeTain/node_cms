const dbBackup = require('../../utils/databaseBackup');
const { createActivityLog } = require('../../utils/activityLogHelper');
const adminLoginPath = require('../../utils/adminLoginPath');

async function safeActivityLog(entry) {
  await createActivityLog(entry);
}

async function redirectAfterRestore(req, res) {
  const loginUrl = await adminLoginPath.getLoginUrl('restored=1');
  req.session.destroy((error) => {
    if (error) console.error('Session destroy after restore:', error.message);
    res.redirect(loginUrl);
  });
}

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

    await safeActivityLog({
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

async function finishDatabaseRestore(req, res) {
  await dbBackup.repairSchemaAfterRestore();
  return redirectAfterRestore(req, res);
}

async function restoreBackup(req, res, next) {
  let imported = false;
  try {
    const filename = req.params.filename;
    const includeUploads = req.body.include_uploads === 'on';
    await dbBackup.restoreBackup(filename, { includeUploads });
    imported = true;
    return finishDatabaseRestore(req, res);
  } catch (error) {
    if (imported) return finishDatabaseRestore(req, res);
    req.flash('error', `Restore failed. Ensure mysql client is installed and in PATH. ${error.message}`);
    return res.redirect('/admin/settings/database');
  }
}

async function destroyBackup(req, res, next) {
  try {
    const filename = req.params.filename;
    dbBackup.deleteBackup(filename);

    await safeActivityLog({
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

async function restoreUpload(req, res, next) {
  let imported = false;
  try {
    if (!req.file) {
      req.flash('error', 'Upload an .sql file to restore.');
      return res.redirect('/admin/settings/database');
    }

    await dbBackup.restoreFromUploadedFile(req.file.path);
    imported = true;
    return finishDatabaseRestore(req, res);
  } catch (error) {
    dbBackup.removeUploadedSql(req.file?.path);
    if (imported) return finishDatabaseRestore(req, res);
    req.flash('error', `Restore failed. Ensure mysql client is installed and in PATH. ${error.message}`);
    return res.redirect('/admin/settings/database');
  }
}

async function resetDatabase(req, res, next) {
  try {
    await safeActivityLog({
      user_id: req.session.user.id,
      action: 'Database reset to defaults',
      entity_type: 'database',
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    await dbBackup.resetDatabase();

    req.flash('success', 'Database reset complete. Default admin: admin@example.com / Admin@12345');
    const loginUrl = await adminLoginPath.getLoginUrl();
    return req.session.destroy(() => res.redirect(loginUrl));
  } catch (error) {
    req.flash('error', `Database reset failed: ${error.message}`);
    return res.redirect('/admin/settings/database');
  }
}

module.exports = { index, createBackup, restoreBackup, restoreUpload, destroyBackup, resetDatabase };
