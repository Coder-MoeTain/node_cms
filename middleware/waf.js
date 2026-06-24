const { Op } = require('sequelize');
const {
  WafRule,
  WafLog,
  WafIpList,
  WafSetting,
  WafRateLimit
} = require('../models');
const {
  getClientIp,
  sanitizeLogData,
  calculateRiskScore,
  matchRule,
  isAdminRoute,
  shouldSkipWaf,
  createRequestId,
  flattenInputs
} = require('../utils/wafHelper');

const cache = {
  loadedAt: 0,
  settings: null,
  rules: null
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
  max_risk_score: 50,
  log_all_requests: false,
  log_blocked_only: true,
  admin_protection_enabled: true,
  public_protection_enabled: true,
  auto_block_enabled: true,
  auto_block_threshold: 5,
  auto_block_duration_minutes: 60,
  trusted_proxy_enabled: false
};

const categorySettingMap = {
  sql_injection: 'block_sql_injection',
  xss: 'block_xss',
  path_traversal: 'block_path_traversal',
  command_injection: 'block_command_injection',
  bad_bot: 'block_bad_bots',
  scanner: 'block_scanners'
};

function castSetting(value, type) {
  if (type === 'boolean') return value === true || value === 'true' || value === '1';
  if (type === 'number') return Number(value);
  return value;
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

  cache.settings = settings;
  cache.rules = rules;
  cache.loadedAt = Date.now();
  return cache;
}

function routeLimitFor(req) {
  if (req.path === '/admin/login') return { routeKey: 'admin_login', max: 8, windowMs: 15 * 60 * 1000 };
  if (isAdminRoute(req)) return { routeKey: 'admin', max: 180, windowMs: 15 * 60 * 1000 };
  if (req.path === '/search' || req.path === '/contact' || /\/post\/\d+\/comment$/.test(req.path)) {
    return { routeKey: `strict:${req.path}`, max: 40, windowMs: 15 * 60 * 1000 };
  }
  return { routeKey: 'public', max: 300, windowMs: 15 * 60 * 1000 };
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
  if (requestCount > limit.max) {
    updates.blocked_until = new Date(now.getTime() + limit.windowMs);
  }
  await row.update(updates);
  return { exceeded: requestCount > limit.max, routeKey: limit.routeKey, blockedUntil: updates.blocked_until };
}

function buildInspectionTargets(req) {
  const skipRichText = Boolean(req.session?.user) && isAdminRoute(req);
  return [
    { target: 'url', key: 'url', value: req.originalUrl || req.url },
    ...flattenInputs(req.query, {}, 'query').map((entry) => ({ target: 'query', ...entry })),
    ...flattenInputs(req.body, { skipRichText }, 'body').map((entry) => ({ target: 'body', ...entry })),
    ...flattenInputs(req.headers, {}, 'headers').map((entry) => ({ target: 'headers', ...entry })),
    { target: 'user_agent', key: 'user-agent', value: req.get('user-agent') || '' },
    { target: 'ip', key: 'ip', value: getClientIp(req) }
  ];
}

function ruleAppliesToTarget(rule, target) {
  return rule.target === 'all' || rule.target === target;
}

function ruleEnabledBySettings(rule, settings) {
  const settingKey = categorySettingMap[rule.category];
  return settingKey ? Boolean(settings[settingKey]) : true;
}

function matchRequest(req, rules, settings) {
  const targets = buildInspectionTargets(req);
  const matches = [];

  for (const rule of rules) {
    if (!ruleEnabledBySettings(rule, settings)) continue;
    for (const target of targets) {
      if (!ruleAppliesToTarget(rule, target.target)) continue;
      if (matchRule(target.value, rule)) {
        matches.push({ rule, target });
        break;
      }
    }
  }

  return matches;
}

async function logWafEvent(req, details) {
  const primary = details.matches?.[0];
  return WafLog.create({
    request_id: details.requestId,
    ip_address: details.ipAddress,
    method: req.method,
    url: req.originalUrl || req.url,
    user_agent: req.get('user-agent') || '',
    headers_snapshot: sanitizeLogData(req.headers || {}),
    query_snapshot: sanitizeLogData(req.query || {}),
    body_snapshot: sanitizeLogData(req.body || {}),
    matched_rule_id: primary?.rule?.id || null,
    matched_rule_name: primary?.rule?.name || details.ruleName || null,
    category: primary?.rule?.category || details.category || null,
    severity: primary?.rule?.severity || details.severity || null,
    action_taken: details.actionTaken,
    risk_score: details.riskScore || 0,
    country: null,
    referer: req.get('referer') || null,
    is_admin_route: isAdminRoute(req),
    user_id: req.session?.user?.id || null
  });
}

async function applyAutoBlock(ipAddress, settings, userId = null) {
  if (!settings.auto_block_enabled) return;

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const [criticalCount, highCount] = await Promise.all([
    WafLog.count({ where: { ip_address: ipAddress, severity: 'critical', created_at: { [Op.gte]: tenMinutesAgo } } }),
    WafLog.count({ where: { ip_address: ipAddress, severity: 'high', created_at: { [Op.gte]: tenMinutesAgo } } })
  ]);
  const threshold = Number(settings.auto_block_threshold || 5);
  if (criticalCount < threshold && highCount < threshold * 2) return;

  const expiresAt = new Date(Date.now() + Number(settings.auto_block_duration_minutes || 60) * 60 * 1000);
  await WafIpList.findOrCreate({
    where: { ip_address: ipAddress, list_type: 'temporary_block' },
    defaults: {
      reason: `Auto-blocked by WAF after ${criticalCount} critical and ${highCount} high events in 10 minutes.`,
      expires_at: expiresAt,
      status: true,
      created_by: userId
    }
  }).then(async ([row, created]) => {
    if (!created) {
      await row.update({
        reason: `Auto-blocked by WAF after ${criticalCount} critical and ${highCount} high events in 10 minutes.`,
        expires_at: expiresAt,
        status: true
      });
    }
  });
}

function blockResponse(req, res, message = 'Request blocked by Web Application Firewall.') {
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(403).json({ message });
  }
  return res.status(403).send(message);
}

async function wafMiddleware(req, res, next) {
  const requestId = createRequestId();
  req.wafRequestId = requestId;

  try {
    if (shouldSkipWaf(req)) return next();

    const { settings, rules } = await loadWafConfig();
    if (!settings.waf_enabled) return next();

    const adminRoute = isAdminRoute(req);
    if (adminRoute && !settings.admin_protection_enabled) return next();
    if (!adminRoute && !settings.public_protection_enabled) return next();

    const ipAddress = getClientIp(req);
    const activeIpRows = await WafIpList.findAll({
      where: {
        ip_address: ipAddress,
        status: true,
        [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }]
      }
    });

    if (activeIpRows.some((row) => row.list_type === 'whitelist')) return next();

    const blockedRow = activeIpRows.find((row) => row.list_type === 'blacklist' || row.list_type === 'temporary_block');
    if (blockedRow) {
      await logWafEvent(req, {
        requestId,
        ipAddress,
        actionTaken: 'block',
        category: blockedRow.list_type,
        severity: 'critical',
        riskScore: 100,
        ruleName: blockedRow.reason || blockedRow.list_type
      });
      return blockResponse(req, res, 'Your IP address is blocked.');
    }

    const rateLimit = await checkWafRateLimit(req, ipAddress);
    if (rateLimit.exceeded) {
      await logWafEvent(req, {
        requestId,
        ipAddress,
        actionTaken: 'rate_limit',
        category: adminRoute ? 'brute_force' : 'spam',
        severity: adminRoute ? 'high' : 'medium',
        riskScore: adminRoute ? 60 : 35,
        ruleName: `WAF dynamic rate limit: ${rateLimit.routeKey}`
      });
      return blockResponse(req, res, 'Too many requests. Try again later.');
    }

    const matches = matchRequest(req, rules, settings);
    const riskScore = calculateRiskScore(matches);
    const maxRiskScore = Number(settings.max_risk_score || 50);
    const effectiveMaxRiskScore = adminRoute ? Math.max(20, maxRiskScore - 10) : maxRiskScore;
    const shouldBlock = settings.waf_mode === 'block' && matches.some((match) => match.rule.action === 'block') && riskScore >= effectiveMaxRiskScore;
    const actionTaken = shouldBlock ? 'block' : matches.length ? 'log' : 'allow';

    if (matches.length || settings.log_all_requests || (settings.log_blocked_only && shouldBlock)) {
      await logWafEvent(req, {
        requestId,
        ipAddress,
        matches,
        actionTaken,
        riskScore
      });
    }

    if (matches.length) {
      await applyAutoBlock(ipAddress, settings, req.session?.user?.id || null);
    }

    if (shouldBlock) return blockResponse(req, res);
    return next();
  } catch (error) {
    console.error('WAF middleware failed:', error.message);
    return next();
  }
}

module.exports = { wafMiddleware, loadWafConfig };
