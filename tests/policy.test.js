const policy = require('../utils/policy');

const author = { id: 2, Role: { slug: 'author' }, permissions: ['create_posts', 'edit_posts', 'upload_media'] };
const editor = { id: 3, Role: { slug: 'editor' }, permissions: ['manage_posts', 'publish_posts', 'delete_posts'] };
const admin = { id: 1, Role: { slug: 'admin' }, permissions: ['manage_posts', 'manage_media', 'manage_categories', 'manage_users', 'manage_plugins', 'manage_themes'] };
const subscriber = { id: 4, Role: { slug: 'subscriber' }, permissions: [] };

const ownDraft = { id: 10, author_id: 2, status: 'draft' };
const ownPublished = { id: 12, author_id: 2, status: 'published' };
const otherPost = { id: 11, author_id: 99, status: 'draft' };
const ownMedia = { id: 5, uploaded_by: 2 };
const otherMedia = { id: 6, uploaded_by: 99 };

test('authors can edit own posts but not others', () => {
  expect(policy.canEditPost(author, ownDraft)).toBe(true);
  expect(policy.canEditPost(author, otherPost)).toBe(false);
});

test('editors with manage_posts can edit any post', () => {
  expect(policy.canEditPost(editor, otherPost)).toBe(true);
});

test('authors can delete own drafts only without delete_posts', () => {
  expect(policy.canDeletePost(author, ownDraft)).toBe(true);
  expect(policy.canDeletePost(author, ownPublished)).toBe(false);
  expect(policy.canDeletePost(author, otherPost)).toBe(false);
});

test('editors with delete_posts can delete any post', () => {
  expect(policy.canDeletePost(editor, otherPost)).toBe(true);
});

test('publish_posts gate works', () => {
  expect(policy.canPublishPost(author)).toBe(false);
  expect(policy.canPublishPost(editor)).toBe(true);
});

test('media ownership rules', () => {
  expect(policy.canEditMedia(author, ownMedia)).toBe(true);
  expect(policy.canEditMedia(author, otherMedia)).toBe(false);
  expect(policy.canEditMedia(admin, otherMedia)).toBe(true);
});

test('resource permissions use dedicated slugs', () => {
  expect(policy.canManageResource(admin, 'categories', 'index')).toBe(true);
  expect(policy.canManageResource(author, 'categories', 'index')).toBe(false);
  expect(policy.canManageResource(author, 'posts', 'create')).toBe(true);
});

test('bulk trash respects post ownership', () => {
  expect(policy.canManageResource(editor, 'posts', 'bulk', otherPost)).toBe(true);
  expect(policy.canManageResource(author, 'posts', 'bulk', otherPost)).toBe(false);
  expect(policy.canManageResource(author, 'posts', 'bulk', ownDraft)).toBe(true);
});

test('admin cannot manage super admin user', () => {
  const adminUser = { id: 5, Role: { slug: 'admin' }, permissions: ['manage_users'] };
  const superAdmin = { id: 1, Role: { slug: 'super-admin' }, permissions: [] };
  expect(policy.canManageUser(adminUser, superAdmin)).toBe(false);
});

test('super admin can manage other users', () => {
  const superAdmin = { id: 1, Role: { slug: 'super-admin' }, permissions: [] };
  const regular = { id: 10, Role: { slug: 'author' }, permissions: [] };
  expect(policy.canManageUser(superAdmin, regular)).toBe(true);
});

test('canManagePlugin and canManageTheme require dedicated permissions', () => {
  expect(policy.canManagePlugin(admin)).toBe(true);
  expect(policy.canManagePlugin(editor)).toBe(false);
  expect(policy.canManageTheme(admin)).toBe(true);
  expect(policy.canManageTheme(editor)).toBe(false);
});

test('canAssignRole blocks non-super-admin from assigning super-admin', () => {
  expect(policy.canAssignRole(admin, 'editor')).toBe(true);
  expect(policy.canAssignRole(admin, 'super-admin')).toBe(false);
  expect(policy.canAssignRole({ id: 1, Role: { slug: 'super-admin' }, permissions: ['manage_users'] }, 'super-admin')).toBe(true);
});

test('subscribers cannot access admin except profile routes', () => {
  expect(policy.canAccessAdmin(subscriber, '/profile')).toBe(true);
  expect(policy.canAccessAdmin(subscriber, '/posts')).toBe(false);
  expect(policy.canAccessAdmin(author, '/posts')).toBe(true);
});

test('role helpers identify roles', () => {
  expect(policy.isAuthor(author)).toBe(true);
  expect(policy.isSubscriber(subscriber)).toBe(true);
  expect(policy.isEditor(editor)).toBe(true);
});
