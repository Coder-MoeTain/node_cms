const models = require('../models');

async function saveAutosave(resourceType, resourceId, draftData, userId) {
  const payload = JSON.stringify(draftData);
  const [row] = await models.Autosave.findOrCreate({
    where: { resource_type: resourceType, resource_id: resourceId, created_by: userId },
    defaults: { draft_data_json: payload }
  });
  if (row.draft_data_json !== payload) {
    await row.update({ draft_data_json: payload });
  }
  return row;
}

async function loadAutosave(resourceType, resourceId, userId) {
  const row = await models.Autosave.findOne({
    where: { resource_type: resourceType, resource_id: resourceId, created_by: userId }
  });
  if (!row) return null;
  try {
    return JSON.parse(row.draft_data_json);
  } catch {
    return null;
  }
}

async function deleteAutosave(resourceType, resourceId, userId) {
  await models.Autosave.destroy({
    where: { resource_type: resourceType, resource_id: resourceId, created_by: userId }
  });
}

async function getResourceSnapshot(resourceType, resourceId) {
  const { Post, Page, User } = models;
  let row = null;
  if (resourceType === 'page') {
    row = await Page.findByPk(resourceId, { attributes: ['id', 'updated_at', 'author_id'] });
  } else if (resourceType === 'post' || resourceType === 'custom_post') {
    row = await Post.findByPk(resourceId, { attributes: ['id', 'updated_at', 'author_id'] });
  }
  if (!row) return null;
  const author = row.author_id
    ? await User.findByPk(row.author_id, { attributes: ['id', 'name'] })
    : null;
  return {
    updated_at: row.updated_at,
    updated_by: row.author_id,
    updated_by_name: author?.name || null
  };
}

module.exports = { saveAutosave, loadAutosave, deleteAutosave, getResourceSnapshot };
