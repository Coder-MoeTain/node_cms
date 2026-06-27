const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { publicUploadPath, classifyMime } = require('./fileHelper');

const imageSizes = {
  thumbnail: 320,
  medium: 768,
  large: 1280
};

function publicPathFromDisk(filePath) {
  return `/uploads/${path.relative(publicUploadPath(), filePath).replace(/\\/g, '/')}`;
}

function diskPathFromPublic(filePath) {
  return publicUploadPath(filePath.replace(/^\/uploads\//, ''));
}

async function createImageVariants(file) {
  if (!file.mimetype.startsWith('image/')) return {};
  const metadata = await sharp(file.path).metadata();
  const parsed = path.parse(file.path);
  const variants = { width: metadata.width, height: metadata.height };

  for (const [key, width] of Object.entries(imageSizes)) {
    const variantPath = path.join(parsed.dir, `${parsed.name}-${key}.webp`);
    await sharp(file.path).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(variantPath);
    variants[`${key === 'thumbnail' ? 'thumbnail' : key}_path`] = publicPathFromDisk(variantPath);
  }

  return variants;
}

async function buildMediaPayload(file, userId) {
  const relative = publicPathFromDisk(file.path);
  const variants = await createImageVariants(file);
  return {
    filename: file.filename,
    original_name: file.originalname,
    file_path: relative,
    file_type: classifyMime(file.mimetype),
    mime_type: file.mimetype,
    file_size: file.size,
    uploaded_by: userId,
    ...variants
  };
}

function removeMediaFiles(media) {
  const paths = [media.file_path, media.thumbnail_path, media.medium_path, media.large_path].filter(Boolean);
  for (const filePath of paths) {
    const diskPath = diskPathFromPublic(filePath);
    if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
  }
}

function mediaUrl(filePath) {
  const cdn = process.env.CDN_URL;
  if (cdn && cdn !== 'undefined' && String(cdn).trim()) {
    return `${String(cdn).replace(/\/$/, '')}${filePath}`;
  }
  return filePath;
}

function normalizeUploadUrlsInHtml(html) {
  if (!html) return html;
  return String(html)
    .replace(/(\s(?:src|href)=["'])\/admin\/uploads\//gi, '$1/uploads/')
    .replace(/(\s(?:src|href)=["'])(?:\.\.\/)+uploads\//gi, '$1/uploads/')
    .replace(
      /(\s(?:src|href)=["'])(?!\/|https?:\/\/|data:|mailto:|#|tel:)(uploads\/[^"']+)(["'])/gi,
      '$1/$2$3'
    );
}

function mediaFileExists(filePath) {
  const value = String(filePath || '').trim();
  if (!value) return false;
  const uploadsPath = extractUploadsPath(value);
  if (!uploadsPath) {
    return /^https?:\/\//i.test(value);
  }
  try {
    return fs.existsSync(diskPathFromPublic(uploadsPath));
  } catch {
    return false;
  }
}

function extractUploadsPath(filePath) {
  const value = String(filePath || '').trim();
  if (!value) return '';
  if (value.startsWith('/uploads/')) return value.split(/[?#]/)[0];
  const match = value.match(/\/uploads\/[^?\s#'"]+/i);
  return match ? match[0] : '';
}

function resolvePublicMediaUrl(filePath) {
  const value = String(filePath || '').trim();
  if (!value) return '';

  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  let relative = value;
  if (appUrl && relative.startsWith(appUrl)) {
    relative = relative.slice(appUrl.length);
  }

  const uploadsPath = extractUploadsPath(relative);
  if (uploadsPath) {
    if (!mediaFileExists(uploadsPath)) return '';
    return mediaUrl(uploadsPath);
  }

  if (/^https?:\/\//i.test(value)) return value.slice(0, 2048);
  return '';
}

function filterExistingMedia(rows = []) {
  return rows.filter((row) => {
    const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    return mediaFileExists(plain.file_path);
  });
}

function resolveBestMediaUrl(...paths) {
  for (const filePath of paths) {
    const resolved = resolvePublicMediaUrl(filePath);
    if (resolved) return resolved;
  }
  return '';
}

async function regenerateImageVariants(media) {
  const originalPath = diskPathFromPublic(media.file_path);
  if (!fs.existsSync(originalPath)) {
    throw new Error('Original media file not found on disk.');
  }
  if (!String(media.mime_type || '').startsWith('image/')) {
    return media;
  }
  for (const key of ['thumbnail_path', 'medium_path', 'large_path']) {
    if (!media[key]) continue;
    const variantPath = diskPathFromPublic(media[key]);
    if (fs.existsSync(variantPath)) fs.unlinkSync(variantPath);
  }
  const variants = await createImageVariants({ path: originalPath, mimetype: media.mime_type });
  await media.update(variants);
  return media;
}

module.exports = {
  buildMediaPayload,
  removeMediaFiles,
  diskPathFromPublic,
  mediaUrl,
  mediaFileExists,
  resolvePublicMediaUrl,
  resolveBestMediaUrl,
  extractUploadsPath,
  filterExistingMedia,
  normalizeUploadUrlsInHtml,
  regenerateImageVariants,
  imageSizes
};
