const appConfig = require('../config/app');

const PREDICTION_CATEGORY_MAP = {
  sqli: 'sql_injection',
  sql_injection: 'sql_injection',
  xss: 'xss',
  csrf: 'custom',
  attack: 'custom'
};

function mapPredictionCategory(prediction) {
  const normalized = String(prediction || '').toLowerCase().trim();
  return PREDICTION_CATEGORY_MAP[normalized] || 'custom';
}

function confidenceToSeverity(confidence) {
  const value = Number(confidence);
  if (value >= 0.9) return 'critical';
  if (value >= 0.7) return 'high';
  if (value >= 0.5) return 'medium';
  return 'low';
}

function buildWebGuardAnalyzePayload(req, normalizedRequest, modelId) {
  const url = normalizedRequest.url || req.originalUrl || req.url || '/';
  const pathOnly = url.split('?')[0] || '/';
  const queryFromUrl = url.includes('?') ? url.split('?').slice(1).join('?') : '';
  const queryParams = queryFromUrl || new URLSearchParams(req.query || {}).toString();

  const bodyParts = (normalizedRequest.body || [])
    .map((entry) => `${entry.key}=${entry.value}`)
    .filter(Boolean);
  const bodyPayload = bodyParts.join('&');

  const headers = {};
  ['cookie', 'referer', 'x-csrf-token', 'x-requested-with', 'content-type'].forEach((name) => {
    const value = req.get(name);
    if (value) headers[name] = value;
  });

  const payload = {
    method: req.method || 'GET',
    url: pathOnly,
    query_params: queryParams || undefined,
    body: bodyPayload || undefined,
    headers: Object.keys(headers).length ? headers : undefined
  };

  if (modelId) payload.model_id = modelId;
  return payload;
}

function shouldUseMlWaf(settings, config = appConfig) {
  const { getWebGuardConfig } = require('./webguardClient');
  if (!getWebGuardConfig(settings).enabled) return false;
  return settings.ml_waf_enabled === true || settings.ml_waf_enabled === 'true';
}

function mlResultToMatch(analysis, settings) {
  if (!analysis || !analysis.is_attack) return null;

  const threshold = Number(settings.ml_waf_confidence_threshold ?? 0.7);
  const confidence = Number(analysis.confidence);
  if (!Number.isFinite(confidence) || confidence < threshold) return null;

  const rejectUncertain = settings.ml_waf_reject_uncertain !== false
    && settings.ml_waf_reject_uncertain !== 'false';
  if (rejectUncertain && analysis.uncertain) return null;

  const prediction = String(analysis.prediction || 'attack').toLowerCase();
  const category = mapPredictionCategory(prediction);
  const blockStandalone = settings.ml_waf_block_standalone !== false
    && settings.ml_waf_block_standalone !== 'false';

  return {
    rule: {
      id: null,
      name: `WebGuard ML: ${prediction}`,
      rule_key: 'webguard_ml',
      category,
      action: blockStandalone ? 'block' : 'log',
      severity: confidenceToSeverity(confidence),
      score: Math.min(Math.round(confidence * 100), 100)
    },
    target: {
      target: 'ml',
      key: 'webguard',
      value: prediction
    },
    ml: {
      prediction,
      confidence,
      uncertain: Boolean(analysis.uncertain),
      second_best: analysis.second_best || null,
      second_confidence: analysis.second_confidence ?? null,
      confidence_margin: analysis.confidence_margin ?? null,
      top_indicators: analysis.top_indicators || []
    }
  };
}

function attachMlMetadata(payload, mlMatch) {
  if (!mlMatch?.ml) return payload;
  const bodySnapshot = { ...(payload.body_snapshot || {}) };
  bodySnapshot._waf_meta = {
    ...(bodySnapshot._waf_meta || {}),
    ml_prediction: mlMatch.ml
  };
  return { ...payload, body_snapshot: bodySnapshot };
}

module.exports = {
  PREDICTION_CATEGORY_MAP,
  mapPredictionCategory,
  confidenceToSeverity,
  buildWebGuardAnalyzePayload,
  shouldUseMlWaf,
  mlResultToMatch,
  attachMlMetadata
};
