const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function optimizeImage(file, settings) {
  if (!file?.path || !IMAGE_TYPES.has(file.mimetype)) return file;
  const maxWidth = Number(settingValue(settings, 'max_width', '1920'));
  const maxHeight = Number(settingValue(settings, 'max_height', '1920'));
  const jpegQuality = Math.min(100, Math.max(1, Number(settingValue(settings, 'jpeg_quality', '82'))));
  const webpQuality = Math.min(100, Math.max(1, Number(settingValue(settings, 'webp_quality', '80'))));
  const stripMetadata = settingBool(settings.strip_metadata, true);
  const convertWebp = settingBool(settings.convert_webp, false);

  let pipeline = sharp(file.path).rotate().resize({
    width: maxWidth,
    height: maxHeight,
    fit: 'inside',
    withoutEnlargement: true
  });
  if (stripMetadata) pipeline = pipeline.withMetadata({ exif: {} });

  const targetPath = `${file.path}.opt`;
  if (convertWebp || file.mimetype === 'image/webp') {
    await pipeline.webp({ quality: webpQuality }).toFile(targetPath);
    file.mimetype = 'image/webp';
    file.originalname = file.originalname.replace(/\.[^.]+$/, '.webp');
  } else if (file.mimetype === 'image/jpeg') {
    await pipeline.jpeg({ quality: jpegQuality }).toFile(targetPath);
  } else if (file.mimetype === 'image/png') {
    await pipeline.png({ compressionLevel: 9 }).toFile(targetPath);
  } else {
    return file;
  }

  fs.renameSync(targetPath, file.path);
  file.size = fs.statSync(file.path).size;
  return file;
}

module.exports = {
  async register({ hooks, manifest }) {
    const settings = await loadPluginSettings(manifest.slug, manifest);
    const enabled = settingBool(settings.enabled, true);

    hooks.register('beforeMediaUpload', async (file) => {
      if (!enabled || !file) return file;
      try {
        return await optimizeImage(file, settings);
      } catch {
        return file;
      }
    }, 20);

    hooks.register('dashboardWidgets', () => ({
      title: 'Image Optimizer',
      body: enabled
        ? `Images resized to max <strong>${settingValue(settings, 'max_width', '1920')}×${settingValue(settings, 'max_height', '1920')}px</strong>${settingBool(settings.convert_webp, false) ? ' · WebP conversion on' : ''}.`
        : 'Image optimization is disabled.'
    }));
  }
};
