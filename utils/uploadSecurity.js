const fs = require('fs');
const path = require('path');
const { ensureDirectory, publicUploadPath } = require('./fileHelper');

const DANGEROUS_EXTENSIONS = new Set([
  '.php', '.phtml', '.exe', '.sh', '.bat', '.cmd', '.jsp', '.asp', '.aspx', '.js', '.mjs', '.html', '.htm', '.svg'
]);

const MIME_EXTENSION_MAP = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/gif', ['.gif']],
  ['image/webp', ['.webp']],
  ['video/mp4', ['.mp4']],
  ['video/webm', ['.webm']],
  ['video/quicktime', ['.mov']],
  ['application/pdf', ['.pdf']],
  ['application/msword', ['.doc']],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['.docx']]
]);

const MAGIC_SIGNATURES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'video/mp4': [[0x00, 0x00, 0x00]],
  'video/webm': [[0x1A, 0x45, 0xDF, 0xA3]],
  'video/quicktime': [[0x00, 0x00, 0x00]]
};

function quarantineUploadPath(filename = '') {
  return path.join(process.cwd(), 'tmp', 'quarantine', filename);
}

function hasDoubleExtension(originalName) {
  const base = path.basename(String(originalName || ''));
  const parts = base.split('.');
  if (parts.length <= 2) return false;
  return parts.slice(0, -1).some((part) => DANGEROUS_EXTENSIONS.has(`.${part.toLowerCase()}`));
}

function readFileHeader(filePath, length = 16) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, 0);
    return buffer;
  } finally {
    fs.closeSync(fd);
  }
}

function matchesSignature(buffer, signatures) {
  return signatures.some((signature) => signature.every((byte, index) => buffer[index] === byte));
}

function detectMimeFromMagic(filePath, extension) {
  const header = readFileHeader(filePath, 12);
  if (extension === '.webp') {
    const riff = header.slice(0, 4).toString('ascii') === 'RIFF';
    const webp = header.slice(8, 12).toString('ascii') === 'WEBP';
    return riff && webp ? 'image/webp' : null;
  }
  if (extension === '.mp4' || extension === '.mov') {
    const box = header.slice(4, 8).toString('ascii');
    if (['ftyp', 'moov', 'mdat', 'wide', 'free'].includes(box)) {
      return extension === '.mov' ? 'video/quicktime' : 'video/mp4';
    }
    return null;
  }
  for (const [mime, signatures] of Object.entries(MAGIC_SIGNATURES)) {
    if (matchesSignature(header, signatures)) return mime;
  }
  return null;
}

function validateDocumentHeader(filePath, extension) {
  const header = readFileHeader(filePath, 8);
  if (extension === '.pdf') {
    return header.slice(0, 5).toString('ascii') === '%PDF-';
  }
  if (extension === '.docx') {
    return header[0] === 0x50 && header[1] === 0x4B;
  }
  if (extension === '.doc') {
    return header.slice(0, 8).equals(Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]));
  }
  return false;
}

async function validateMagicBytes(filePath, claimedMime, extension) {
  const ext = String(extension || '').toLowerCase();
  const allowedExtensions = MIME_EXTENSION_MAP.get(claimedMime);
  if (!allowedExtensions || !allowedExtensions.includes(ext)) {
    return { valid: false, reason: 'MIME type and extension do not match allowlist.' };
  }

  if (['.pdf', '.doc', '.docx'].includes(ext)) {
    if (!validateDocumentHeader(filePath, ext)) {
      return { valid: false, reason: 'Document header validation failed.' };
    }
    return { valid: true, detectedMime: claimedMime };
  }

  const detectedMime = detectMimeFromMagic(filePath, ext);
  if (!detectedMime) {
    return { valid: false, reason: 'Unable to detect file type from content.' };
  }

  const detectedAllowed = MIME_EXTENSION_MAP.get(detectedMime);
  if (!detectedAllowed || !detectedAllowed.includes(ext)) {
    return { valid: false, reason: `Detected content type ${detectedMime} does not match claimed type.` };
  }

  return { valid: true, detectedMime };
}

async function finalizeQuarantinedUpload(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (hasDoubleExtension(file.originalname)) {
    fs.unlinkSync(file.path);
    throw new Error('Double extension filenames are not allowed.');
  }

  const magic = await validateMagicBytes(file.path, file.mimetype, extension);
  if (!magic.valid) {
    fs.unlinkSync(file.path);
    throw new Error(magic.reason || 'Upload failed content validation.');
  }

  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const destinationDir = publicUploadPath(folder);
  ensureDirectory(destinationDir);

  const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
  const destination = path.join(destinationDir, safeName);
  fs.renameSync(file.path, destination);

  file.path = destination;
  file.filename = safeName;
  file.mimetype = magic.detectedMime || file.mimetype;
  return file;
}

module.exports = {
  quarantineUploadPath,
  hasDoubleExtension,
  validateMagicBytes,
  finalizeQuarantinedUpload,
  detectMimeFromMagic,
  DANGEROUS_EXTENSIONS,
  MIME_EXTENSION_MAP
};
