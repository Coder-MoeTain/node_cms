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
    callback(null, `${Date.now()}-import.json`);
  }
});

const jsonUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.json' && file.mimetype !== 'application/json') {
      return callback(new Error('Only JSON export files are allowed.'));
    }
    callback(null, true);
  }
});

module.exports = { jsonUpload };
