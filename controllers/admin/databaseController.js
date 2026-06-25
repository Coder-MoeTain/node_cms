const { ActivityLog } = require('../../models');
const dbBackup = require('../../utils/databaseBackup');

async function safeActivityLog(entry) {
  try {
    await ActivityLog.create(entry);
  } catch {
    // Restored databases may be missing optional tables until schema repair runs.
  }
}

function redirectAfterRestore(req, res) {
  return req.session.destroy(() => res.redirect('/admin/login?restored=1'));
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

async function restoreBackup(req, res, next) {
  try {
    const filename = req.params.filename;
    const includeUploads = req.body.include_uploads === 'on';

    await safeActivityLog({
      user_id: req.session.user.id,
      action: 'Database restore started from backup file',
      entity_type: 'database',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      metadata: { filename, includeUploads }
    });

    await dbBackup.restoreBackup(filename, { includeUploads });
    await dbBackup.repairSchemaAfterRestore();

    await safeActivityLog({
      user_id: req.session.user.id,
      action: 'Database restored from backup',
      entity_type: 'database',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      metadata: { filename, includeUploads }
    });

    return redirectAfterRestore(req, res);
  } catch (error) {
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
  try {
    if (!req.file) {
      req.flash('error', 'Upload an .sql file to restore.');
      return res.redirect('/admin/settings/database');
    }

    const { originalname, size } = req.file;

    await safeActivityLog({
      user_id: req.session.user.id,
      action: 'Database restore started from uploaded SQL file',
      entity_type: 'database',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      metadata: { originalName: originalname, size }
    });

    await dbBackup.restoreFromUploadedFile(req.file.path);
    await dbBackup.repairSchemaAfterRestore();

    await safeActivityLog({
      user_id: req.session.user.id,
      action: 'Database restored from uploaded SQL file',
      entity_type: 'database',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      metadata: { originalName: originalname, size }
    });

    return redirectAfterRestore(req, res);
  } catch (error) {
    dbBackup.removeUploadedSql(req.file?.path);
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
    return req.session.destroy(() => res.redirect('/admin/login'));
  } catch (error) {
    req.flash('error', `Database reset failed: ${error.message}`);
    return res.redirect('/admin/settings/database');
  }
}

module.exports = { index, createBackup, restoreBackup, restoreUpload, destroyBackup, resetDatabase };
