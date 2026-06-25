const path = require('path');
const multer = require('multer');
const { ensureDirectory } = require('../utils/fileHelper');

const MAX_SQL_BYTES = Number(process.env.SQL_RESTORE_MAX_SIZE_MB || 100) * 1024 * 1024;
const allowedMimeTypes = new Set([
  'application/sql',
  'application/x-sql',
  'text/plain',
  'text/x-sql',
  'application/octet-stream'
]);

const storage = multer.diskStorage({
  destination(req, file, callback) {
    const dir = path.join(process.cwd(), 'tmp', 'uploads');
    ensureDirectory(dir);
    callback(null, dir);
  },
  filename(req, file, callback) {
    callback(null, `${Date.now()}-restore.sql`);
  }
});

const sqlUpload = multer({
  storage,
  limits: { fileSize: MAX_SQL_BYTES },
  fileFilter(req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.sql') {
      return callback(new Error('Only .sql files are allowed.'));
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error('Invalid SQL file type.'));
    }
    const baseName = path.basename(file.originalname);
    if (baseName.includes('..') || /[\\/]/.test(file.originalname)) {
      return callback(new Error('Invalid file name.'));
    }
    callback(null, true);
  }
});

module.exports = { sqlUpload, MAX_SQL_BYTES };
