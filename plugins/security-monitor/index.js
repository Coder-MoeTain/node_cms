const path = require('path');
const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');

const DANGEROUS_EXT = new Set(['.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.jsp', '.asp', '.aspx']);
let blockedCount = 0;

function hasDoubleExtension(filename) {
  const parts = String(filename || '').toLowerCase().split('.');
  if (parts.length < 3) return false;
  const inner = `.${parts[parts.length - 2]}`;
  return DANGEROUS_EXT.has(inner);
}

function reject(file, logBlocked) {
  if (logBlocked) blockedCount += 1;
  return null;
}

module.exports = {
  async register({ hooks, manifest }) {
    const settings = await loadPluginSettings(manifest.slug, manifest);
    const blockExecutables = settingBool(settings.block_executables, true);
    const blockDoubleExtension = settingBool(settings.block_double_extension, true);
    const logBlocked = settingBool(settings.log_blocked_uploads, true);
    const maxMb = Number(settingValue(settings, 'max_upload_mb', '10'));
    const allowedMime = settingValue(settings, 'allowed_mime_types', '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    hooks.register('beforeMediaUpload', async (file) => {
      if (!file) return null;
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (blockExecutables && DANGEROUS_EXT.has(ext)) return reject(file, logBlocked);
      if (blockDoubleExtension && hasDoubleExtension(file.originalname)) return reject(file, logBlocked);
      if (allowedMime.length && !allowedMime.includes(file.mimetype)) return reject(file, logBlocked);
      if (maxMb > 0 && file.size > maxMb * 1024 * 1024) return reject(file, logBlocked);
      return file;
    }, 5);

    hooks.register('dashboardWidgets', () => ({
      title: 'Upload Security',
      body: `Executable blocking: <strong>${blockExecutables ? 'on' : 'off'}</strong> · Max size: <strong>${maxMb} MB</strong> · Blocked this session: <strong>${blockedCount}</strong>.`
    }));
  }
};
