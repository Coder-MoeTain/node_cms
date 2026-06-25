const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const { ensureDirectory } = require('./fileHelper');

const execFileAsync = promisify(execFile);

function getBackupDir() {
  return path.join(process.cwd(), 'database', 'backups');
}

function getDbConfig() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || '3306',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nodepress_cms'
  };
}

function mysqlEnv() {
  return { ...process.env, MYSQL_PWD: getDbConfig().password };
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isSafeBackupFilename(filename) {
  return typeof filename === 'string' && /^[\w.-]+\.sql$/.test(filename);
}

function resolveBackupPath(filename) {
  if (!isSafeBackupFilename(filename)) {
    throw new Error('Invalid backup filename.');
  }
  const backupDir = getBackupDir();
  const fullPath = path.resolve(backupDir, filename);
  if (!fullPath.startsWith(path.resolve(backupDir) + path.sep)) {
    throw new Error('Invalid backup path.');
  }
  if (!fs.existsSync(fullPath)) {
    throw new Error('Backup file not found.');
  }
  return fullPath;
}

function extractStamp(filename) {
  const match = filename.match(/^(?:backup-|[\w-]+-)(.+)\.sql$/);
  return match ? match[1] : null;
}

function listBackups() {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return [];

  return fs.readdirSync(backupDir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => {
      const full = path.join(backupDir, file);
      const stats = fs.statSync(full);
      const stamp = extractStamp(file);
      const uploadsArchive = stamp ? `uploads-${stamp}.tar.gz` : null;
      const uploadsPath = uploadsArchive ? path.join(backupDir, uploadsArchive) : null;
      return {
        file,
        size: stats.size,
        sizeLabel: formatFileSize(stats.size),
        created: stats.mtime,
        uploadsArchive: uploadsPath && fs.existsSync(uploadsPath) ? uploadsArchive : null
      };
    })
    .sort((a, b) => b.created - a.created);
}

async function createBackup({ includeUploads = false } = {}) {
  const backupDir = getBackupDir();
  ensureDirectory(backupDir);

  const { host, port, user, database } = getDbConfig();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${stamp}.sql`;
  const outputPath = path.join(backupDir, filename);

  const args = [
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
    database,
    `--result-file=${outputPath}`
  ];

  await execFileAsync('mysqldump', args, { env: mysqlEnv() });

  let uploadsArchive = null;
  if (includeUploads) {
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      uploadsArchive = `uploads-${stamp}.tar.gz`;
      const archivePath = path.join(backupDir, uploadsArchive);
      await execFileAsync('tar', ['-czf', archivePath, '-C', path.dirname(uploadsDir), 'uploads'], { env: process.env });
    }
  }

  return { filename, outputPath, uploadsArchive };
}

function runMysqlImport(sqlPath) {
  const { host, port, user, database } = getDbConfig();
  const args = [`--host=${host}`, `--port=${port}`, `--user=${user}`, database];

  return new Promise((resolve, reject) => {
    const proc = spawn('mysql', args, { env: mysqlEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    const stderr = [];
    proc.stderr.on('data', (chunk) => stderr.push(chunk));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `mysql exited with code ${code}`));
    });
    fs.createReadStream(sqlPath).pipe(proc.stdin);
  });
}

async function restoreUploadsArchive(archiveName) {
  const safeName = path.basename(archiveName);
  if (!/^uploads-[\w.-]+\.tar\.gz$/.test(safeName)) {
    throw new Error('Invalid uploads archive.');
  }

  const backupDir = getBackupDir();
  const archivePath = path.resolve(backupDir, safeName);
  if (!archivePath.startsWith(path.resolve(backupDir) + path.sep) || !fs.existsSync(archivePath)) {
    throw new Error('Uploads archive not found.');
  }

  const uploadsParent = path.join(process.cwd(), 'public');
  ensureDirectory(uploadsParent);
  await execFileAsync('tar', ['-xzf', archivePath, '-C', uploadsParent], { env: process.env });
}

function getSqlUploadDir() {
  return path.join(process.cwd(), 'tmp', 'uploads');
}

function isSafeUploadedSqlPath(filePath) {
  if (typeof filePath !== 'string' || !filePath) return false;
  const resolved = path.resolve(filePath);
  const uploadDir = path.resolve(getSqlUploadDir());
  return resolved.startsWith(`${uploadDir}${path.sep}`) && resolved.endsWith('.sql');
}

function assertValidSqlUpload(filePath) {
  if (!isSafeUploadedSqlPath(filePath)) {
    throw new Error('Invalid upload path.');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error('Upload file not found.');
  }
  const stats = fs.statSync(filePath);
  if (!stats.isFile() || stats.size === 0) {
    throw new Error('SQL file is empty.');
  }
}

function removeUploadedSql(filePath) {
  if (!isSafeUploadedSqlPath(filePath)) return;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

async function restoreFromUploadedFile(filePath) {
  assertValidSqlUpload(filePath);
  try {
    await runMysqlImport(filePath);
  } finally {
    removeUploadedSql(filePath);
  }
  return { restored: true };
}

async function restoreBackup(filename, { includeUploads = false } = {}) {
  const sqlPath = resolveBackupPath(filename);
  await runMysqlImport(sqlPath);

  if (includeUploads) {
    const stamp = extractStamp(filename);
    if (stamp) {
      const archiveName = `uploads-${stamp}.tar.gz`;
      const archivePath = path.join(getBackupDir(), archiveName);
      if (fs.existsSync(archivePath)) {
        await restoreUploadsArchive(archiveName);
      }
    }
  }

  return { filename };
}

function deleteBackup(filename) {
  const sqlPath = resolveBackupPath(filename);
  fs.unlinkSync(sqlPath);

  const stamp = extractStamp(filename);
  if (stamp) {
    const uploadsPath = path.join(getBackupDir(), `uploads-${stamp}.tar.gz`);
    if (fs.existsSync(uploadsPath)) fs.unlinkSync(uploadsPath);
  }
}

async function resetDatabase() {
  const { sequelize } = require('../models');
  const session = require('express-session');
  const SequelizeStore = require('connect-session-sequelize')(session.Store);

  await sequelize.drop({ cascade: true });
  await sequelize.sync();

  const sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sessions' });
  await sessionStore.sync();

  const { seed } = require('../database/seed');
  await seed();
}

async function repairSchemaAfterRestore() {
  const { sequelize } = require('../models');
  const { applyPendingMigrations } = require('../database/migrationRunner');
  await sequelize.sync();
  await applyPendingMigrations(sequelize);
}

module.exports = {
  getBackupDir,
  getSqlUploadDir,
  getDbConfig,
  formatFileSize,
  listBackups,
  createBackup,
  restoreBackup,
  restoreFromUploadedFile,
  repairSchemaAfterRestore,
  deleteBackup,
  resetDatabase,
  isSafeBackupFilename,
  isSafeUploadedSqlPath,
  removeUploadedSql
};
