const path = require('path');
const multer = require('multer');
const appConfig = require('../config/app');
const { ensureDirectory, publicUploadPath } = require('../utils/fileHelper');

const blockedExtensions = new Set(['.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.js', '.mjs', '.jar']);
const allowedMimePrefixes = ['image/', 'video/'];
const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const storage = multer.diskStorage({
  destination(req, file, callback) {
    const folder = new Date().toISOString().slice(0, 7);
    const destination = publicUploadPath(folder);
    ensureDirectory(destination);
    callback(null, destination);
  },
  filename(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
  }
});

function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  const allowedMime = allowedMimePrefixes.some((prefix) => file.mimetype.startsWith(prefix)) || allowedMimeTypes.includes(file.mimetype);
  if (blockedExtensions.has(extension) || !allowedMime) {
    return callback(new Error('File type is not allowed.'));
  }
  return callback(null, true);
}

function imageFileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (blockedExtensions.has(extension) || !file.mimetype.startsWith('image/')) {
    return callback(new Error('Featured image must be an image file.'));
  }
  return callback(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: appConfig.uploadMaxSizeMb * 1024 * 1024 }
});

upload.image = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: appConfig.uploadMaxSizeMb * 1024 * 1024 }
});

module.exports = upload;
