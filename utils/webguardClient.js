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
  const parsed = assertSafeOutboundUrl(`${baseUrl}/api/ids/analyze`, {
    allowHttp: appConfig.env !== 'production',
    allowLoopback: getWebGuardConfig().allowLocalhost
  });
  return parsed.toString();
}

function buildHealthUrl(baseUrl) {
  const parsed = assertSafeOutboundUrl(`${baseUrl}/health`, {
    allowHttp: appConfig.env !== 'production',
    allowLoopback: getWebGuardConfig().allowLocalhost
  });
  return parsed.toString();
}

function buildAuthHeaders(config) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (config.apiKey) headers['X-API-Key'] = config.apiKey;
  else if (config.bearerToken) headers.Authorization = `Bearer ${config.bearerToken}`;
  return headers;
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

module.exports = {
  getWebGuardConfig,
  analyzeRequest,
  checkHealth,
  clearWebGuardHealthCache
};
