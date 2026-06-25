const fs = require('fs');
const os = require('os');
const path = require('path');
const dbBackup = require('../utils/databaseBackup');

describe('databaseBackup upload restore', () => {
  test('isSafeUploadedSqlPath accepts files under tmp/uploads', () => {
    const uploadDir = dbBackup.getSqlUploadDir();
    const filePath = path.join(uploadDir, '123-restore.sql');
    expect(dbBackup.isSafeUploadedSqlPath(filePath)).toBe(true);
  });

  test('isSafeUploadedSqlPath rejects paths outside tmp/uploads', () => {
    expect(dbBackup.isSafeUploadedSqlPath('/etc/passwd.sql')).toBe(false);
    expect(dbBackup.isSafeUploadedSqlPath(path.join(process.cwd(), 'database', 'backups', 'backup.sql'))).toBe(false);
  });

  test('restoreFromUploadedFile rejects missing files', async () => {
    const missing = path.join(dbBackup.getSqlUploadDir(), 'missing-restore.sql');
    await expect(dbBackup.restoreFromUploadedFile(missing)).rejects.toThrow(/not found/i);
  });

  test('restoreFromUploadedFile rejects empty files', async () => {
    const uploadDir = dbBackup.getSqlUploadDir();
    fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `empty-${Date.now()}.sql`);
    fs.writeFileSync(filePath, '');
    await expect(dbBackup.restoreFromUploadedFile(filePath)).rejects.toThrow(/empty/i);
    dbBackup.removeUploadedSql(filePath);
  });

  test('removeUploadedSql deletes only valid upload paths', () => {
    const outside = path.join(os.tmpdir(), `outside-${Date.now()}.sql`);
    fs.writeFileSync(outside, 'SELECT 1;');
    dbBackup.removeUploadedSql(outside);
    expect(fs.existsSync(outside)).toBe(true);
    fs.unlinkSync(outside);
  });

  test('repairSchemaAfterRestore recreates missing activity_logs', async () => {
    const { sequelize } = require('../models');
    const { tableExists } = require('../database/ensureBaseSchema');
    await sequelize.query('DROP TABLE IF EXISTS activity_logs');
    await expect(dbBackup.repairSchemaAfterRestore()).resolves.toBeUndefined();
    expect(await tableExists(sequelize, 'activity_logs')).toBe(true);
  });
});
