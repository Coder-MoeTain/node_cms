const path = require('path');
const multer = require('multer');
const appConfig = require('../config/app');
const { ensureDirectory } = require('../utils/fileHelper');
const { quarantineUploadPath } = require('../utils/uploadSecurity');

const blockedExtensions = new Set(['.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.js', '.mjs', '.jar', '.svg', '.html', '.htm', '.jsp', '.asp', '.aspx']);
const blockedFileNames = new Set(['.env', 'wp-config.php', 'phpinfo.php', 'config.php', 'backup.sql', 'database.sql', 'shell.php', 'config']);
const allowedImageMimeTypes = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/gif', ['.gif']],
  ['image/webp', ['.webp']]
]);
const allowedVideoMimeTypes = new Map([
  ['video/mp4', ['.mp4']],
  ['video/webm', ['.webm']],
  ['video/quicktime', ['.mov']]
]);
const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

function uploadDestination() {
  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const destination = quarantineUploadPath(folder);
  ensureDirectory(destination);
  return destination;
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadDestination());
  },
  filename(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
  }
});

function hasUnsafeFileName(originalName) {
  const normalized = String(originalName || '').toLowerCase().replace(/\\/g, '/');
  const baseName = path.basename(normalized);
  const stem = baseName.replace(path.extname(baseName), '');
  if (normalized.includes('../') || normalized.includes('..\\') || normalized.startsWith('..')) return true;
  if (blockedFileNames.has(baseName) || blockedFileNames.has(stem)) return true;
  const parts = baseName.split('.');
  if (parts.length > 2 && parts.slice(0, -1).some((part) => blockedExtensions.has(`.${part}`))) return true;
  return false;
}

function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (hasUnsafeFileName(file.originalname)) return callback(new Error('File name is not allowed.'));
  const allowedImage = allowedImageMimeTypes.get(file.mimetype)?.includes(extension);
  const allowedVideo = allowedVideoMimeTypes.get(file.mimetype)?.includes(extension);
  const allowedDocument = allowedMimeTypes.includes(file.mimetype) && ['.pdf', '.doc', '.docx'].includes(extension);
  if (blockedExtensions.has(extension) || (!allowedImage && !allowedVideo && !allowedDocument)) {
    return callback(new Error('File type is not allowed.'));
  }
  return callback(null, true);
}

function imageFileFilter(req, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (hasUnsafeFileName(file.originalname)) return callback(new Error('Featured image file name is not allowed.'));
  if (blockedExtensions.has(extension) || !allowedImageMimeTypes.get(file.mimetype)?.includes(extension)) {
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

function isAllowedUpload(extension, mimetype) {
  const ext = extension.toLowerCase();
  if (blockedExtensions.has(ext) || hasUnsafeFileName(`file${ext}`)) return false;
  const allowedImage = allowedImageMimeTypes.get(mimetype)?.includes(ext);
  const allowedVideo = allowedVideoMimeTypes.get(mimetype)?.includes(ext);
  const allowedDocument = allowedMimeTypes.includes(mimetype) && ['.pdf', '.doc', '.docx'].includes(ext);
  return Boolean(allowedImage || allowedVideo || allowedDocument);
}

module.exports = upload;
module.exports.hasUnsafeFileName = hasUnsafeFileName;
module.exports.isAllowedUpload = isAllowedUpload;
module.exports.blockedExtensions = blockedExtensions;
module.exports.blockedFileNames = blockedFileNames;
