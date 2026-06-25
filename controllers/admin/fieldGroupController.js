const sanitizeHtml = require('sanitize-html');
const { Op } = require('sequelize');
const models = require('../../models');
const { createUniqueSlug } = require('../../utils/slugGenerator');
const policy = require('../../utils/policy');

function sanitizeText(value, max = 500) {
  return sanitizeHtml(value || '', { allowedTags: [], allowedAttributes: {} }).slice(0, max);
}

const FIELD_TYPES = [
  'text', 'textarea', 'rich_text', 'number', 'date', 'datetime',
  'select', 'checkbox', 'radio', 'image', 'file', 'url', 'email', 'color', 'repeater', 'group'
];

async function index(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_fields')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin');
    }
    const groups = await models.FieldGroup.findAll({
      include: [{ model: models.CustomField, as: 'fields' }],
      order: [['display_order', 'ASC'], ['name', 'ASC']]
    });
    return res.render('admin/field-groups/index', { title: 'Field Groups', groups });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_fields')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/field-groups');
    }
    const postTypes = await models.CustomPostType.findAll({ where: { status: 'active' }, order: [['name', 'ASC']] });
    return res.render('admin/field-groups/form', {
      title: 'Add Field Group',
      record: {},
      fields: [],
      postTypes,
      fieldTypes: FIELD_TYPES
    });
  } catch (error) {
    return next(error);
  }
}

async function store(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_fields')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/field-groups');
    }
    const slug = await createUniqueSlug(models.FieldGroup, req.body.slug || req.body.name, 'group');
    const group = await models.FieldGroup.create({
      name: sanitizeText(req.body.name, 120),
      slug,
      description: sanitizeText(req.body.description, 2000),
      location_type: req.body.location_type || 'custom_post_type',
      location_value: sanitizeText(req.body.location_value, 120),
      display_order: Number(req.body.display_order) || 0,
      status: req.body.status === 'inactive' ? 'inactive' : 'active'
    });
    await syncFields(group, req.body);
    req.flash('success', 'Field group created.');
    return res.redirect('/admin/field-groups');
  } catch (error) {
    return next(error);
  }
}

async function edit(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_fields')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/field-groups');
    }
    const record = await models.FieldGroup.findByPk(req.params.id, {
      include: [{ model: models.CustomField, as: 'fields', order: [['display_order', 'ASC']] }]
    });
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });
    const postTypes = await models.CustomPostType.findAll({ where: { status: 'active' }, order: [['name', 'ASC']] });
    return res.render('admin/field-groups/form', {
      title: 'Edit Field Group',
      record,
      fields: record.fields || [],
      postTypes,
      fieldTypes: FIELD_TYPES
    });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_fields')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/field-groups');
    }
    const record = await models.FieldGroup.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });
    await record.update({
      name: sanitizeText(req.body.name, 120),
      slug: await createUniqueSlug(models.FieldGroup, req.body.slug || req.body.name, 'group', record.id),
      description: sanitizeText(req.body.description, 2000),
      location_type: req.body.location_type || 'custom_post_type',
      location_value: sanitizeText(req.body.location_value, 120),
      display_order: Number(req.body.display_order) || 0,
      status: req.body.status === 'inactive' ? 'inactive' : 'active'
    });
    await syncFields(record, req.body);
    req.flash('success', 'Field group updated.');
    return res.redirect('/admin/field-groups');
  } catch (error) {
    return next(error);
  }
}

async function destroy(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_fields')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/field-groups');
    }
    const record = await models.FieldGroup.findByPk(req.params.id);
    if (record) await record.destroy();
    req.flash('success', 'Field group deleted.');
    return res.redirect('/admin/field-groups');
  } catch (error) {
    return next(error);
  }
}

async function syncFields(group, body) {
  const labels = [].concat(body.field_label || []);
  const names = [].concat(body.field_name || []);
  const types = [].concat(body.field_type || []);
  const required = [].concat(body.field_required || []);
  const help = [].concat(body.field_help || []);
  const ids = [].concat(body.field_id || []);
  const kept = [];

  for (let i = 0; i < labels.length; i += 1) {
    const label = sanitizeText(labels[i], 120);
    const name = sanitizeText(names[i] || labels[i], 80).replace(/\s+/g, '_').toLowerCase();
    if (!label || !name) continue;
    const data = {
      label,
      name,
      type: FIELD_TYPES.includes(types[i]) ? types[i] : 'text',
      is_required: required[i] === 'on' || required[i] === '1',
      help_text: sanitizeText(help[i], 500),
      display_order: i,
      status: 'active'
    };
    if (ids[i]) {
      const field = await models.CustomField.findOne({ where: { id: ids[i], field_group_id: group.id } });
      if (field) {
        await field.update(data);
        kept.push(field.id);
        continue;
      }
    }
    const created = await models.CustomField.create({ ...data, field_group_id: group.id });
    kept.push(created.id);
  }

  await models.CustomField.destroy({
    where: { field_group_id: group.id, id: { [Op.notIn]: kept.length ? kept : [0] } }
  });
}

module.exports = { index, create, store, edit, update, destroy, FIELD_TYPES };
