const fs = require('fs');
const path = require('path');
const { ensureDirectory } = require('./fileHelper');

const SENSITIVE_KEYS = /password|secret|token|api_key|apikey|credential|private/i;

function maskValue(key, value) {
  if (value === null || value === undefined) return value;
  if (SENSITIVE_KEYS.test(String(key))) return '[REDACTED]';
  if (typeof value === 'object') return maskObject(value);
  return value;
}

function maskObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = maskValue(key, value);
  }
  return out;
}

function isMissingActivityLogsError(error) {
  const message = String(error?.message || '');
  const code = error?.parent?.code || error?.original?.code;
  return code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR' || /activity_logs.*doesn't exist/i.test(message);
}

async function listActivityLogs(options = {}) {
  try {
    const { ActivityLog } = require('../models');
    return await ActivityLog.findAll(options);
  } catch (error) {
    if (isMissingActivityLogsError(error)) return [];
    throw error;
  }
}

async function createActivityLog(entry) {
  try {
    const { ActivityLog } = require('../models');
    const payload = {
      user_id: entry.user_id ?? null,
      action: entry.action,
      entity_type: entry.resource_type || entry.entity_type || null,
      entity_id: entry.resource_id || entry.entity_id || null,
      ip_address: entry.ip_address || null,
      user_agent: entry.user_agent || null,
      metadata: entry.metadata || buildMetadata(entry)
    };
    return await ActivityLog.create(payload);
  } catch (error) {
    if (isMissingActivityLogsError(error)) return null;
    throw error;
  }
}

function buildMetadata(entry) {
  const meta = {
    status: entry.status || 'success',
    slug: entry.slug || entry.resource_id || null
  };
  if (entry.old_value_json !== undefined || entry.old_value !== undefined) {
    meta.old_value = maskObject(entry.old_value_json || entry.old_value);
  }
  if (entry.new_value_json !== undefined || entry.new_value !== undefined) {
    meta.new_value = maskObject(entry.new_value_json || entry.new_value);
  }
  if (entry.details) {
    try {
      meta.details = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
      meta.details = maskObject(meta.details);
    } catch {
      meta.details = entry.details;
    }
  }
  return meta;
}

function logPluginAudit(req, action, details = {}) {
  return createActivityLog({
    user_id: req.session?.user?.id || null,
    action,
    resource_type: 'plugin',
    resource_id: null,
    ip_address: req.ip,
    user_agent: req.get('user-agent'),
    status: details.status || 'success',
    old_value_json: details.old_value,
    new_value_json: details.new_value,
    details: { ...details, slug: details.slug || null }
  });
}

function logThemeAudit(req, action, details = {}) {
  return createActivityLog({
    user_id: req.session?.user?.id || null,
    action,
    resource_type: 'theme',
    resource_id: null,
    ip_address: req.ip,
    user_agent: req.get('user-agent'),
    status: details.status || 'success',
    old_value_json: details.old_value,
    new_value_json: details.new_value,
    details: { ...details, slug: details.slug || null }
  });
}

module.exports = {
  listActivityLogs,
  createActivityLog,
  logPluginAudit,
  logThemeAudit,
  maskObject,
  isMissingActivityLogsError
};
