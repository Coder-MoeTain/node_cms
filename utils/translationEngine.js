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

function parseGlossaryFile(raw) {
  const phrases = Object.entries(raw.phrases || {})
    .map(([sourceText, translatedText]) => ({ sourceText, translatedText }))
    .sort((a, b) => b.sourceText.length - a.sourceText.length);
  const words = new Map(
    Object.entries(raw.words || {}).map(([sourceText, translatedText]) => [sourceText.toLowerCase(), translatedText])
  );
  return { phrases, words };
}

function reverseGlossary(glossary) {
  const phrases = glossary.phrases
    .map(({ sourceText, translatedText }) => ({ sourceText: translatedText, translatedText: sourceText }))
    .sort((a, b) => b.sourceText.length - a.sourceText.length);
  const words = new Map();
  for (const [sourceWord, translatedWord] of glossary.words.entries()) {
    if (translatedWord) words.set(String(translatedWord).toLowerCase(), sourceWord);
  }
  return { phrases, words };
}

function readGlossaryFile(filename) {
  const filePath = path.join(GLOSSARY_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  return parseGlossaryFile(JSON.parse(fs.readFileSync(filePath, 'utf8')));
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

  let glossary = { phrases: [], words: new Map() };
  if (source === 'en') {
    const forward = readGlossaryFile(`en-${glossaryFileKey(target)}.json`);
    if (forward) glossary = forward;
  } else if (target === 'en') {
    const forward = readGlossaryFile(`en-${glossaryFileKey(source)}.json`);
    if (forward) glossary = reverseGlossary(forward);
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

function replacePreserveCase(match, translatedText) {
  if (match === match.toUpperCase() && match.length > 1) return translatedText.toUpperCase();
  if (match[0] === match[0].toUpperCase()) {
    return translatedText.charAt(0).toUpperCase() + translatedText.slice(1);
  }
  return translatedText;
}

function applyPhrases(text, phrases) {
  let output = text;
  for (const { sourceText, translatedText } of phrases) {
    if (!sourceText) continue;
    const useWordBoundary = /^[\w\s'&.,;:!?()/+-]+$/i.test(sourceText);
    if (useWordBoundary) {
      const pattern = new RegExp(`\\b${escapeRegExp(sourceText)}\\b`, 'gi');
      output = output.replace(pattern, (match) => replacePreserveCase(match, translatedText));
    } else {
      let index = output.indexOf(sourceText);
      while (index !== -1) {
        output = `${output.slice(0, index)}${translatedText}${output.slice(index + sourceText.length)}`;
        index = output.indexOf(sourceText, index + translatedText.length);
      }
    }
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

function applyGlossary(text, glossary) {
  let output = applyPhrases(text, glossary.phrases);
  output = applyWords(output, glossary.words);
  return output;
}

function translatePlainText(text, sourceLocale, targetLocale) {
  const source = normalizeLocale(sourceLocale);
  const target = normalizeLocale(targetLocale);
  if (!text || source === target) return text;

  const glossary = loadGlossary(source, target);
  if (glossary.phrases.length || glossary.words.size) {
    return normalizeWhitespace(applyGlossary(text, glossary));
  }

  if (source !== 'en' && target !== 'en') {
    const english = translatePlainText(text, source, 'en');
    return translatePlainText(english, 'en', target);
  }

  return normalizeWhitespace(applyGlossary(text, glossary));
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
