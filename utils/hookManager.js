/**
 * WordPress-style hook manager for NodePress plugins.
 * Filters transform a value; actions run side effects; collectors aggregate outputs.
 */

const COLLECTOR_HOOKS = new Set([
  'publicHead',
  'publicFooter',
  'dashboardWidgets',
  'adminMenuItems'
]);

const HOOK_ALIASES = {
  beforeCommentSave: 'beforeCommentCreate',
  beforeCommentCreate: 'beforeCommentSave',
  afterCommentSave: 'afterCommentCreate',
  afterCommentCreate: 'afterCommentSave'
};

const filters = new Map();
const actions = new Map();
const collectors = new Map();

function resolveHookNames(name) {
  const alias = HOOK_ALIASES[name];
  return alias ? [name, alias] : [name];
}

function getBucket(map, name) {
  const items = [];
  for (const key of resolveHookNames(name)) {
    for (const entry of map.get(key) || []) items.push(entry);
  }
  return items.sort((a, b) => a.sort - b.sort);
}

function addToBucket(map, name, handler, priority = 10, meta = {}) {
  for (const key of resolveHookNames(name)) {
    const list = map.get(key) || [];
    list.push({ handler, priority, sort: priority, ...meta });
    list.sort((a, b) => a.sort - b.sort);
    map.set(key, list);
  }
}

function addFilter(hookName, callback, priority = 10, meta = {}) {
  addToBucket(filters, hookName, callback, priority, meta);
}

function addAction(hookName, callback, priority = 10, meta = {}) {
  if (COLLECTOR_HOOKS.has(hookName)) {
    addToBucket(collectors, hookName, callback, priority, meta);
    return;
  }
  addToBucket(actions, hookName, callback, priority, meta);
}

function registerLegacy(hookName, callback, priority = 10, meta = {}) {
  if (COLLECTOR_HOOKS.has(hookName)) {
    addToBucket(collectors, hookName, callback, priority, meta);
    return;
  }
  addToBucket(filters, hookName, callback, priority, meta);
  addToBucket(collectors, hookName, (context) => callback(null, context), priority, meta);
}

async function applyFilters(hookName, value, context = {}) {
  let result = value;
  for (const item of getBucket(filters, hookName)) {
    result = await item.handler(result, context);
    if (result === false || result === null) return result;
  }
  return result;
}

async function doAction(hookName, payload, context = {}) {
  for (const item of getBucket(actions, hookName)) {
    await item.handler(payload, context);
  }
}

async function collect(hookName, context = {}) {
  const output = [];
  for (const item of getBucket(collectors, hookName)) {
    const value = await item.handler(context);
    if (Array.isArray(value)) output.push(...value);
    else if (value) output.push(value);
  }
  return output;
}

function clear() {
  filters.clear();
  actions.clear();
  collectors.clear();
}

function listRegisteredHooks() {
  const names = new Set([
    ...filters.keys(),
    ...actions.keys(),
    ...collectors.keys()
  ]);
  return [...names].sort();
}

function createPluginApi(pluginSlug = null) {
  const meta = pluginSlug ? { pluginSlug } : {};
  return {
    register: (name, handler, priority = 10) => registerLegacy(name, handler, priority, meta),
    addFilter: (name, handler, priority = 10) => addFilter(name, handler, priority, meta),
    addAction: (name, handler, priority = 10) => addAction(name, handler, priority, meta),
    applyFilters,
    doAction,
    collect
  };
}

module.exports = {
  COLLECTOR_HOOKS,
  addFilter,
  addAction,
  registerLegacy,
  applyFilters,
  doAction,
  collect,
  clear,
  listRegisteredHooks,
  createPluginApi
};
