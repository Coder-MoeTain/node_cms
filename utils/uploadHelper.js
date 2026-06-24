const models = require('../models');
const { buildMediaPayload } = require('./mediaHelper');

function getUploadedFile(req, fieldName) {
  return req.files?.[fieldName]?.[0] || (req.file?.fieldname === fieldName ? req.file : null);
}

async function saveUploadedImage(file, userId, transaction = null) {
  if (!file) return null;

  const payload = await buildMediaPayload(file, userId);
  await models.Media.create(payload, { transaction });
  return payload.file_path;
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
    return String(fromBody).slice(0, 255);
  }

  return record?.[pathField] || '';
}

module.exports = { getUploadedFile, saveUploadedImage, resolveImageValue };
