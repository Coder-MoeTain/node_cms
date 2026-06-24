const { Media } = require('../../models');
const { buildMediaPayload, removeMediaFiles } = require('../../utils/mediaHelper');
const { getPagination, pageMeta } = require('../../utils/pagination');

async function index(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req, 18);
    const { rows, count } = await Media.findAndCountAll({ limit, offset, order: [['created_at', 'DESC']] });
    return res.render('admin/media/index', { title: 'Media Library', rows, pagination: pageMeta(count, page, limit) });
  } catch (error) {
    return next(error);
  }
}

async function upload(req, res, next) {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    for (const file of files) {
      await Media.create(await buildMediaPayload(file, req.session.user.id));
    }
    req.flash('success', 'Media uploaded.');
    return res.redirect('/admin/media');
  } catch (error) {
    return next(error);
  }
}

async function edit(req, res, next) {
  try {
    const media = await Media.findByPk(req.params.id);
    if (!media) return res.status(404).render('errors/404', { title: 'Media Not Found' });
    return res.render('admin/media/edit', { title: 'Edit Media', media });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const media = await Media.findByPk(req.params.id);
    if (!media) return res.status(404).render('errors/404', { title: 'Media Not Found' });
    const payload = {
      alt_text: req.body.alt_text,
      caption: req.body.caption,
      description: req.body.description
    };
    if (req.file) {
      removeMediaFiles(media);
      Object.assign(payload, await buildMediaPayload(req.file, req.session.user.id));
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
