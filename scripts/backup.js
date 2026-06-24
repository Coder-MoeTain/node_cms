#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backupDir = path.join(process.cwd(), 'database', 'backups');
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
  console.log(`Uploads archive: ${uploadsArchive}`);
}

console.log(`Database backup: ${dbFile}`);
