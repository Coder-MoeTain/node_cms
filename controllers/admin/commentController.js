const { Op } = require('sequelize');
const sanitizeHtml = require('sanitize-html');
const models = require('../../models');
const policy = require('../../utils/policy');
const { getPagination, pageMeta } = require('../../utils/pagination');

const STATUSES = ['pending', 'approved', 'spam', 'trash', 'all'];

async function index(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_comments')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin');
    }
    const status = STATUSES.includes(req.query.status) ? req.query.status : 'all';
    const { page, limit, offset } = getPagination(req, 20);
    const where = status === 'all' ? {} : { status: status === 'trash' ? 'trash' : status };
    if (status === 'trash') where.status = { [Op.in]: ['trash', 'rejected'] };
    const { rows, count } = await models.Comment.findAndCountAll({
      where,
      include: [models.Post],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });
    const counts = {};
    for (const s of ['pending', 'approved', 'spam', 'trash']) {
      counts[s] = await models.Comment.count({
        where: s === 'trash' ? { status: { [Op.in]: ['trash', 'rejected'] } } : { status: s }
      });
    }
    return res.render('admin/comments/index', {
      title: 'Comments',
      comments: rows,
      status,
      counts,
      pagination: pageMeta(count, page, limit)
    });
  } catch (error) {
    return next(error);
  }
}

async function moderate(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_comments')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/comments');
    }
    const comment = await models.Comment.findByPk(req.params.id);
    if (!comment) return res.status(404).render('errors/404', { title: 'Not Found' });
    const action = req.body.action;
    const map = {
      approve: 'approved',
      spam: 'spam',
      trash: 'trash',
      pending: 'pending'
    };
    if (!map[action]) {
      req.flash('error', 'Unknown action.');
      return res.redirect('/admin/comments');
    }
    await comment.update({
      status: map[action],
      approved_by: action === 'approve' ? req.session.user.id : comment.approved_by,
      approved_at: action === 'approve' ? new Date() : comment.approved_at
    });
    req.flash('success', 'Comment updated.');
    return res.redirect(`/admin/comments?status=${req.body.return_status || 'all'}`);
  } catch (error) {
    return next(error);
  }
}

async function reply(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_comments')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/comments');
    }
    const parent = await models.Comment.findByPk(req.params.id, { include: [models.Post] });
    if (!parent) return res.status(404).render('errors/404', { title: 'Not Found' });
    return res.render('admin/comments/reply', { title: 'Reply to Comment', parent });
  } catch (error) {
    return next(error);
  }
}

async function storeReply(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_comments')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/comments');
    }
    const parent = await models.Comment.findByPk(req.params.id);
    if (!parent) return res.status(404).render('errors/404', { title: 'Not Found' });
    const user = await models.User.findByPk(req.session.user.id);
    await models.Comment.create({
      post_id: parent.post_id,
      parent_id: parent.id,
      user_id: user.id,
      name: user.name,
      email: user.email,
      content: sanitizeHtml(req.body.content || '', { allowedTags: [], allowedAttributes: {} }),
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date()
    });
    req.flash('success', 'Reply published.');
    return res.redirect('/admin/comments?status=approved');
  } catch (error) {
    return next(error);
  }
}

async function bulk(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_comments')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/comments');
    }
    const ids = [].concat(req.body.ids || []).map(Number).filter(Boolean);
    const action = req.body.action;
    const statusMap = { approve: 'approved', spam: 'spam', trash: 'trash', delete: 'delete' };
    if (!ids.length || !statusMap[action]) {
      req.flash('error', 'Select comments and an action.');
      return res.redirect('/admin/comments');
    }
    if (action === 'delete') {
      await models.Comment.destroy({ where: { id: ids } });
    } else {
      await models.Comment.update({ status: statusMap[action] }, { where: { id: ids } });
    }
    req.flash('success', 'Bulk action applied.');
    return res.redirect('/admin/comments');
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, moderate, reply, storeReply, bulk };
