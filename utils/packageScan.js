const fs = require('fs');
const path = require('path');

const BLOCKED_ARCHIVE_EXTENSIONS = new Set([
  '.php', '.phtml', '.exe', '.sh', '.bat', '.cmd', '.jsp', '.asp', '.aspx', '.jar', '.dll', '.vbs', '.ps1', '.htaccess', '.env'
]);

const BLOCKED_THEME_ARCHIVE_EXTENSIONS = new Set([
  ...BLOCKED_ARCHIVE_EXTENSIONS,
  '.js',
  '.mjs'
]);

const MAX_ARCHIVE_FILES = 500;

function listFilesRecursive(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) listFilesRecursive(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function scanExtractedDirectory(rootDir, { archiveType = 'plugin' } = {}) {
  const issues = [];
  const blockedExtensions = archiveType === 'theme' ? BLOCKED_THEME_ARCHIVE_EXTENSIONS : BLOCKED_ARCHIVE_EXTENSIONS;
  const files = listFilesRecursive(rootDir);
  if (files.length > MAX_ARCHIVE_FILES) {
    issues.push(`Archive contains too many files (${files.length}; max ${MAX_ARCHIVE_FILES}).`);
  }
  for (const filePath of files) {
    const relative = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();
    if (relative.includes('..')) {
      issues.push(`Unsafe path "${relative}"`);
    }
    if (blockedExtensions.has(ext)) {
      issues.push(`Blocked file type "${ext}" in ${relative}`);
    }
    if (path.basename(relative).toLowerCase() === '.env') {
      issues.push(`Blocked file ".env" in ${relative}`);
    }
  }
  return issues;
}

function isZipMagicBytes(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(4);
    fs.readSync(fd, header, 0, 4, 0);
    return header[0] === 0x50 && header[1] === 0x4B;
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = {
  BLOCKED_ARCHIVE_EXTENSIONS,
  MAX_ARCHIVE_FILES,
  scanExtractedDirectory,
  isZipMagicBytes
};
