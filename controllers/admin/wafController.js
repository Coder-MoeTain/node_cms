const { Op, fn, col } = require('sequelize');
const { WafRule, WafLog, WafIpList, WafSetting, ActivityLog } = require('../../models');
const { getPagination, pageMeta } = require('../../utils/pagination');
const { createSlug } = require('../../utils/slugGenerator');
const { validatePattern } = require('../../utils/wafHelper');
const { clearWafCache } = require('../../middleware/waf');

const categories = ['sql_injection', 'xss', 'command_injection', 'path_traversal', 'file_attack', 'bad_bot', 'scanner', 'brute_force', 'spam', 'cms_probe', 'custom'];
const targets = ['url', 'query', 'body', 'headers', 'user_agent', 'ip', 'file_name', 'all'];
const actions = ['block', 'log', 'rate_limit', 'temporary_block'];
const patternTypes = ['regex', 'contains', 'equals'];
const severities = ['low', 'medium', 'high', 'critical'];
const listTypes = ['blacklist', 'whitelist', 'temporary_block'];

const settingFields = {
  waf_enabled: 'boolean',
  waf_mode: 'string',
  block_sql_injection: 'boolean',
  block_xss: 'boolean',
  block_path_traversal: 'boolean',
  block_command_injection: 'boolean',
  block_bad_bots: 'boolean',
  block_scanners: 'boolean',
  block_cms_probes: 'boolean',
  max_risk_score_public: 'number',
  max_risk_score_admin: 'number',
  max_risk_score: 'number',
  log_all_suspicious: 'boolean',
  log_all_requests: 'boolean',
  log_blocked_only: 'boolean',
  admin_protection_enabled: 'boolean',
  public_protection_enabled: 'boolean',
  auto_block_enabled: 'boolean',
  auto_block_threshold: 'number',
  auto_block_window_minutes: 'number',
  auto_block_duration_minutes: 'number',
  trusted_proxy_enabled: 'boolean',
  waf_response_message: 'string'
};

function flashAndRedirect(req, res, message, path = '/admin/waf') {
  req.flash('error', message);
  return res.redirect(path);
}

async function getSettingsObject() {
  const rows = await WafSetting.findAll({ order: [['setting_key', 'ASC']] });
  return rows.reduce((settings, row) => {
    settings[row.setting_key] = row.setting_value;
    return settings;
  }, {});
}

function buildRulePayload(body, userId, existing = null) {
  const category = categories.includes(body.category) ? body.category : 'custom';
  const target = targets.includes(body.target) ? body.target : 'all';
  const action = actions.includes(body.action) ? body.action : 'block';
  const patternType = patternTypes.includes(body.pattern_type) ? body.pattern_type : 'regex';
  const severity = severities.includes(body.severity) ? body.severity : 'medium';
  const score = Math.min(Math.max(Number(body.score || 10), 1), 100);
  const ruleKey = existing?.rule_key || createSlug(body.rule_key || body.name, 'custom-rule').replace(/-/g, '_');

  return {
    name: String(body.name || '').trim().slice(0, 160),
    rule_key: ruleKey,
    description: String(body.description || '').trim(),
    category,
    pattern: String(body.pattern || '').trim(),
    pattern_type: patternType,
    target,
    action,
    severity,
    status: body.status === 'on' || body.status === 'true',
    score,
    is_system: false,
    created_by: existing?.created_by || userId
  };
}

async function dashboard(req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const settings = await getSettingsObject();
    const [
      blockedToday,
      loggedToday,
      topIps,
      topRules,
      topCategories,
      recentBlocked,
      riskSummary,
      activeBlocks,
      systemRuleCount,
      customRuleCount
    ] = await Promise.all([
      WafLog.count({ where: { action_taken: 'block', created_at: { [Op.gte]: today } } }),
      WafLog.count({ where: { created_at: { [Op.gte]: today } } }),
      WafLog.findAll({ attributes: ['ip_address', [fn('COUNT', col('id')), 'count']], group: ['ip_address'], order: [[fn('COUNT', col('id')), 'DESC']], limit: 8 }),
      WafLog.findAll({ attributes: ['matched_rule_name', [fn('COUNT', col('id')), 'count']], where: { matched_rule_name: { [Op.ne]: null } }, group: ['matched_rule_name'], order: [[fn('COUNT', col('id')), 'DESC']], limit: 8 }),
      WafLog.findAll({ attributes: ['category', [fn('COUNT', col('id')), 'count']], where: { category: { [Op.ne]: null } }, group: ['category'], order: [[fn('COUNT', col('id')), 'DESC']], limit: 8 }),
      WafLog.findAll({ where: { action_taken: ['block', 'rate_limit', 'temporary_block'] }, order: [['created_at', 'DESC']], limit: 10 }),
      WafLog.findAll({ attributes: ['severity', [fn('COUNT', col('id')), 'count']], where: { created_at: { [Op.gte]: today }, severity: { [Op.ne]: null } }, group: ['severity'] }),
      WafIpList.count({ where: { status: true, list_type: ['blacklist', 'temporary_block'] } }),
      WafRule.count({ where: { is_system: true } }),
      WafRule.count({ where: { is_system: false } })
    ]);

    return res.render('admin/waf/dashboard', {
      title: 'WAF Dashboard',
      settings,
      blockedToday,
      loggedToday,
      topIps,
      topRules,
      topCategories,
      recentBlocked,
      riskSummary,
      activeBlocks,
      systemRuleCount,
      customRuleCount
    });
  } catch (error) {
    return next(error);
  }
}

async function settings(req, res, next) {
  try {
    return res.render('admin/waf/settings', { title: 'WAF Settings', settings: await getSettingsObject() });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    for (const [key, type] of Object.entries(settingFields)) {
      let value;
      if (type === 'boolean') {
        value = String(req.body[key] === 'on');
      } else if (key === 'waf_mode') {
        value = ['disabled', 'monitor', 'block'].includes(req.body[key]) ? req.body[key] : 'monitor';
      } else if (type === 'number') {
        value = String(Math.max(Number(req.body[key] || 0), 0));
      } else {
        value = String(req.body[key] || '').trim();
      }
      await WafSetting.upsert({ setting_key: key, setting_value: value, setting_type: type });
    }
    clearWafCache();
    req.flash('success', 'WAF settings updated.');
    return res.redirect('/admin/waf/settings');
  } catch (error) {
    return next(error);
  }
}

async function rules(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req, 20, 100);
    const where = {};
    if (req.query.category) where.category = req.query.category;
    if (req.query.severity) where.severity = req.query.severity;
    if (req.query.action) where.action = req.query.action;
    if (req.query.q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${req.query.q}%` } },
        { rule_key: { [Op.like]: `%${req.query.q}%` } },
        { description: { [Op.like]: `%${req.query.q}%` } }
      ];
    }
    const { rows, count } = await WafRule.findAndCountAll({ where, order: [['category', 'ASC'], ['name', 'ASC']], limit, offset });
    return res.render('admin/waf/rules/index', { title: 'WAF Rules', rules: rows, meta: pageMeta(count, page, limit), filters: req.query, categories, severities, actions });
  } catch (error) {
    return next(error);
  }
}

function createRule(req, res) {
  return res.render('admin/waf/rules/create', { title: 'Create WAF Rule', categories, targets, actions, severities, patternTypes, rule: {} });
}

async function storeRule(req, res, next) {
  try {
    const payload = buildRulePayload(req.body, req.session.user.id);
    if (!payload.name || !payload.pattern) return flashAndRedirect(req, res, 'Rule name and pattern are required.', '/admin/waf/rules/create');
    if (!validatePattern(payload.pattern, payload.pattern_type)) return flashAndRedirect(req, res, 'Invalid pattern for the selected pattern type.', '/admin/waf/rules/create');
    payload.category = 'custom';
    await WafRule.create(payload);
    clearWafCache();
    req.flash('success', 'Custom WAF rule created.');
    return res.redirect('/admin/waf/rules');
  } catch (error) {
    return next(error);
  }
}

async function editRule(req, res, next) {
  try {
    const rule = await WafRule.findByPk(req.params.id);
    if (!rule) return flashAndRedirect(req, res, 'Rule not found.', '/admin/waf/rules');
    return res.render('admin/waf/rules/edit', { title: 'Edit WAF Rule', rule, categories, targets, actions, severities, patternTypes });
  } catch (error) {
    return next(error);
  }
}

async function updateRule(req, res, next) {
  try {
    const rule = await WafRule.findByPk(req.params.id);
    if (!rule) return flashAndRedirect(req, res, 'Rule not found.', '/admin/waf/rules');
    const payload = buildRulePayload(req.body, req.session.user.id, rule);
    if (!payload.name || !payload.pattern) return flashAndRedirect(req, res, 'Rule name and pattern are required.', `/admin/waf/rules/${rule.id}/edit`);
    if (!validatePattern(payload.pattern, payload.pattern_type)) return flashAndRedirect(req, res, 'Invalid pattern for the selected pattern type.', `/admin/waf/rules/${rule.id}/edit`);
    if (rule.is_system) {
      delete payload.pattern;
      delete payload.rule_key;
      delete payload.category;
      delete payload.pattern_type;
    }
    await rule.update(payload);
    clearWafCache();
    req.flash('success', 'WAF rule updated.');
    return res.redirect('/admin/waf/rules');
  } catch (error) {
    return next(error);
  }
}

async function deleteRule(req, res, next) {
  try {
    const rule = await WafRule.findByPk(req.params.id);
    if (!rule) return flashAndRedirect(req, res, 'Rule not found.', '/admin/waf/rules');
    if (rule.is_system) return flashAndRedirect(req, res, 'System rules cannot be deleted.', '/admin/waf/rules');
    await rule.destroy();
    clearWafCache();
    req.flash('success', 'Custom WAF rule deleted.');
    return res.redirect('/admin/waf/rules');
  } catch (error) {
    return next(error);
  }
}

async function toggleRule(req, res, next) {
  try {
    const rule = await WafRule.findByPk(req.params.id);
    if (rule) {
      await rule.update({ status: !rule.status });
      clearWafCache();
    }
    req.flash('success', 'WAF rule status updated.');
    return res.redirect('/admin/waf/rules');
  } catch (error) {
    return next(error);
  }
}

async function logs(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req, 25, 100);
    const where = {};
    if (req.query.ip) where.ip_address = { [Op.like]: `%${req.query.ip}%` };
    if (req.query.category) where.category = req.query.category;
    if (req.query.severity) where.severity = req.query.severity;
    if (req.query.action) where.action_taken = req.query.action;
    if (req.query.date) {
      const start = new Date(req.query.date);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.created_at = { [Op.gte]: start, [Op.lt]: end };
    }
    const { rows, count } = await WafLog.findAndCountAll({ where, order: [['created_at', 'DESC']], limit, offset });
    return res.render('admin/waf/logs/index', { title: 'WAF Logs', logs: rows, meta: pageMeta(count, page, limit), filters: req.query, categories, severities, actions });
  } catch (error) {
    return next(error);
  }
}

async function logDetail(req, res, next) {
  try {
    const log = await WafLog.findByPk(req.params.id, { include: [WafRule] });
    if (!log) return flashAndRedirect(req, res, 'WAF log not found.', '/admin/waf/logs');
    return res.render('admin/waf/logs/show', { title: 'WAF Log Detail', log });
  } catch (error) {
    return next(error);
  }
}

async function deleteLog(req, res, next) {
  try {
    const log = await WafLog.findByPk(req.params.id);
    if (log) await log.destroy();
    req.flash('success', 'WAF log deleted.');
    return res.redirect('/admin/waf/logs');
  } catch (error) {
    return next(error);
  }
}

async function deleteOldLogs(req, res, next) {
  try {
    const days = Math.max(Number(req.body.days || 30), 1);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted = await WafLog.destroy({ where: { created_at: { [Op.lt]: cutoff } } });
    req.flash('success', `Deleted ${deleted} WAF logs older than ${days} days.`);
    return res.redirect('/admin/waf/logs');
  } catch (error) {
    return next(error);
  }
}

async function ipLists(req, res, next) {
  try {
    const where = {};
    if (req.query.ip) where.ip_address = { [Op.like]: `%${req.query.ip}%` };
    if (req.query.type) where.list_type = req.query.type;
    const ipLists = await WafIpList.findAll({ where, order: [['created_at', 'DESC']] });
    return res.render('admin/waf/ip-lists', { title: 'WAF IP Lists', ipLists, filters: req.query, listTypes });
  } catch (error) {
    return next(error);
  }
}

async function addIpList(req, res, next) {
  try {
    const listType = listTypes.includes(req.body.list_type) ? req.body.list_type : 'blacklist';
    const expiresAt = req.body.expires_at ? new Date(req.body.expires_at) : null;
    await WafIpList.upsert({
      ip_address: String(req.body.ip_address || '').trim(),
      list_type: listType,
      reason: req.body.reason || null,
      expires_at: listType === 'temporary_block' ? expiresAt : null,
      status: true,
      created_by: req.session.user.id
    });
    req.flash('success', 'WAF IP list updated.');
    return res.redirect('/admin/waf/ip-lists');
  } catch (error) {
    return next(error);
  }
}

async function removeIpList(req, res, next) {
  try {
    const row = await WafIpList.findByPk(req.params.id);
    if (row) await row.update({ status: false });
    req.flash('success', 'IP list entry removed.');
    return res.redirect('/admin/waf/ip-lists');
  } catch (error) {
    return next(error);
  }
}

async function addIpFromLog(req, res, next, listType) {
  try {
    const log = await WafLog.findByPk(req.params.id);
    if (!log) return flashAndRedirect(req, res, 'WAF log not found.', '/admin/waf/logs');
    await WafIpList.upsert({
      ip_address: log.ip_address,
      list_type: listType,
      reason: `${listType === 'whitelist' ? 'Whitelisted' : 'Blocked'} from WAF log ${log.id}`,
      expires_at: null,
      status: true,
      created_by: req.session.user.id
    });
    await ActivityLog.create({
      user_id: req.session.user.id,
      action: `${listType === 'whitelist' ? 'Whitelisted' : 'Blocked'} IP from WAF log`,
      entity_type: 'waf',
      entity_id: log.id,
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      metadata: { target_ip: log.ip_address }
    });
    req.flash('success', `IP ${log.ip_address} ${listType === 'whitelist' ? 'whitelisted' : 'blocked'}.`);
    return res.redirect(`/admin/waf/logs/${log.id}`);
  } catch (error) {
    return next(error);
  }
}

function blockIpFromLog(req, res, next) {
  return addIpFromLog(req, res, next, 'blacklist');
}

function whitelistIpFromLog(req, res, next) {
  return addIpFromLog(req, res, next, 'whitelist');
}

function csvEscape(value) {
  const text = value === null || typeof value === 'undefined' ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function exportLogsCsv(req, res, next) {
  try {
    const where = {};
    if (req.query.ip) where.ip_address = { [Op.like]: `%${req.query.ip}%` };
    if (req.query.category) where.category = req.query.category;
    if (req.query.severity) where.severity = req.query.severity;
    if (req.query.action) where.action_taken = req.query.action;

    const logs = await WafLog.findAll({ where, order: [['created_at', 'DESC']], limit: 5000 });
    const header = ['id', 'created_at', 'ip_address', 'method', 'url', 'route_type', 'category', 'severity', 'action_taken', 'risk_score', 'matched_rule_name'];
    const rows = logs.map((log) => [
      log.id,
      log.created_at?.toISOString?.() || log.created_at,
      log.ip_address,
      log.method,
      log.url,
      log.route_type,
      log.category,
      log.severity,
      log.action_taken,
      log.risk_score,
      log.matched_rule_name
    ].map(csvEscape).join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="waf-logs.csv"');
    return res.send([header.join(','), ...rows].join('\n'));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  dashboard,
  settings,
  updateSettings,
  rules,
  createRule,
  storeRule,
  editRule,
  updateRule,
  deleteRule,
  toggleRule,
  logs,
  logDetail,
  deleteLog,
  deleteOldLogs,
  ipLists,
  addIpList,
  removeIpList,
  blockIpFromLog,
  whitelistIpFromLog,
  exportLogsCsv
};
