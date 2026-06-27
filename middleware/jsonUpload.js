const path = require('path');
const multer = require('multer');
const { ensureDirectory } = require('../utils/fileHelper');

const storage = multer.diskStorage({
  destination(req, file, callback) {
    const dir = path.join(process.cwd(), 'tmp', 'uploads');
    ensureDirectory(dir);
    callback(null, dir);
  },
  filename(req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase() || '.json';
    callback(null, `${Date.now()}-import${ext}`);
  }
});

const jsonUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ext === '.json' || ext === '.xml' || ext === '.csv';
    const jsonMime = file.mimetype === 'application/json' || file.mimetype === 'text/json';
    const xmlMime = file.mimetype === 'application/xml' || file.mimetype === 'text/xml';
    const csvMime = file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel';
    if (!allowed && !jsonMime && !xmlMime && !csvMime) {
      return callback(new Error('Only JSON, CSV, or WordPress WXR (.xml) export files are allowed.'));
    }
    callback(null, true);
  }
});

module.exports = { jsonUpload };
