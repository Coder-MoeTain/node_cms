const notFoundMiddleware = require('../middleware/notFound');
const errorHandler = require('../middleware/errorHandler');
const { can, canAny, canResource } = require('../middleware/permission');

function mockRes(overrides = {}) {
  const res = {
    locals: {},
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    render: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    headersSent: false,
    ...overrides
  };
  return res;
}

test('permission can allows user with matching permission', () => {
  const req = { session: { user: { permissions: ['manage_posts'] } }, flash: jest.fn() };
  const res = mockRes();
  const next = jest.fn();
  can('manage_posts')(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('permission can redirects unauthorized users', () => {
  const req = { session: { user: { permissions: [] } }, flash: jest.fn() };
  const res = mockRes();
  const next = jest.fn();
  can('manage_posts')(req, res, next);
  expect(res.redirect).toHaveBeenCalledWith('/admin/profile');
  expect(next).not.toHaveBeenCalled();
});

test('permission canAny passes when one permission matches', () => {
  const req = { session: { user: { permissions: ['create_posts'] } }, flash: jest.fn() };
  const res = mockRes();
  const next = jest.fn();
  canAny(['manage_posts', 'create_posts'])(req, res, next);
  expect(next).toHaveBeenCalled();
});

test('permission canResource blocks author from categories', () => {
  const req = { session: { user: { permissions: ['create_posts', 'edit_posts'] } }, flash: jest.fn() };
  const res = mockRes();
  const next = jest.fn();
  canResource('categories', 'index')(req, res, next);
  expect(res.redirect).toHaveBeenCalled();
});

test('notFound returns JSON for API routes', () => {
  const req = { originalUrl: '/api/missing' };
  const res = mockRes();
  notFoundMiddleware(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith({ message: 'Route not found' });
});

test('notFound renders HTML for public routes', () => {
  const req = { originalUrl: '/missing-page' };
  const res = mockRes({ locals: {} });
  notFoundMiddleware(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.render).toHaveBeenCalled();
});

test('errorHandler returns JSON for API errors', () => {
  const req = { originalUrl: '/api/posts', method: 'GET', ip: '127.0.0.1' };
  const res = mockRes();
  const next = jest.fn();
  errorHandler(new Error('boom'), req, res, next);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ message: 'boom' });
});

test('errorHandler maps CSRF errors to 403', () => {
  const req = { originalUrl: '/contact', method: 'POST', ip: '127.0.0.1' };
  const res = mockRes();
  const next = jest.fn();
  const error = new Error('invalid csrf token');
  error.code = 'EBADCSRFTOKEN';
  errorHandler(error, req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
});
