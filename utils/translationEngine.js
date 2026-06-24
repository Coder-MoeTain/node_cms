const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { TranslationCache } = require('../models');

const DEFAULT_LOCALE = 'en';
const SUPPORTED_LOCALES = ['en', 'my', 'zh-CN', 'ru'];
const LOCALE_COOKIE = 'np_lang';
const GLOSSARY_DIR = path.join(__dirname, '../data/glossaries');
const MEMORY_CACHE_LIMIT = 2000;

const glossaryCache = new Map();
const memoryCache = new Map();

function normalizeLocale(locale) {
  if (!locale) return DEFAULT_LOCALE;
  const value = String(locale).trim();
  if (value === 'zh' || value === 'zh-cn') return 'zh-CN';
  return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

function glossaryFileKey(targetLocale) {
  if (targetLocale === 'zh-CN') return 'zh';
  return targetLocale;
}

function loadGlossary(sourceLocale, targetLocale) {
  const source = normalizeLocale(sourceLocale);
  const target = normalizeLocale(targetLocale);
  const cacheKey = `${source}:${target}`;
  if (glossaryCache.has(cacheKey)) return glossaryCache.get(cacheKey);
  if (source === target) {
    const empty = { phrases: [], words: new Map() };
    glossaryCache.set(cacheKey, empty);
    return empty;
  }

  const filePath = path.join(GLOSSARY_DIR, `${source}-${glossaryFileKey(target)}.json`);
  let glossary = { phrases: [], words: new Map() };
  if (fs.existsSync(filePath)) {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const phrases = Object.entries(raw.phrases || {})
      .map(([sourceText, translatedText]) => ({ sourceText, translatedText }))
      .sort((a, b) => b.sourceText.length - a.sourceText.length);
    const words = new Map(
      Object.entries(raw.words || {}).map(([sourceText, translatedText]) => [sourceText.toLowerCase(), translatedText])
    );
    glossary = { phrases, words };
  }
  glossaryCache.set(cacheKey, glossary);
  return glossary;
}

function hashText(text, sourceLocale, targetLocale) {
  return crypto.createHash('sha256').update(`${sourceLocale}|${targetLocale}|${text}`).digest('hex');
}

function rememberInMemory(key, value) {
  if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  memoryCache.set(key, value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyPhrases(text, phrases) {
  let output = text;
  for (const { sourceText, translatedText } of phrases) {
    const pattern = new RegExp(`\\b${escapeRegExp(sourceText)}\\b`, 'gi');
    output = output.replace(pattern, (match) => {
      if (match === match.toUpperCase() && match.length > 1) return translatedText.toUpperCase();
      if (match[0] === match[0].toUpperCase()) {
        return translatedText.charAt(0).toUpperCase() + translatedText.slice(1);
      }
      return translatedText;
    });
  }
  return output;
}

function applyWords(text, words) {
  return text.replace(/\b[\w'-]+\b/g, (token) => {
    const mapped = words.get(token.toLowerCase());
    if (mapped === undefined) return token;
    if (!mapped) return '';
    if (token === token.toUpperCase() && token.length > 1) return mapped.toUpperCase();
    if (token[0] === token[0].toUpperCase()) return mapped.charAt(0).toUpperCase() + mapped.slice(1);
    return mapped;
  });
}

function normalizeWhitespace(text) {
  return text.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

function translatePlainText(text, sourceLocale, targetLocale) {
  const source = normalizeLocale(sourceLocale);
  const target = normalizeLocale(targetLocale);
  if (!text || source === target) return text;

  const glossary = loadGlossary(source, target);
  let output = applyPhrases(text, glossary.phrases);
  output = applyWords(output, glossary.words);
  return normalizeWhitespace(output);
}

function translateHtmlSegment(html, sourceLocale, targetLocale) {
  if (!html || !html.includes('<')) {
    return translatePlainText(html, sourceLocale, targetLocale);
  }

  const parts = html.split(/(<[^>]+>)/g);
  return parts
    .map((part) => {
      if (!part || part.startsWith('<')) return part;
      return translatePlainText(part, sourceLocale, targetLocale);
    })
    .join('');
}

class TranslationEngine {
  constructor({ sourceLocale = DEFAULT_LOCALE, targetLocale = DEFAULT_LOCALE, useDatabase = true } = {}) {
    this.sourceLocale = normalizeLocale(sourceLocale);
    this.targetLocale = normalizeLocale(targetLocale);
    this.useDatabase = useDatabase;
  }

  get isActive() {
    return this.sourceLocale !== this.targetLocale;
  }

  async translate(text) {
    if (!text || !this.isActive) return text;
    const input = String(text);
    const cacheKey = hashText(input, this.sourceLocale, this.targetLocale);
    if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);

    if (this.useDatabase) {
      const cached = await TranslationCache.findOne({
        where: {
          source_hash: cacheKey,
          source_locale: this.sourceLocale,
          target_locale: this.targetLocale
        },
        attributes: ['translated_text']
      });
      if (cached) {
        rememberInMemory(cacheKey, cached.translated_text);
        return cached.translated_text;
      }
    }

    const translated = translatePlainText(input, this.sourceLocale, this.targetLocale);
    rememberInMemory(cacheKey, translated);

    if (this.useDatabase && translated !== input) {
      await TranslationCache.upsert({
        source_hash: cacheKey,
        source_locale: this.sourceLocale,
        target_locale: this.targetLocale,
        source_text: input.slice(0, 65000),
        translated_text: translated.slice(0, 65000)
      });
    }

    return translated;
  }

  async translateHtml(html) {
    if (!html || !this.isActive) return html;
    const input = String(html);
    const cacheKey = hashText(`html:${input}`, this.sourceLocale, this.targetLocale);
    if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);

    if (this.useDatabase) {
      const cached = await TranslationCache.findOne({
        where: {
          source_hash: cacheKey,
          source_locale: this.sourceLocale,
          target_locale: this.targetLocale
        },
        attributes: ['translated_text']
      });
      if (cached) {
        rememberInMemory(cacheKey, cached.translated_text);
        return cached.translated_text;
      }
    }

    const translated = translateHtmlSegment(input, this.sourceLocale, this.targetLocale);
    rememberInMemory(cacheKey, translated);

    if (this.useDatabase && translated !== input) {
      await TranslationCache.upsert({
        source_hash: cacheKey,
        source_locale: this.sourceLocale,
        target_locale: this.targetLocale,
        source_text: input.slice(0, 65000),
        translated_text: translated.slice(0, 65000)
      });
    }

    return translated;
  }
}

function resolveLocaleFromRequest(req) {
  const cookieValue = req.cookies?.[LOCALE_COOKIE];
  if (cookieValue) return normalizeLocale(cookieValue);

  const legacy = req.cookies?.googtrans;
  if (legacy) {
    const parts = decodeURIComponent(legacy).split('/');
    return normalizeLocale(parts[2] || DEFAULT_LOCALE);
  }

  return DEFAULT_LOCALE;
}

function createEngine(targetLocale, options = {}) {
  return new TranslationEngine({ targetLocale: normalizeLocale(targetLocale), ...options });
}

module.exports = {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_COOKIE,
  TranslationEngine,
  createEngine,
  normalizeLocale,
  resolveLocaleFromRequest,
  translatePlainText,
  translateHtmlSegment
};
