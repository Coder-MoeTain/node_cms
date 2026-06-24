const path = require('path');
const multer = require('multer');
const appConfig = require('../config/app');
const { ensureDirectory } = require('../utils/fileHelper');
const { MAX_ARCHIVE_BYTES } = require('../utils/packageArchive');

const zipStorage = multer.diskStorage({
  destination(req, file, callback) {
    const dir = path.join(process.cwd(), 'tmp', 'uploads');
    ensureDirectory(dir);
    callback(null, dir);
  },
  filename(req, file, callback) {
    callback(null, `${Date.now()}-archive.zip`);
  }
});

const zipUpload = multer({
  storage: zipStorage,
  limits: { fileSize: MAX_ARCHIVE_BYTES },
  fileFilter(req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.zip') {
      return callback(new Error('Only .zip archives are allowed.'));
    }
    callback(null, true);
  }
});

module.exports = { zipUpload };
