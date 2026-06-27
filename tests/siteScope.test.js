const { Op } = require('sequelize');
const appConfig = require('../config/app');
const {
  getCurrentSiteId,
  isMultisiteActive,
  siteScopeWhere,
  siteScopeStrictWhere,
  assignSiteScope,
  isSiteScopedModel
} = require('../utils/siteScope');

describe('siteScope helpers', () => {
  const originalMultisite = appConfig.multisiteEnabled;

  afterEach(() => {
    appConfig.multisiteEnabled = originalMultisite;
  });

  test('siteScopeWhere is a no-op when multisite is disabled', () => {
    appConfig.multisiteEnabled = false;
    const req = { currentSite: { id: 9 } };
    expect(siteScopeWhere(req, { status: 'published' })).toEqual({ status: 'published' });
    expect(assignSiteScope(req, { title: 'A' })).toEqual({ title: 'A' });
    expect(isMultisiteActive(req)).toBe(false);
  });

  test('siteScopeWhere filters by current site and legacy null rows', () => {
    appConfig.multisiteEnabled = true;
    const req = { currentSite: { id: 4 } };
    const where = siteScopeWhere(req, { status: 'published' });
    expect(where[Op.and]).toBeTruthy();
    expect(where[Op.and][0]).toEqual({ status: 'published' });
    expect(getCurrentSiteId(req)).toBe(4);
    expect(isMultisiteActive(req)).toBe(true);
    expect(assignSiteScope(req, { title: 'Scoped' })).toEqual({ title: 'Scoped', site_id: 4 });
  });

  test('siteScopeStrictWhere requires exact site id', () => {
    appConfig.multisiteEnabled = true;
    const req = { currentSite: { id: 2 } };
    expect(siteScopeStrictWhere(req, { slug: 'news' })).toEqual({ slug: 'news', site_id: 2 });
  });

  test('isSiteScopedModel recognizes scoped models', () => {
    expect(isSiteScopedModel({ name: 'Post' })).toBe(true);
    expect(isSiteScopedModel({ name: 'Tag' })).toBe(true);
    expect(isSiteScopedModel({ name: 'CustomPostType' })).toBe(true);
    expect(isSiteScopedModel({ name: 'FieldGroup' })).toBe(true);
    expect(isSiteScopedModel({ name: 'WidgetInstance' })).toBe(true);
    expect(isSiteScopedModel({ name: 'Role' })).toBe(false);
  });
});
