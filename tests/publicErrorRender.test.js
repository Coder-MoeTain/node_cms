const request = require('supertest');
const { renderPublicError, isPortalLayout } = require('../utils/publicErrorRender');
const { app, models } = require('../server');
const { ensureStandardTheme } = require('./helpers');

describe('publicErrorRender', () => {
  test('isPortalLayout detects portal theme locals', () => {
    const res = { locals: { activeTheme: { header_layout: 'portal' } } };
    expect(isPortalLayout(res)).toBe(true);
    expect(isPortalLayout({ locals: {} })).toBe(false);
  });

  test('renderPublicError renders themed error view', async () => {
    const render = jest.fn().mockReturnValue(undefined);
    const res = {
      locals: { activeTheme: { slug: 'classic-blog' } },
      status: jest.fn().mockReturnThis(),
      render
    };
    await renderPublicError(res, { title: 'Missing', code: 404, message: 'Gone' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(render).toHaveBeenCalled();
    const locals = render.mock.calls[0][1];
    expect(locals.message).toBe('Gone');
    expect(locals.isPortal).toBe(false);
  });
});

describe('Public 404 routes', () => {
  beforeAll(async () => {
    await ensureStandardTheme(models);
  });

  test('unknown route returns 404 with standard theme layout', async () => {
    const res = await request(app).get('/this-route-does-not-exist-np-verify');
    expect(res.status).toBe(404);
    expect(res.text).toMatch(/404|Page Not Found|could not be found/i);
    expect(res.text).toMatch(/site-main|Return home/i);
  });

  test('FSE 404 template renders when active', async () => {
    const blocks = [{ type: 'heading', content: 'FSE 404 Verify Heading', attrs: { level: 1 } }];
    const [row] = await models.SiteTemplate.findOrCreate({
      where: { slug: 'fse-404-verify', theme_slug: 'classic-blog' },
      defaults: {
        name: 'FSE 404 Verify',
        template_type: '404',
        block_content_json: JSON.stringify(blocks),
        status: 'active'
      }
    });
    await row.update({ block_content_json: JSON.stringify(blocks), status: 'active', template_type: '404' });
    const res = await request(app).get('/missing-fse-404-verify-route');
    expect(res.status).toBe(404);
    expect(res.text).toMatch(/FSE 404 Verify Heading/);
  });

  afterAll(async () => {
    await models.SiteTemplate.update({ status: 'inactive' }, { where: { slug: 'fse-404-verify' } });
  });
});
