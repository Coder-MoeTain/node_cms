const models = require('../models');

const DEFAULT_REVISION_LIMIT = 25;

async function getRevisionLimit() {
  const row = await models.SiteSetting.findOne({ where: { key: 'revision_limit' } });
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_REVISION_LIMIT;
}

async function saveRevision(resourceType, resourceId, snapshot, userId, transaction = null) {
  await models.Revision.create({
    resource_type: resourceType,
    resource_id: resourceId,
    title: snapshot.title || null,
    content: snapshot.content || null,
    excerpt: snapshot.excerpt || null,
    block_content_json: snapshot.block_content_json || null,
    meta_json: snapshot.meta_json ? JSON.stringify(snapshot.meta_json) : null,
    created_by: userId || null
  }, { transaction });

  const limit = await getRevisionLimit();
  const revisions = await models.Revision.findAll({
    where: { resource_type: resourceType, resource_id: resourceId },
    order: [['created_at', 'DESC']],
    attributes: ['id'],
    transaction
  });
  if (revisions.length > limit) {
    const toDelete = revisions.slice(limit).map((r) => r.id);
    await models.Revision.destroy({ where: { id: { [require('sequelize').Op.in]: toDelete } }, transaction });
  }
}

async function listRevisions(resourceType, resourceId) {
  return models.Revision.findAll({
    where: { resource_type: resourceType, resource_id: resourceId },
    order: [['created_at', 'DESC']],
    include: [{ model: models.User, as: 'author', attributes: ['id', 'name', 'email'] }]
  });
}

module.exports = { saveRevision, listRevisions, getRevisionLimit, DEFAULT_REVISION_LIMIT };
