const models = require('../../models');
const policy = require('../../utils/policy');
const { listRevisions } = require('../../utils/revisionHelper');

async function index(req, res, next) {
  try {
    if (!policy.hasAnyPermission(req.session.user, ['manage_posts', 'manage_pages', 'manage_custom_content'])) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin');
    }
    const resourceType = req.query.resource_type || 'custom_post';
    const resourceId = Number(req.query.resource_id);
    if (!resourceId) {
      req.flash('error', 'Missing resource.');
      return res.redirect('/admin');
    }
    const revisions = await listRevisions(resourceType, resourceId);
    return res.render('admin/revisions/index', {
      title: 'Revisions',
      revisions,
      resourceType,
      resourceId
    });
  } catch (error) {
    return next(error);
  }
}

async function restore(req, res, next) {
  try {
    if (!policy.hasAnyPermission(req.session.user, ['manage_posts', 'manage_pages', 'manage_custom_content'])) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin');
    }
    const revision = await models.Revision.findByPk(req.params.id);
    if (!revision) return res.status(404).render('errors/404', { title: 'Not Found' });

    if (revision.resource_type === 'custom_post' || revision.resource_type === 'post') {
      const post = await models.Post.findByPk(revision.resource_id);
      if (post) {
        await post.update({
          title: revision.title || post.title,
          content: revision.content || post.content,
          excerpt: revision.excerpt || post.excerpt,
          block_content_json: revision.block_content_json || post.block_content_json
        });
      }
    } else if (revision.resource_type === 'page') {
      const page = await models.Page.findByPk(revision.resource_id);
      if (page) {
        await page.update({
          title: revision.title || page.title,
          content: revision.content || page.content
        });
      }
    }

    req.flash('success', 'Revision restored.');
    return res.redirect(`/admin/revisions?resource_type=${revision.resource_type}&resource_id=${revision.resource_id}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, restore };
