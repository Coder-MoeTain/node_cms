const policy = require('../utils/policy');

const author = { id: 2, Role: { slug: 'author' }, permissions: ['create_posts', 'edit_posts', 'upload_media'] };
const editor = { id: 3, Role: { slug: 'editor' }, permissions: ['manage_posts', 'publish_posts', 'delete_posts'] };
const admin = { id: 1, Role: { slug: 'admin' }, permissions: ['manage_posts', 'manage_media', 'manage_categories'] };

const ownPost = { id: 10, author_id: 2 };
const otherPost = { id: 11, author_id: 99 };
const ownMedia = { id: 5, uploaded_by: 2 };
const otherMedia = { id: 6, uploaded_by: 99 };

test('authors can edit own posts but not others', () => {
  expect(policy.canEditPost(author, ownPost)).toBe(true);
  expect(policy.canEditPost(author, otherPost)).toBe(false);
});

test('editors with manage_posts can edit any post', () => {
  expect(policy.canEditPost(editor, otherPost)).toBe(true);
});

test('delete requires ownership unless manage_posts', () => {
  expect(policy.canDeletePost(author, ownPost)).toBe(false);
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
