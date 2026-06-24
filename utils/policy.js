function getPermissionSlugs(user) {
  return user?.permissions || user?.Role?.Permissions?.map((permission) => permission.slug) || [];
}

function getRoleSlug(user) {
  return user?.role || user?.Role?.slug || null;
}

function isSuperAdmin(user) {
  return getRoleSlug(user) === 'super-admin';
}

function isAdmin(user) {
  return getRoleSlug(user) === 'admin';
}

function isEditor(user) {
  return getRoleSlug(user) === 'editor';
}

function isAuthor(user) {
  return getRoleSlug(user) === 'author';
}

function isSubscriber(user) {
  return getRoleSlug(user) === 'subscriber';
}

function hasPermission(user, permission) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return getPermissionSlugs(user).includes(permission);
}

function hasAnyPermission(user, permissions) {
  return permissions.some((permission) => hasPermission(user, permission));
}

function canPublishPost(user, post = null) {
  if (!hasPermission(user, 'publish_posts') && !hasPermission(user, 'manage_posts')) return false;
  if (post && !hasPermission(user, 'manage_posts')) {
    return Number(post.author_id) === Number(user.id);
  }
  return true;
}

function canEditPost(user, post) {
  if (!post) return hasAnyPermission(user, ['manage_posts', 'edit_posts', 'create_posts']);
  if (hasPermission(user, 'manage_posts')) return true;
  if (hasPermission(user, 'edit_posts') || hasPermission(user, 'create_posts')) {
    return Number(post.author_id) === Number(user.id);
  }
  return false;
}

function canDeletePost(user, post) {
  if (!post) return hasAnyPermission(user, ['manage_posts', 'delete_posts', 'edit_posts', 'create_posts']);
  if (isSuperAdmin(user) || hasPermission(user, 'manage_posts')) return true;
  if (Number(post.author_id) !== Number(user.id)) return false;
  if (hasPermission(user, 'delete_posts')) return true;
  if (hasAnyPermission(user, ['edit_posts', 'create_posts'])) {
    return post.status === 'draft';
  }
  return false;
}

function canEditPage(user, page) {
  if (!page) return hasPermission(user, 'manage_pages');
  return hasPermission(user, 'manage_pages');
}

function canDeletePage(user, page) {
  return canEditPage(user, page);
}

function canEditMedia(user, media) {
  if (!media) return hasAnyPermission(user, ['manage_media', 'upload_media']);
  if (hasPermission(user, 'manage_media')) return true;
  if (hasPermission(user, 'upload_media')) {
    return Number(media.uploaded_by) === Number(user.id);
  }
  return false;
}

function canDeleteMedia(user, media) {
  return canEditMedia(user, media);
}

function canEditComment(user, comment = null) {
  return hasPermission(user, 'manage_comments');
}

function canManageUser(currentUser, targetUser) {
  if (!hasPermission(currentUser, 'manage_users')) return false;
  if (isSuperAdmin(currentUser)) return true;
  if (isSuperAdmin(targetUser)) return false;
  return true;
}

function canAssignRole(currentUser, roleSlug) {
  if (!hasPermission(currentUser, 'manage_users') && !hasPermission(currentUser, 'manage_roles')) return false;
  if (isSuperAdmin(currentUser)) return true;
  if (roleSlug === 'super-admin') return false;
  return true;
}

function canManagePlugin(user, plugin = null) {
  return hasPermission(user, 'manage_plugins');
}

function canManageTheme(user, theme = null) {
  return hasPermission(user, 'manage_themes');
}

function canAccessAdmin(user, path = '') {
  if (!user) return false;
  if (isSubscriber(user)) {
    return path === '/profile' || path.startsWith('/profile/') || path === '/logout';
  }
  return hasPermission(user, 'view_dashboard') || hasAnyPermission(user, [
    'manage_posts', 'create_posts', 'edit_posts', 'manage_pages', 'manage_media', 'upload_media',
    'manage_comments', 'manage_users', 'manage_settings', 'manage_plugins', 'manage_themes'
  ]);
}

function canManageResource(user, resource, action, record = null) {
  if (isSuperAdmin(user)) return true;

  const permissionMap = {
    posts: {
      index: ['manage_posts', 'create_posts', 'edit_posts'],
      create: ['create_posts', 'manage_posts'],
      store: ['create_posts', 'manage_posts'],
      edit: ['edit_posts', 'manage_posts', 'create_posts'],
      update: ['edit_posts', 'manage_posts', 'create_posts'],
      destroy: ['delete_posts', 'manage_posts', 'edit_posts', 'create_posts'],
      bulk: ['delete_posts', 'manage_posts', 'edit_posts', 'create_posts']
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
      create: ['manage_media', 'upload_media'],
      store: ['manage_media', 'upload_media'],
      edit: ['manage_media', 'upload_media'],
      update: ['manage_media', 'upload_media'],
      destroy: ['manage_media', 'upload_media'],
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

  if (record && resource === 'posts') {
    if (['edit', 'update'].includes(action)) return canEditPost(user, record);
    if (['destroy', 'bulk'].includes(action)) return canDeletePost(user, record);
  }
  if (record && resource === 'pages') {
    if (['edit', 'update', 'destroy', 'bulk'].includes(action)) return canEditPage(user, record);
  }
  if (record && resource === 'media') {
    if (['edit', 'update'].includes(action)) return canEditMedia(user, record);
    if (action === 'destroy') return canDeleteMedia(user, record);
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
  getRoleSlug,
  isSuperAdmin,
  isAdmin,
  isEditor,
  isAuthor,
  isSubscriber,
  canManageResource,
  canEditPost,
  canDeletePost,
  canPublishPost,
  canEditPage,
  canDeletePage,
  canEditMedia,
  canDeleteMedia,
  canEditComment,
  canManageUser,
  canAssignRole,
  canManagePlugin,
  canManageTheme,
  canAccessAdmin
};
