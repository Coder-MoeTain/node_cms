const { settingBool, settingValue } = require('../../utils/pluginSettings');

const DEFAULT_SPAM_WORDS = ['viagra', 'casino', 'crypto', 'forex', 'lottery', 'cialis', 'payday loan'];

function countLinks(text) {
  return (String(text).match(/https?:\/\//gi) || []).length;
}

function isSpam(payload, settings) {
  if (!settingBool(settings.enabled, true)) return false;
  const content = `${payload.content || ''} ${payload.name || ''} ${payload.website || ''} ${payload.email || ''} ${payload.subject || ''}`.toLowerCase();
  const strictness = settingValue(settings, 'strictness', 'normal');
  const words = settingValue(settings, 'blocked_words', '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  const blockList = settingBool(settings.block_keywords, true)
    ? (words.length ? words : DEFAULT_SPAM_WORDS)
    : words;

  if (blockList.some((word) => content.includes(word))) return true;
  if (settingBool(settings.block_links, true) && countLinks(payload.content) >= 3) return true;
  if (/(.)\1{6,}/.test(payload.content || '')) return true;
  if (strictness === 'strict' && countLinks(payload.content) >= 1 && content.length < 40) return true;
  return false;
}

function filterPayload(payload, settings) {
  if (!payload || !isSpam(payload, settings)) return payload;
  if (settingBool(settings.hold_for_moderation, false)) {
    return { ...payload, status: 'pending' };
  }
  return null;
}

module.exports = { isSpam, filterPayload };
