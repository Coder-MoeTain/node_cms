const fs = require('fs');
const path = require('path');

function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function publicUploadPath(filename = '') {
  return path.join(process.cwd(), 'public', 'uploads', filename);
}

function classifyMime(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(mimeType)) {
    return 'document';
  }
  return 'other';
}

module.exports = { ensureDirectory, publicUploadPath, classifyMime };
