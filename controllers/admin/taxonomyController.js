const { Op } = require('sequelize');
const models = require('../../models');
const policy = require('../../utils/policy');
const { createUniqueSlug } = require('../../utils/slugGenerator');
const { getPagination, pageMeta } = require('../../utils/pagination');

function deny(req, res) {
  req.flash('error', 'You do not have permission.');
  return res.redirect('/admin');
}

async function index(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_categories')) return deny(req, res);
    const taxonomies = await models.Taxonomy.findAll({ order: [['name', 'ASC']] });
    return res.render('admin/taxonomies/index', { title: 'Taxonomies', taxonomies });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_categories')) return deny(req, res);
    return res.render('admin/taxonomies/form', { title: 'Add Taxonomy', record: {}, postTypes: await models.CustomPostType.findAll() });
  } catch (error) {
    return next(error);
  }
}

async function store(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_categories')) return deny(req, res);
    const postTypes = String(req.body.post_types || 'post').split(',').map((s) => s.trim()).filter(Boolean);
    await models.Taxonomy.create({
      name: req.body.name,
      slug: await createUniqueSlug(models.Taxonomy, req.body.slug || req.body.name, 'taxonomy'),
      description: req.body.description || null,
      hierarchical: req.body.hierarchical === 'on',
      post_types: postTypes,
      public: req.body.public !== 'off',
      show_in_api: req.body.show_in_api !== 'off',
      status: req.body.status || 'active'
    });
    req.flash('success', 'Taxonomy created.');
    return res.redirect('/admin/taxonomies');
  } catch (error) {
    return next(error);
  }
}

async function terms(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_categories')) return deny(req, res);
    const taxonomy = await models.Taxonomy.findOne({ where: { slug: req.params.slug } });
    if (!taxonomy) return res.status(404).render('errors/404', { title: 'Not Found' });
    const { page, limit, offset } = getPagination(req, 20);
    const { rows, count } = await models.TaxonomyTerm.findAndCountAll({
      where: { taxonomy_id: taxonomy.id },
      limit,
      offset,
      order: [['name', 'ASC']]
    });
    return res.render('admin/taxonomies/terms', {
      title: `${taxonomy.name} Terms`,
      taxonomy,
      rows,
      pagination: pageMeta(count, page, limit)
    });
  } catch (error) {
    return next(error);
  }
}

async function storeTerm(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_categories')) return deny(req, res);
    const taxonomy = await models.Taxonomy.findOne({ where: { slug: req.params.slug } });
    if (!taxonomy) return res.status(404).render('errors/404', { title: 'Not Found' });
    await models.TaxonomyTerm.create({
      taxonomy_id: taxonomy.id,
      name: req.body.name,
      slug: await createUniqueSlug(models.TaxonomyTerm, req.body.slug || req.body.name, 'term', null, { taxonomy_id: taxonomy.id }),
      description: req.body.description || null,
      parent_id: req.body.parent_id || null,
      seo_title: req.body.seo_title || null,
      seo_description: req.body.seo_description || null
    });
    req.flash('success', 'Term created.');
    return res.redirect(`/admin/taxonomies/${taxonomy.slug}/terms`);
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, create, store, terms, storeTerm };
