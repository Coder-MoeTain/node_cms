const appConfig = require('../config/app');
const { assertSafeOutboundUrl } = require('./ssrfGuard');

let healthCache = { checkedAt: 0, ok: false };

function getWebGuardConfig() {
  const webguard = appConfig.webguard || {};
  return {
    enabled: Boolean(webguard.enabled),
    baseUrl: String(webguard.baseUrl || '').replace(/\/$/, ''),
    apiKey: String(webguard.apiKey || '').trim(),
    bearerToken: String(webguard.bearerToken || '').trim(),
    timeoutMs: Math.max(100, Number(webguard.timeoutMs || 500)),
    allowLocalhost: Boolean(webguard.allowLocalhost),
    failOpen: webguard.failOpen !== false
  };
}

function buildAnalyzeUrl(baseUrl) {
  return buildApiUrl(baseUrl, '/api/ids/analyze');
}

function buildHealthUrl(baseUrl) {
  return buildApiUrl(baseUrl, '/health');
}

function buildAuthHeaders(config, options = {}) {
  const headers = { Accept: 'application/json' };
  if (!options.multipart) headers['Content-Type'] = 'application/json';
  if (config.apiKey) headers['X-API-Key'] = config.apiKey;
  else if (config.bearerToken) headers.Authorization = `Bearer ${config.bearerToken}`;
  return headers;
}

function buildApiUrl(baseUrl, apiPath) {
  const normalizedPath = String(apiPath || '').startsWith('/') ? apiPath : `/${apiPath}`;
  const parsed = assertSafeOutboundUrl(`${baseUrl}${normalizedPath}`, {
    allowHttp: appConfig.env !== 'production',
    allowLoopback: getWebGuardConfig().allowLocalhost
  });
  return parsed.toString();
}

async function analyzeRequest(payload, options = {}) {
  const config = getWebGuardConfig();
  if (!config.enabled || !config.baseUrl) {
    return { ok: false, error: 'WebGuard integration is not configured.', failOpen: config.failOpen };
  }
  if (!config.apiKey && !config.bearerToken) {
    return { ok: false, error: 'WebGuard API credentials are not configured.', failOpen: config.failOpen };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || config.timeoutMs);

  try {
    const response = await fetch(buildAnalyzeUrl(config.baseUrl), {
      method: 'POST',
      headers: buildAuthHeaders(config),
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return {
        ok: false,
        error: `WebGuard analyze failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        status: response.status,
        failOpen: config.failOpen
      };
    }

    const data = await response.json();
    return { ok: true, data, failOpen: config.failOpen };
  } catch (error) {
    const message = error.name === 'AbortError'
      ? `WebGuard analyze timed out after ${options.timeoutMs || config.timeoutMs}ms`
      : error.message;
    return { ok: false, error: message, failOpen: config.failOpen };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkHealth(force = false) {
  const config = getWebGuardConfig();
  if (!config.enabled || !config.baseUrl) {
    return { ok: false, configured: false, error: 'WebGuard integration is not configured.' };
  }

  if (!force && Date.now() - healthCache.checkedAt < 30000) {
    return { ok: healthCache.ok, configured: true, cached: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 2000));

  try {
    const response = await fetch(buildHealthUrl(config.baseUrl), {
      method: 'GET',
      signal: controller.signal
    });
    const ok = response.ok;
    healthCache = { checkedAt: Date.now(), ok };
    return { ok, configured: true, status: response.status };
  } catch (error) {
    healthCache = { checkedAt: Date.now(), ok: false };
    return { ok: false, configured: true, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

function clearWebGuardHealthCache() {
  healthCache = { checkedAt: 0, ok: false };
}

async function uploadModelArchive(filePath, filename = 'model.zip', options = {}) {
  const config = getWebGuardConfig();
  if (!config.enabled || !config.baseUrl) {
    return { ok: false, skipped: true, error: 'WebGuard integration is not configured.' };
  }
  if (!config.apiKey && !config.bearerToken) {
    return { ok: false, skipped: true, error: 'WebGuard API credentials are not configured.' };
  }

  const fs = require('fs');
  const { Blob } = require('buffer');
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'Model archive not found on disk.' };
  }

  const uploadPath = process.env.WEBGUARD_MODEL_UPLOAD_PATH || '/api/models/upload';
  const timeoutMs = Math.max(config.timeoutMs, Number(process.env.WEBGUARD_UPLOAD_TIMEOUT_MS || 120000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const buffer = fs.readFileSync(filePath);
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: 'application/zip' }), filename || 'model.zip');
    if (options.modelId) formData.append('model_id', String(options.modelId));

    const response = await fetch(buildApiUrl(config.baseUrl, uploadPath), {
      method: 'POST',
      headers: buildAuthHeaders(config, { multipart: true }),
      body: formData,
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return {
        ok: false,
        error: `WebGuard model upload failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        status: response.status
      };
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    clearWebGuardHealthCache();
    return { ok: true, data };
  } catch (error) {
    const message = error.name === 'AbortError'
      ? `WebGuard model upload timed out after ${timeoutMs}ms`
      : error.message;
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function listRemoteModels() {
  const config = getWebGuardConfig();
  if (!config.enabled || !config.baseUrl) {
    return { ok: false, models: [], error: 'WebGuard integration is not configured.' };
  }

  const listPath = process.env.WEBGUARD_MODEL_LIST_PATH || '/api/models';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 5000));

  try {
    const response = await fetch(buildApiUrl(config.baseUrl, listPath), {
      method: 'GET',
      headers: buildAuthHeaders(config),
      signal: controller.signal
    });
    if (!response.ok) {
      return { ok: false, models: [], error: `WebGuard model list failed (${response.status})` };
    }
    const data = await response.json();
    const models = Array.isArray(data) ? data : (Array.isArray(data?.models) ? data.models : []);
    return { ok: true, models };
  } catch (error) {
    return { ok: false, models: [], error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function deleteRemoteModel(modelId) {
  const config = getWebGuardConfig();
  if (!config.enabled || !config.baseUrl || !modelId) {
    return { ok: false, skipped: true };
  }

  const deletePath = process.env.WEBGUARD_MODEL_DELETE_PATH || `/api/models/${encodeURIComponent(modelId)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 5000));

  try {
    const response = await fetch(buildApiUrl(config.baseUrl, deletePath), {
      method: 'DELETE',
      headers: buildAuthHeaders(config),
      signal: controller.signal
    });
    return { ok: response.ok || response.status === 404, status: response.status };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  getWebGuardConfig,
  analyzeRequest,
  checkHealth,
  uploadModelArchive,
  listRemoteModels,
  deleteRemoteModel,
  clearWebGuardHealthCache
};
