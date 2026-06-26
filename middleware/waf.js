const { Op } = require('sequelize');
const pluginLoader = require('../utils/pluginLoader');
const {
  WafRule,
  WafLog,
  WafIpList,
  WafSetting,
  WafRateLimit
} = require('../models');
const {
  getClientIp,
  normalizeRequestData,
  calculateRiskScore,
  matchRuleAgainstRequest,
  shouldSkipWaf,
  createRequestId,
  getActionForRiskScore,
  buildSafeLogPayload,
  createWafBlockResponse,
  isExpiredIpListItem,
  findIpListMatches,
  getRouteType,
  isDangerousUploadFilename,
  ipMatchesListEntry
} = require('../utils/wafHelper');
const { analyzeRequest } = require('../utils/webguardClient');
const {
  shouldUseMlWaf,
  buildWebGuardAnalyzePayload,
  mlResultToMatch,
  attachMlMetadata
} = require('../utils/wafMlHelper');

const cache = {
  loadedAt: 0,
  settings: null,
  rules: null,
  ipLists: null
};

const DEFAULT_SETTINGS = {
  waf_enabled: true,
  waf_mode: 'monitor',
  block_sql_injection: true,
  block_xss: true,
  block_path_traversal: true,
  block_command_injection: true,
  block_bad_bots: true,
  block_scanners: true,
  block_cms_probes: true,
  admin_protection_enabled: true,
  public_protection_enabled: true,
  max_risk_score_public: 50,
  max_risk_score_admin: 40,
  max_risk_score: 50,
  log_all_suspicious: true,
  log_all_requests: false,
  log_blocked_only: true,
  auto_block_enabled: true,
  auto_block_threshold: 5,
  auto_block_window_minutes: 10,
  auto_block_duration_minutes: 60,
  trusted_proxy_enabled: false,
  waf_response_message: 'Request blocked by Web Application Firewall.',
  ml_waf_enabled: false,
  ml_waf_confidence_threshold: 0.7,
  ml_waf_model_id: '',
  ml_waf_block_standalone: true,
  ml_waf_reject_uncertain: true
};

const categorySettingMap = {
  sql_injection: 'block_sql_injection',
  xss: 'block_xss',
  path_traversal: 'block_path_traversal',
  command_injection: 'block_command_injection',
  bad_bot: 'block_bad_bots',
  scanner: 'block_scanners',
  cms_probe: 'block_cms_probes',
  file_attack: 'block_cms_probes'
};

function castSetting(value, type) {
  if (type === 'boolean') return value === true || value === 'true' || value === '1';
  if (type === 'number') return Number(value);
  return value;
}

function clearWafCache() {
  cache.loadedAt = 0;
  cache.settings = null;
  cache.rules = null;
  cache.ipLists = null;
}

async function loadActiveIpLists() {
  if (cache.ipLists && Date.now() - cache.loadedAt < 30000) return cache.ipLists;
  const rows = await WafIpList.findAll({
    where: {
      status: true,
      [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }]
    }
  });
  cache.ipLists = rows.filter((row) => !isExpiredIpListItem(row));
  return cache.ipLists;
}

async function loadWafConfig() {
  if (cache.settings && Date.now() - cache.loadedAt < 30000) return cache;

  const [settingRows, rules] = await Promise.all([
    WafSetting.findAll(),
    WafRule.findAll({ where: { status: true }, order: [['severity', 'DESC'], ['id', 'ASC']] })
  ]);

  const settings = { ...DEFAULT_SETTINGS };
  settingRows.forEach((row) => {
    settings[row.setting_key] = castSetting(row.setting_value, row.setting_type);
  });

  if (!settings.max_risk_score_public && settings.max_risk_score) {
    settings.max_risk_score_public = settings.max_risk_score;
  }
  if (!settings.max_risk_score_admin) {
    settings.max_risk_score_admin = Math.max(20, Number(settings.max_risk_score_public || 50) - 10);
  }

  cache.settings = settings;
  cache.rules = rules.filter((rule) => {
    if (rule.pattern_type === 'regex' || !rule.pattern_type) {
      try {
         
        new RegExp(rule.pattern, 'i');
        return true;
      } catch (error) {
        return false;
      }
    }
    return true;
  });
  cache.loadedAt = Date.now();
  return cache;
}

const appConfig = require('../config/app');

function isLocalRequest(req) {
  const ip = req.ip || '';
  return ip === '127.0.0.1'
    || ip === '::1'
    || ip === '::ffff:127.0.0.1'
    || ip.startsWith('::ffff:127.0.0.1');
}

function routeLimitFor(req) {
  const routeType = getRouteType(req);
  const isDev = appConfig.env === 'development' || appConfig.env === 'test';
  if (isDev && isLocalRequest(req)) {
    return { routeKey: routeType, max: 10000, windowMs: 15 * 60 * 1000 };
  }
  if (routeType === 'admin_login') return { routeKey: 'admin_login', max: 8, windowMs: 15 * 60 * 1000 };
  if (routeType === 'admin') return { routeKey: 'admin', max: 600, windowMs: 15 * 60 * 1000 };
  if (routeType === 'public_mutation') return { routeKey: `strict:${req.path}`, max: 60, windowMs: 15 * 60 * 1000 };
  return { routeKey: 'public', max: 1000, windowMs: 15 * 60 * 1000 };
}

async function checkWafRateLimit(req, ipAddress) {
  const now = new Date();
  const limit = routeLimitFor(req);
  const firstWindowDate = new Date(now.getTime() - limit.windowMs);
  const [row] = await WafRateLimit.findOrCreate({
    where: { ip_address: ipAddress, route_key: limit.routeKey },
    defaults: {
      request_count: 1,
      first_request_at: now,
      last_request_at: now
    }
  });

  if (row.blocked_until && row.blocked_until > now) {
    return { exceeded: true, routeKey: limit.routeKey, blockedUntil: row.blocked_until };
  }

  if (row.first_request_at < firstWindowDate) {
    await row.update({ request_count: 1, first_request_at: now, last_request_at: now, blocked_until: null });
    return { exceeded: false, routeKey: limit.routeKey };
  }

  const requestCount = Number(row.request_count) + 1;
  const updates = { request_count: requestCount, last_request_at: now };
  const exceeded = requestCount > limit.max;
  if (exceeded) {
    updates.blocked_until = new Date(now.getTime() + Math.min(limit.windowMs, 5 * 60 * 1000));
  }
  await row.update(updates);
  return { exceeded, routeKey: limit.routeKey, blockedUntil: updates.blocked_until };
}

function ruleEnabledBySettings(rule, settings) {
  const settingKey = categorySettingMap[rule.category];
  return settingKey ? Boolean(settings[settingKey]) : true;
}

function matchRequest(req, rules, settings) {
  const normalizedRequest = normalizeRequestData(req);
  const matches = [];

  for (const rule of rules) {
    if (!ruleEnabledBySettings(rule, settings)) continue;
    const match = matchRuleAgainstRequest(rule, normalizedRequest);
    if (match) matches.push(match);
  }

  if (normalizedRequest.files.length) {
    normalizedRequest.files.forEach((file) => {
      if (isDangerousUploadFilename(file.name)) {
        matches.push({
          rule: {
            id: null,
            name: 'Dangerous upload filename',
            category: 'file_attack',
            severity: 'critical',
            action: 'block',
            score: 60
          },
          target: { target: 'file_name', key: file.field, value: file.name }
        });
      }
    });
  }

  return matches;
}

async function logWafEvent(req, payload) {
  return WafLog.create(payload);
}

async function applyAutoBlock(ipAddress, settings, userId = null) {
  if (!settings.auto_block_enabled) return;

  const windowMinutes = Number(settings.auto_block_window_minutes || 10);
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  const [criticalCount, highCount] = await Promise.all([
    WafLog.count({ where: { ip_address: ipAddress, severity: 'critical', created_at: { [Op.gte]: windowStart } } }),
    WafLog.count({ where: { ip_address: ipAddress, severity: 'high', created_at: { [Op.gte]: windowStart } } })
  ]);
  const threshold = Number(settings.auto_block_threshold || 5);
  if (criticalCount < threshold && highCount < threshold * 2) return;

  const whitelist = (await loadActiveIpLists()).find((row) => row.list_type === 'whitelist' && ipMatchesListEntry(ipAddress, row.ip_address));
  if (whitelist) return;

  const expiresAt = new Date(Date.now() + Number(settings.auto_block_duration_minutes || 60) * 60 * 1000);
  const reason = `Auto-blocked by WAF after ${criticalCount} critical and ${highCount} high events in ${windowMinutes} minutes.`;
  await WafIpList.findOrCreate({
    where: { ip_address: ipAddress, list_type: 'temporary_block' },
    defaults: {
      reason,
      expires_at: expiresAt,
      status: true,
      created_by: userId
    }
  }).then(async ([row, created]) => {
    if (!created) await row.update({ reason, expires_at: expiresAt, status: true });
  });
}

async function applyTemporaryBlock(ipAddress, settings, userId, reason) {
  const expiresAt = new Date(Date.now() + Number(settings.auto_block_duration_minutes || 60) * 60 * 1000);
  await WafIpList.findOrCreate({
    where: { ip_address: ipAddress, list_type: 'temporary_block' },
    defaults: {
      reason: reason || 'Temporary block triggered by WAF rule.',
      expires_at: expiresAt,
      status: true,
      created_by: userId
    }
  }).then(async ([row, created]) => {
    if (!created) await row.update({ reason, expires_at: expiresAt, status: true });
  });
}

async function wafMiddleware(req, res, next) {
  const requestId = createRequestId();
  req.wafRequestId = requestId;

  try {
    if (shouldSkipWaf(req)) return next();

    const { settings, rules } = await loadWafConfig();
    if (!settings.waf_enabled || settings.waf_mode === 'disabled') return next();

    const adminRoute = req.path === '/admin' || req.path.startsWith('/admin/');
    if (adminRoute && !settings.admin_protection_enabled) return next();
    if (!adminRoute && !settings.public_protection_enabled) return next();

    const trustProxy = settings.trusted_proxy_enabled === true
      || settings.trusted_proxy_enabled === 'true'
      || Boolean(req.app?.get('trust proxy'));
    req.wafTrustProxy = trustProxy;

    const ipAddress = getClientIp(req, trustProxy);
    const activeIpRows = findIpListMatches(ipAddress, await loadActiveIpLists());

    if (activeIpRows.some((row) => row.list_type === 'whitelist')) return next();

    const blockedRow = activeIpRows.find((row) => row.list_type === 'blacklist' || row.list_type === 'temporary_block');
    if (blockedRow) {
      const payload = buildSafeLogPayload(req, [], 'block', 100);
      payload.matched_rule_name = blockedRow.reason || blockedRow.list_type;
      payload.category = blockedRow.list_type;
      payload.severity = 'critical';
      await logWafEvent(req, payload);
      if (settings.waf_mode === 'block') {
        return createWafBlockResponse(req, res, settings.waf_response_message || 'Your IP address is blocked.');
      }
      return next();
    }

    const rateLimit = await checkWafRateLimit(req, ipAddress);
    if (rateLimit.exceeded) {
      const payload = buildSafeLogPayload(req, [], 'rate_limit', adminRoute ? 60 : 35);
      payload.matched_rule_name = `WAF dynamic rate limit: ${rateLimit.routeKey}`;
      payload.category = adminRoute ? 'brute_force' : 'spam';
      payload.severity = adminRoute ? 'high' : 'medium';
      await logWafEvent(req, payload);
      if (settings.waf_mode === 'block') {
        return createWafBlockResponse(req, res, 'Too many requests. Try again later.');
      }
      return next();
    }

    const matches = matchRequest(req, rules, settings);

    let mlMatch = null;
    if (shouldUseMlWaf(settings)) {
      const normalizedRequest = normalizeRequestData(req);
      const modelId = String(settings.ml_waf_model_id || '').trim();
      const analyzePayload = buildWebGuardAnalyzePayload(req, normalizedRequest, modelId || undefined);
      const mlResult = await analyzeRequest(analyzePayload);
      if (mlResult.ok) {
        mlMatch = mlResultToMatch(mlResult.data, settings);
        if (mlMatch) matches.push(mlMatch);
      } else if (!mlResult.failOpen) {
        const payload = buildSafeLogPayload(req, [], 'block', 100);
        payload.matched_rule_name = 'WebGuard ML service unavailable';
        payload.category = 'custom';
        payload.severity = 'high';
        await logWafEvent(req, payload);
        if (settings.waf_mode === 'block') {
          return createWafBlockResponse(req, res, settings.waf_response_message);
        }
        return next();
      }
    }

    const riskScore = calculateRiskScore(matches, adminRoute);
    let actionTaken = getActionForRiskScore(riskScore, settings, adminRoute, matches);
    let wafDecision = await pluginLoader.applyFilters('beforeWafDecision', {
      actionTaken,
      matches,
      riskScore,
      settings,
      adminRoute,
      ipAddress,
      block: ['block', 'rate_limit', 'temporary_block'].includes(actionTaken) && settings.waf_mode === 'block'
    }, { req, res });
    if (wafDecision === false || wafDecision === null) {
      return next();
    }
    if (wafDecision && typeof wafDecision === 'object') {
      actionTaken = wafDecision.actionTaken || actionTaken;
    }
    const shouldBlock = wafDecision?.block !== false
      && ['block', 'rate_limit', 'temporary_block'].includes(actionTaken)
      && settings.waf_mode === 'block';

    const shouldLog = Boolean(
      matches.length
      || settings.log_all_requests
      || (settings.log_all_suspicious && matches.length)
      || (settings.log_blocked_only && ['block', 'rate_limit', 'temporary_block'].includes(actionTaken))
    );

    if (shouldLog) {
      let payload = buildSafeLogPayload(req, matches, actionTaken === 'allow' && matches.length ? 'log' : actionTaken, riskScore);
      if (mlMatch) payload = attachMlMetadata(payload, mlMatch);
      const logRow = await logWafEvent(req, payload);
      await pluginLoader.doAction('afterWafLog', { ...payload, id: logRow?.id }, { req, res });
    }

    if (matches.length) {
      await applyAutoBlock(ipAddress, settings, req.session?.user?.id || null);
    }

    if (actionTaken === 'temporary_block' && shouldBlock) {
      await applyTemporaryBlock(ipAddress, settings, req.session?.user?.id || null, 'Temporary block triggered by WAF rule match.');
      return createWafBlockResponse(req, res, settings.waf_response_message);
    }

    if (['block', 'rate_limit'].includes(actionTaken) && shouldBlock) {
      return createWafBlockResponse(req, res, settings.waf_response_message);
    }

    return next();
  } catch (error) {
    console.error('WAF middleware failed:', error.message);
    return next();
  }
}

module.exports = { wafMiddleware, loadWafConfig, clearWafCache, loadActiveIpLists };
