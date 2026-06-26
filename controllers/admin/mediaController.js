const appConfig = require('../../config/app');
const { Media } = require('../../models');
const pluginLoader = require('../../utils/pluginLoader');
const policy = require('../../utils/policy');
const { buildMediaPayload, removeMediaFiles, filterExistingMedia, regenerateImageVariants } = require('../../utils/mediaHelper');
const { finalizeQuarantinedUpload } = require('../../utils/uploadSecurity');
const { getPagination, pageMeta } = require('../../utils/pagination');

async function index(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req, 18);
    const where = {};
    if (!policy.hasPermission(req.session.user, 'manage_media') && policy.hasPermission(req.session.user, 'upload_media')) {
      where.uploaded_by = req.session.user.id;
    }
    const { rows, count } = await Media.findAndCountAll({ where, limit, offset, order: [['created_at', 'DESC']] });
    return res.render('admin/media/index', {
      title: 'Media Library',
      rows: filterExistingMedia(rows),
      pagination: pageMeta(count, page, limit),
      mediaUploadMaxFiles: appConfig.mediaUploadMaxFiles,
      uploadMaxSizeMb: appConfig.uploadMaxSizeMb
    });
  } catch (error) {
    return next(error);
  }
}

async function upload(req, res, next) {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    let uploaded = 0;
    for (const file of files) {
      let processedFile;
      try {
        processedFile = await finalizeQuarantinedUpload(file);
      } catch (validationError) {
        req.flash('error', validationError.message);
        continue;
      }
      const allowed = await pluginLoader.applyFilters('beforeMediaUpload', processedFile, {
        req,
        user: req.session.user
      });
      if (!allowed) continue;
      const mediaRecord = await Media.create(await buildMediaPayload(allowed, req.session.user.id));
      await pluginLoader.doAction('afterMediaUpload', mediaRecord, { req, user: req.session.user, file: allowed });
      uploaded += 1;
    }
    if (!uploaded && files.length) {
      req.flash('error', 'Upload blocked by a plugin or security policy.');
      return res.redirect('/admin/media');
    }
    req.flash('success', uploaded === 1 ? 'Media uploaded.' : `${uploaded} files uploaded.`);
    return res.redirect('/admin/media');
  } catch (error) {
    return next(error);
  }
}

async function edit(req, res, next) {
  try {
    const media = await Media.findByPk(req.params.id);
    if (!media) return res.status(404).render('errors/404', { title: 'Media Not Found' });
    if (!policy.canEditMedia(req.session.user, media)) {
      req.flash('error', 'You can only edit media you uploaded.');
      return res.redirect('/admin/media');
    }
    return res.render('admin/media/edit', { title: 'Edit Media', media });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const media = await Media.findByPk(req.params.id);
    if (!media) return res.status(404).render('errors/404', { title: 'Media Not Found' });
    if (!policy.canEditMedia(req.session.user, media)) {
      req.flash('error', 'You can only edit media you uploaded.');
      return res.redirect('/admin/media');
    }
    const payload = {
      alt_text: req.body.alt_text,
      caption: req.body.caption,
      description: req.body.description
    };
    if (req.file) {
      let processedFile;
      try {
        processedFile = await finalizeQuarantinedUpload(req.file);
      } catch (validationError) {
        req.flash('error', validationError.message);
        return res.redirect(`/admin/media/${media.id}/edit`);
      }
      const allowed = await pluginLoader.applyFilters('beforeMediaUpload', processedFile, {
        req,
        user: req.session.user
      });
      if (!allowed) {
        req.flash('error', 'Upload blocked by a plugin or security policy.');
        return res.redirect(`/admin/media/${media.id}/edit`);
      }
      removeMediaFiles(media);
      Object.assign(payload, await buildMediaPayload(allowed, req.session.user.id));
    }
    await media.update(payload);
    if (req.file) {
      await pluginLoader.doAction('afterMediaUpload', media, { req, user: req.session.user, file: req.file, replaced: true });
    }
    req.flash('success', 'Media updated.');
    return res.redirect(`/admin/media/${media.id}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function destroy(req, res, next) {
  try {
    const media = await Media.findByPk(req.params.id);
    if (media && !policy.canDeleteMedia(req.session.user, media)) {
      req.flash('error', 'You can only delete media you uploaded.');
      return res.redirect('/admin/media');
    }
    if (media) {
      removeMediaFiles(media);
      await media.destroy();
    }
    req.flash('success', 'Media deleted.');
    return res.redirect('/admin/media');
  } catch (error) {
    return next(error);
  }
}

async function bulkDestroy(req, res, next) {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : String(req.body.ids || '').split(',').filter(Boolean);
    if (!ids.length) {
      req.flash('error', 'Select at least one media item to delete.');
      return res.redirect('/admin/media');
    }
    const rows = await Media.findAll({ where: { id: ids } });
    let deleted = 0;
    for (const media of rows) {
      if (!policy.canDeleteMedia(req.session.user, media)) continue;
      removeMediaFiles(media);
      await media.destroy();
      deleted += 1;
    }
    req.flash('success', deleted === 1 ? 'Media deleted.' : `${deleted} media items deleted.`);
    return res.redirect('/admin/media');
  } catch (error) {
    return next(error);
  }
}

async function regenerateThumbnails(req, res, next) {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : String(req.body.ids || '').split(',').filter(Boolean);
    const where = ids.length ? { id: ids } : { file_type: 'image' };
    const rows = await Media.findAll({ where, order: [['id', 'ASC']] });
    let regenerated = 0;
    for (const media of rows) {
      if (!policy.canEditMedia(req.session.user, media)) continue;
      try {
        await regenerateImageVariants(media);
        regenerated += 1;
      } catch {
        // skip items with missing originals
      }
    }
    req.flash('success', regenerated
      ? `Regenerated thumbnails for ${regenerated} image(s).`
      : 'No images were regenerated.');
    return res.redirect('/admin/media');
  } catch (error) {
    return next(error);
  }
}

async function gallery(req, res, next) {
  try {
    const mediaType = req.query.type || 'image';
    const where = { file_type: mediaType };
    if (!policy.hasPermission(req.session.user, 'manage_media') && policy.hasPermission(req.session.user, 'upload_media')) {
      where.uploaded_by = req.session.user.id;
    }
    const rows = filterExistingMedia(await Media.findAll({
      where,
      limit: 60,
      order: [['created_at', 'DESC']]
    }));
    return res.json({
      items: rows.map((item) => ({
        id: item.id,
        originalName: item.original_name,
        filePath: item.file_path,
        thumbnailPath: item.thumbnail_path,
        fileType: item.file_type,
        mimeType: item.mime_type,
        fileSize: item.file_size,
        createdAt: item.created_at
      }))
    });
  } catch (error) {
    return next(error);
  }
}

async function uploadJson(req, res, next) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded.' });

    let processedFile;
    try {
      processedFile = await finalizeQuarantinedUpload(file);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message || 'Upload failed content validation.' });
    }

    const allowed = await pluginLoader.applyFilters('beforeMediaUpload', processedFile, {
      req,
      user: req.session.user
    });
    if (!allowed) return res.status(403).json({ error: 'Upload blocked by a plugin or security policy.' });

    const mediaRecord = await Media.create(await buildMediaPayload(allowed, req.session.user.id));
    await pluginLoader.doAction('afterMediaUpload', mediaRecord, { req, user: req.session.user, file: allowed });

    return res.json({
      location: mediaRecord.file_path,
      filePath: mediaRecord.file_path,
      thumbnailPath: mediaRecord.thumbnail_path,
      id: mediaRecord.id,
      originalName: mediaRecord.original_name
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, upload, uploadJson, gallery, edit, update, destroy, bulkDestroy, regenerateThumbnails };
