const sanitizeHtml = require('sanitize-html');
const { Op } = require('sequelize');
const models = require('../models');

const richTextSanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height']
  }
};

function parseOptions(field) {
  if (!field.options_json) return [];
  try {
    const parsed = JSON.parse(field.options_json);
    return Array.isArray(parsed) ? parsed : parsed.options || [];
  } catch {
    return [];
  }
}

function sanitizeFieldValue(field, rawValue) {
  if (rawValue == null || rawValue === '') return '';
  const str = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);

  switch (field.type) {
    case 'number':
      return String(Number(str) || 0);
    case 'email':
      return sanitizeHtml(str.trim().toLowerCase(), { allowedTags: [], allowedAttributes: {} }).slice(0, 254);
    case 'url':
      return sanitizeHtml(str.trim(), { allowedTags: [], allowedAttributes: {} }).slice(0, 2048);
    case 'color':
      return /^#[0-9a-fA-F]{3,8}$/.test(str.trim()) ? str.trim() : '';
    case 'rich_text':
      return sanitizeHtml(str, richTextSanitizeOptions);
    case 'textarea':
    case 'text':
      return sanitizeHtml(str, { allowedTags: [], allowedAttributes: {} }).slice(0, 10000);
    case 'checkbox':
    case 'radio':
    case 'select':
      return sanitizeHtml(str, { allowedTags: [], allowedAttributes: {} }).slice(0, 500);
    case 'repeater':
    case 'group':
      try {
        const parsed = typeof rawValue === 'object' ? rawValue : JSON.parse(str);
        return JSON.stringify(parsed);
      } catch {
        return '[]';
      }
    default:
      return sanitizeHtml(str, { allowedTags: [], allowedAttributes: {} }).slice(0, 5000);
  }
}

function validateFieldValue(field, sanitized) {
  if (field.is_required && (!sanitized || sanitized === '')) {
    return `${field.label} is required.`;
  }
  if (field.type === 'email' && sanitized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
    return `${field.label} must be a valid email.`;
  }
  if (field.type === 'url' && sanitized && !/^https?:\/\//i.test(sanitized)) {
    return `${field.label} must be a valid URL starting with http:// or https://.`;
  }
  return null;
}

async function loadFieldGroupsForLocation(locationType, locationValue) {
  return models.FieldGroup.findAll({
    where: {
      status: 'active',
      location_type: locationType,
      location_value: locationValue
    },
    include: [{
      model: models.CustomField,
      as: 'fields',
      where: { status: 'active' },
      required: false
    }],
    order: [
      ['display_order', 'ASC'],
      [{ model: models.CustomField, as: 'fields' }, 'display_order', 'ASC']
    ]
  });
}

async function loadFieldValues(resourceType, resourceId) {
  const values = await models.CustomFieldValue.findAll({
    where: { resource_type: resourceType, resource_id: resourceId },
    include: [{ model: models.CustomField, as: 'CustomField', required: true }]
  });
  const map = {};
  for (const row of values) {
    const name = row.CustomField?.name || row.custom_field_id;
    map[name] = row.value_text;
  }
  return map;
}

async function loadCustomFieldsMap(resourceType, resourceId, locationType, locationValue) {
  const groups = await loadFieldGroupsForLocation(locationType, locationValue);
  const saved = await loadFieldValues(resourceType, resourceId);
  const result = {};
  for (const group of groups) {
    for (const field of group.fields || []) {
      result[field.name] = saved[field.name] != null ? saved[field.name] : (field.default_value || '');
    }
  }
  return result;
}

async function saveCustomFieldValues(resourceType, resourceId, body, locationType, locationValue, transaction = null) {
  const groups = await loadFieldGroupsForLocation(locationType, locationValue);
  const errors = [];

  for (const group of groups) {
    for (const field of group.fields || []) {
      const key = `cf_${field.name}`;
      const raw = body[key];
      const sanitized = sanitizeFieldValue(field, raw);
      const err = validateFieldValue(field, sanitized);
      if (err) errors.push(err);
    }
  }

  if (errors.length) {
    const error = new Error(errors.join(' '));
    error.status = 400;
    error.fieldErrors = errors;
    throw error;
  }

  for (const group of groups) {
    for (const field of group.fields || []) {
      const key = `cf_${field.name}`;
      const sanitized = sanitizeFieldValue(field, body[key]);
      const [row] = await models.CustomFieldValue.findOrCreate({
        where: {
          custom_field_id: field.id,
          resource_type: resourceType,
          resource_id: resourceId
        },
        defaults: { value_text: sanitized },
        transaction
      });
      if (row.value_text !== sanitized) {
        await row.update({ value_text: sanitized }, { transaction });
      }
    }
  }
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  parseOptions,
  sanitizeFieldValue,
  validateFieldValue,
  loadFieldGroupsForLocation,
  loadFieldValues,
  loadCustomFieldsMap,
  saveCustomFieldValues,
  escapeHtml
};
