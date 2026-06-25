const fs = require('fs');
const path = require('path');
const models = require('../models');
const { buildMediaPayload } = require('./mediaHelper');
const { finalizeQuarantinedUpload } = require('./uploadSecurity');

async function saveUploadedImage(file, userId, transaction = null) {
  if (!file) return null;

  const processed = await finalizeQuarantinedUpload(file);
  const payload = await buildMediaPayload(processed, userId);
  await models.Media.create(payload, { transaction });
  return payload.file_path;
}

function getUploadedFile(req, fieldName) {
  return req.files?.[fieldName]?.[0] || (req.file?.fieldname === fieldName ? req.file : null);
}

function isValidUploadPath(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') return false;
  const trimmed = publicPath.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (!trimmed.startsWith('/uploads/')) return false;
  const diskPath = path.join(process.cwd(), 'public', trimmed.replace(/^\//, ''));
  return fs.existsSync(diskPath);
}

function sanitizeUploadPath(publicPath) {
  if (!publicPath || typeof publicPath !== 'string') return '';
  const trimmed = publicPath.trim();
  return isValidUploadPath(trimmed) ? trimmed.slice(0, 255) : '';
}

function readRecordPath(record, pathField) {
  if (!record) return '';
  const plain = typeof record.get === 'function' ? record.get({ plain: true }) : record;
  const direct = plain[pathField];
  if (direct !== undefined && direct !== null && direct !== '') {
    return String(direct);
  }
  if (plain.value !== undefined && plain.value !== null && plain.value !== '') {
    return String(plain.value);
  }
  return '';
}

async function resolveImageValue(req, { fileField, pathField, record = null, transaction = null }) {
  const uploaded = await saveUploadedImage(
    getUploadedFile(req, fileField),
    req.session.user.id,
    transaction
  );
  if (uploaded) return uploaded;
  if (req.body[`remove_${pathField}`] === '1') return '';

  const fromBody = req.body[pathField];
  if (fromBody !== undefined && fromBody !== '') {
    const sanitized = sanitizeUploadPath(String(fromBody));
    if (sanitized) return sanitized;
    return sanitizeUploadPath(readRecordPath(record, pathField));
  }

  return sanitizeUploadPath(readRecordPath(record, pathField));
}

module.exports = {
  getUploadedFile,
  saveUploadedImage,
  resolveImageValue,
  isValidUploadPath,
  sanitizeUploadPath,
  readRecordPath
};
