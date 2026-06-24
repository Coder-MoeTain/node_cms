#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('../utils/logger');

const backupDir = path.join(process.cwd(), 'database', 'backups');
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14);

function pruneOldBackups() {
  if (!fs.existsSync(backupDir)) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(backupDir)) {
    const filePath = path.join(backupDir, file);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      logger.info('Pruned old backup', { file });
    }
  }
}

try {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dbFile = path.join(backupDir, `backup-${stamp}.sql`);

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'nodepress_cms';

  const cmd = `mysqldump -h ${host} -P ${port} -u ${user} ${password ? `-p${password}` : ''} ${database}`;
  execSync(`${cmd} > "${dbFile}"`, { stdio: 'inherit', shell: true });

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const uploadsArchive = path.join(backupDir, `uploads-${stamp}.tar.gz`);
    execSync(`tar -czf "${uploadsArchive}" -C "${path.dirname(uploadsDir)}" uploads`, { stdio: 'inherit', shell: true });
    logger.info('Scheduled uploads backup complete', { uploadsArchive });
  }

  pruneOldBackups();
  logger.info('Scheduled database backup complete', { dbFile, retentionDays });
  process.exit(0);
} catch (error) {
  logger.error('Scheduled backup failed', { error: error.message });
  process.exit(1);
}
