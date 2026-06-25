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
  return cdn ? `${cdn.replace(/\/$/, '')}${filePath}` : filePath;
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
  if (!filePath) return false;
  try {
    return fs.existsSync(diskPathFromPublic(filePath));
  } catch {
    return false;
  }
}

function filterExistingMedia(rows = []) {
  return rows.filter((row) => {
    const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    return mediaFileExists(plain.file_path);
  });
}

module.exports = {
  buildMediaPayload,
  removeMediaFiles,
  diskPathFromPublic,
  mediaUrl,
  mediaFileExists,
  filterExistingMedia,
  normalizeUploadUrlsInHtml
};
