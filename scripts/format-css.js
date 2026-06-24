#!/usr/bin/env node
/**
 * Expands minified CSS into readable multi-line rules for easier maintenance.
 * Preserves comments and does not alter data: URLs.
 */
const fs = require('fs');
const path = require('path');

const cssDir = path.join(process.cwd(), 'public', 'css');

function formatCss(source) {
  let output = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let buffer = '';

  function flushBuffer(trim = true) {
    const chunk = trim ? buffer.trim() : buffer;
    if (chunk) output += chunk;
    buffer = '';
  }

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const prev = source[i - 1];

    if (inString) {
      buffer += ch;
      if (ch === stringChar && prev !== '\\') inString = false;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      buffer += ch;
      continue;
    }

    if (ch === '{') {
      flushBuffer();
      output += ' {\n';
      depth += 1;
      output += '  '.repeat(depth);
      continue;
    }

    if (ch === '}') {
      flushBuffer();
      depth = Math.max(0, depth - 1);
      output += '\n' + '  '.repeat(depth) + '}\n';
      if (depth > 0) output += '  '.repeat(depth);
      continue;
    }

    if (ch === ';') {
      flushBuffer();
      output += ';\n';
      if (depth > 0) output += '  '.repeat(depth);
      continue;
    }

    buffer += ch;
  }

  flushBuffer(false);
  return output
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim() + '\n';
}

function isLikelyMinified(content) {
  const lines = content.split('\n').filter((line) => line.trim());
  if (!lines.length) return false;
  const avg = content.length / lines.length;
  return avg > 180;
}

const files = fs.readdirSync(cssDir).filter((file) => file.endsWith('.css'));
let changed = 0;

for (const file of files) {
  const filePath = path.join(cssDir, file);
  const original = fs.readFileSync(filePath, 'utf8');
  if (!isLikelyMinified(original)) continue;
  const formatted = formatCss(original);
  fs.writeFileSync(filePath, formatted, 'utf8');
  changed += 1;
  console.log(`Formatted ${file}`);
}

console.log(changed ? `Done. Reformatted ${changed} file(s).` : 'All CSS files already readable.');
