/**
 * WordPress-style hook manager for NodePress plugins.
 * Filters transform a value; actions run side effects; collectors aggregate outputs.
 */

const COLLECTOR_HOOKS = new Set([
  'publicHead',
  'publicFooter',
  'dashboardWidgets',
  'adminMenuItems',
  'admin:menu',
  'admin:dashboardWidgets'
]);

const HOOK_ALIASES = {
  beforeCommentSave: 'beforeCommentCreate',
  beforeCommentCreate: 'beforeCommentSave',
  afterCommentSave: 'afterCommentCreate',
  afterCommentCreate: 'afterCommentSave',
  'public:head': 'publicHead',
  publicHead: 'public:head',
  'public:footer': 'publicFooter',
  publicFooter: 'public:footer',
  'admin:menu': 'adminMenuItems',
  adminMenuItems: 'admin:menu',
  'admin:dashboardWidgets': 'dashboardWidgets',
  dashboardWidgets: 'admin:dashboardWidgets',
  'admin:enqueueAssets': 'adminEnqueueAssets',
  'public:enqueueAssets': 'publicEnqueueAssets',
  'post:beforeCreate': 'beforePostCreate',
  'post:afterCreate': 'afterPostCreate',
  'post:beforeUpdate': 'beforePostUpdate',
  'post:afterUpdate': 'afterPostUpdate',
  'post:beforeDelete': 'beforePostDelete',
  'post:afterDelete': 'afterPostDelete',
  'post:beforeRender': 'beforePageRender',
  'post:afterRender': 'afterPageRender',
  'media:beforeUpload': 'beforeMediaUpload',
  'media:afterUpload': 'afterMediaUpload',
  'media:beforeDelete': 'beforeMediaDelete',
  'media:afterDelete': 'afterMediaDelete',
  'user:afterLogin': 'afterUserLogin',
  'user:afterLogout': 'afterUserLogout',
  'content:render': 'beforePageRender',
  'waf:beforeCheck': 'beforeWafCheck',
  'waf:afterCheck': 'afterWafCheck'
};

const filters = new Map();
const actions = new Map();
const collectors = new Map();
const hookErrors = [];
const isDev = process.env.NODE_ENV !== 'production';

function resolveHookNames(name) {
  const alias = HOOK_ALIASES[name];
  const names = alias ? [name, alias] : [name];
  return [...new Set(names)];
}

function getBucket(map, name) {
  const items = [];
  const seen = new Set();
  for (const key of resolveHookNames(name)) {
    for (const entry of map.get(key) || []) {
      const id = entry.id || `${entry.priority}:${entry.handler}`;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(entry);
    }
  }
  return items.sort((a, b) => a.sort - b.sort);
}

let hookIdCounter = 0;

function addToBucket(map, name, handler, priority = 10, meta = {}) {
  const id = ++hookIdCounter;
  const entry = { id, handler, priority, sort: priority, ...meta };
  for (const key of resolveHookNames(name)) {
    const list = map.get(key) || [];
    list.push(entry);
    list.sort((a, b) => a.sort - b.sort);
    map.set(key, list);
  }
  return id;
}

function removeFromBucket(map, hookName, callback) {
  let removed = false;
  for (const key of resolveHookNames(hookName)) {
    const list = map.get(key);
    if (!list) continue;
    const next = list.filter((entry) => entry.handler !== callback);
    if (next.length !== list.length) {
      removed = true;
      map.set(key, next);
    }
  }
  return removed;
}

function addFilter(hookName, callback, priority = 10, meta = {}) {
  return addToBucket(filters, hookName, callback, priority, meta);
}

function addAction(hookName, callback, priority = 10, meta = {}) {
  if (COLLECTOR_HOOKS.has(hookName) || COLLECTOR_HOOKS.has(HOOK_ALIASES[hookName])) {
    return addToBucket(collectors, hookName, callback, priority, meta);
  }
  return addToBucket(actions, hookName, callback, priority, meta);
}

function registerLegacy(hookName, callback, priority = 10, meta = {}) {
  if (COLLECTOR_HOOKS.has(hookName)) {
    addToBucket(collectors, hookName, callback, priority, meta);
    return;
  }
  addToBucket(filters, hookName, callback, priority, meta);
  addToBucket(collectors, hookName, (context) => callback(null, context), priority, meta);
}

function removeFilter(hookName, callback) {
  return removeFromBucket(filters, hookName, callback);
}

function removeAction(hookName, callback) {
  return removeFromBucket(actions, hookName, callback) || removeFromBucket(collectors, hookName, callback);
}

function hasHook(hookName) {
  return getBucket(filters, hookName).length > 0
    || getBucket(actions, hookName).length > 0
    || getBucket(collectors, hookName).length > 0;
}

async function runWithIsolation(type, hookName, item, runner) {
  const start = isDev ? Date.now() : 0;
  try {
    return await runner();
  } catch (error) {
    hookErrors.push({
      hook: hookName,
      type,
      pluginSlug: item.pluginSlug || null,
      message: error.message,
      at: new Date().toISOString()
    });
    if (isDev) {
      console.warn(`[hook:${type}] ${hookName} failed (${item.pluginSlug || 'core'}): ${error.message}`);
    }
    return type === 'filter' ? undefined : null;
  } finally {
    if (isDev && start) {
      const ms = Date.now() - start;
      if (ms > 50) console.debug(`[hook:timing] ${hookName} ${ms}ms (${item.pluginSlug || 'core'})`);
    }
  }
}

async function applyFilters(hookName, value, context = {}) {
  let result = value;
  for (const item of getBucket(filters, hookName)) {
    const next = await runWithIsolation('filter', hookName, item, () => item.handler(result, context));
    if (next === undefined) continue;
    result = next;
    if (result === false || result === null) return result;
  }
  return result;
}

async function doAction(hookName, payload, context = {}) {
  for (const item of getBucket(actions, hookName)) {
    await runWithIsolation('action', hookName, item, () => item.handler(payload, context));
  }
}

async function collect(hookName, context = {}) {
  const output = [];
  for (const item of getBucket(collectors, hookName)) {
    const value = await runWithIsolation('collect', hookName, item, () => item.handler(context));
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) output.push(...value);
    else output.push(value);
  }
  return output;
}

function clear() {
  filters.clear();
  actions.clear();
  collectors.clear();
  hookErrors.length = 0;
}

function clearHooks() {
  clear();
}

function getHookErrors() {
  return [...hookErrors];
}

function listRegisteredHooks() {
  const names = new Set([
    ...filters.keys(),
    ...actions.keys(),
    ...collectors.keys()
  ]);
  return [...names].sort();
}

function listHooks() {
  const names = new Set([
    ...filters.keys(),
    ...actions.keys(),
    ...collectors.keys()
  ]);
  return [...names].sort().map((name) => ({
    name,
    filters: getBucket(filters, name).length,
    actions: getBucket(actions, name).length,
    collectors: getBucket(collectors, name).length
  }));
}

function createPluginApi(pluginSlug = null) {
  const meta = pluginSlug ? { pluginSlug } : {};
  return {
    register: (name, handler, priority = 10) => registerLegacy(name, handler, priority, meta),
    addFilter: (name, handler, priority = 10) => addFilter(name, handler, priority, meta),
    addAction: (name, handler, priority = 10) => addAction(name, handler, priority, meta),
    removeFilter: (name, handler) => removeFilter(name, handler),
    removeAction: (name, handler) => removeAction(name, handler),
    applyFilters,
    doAction,
    collect
  };
}

module.exports = {
  COLLECTOR_HOOKS,
  HOOK_ALIASES,
  addFilter,
  addAction,
  removeFilter,
  removeAction,
  registerLegacy,
  applyFilters,
  doAction,
  collect,
  clear,
  clearHooks,
  hasHook,
  listHooks,
  listRegisteredHooks,
  getHookErrors,
  createPluginApi
};
