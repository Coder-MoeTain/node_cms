function getPermissionSlugs(user) {
  return user?.permissions || user?.Role?.Permissions?.map((permission) => permission.slug) || [];
}

function isSuperAdmin(user) {
  return user?.role === 'super-admin' || user?.Role?.slug === 'super-admin';
}

function hasPermission(user, permission) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return getPermissionSlugs(user).includes(permission);
}

function hasAnyPermission(user, permissions) {
  return permissions.some((permission) => hasPermission(user, permission));
}

function canEditPost(user, post) {
  if (hasPermission(user, 'manage_posts') || hasPermission(user, 'edit_posts')) {
    if (hasPermission(user, 'manage_posts')) return true;
    return Number(post.author_id) === Number(user.id);
  }
  return false;
}

function canDeletePost(user, post) {
  if (hasPermission(user, 'delete_posts')) {
    return hasPermission(user, 'manage_posts') || Number(post.author_id) === Number(user.id);
  }
  return false;
}

function canManageUser(currentUser, targetUser) {
  if (!hasPermission(currentUser, 'manage_users')) return false;
  if (isSuperAdmin(currentUser)) return true;
  return !isSuperAdmin(targetUser);
}

function canManageResource(user, resource, action, record = null) {
  if (isSuperAdmin(user)) return true;
  const permissionMap = {
    posts: {
      index: ['manage_posts', 'create_posts', 'edit_posts'],
      create: ['create_posts', 'manage_posts'],
      store: ['create_posts', 'manage_posts'],
      edit: ['edit_posts', 'manage_posts'],
      update: ['edit_posts', 'manage_posts'],
      destroy: ['delete_posts', 'manage_posts']
    },
    pages: {
      index: ['manage_pages'],
      create: ['manage_pages'],
      store: ['manage_pages'],
      edit: ['manage_pages'],
      update: ['manage_pages'],
      destroy: ['manage_pages']
    },
    categories: { default: ['manage_posts'] },
    tags: { default: ['manage_posts'] },
    media: { default: ['manage_media'] },
    comments: { default: ['manage_posts'] },
    messages: { default: ['manage_messages', 'manage_settings'] },
    menus: { default: ['manage_settings'] },
    'menu-items': { default: ['manage_settings'] },
    banners: { default: ['manage_settings'] },
    sliders: { default: ['manage_settings'] },
    users: { default: ['manage_users'] },
    roles: { default: ['manage_roles'] },
    plugins: { default: ['manage_plugins'] },
    themes: { default: ['manage_themes'] },
    settings: { default: ['manage_settings'] },
    security: { default: ['manage_security'] }
  };

  const resourcePermissions = permissionMap[resource];
  if (!resourcePermissions) return false;
  const permissions = resourcePermissions[action] || resourcePermissions.default || [];
  if (!hasAnyPermission(user, permissions)) return false;

  if (record && resource === 'posts' && ['edit', 'update'].includes(action)) return canEditPost(user, record);
  if (record && resource === 'posts' && action === 'destroy') return canDeletePost(user, record);
  return true;
}

module.exports = {
  can: hasPermission,
  hasPermission,
  hasAnyPermission,
  isSuperAdmin,
  canManageResource,
  canEditPost,
  canDeletePost,
  canManageUser
};
