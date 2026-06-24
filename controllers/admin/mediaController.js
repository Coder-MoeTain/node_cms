const fs = require('fs');
const path = require('path');
const { Media } = require('../../models');
const { classifyMime, publicUploadPath } = require('../../utils/fileHelper');
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
      const relative = `/uploads/${path.relative(publicUploadPath(), file.path).replace(/\\/g, '/')}`;
      await Media.create({
        filename: file.filename,
        original_name: file.originalname,
        file_path: relative,
        file_type: classifyMime(file.mimetype),
        mime_type: file.mimetype,
        file_size: file.size,
        uploaded_by: req.session.user.id
      });
    }
    req.flash('success', 'Media uploaded.');
    return res.redirect('/admin/media');
  } catch (error) {
    return next(error);
  }
}

async function destroy(req, res, next) {
  try {
    const media = await Media.findByPk(req.params.id);
    if (media) {
      const diskPath = publicUploadPath(media.file_path.replace('/uploads/', ''));
      if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
      await media.destroy();
    }
    req.flash('success', 'Media deleted.');
    return res.redirect('/admin/media');
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, upload, destroy };
