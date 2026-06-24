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

function canPublishPost(user) {
  return hasPermission(user, 'publish_posts') || hasPermission(user, 'manage_posts');
}

function canEditPost(user, post) {
  if (hasPermission(user, 'manage_posts')) return true;
  if (hasPermission(user, 'edit_posts')) {
    return Number(post.author_id) === Number(user.id);
  }
  return false;
}

function canDeletePost(user, post) {
  if (!hasPermission(user, 'delete_posts') && !hasPermission(user, 'manage_posts')) return false;
  if (hasPermission(user, 'manage_posts')) return true;
  return Number(post.author_id) === Number(user.id);
}

function canEditMedia(user, media) {
  if (hasPermission(user, 'manage_media')) return true;
  if (hasPermission(user, 'upload_media')) {
    return Number(media.uploaded_by) === Number(user.id);
  }
  return false;
}

function canDeleteMedia(user, media) {
  return canEditMedia(user, media);
}

function canEditComment(user) {
  return hasPermission(user, 'manage_comments');
}

function canManageUser(currentUser, targetUser) {
  if (!hasPermission(currentUser, 'manage_users')) return false;
  if (isSuperAdmin(currentUser)) return true;
  if (isSuperAdmin(targetUser)) return false;
  return true;
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
      destroy: ['delete_posts', 'manage_posts'],
      bulk: ['delete_posts', 'manage_posts']
    },
    pages: {
      index: ['manage_pages'],
      create: ['manage_pages'],
      store: ['manage_pages'],
      edit: ['manage_pages'],
      update: ['manage_pages'],
      destroy: ['manage_pages'],
      bulk: ['manage_pages']
    },
    categories: { default: ['manage_categories', 'manage_posts'] },
    tags: { default: ['manage_tags', 'manage_posts'] },
    media: {
      index: ['manage_media', 'upload_media'],
      default: ['manage_media', 'upload_media']
    },
    comments: { default: ['manage_comments'] },
    messages: { default: ['manage_messages', 'manage_settings'] },
    menus: { default: ['manage_menus', 'manage_settings'] },
    'menu-items': { default: ['manage_menus', 'manage_settings'] },
    banners: { default: ['manage_banners', 'manage_settings'] },
    sliders: { default: ['manage_sliders', 'manage_settings'] },
    users: { default: ['manage_users'] },
    roles: { default: ['manage_roles'] },
    plugins: { default: ['manage_plugins'] },
    themes: { default: ['manage_themes'] },
    settings: { default: ['manage_settings'] },
    security: { default: ['manage_security'] },
    waf: { default: ['manage_waf', 'manage_security'] }
  };

  const resourcePermissions = permissionMap[resource];
  if (!resourcePermissions) return false;
  const permissions = resourcePermissions[action] || resourcePermissions.default || [];
  if (!hasAnyPermission(user, permissions)) return false;

  if (record && resource === 'posts' && ['edit', 'update'].includes(action)) return canEditPost(user, record);
  if (record && resource === 'posts' && ['destroy', 'bulk'].includes(action)) return canDeletePost(user, record);
  if (record && resource === 'media' && ['edit', 'update', 'destroy'].includes(action)) {
    return action === 'destroy' ? canDeleteMedia(user, record) : canEditMedia(user, record);
  }
  if (record && resource === 'comments' && ['edit', 'update', 'destroy'].includes(action)) {
    return canEditComment(user, record);
  }
  if (record && resource === 'users' && ['edit', 'update', 'destroy'].includes(action)) {
    return canManageUser(user, record);
  }
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
  canPublishPost,
  canEditMedia,
  canDeleteMedia,
  canEditComment,
  canManageUser
};
