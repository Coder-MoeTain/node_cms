const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assertSafeOutboundUrlResolved } = require('./ssrfGuard');
const { ensureDirectory, publicUploadPath, classifyMime } = require('./fileHelper');

const MAX_REMOTE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_DIR = 'wxr-import';

function isRemoteMediaUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function safeFilename(name, mimeType = '') {
  const base = path.basename(String(name || 'attachment').replace(/[^\w.\-]+/g, '-'), path.extname(name || ''));
  const ext = path.extname(name || '') || mimeExtension(mimeType);
  const stamp = Date.now();
  const rand = crypto.randomBytes(4).toString('hex');
  return `${base || 'file'}-${stamp}-${rand}${ext}`;
}

function mimeExtension(mimeType = '') {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'application/pdf': '.pdf'
  };
  return map[mimeType.toLowerCase()] || '';
}

async function downloadRemoteMedia(rawUrl, options = {}) {
  const fetchImpl = options.fetchImpl || global.fetch;
  if (!fetchImpl) throw new Error('Fetch is not available for remote media download.');

  if (!options.fetchImpl) {
    await assertSafeOutboundUrlResolved(rawUrl, { allowHttp: process.env.NODE_ENV === 'test' });
  }

  const response = await fetchImpl(rawUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(options.timeoutMs || 15000)
  });
  if (!response.ok) {
    throw new Error(`Failed to download media (${response.status}).`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_REMOTE_BYTES) {
    throw new Error('Remote media file exceeds maximum download size.');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_REMOTE_BYTES) {
    throw new Error('Remote media file exceeds maximum download size.');
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim()
    || options.mimeType
    || 'application/octet-stream';
  const filename = safeFilename(options.originalName || path.basename(new URL(rawUrl).pathname), mimeType);
  const dir = publicUploadPath(DOWNLOAD_DIR);
  ensureDirectory(dir);
  const diskPath = path.join(dir, filename);
  fs.writeFileSync(diskPath, buffer);

  const relative = `/uploads/${DOWNLOAD_DIR}/${filename}`;

  return {
    filename,
    original_name: options.originalName || filename,
    file_path: relative,
    file_type: classifyMime(mimeType),
    mime_type: mimeType,
    file_size: buffer.length,
    uploaded_by: options.userId || null
  };
}

async function hydrateImportMedia(mediaRows = [], options = {}) {
  const { downloadRemote = true, userId = null, fetchImpl } = options;
  const output = [];

  for (const row of mediaRows) {
    const sourceUrl = row.source_url || (isRemoteMediaUrl(row.file_path) ? row.file_path : null);
    if (downloadRemote && sourceUrl) {
      try {
        const saved = await downloadRemoteMedia(sourceUrl, {
          userId,
          fetchImpl,
          originalName: row.original_name || row.filename,
          mimeType: row.mime_type
        });
        output.push({ ...row, ...saved, external: false });
        continue;
      } catch (error) {
        if (options.strict) throw error;
        output.push({ ...row, download_error: error.message });
        continue;
      }
    }
    if (row.file_path && !isRemoteMediaUrl(row.file_path)) {
      output.push(row);
    }
  }

  return output;
}

module.exports = {
  isRemoteMediaUrl,
  downloadRemoteMedia,
  hydrateImportMedia,
  MAX_REMOTE_BYTES
};
