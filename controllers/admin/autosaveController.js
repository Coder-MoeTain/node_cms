const { saveAutosave, loadAutosave, deleteAutosave } = require('../../utils/autosaveHelper');
const policy = require('../../utils/policy');

const ALLOWED_TYPES = new Set(['post', 'page', 'custom_post']);

async function store(req, res, next) {
  try {
    const { resource_type, resource_id, draft_data } = req.body;
    if (!ALLOWED_TYPES.has(resource_type) || !resource_id) {
      return res.status(400).json({ error: 'Invalid autosave payload.' });
    }
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    await saveAutosave(resource_type, Number(resource_id), draft_data || {}, req.session.user.id);
    return res.json({ ok: true, saved_at: new Date().toISOString() });
  } catch (error) {
    return next(error);
  }
}

async function show(req, res, next) {
  try {
    const { resource_type, resource_id } = req.query;
    if (!ALLOWED_TYPES.has(resource_type) || !resource_id) {
      return res.status(400).json({ error: 'Invalid request.' });
    }
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const draft = await loadAutosave(resource_type, Number(resource_id), req.session.user.id);
    return res.json({ draft });
  } catch (error) {
    return next(error);
  }
}

async function destroy(req, res, next) {
  try {
    const { resource_type, resource_id } = req.body;
    if (!ALLOWED_TYPES.has(resource_type) || !resource_id) return res.status(400).json({ error: 'Invalid.' });
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    await deleteAutosave(resource_type, Number(resource_id), req.session.user.id);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

module.exports = { store, show, destroy };
