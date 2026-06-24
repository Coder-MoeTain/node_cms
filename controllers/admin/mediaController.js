const { Media } = require('../../models');
const pluginLoader = require('../../utils/pluginLoader');
const policy = require('../../utils/policy');
const { buildMediaPayload, removeMediaFiles } = require('../../utils/mediaHelper');
const { getPagination, pageMeta } = require('../../utils/pagination');

async function index(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req, 18);
    const where = {};
    if (!policy.hasPermission(req.session.user, 'manage_media') && policy.hasPermission(req.session.user, 'upload_media')) {
      where.uploaded_by = req.session.user.id;
    }
    const { rows, count } = await Media.findAndCountAll({ where, limit, offset, order: [['created_at', 'DESC']] });
    return res.render('admin/media/index', { title: 'Media Library', rows, pagination: pageMeta(count, page, limit) });
  } catch (error) {
    return next(error);
  }
}

async function upload(req, res, next) {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    let uploaded = 0;
    for (const file of files) {
      const allowed = await pluginLoader.applyHook('beforeMediaUpload', file, {
        req,
        user: req.session.user
      });
      if (!allowed) continue;
      await Media.create(await buildMediaPayload(allowed, req.session.user.id));
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
      const allowed = await pluginLoader.applyHook('beforeMediaUpload', req.file, {
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

module.exports = { index, upload, edit, update, destroy };
