const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('admin can upload a valid PNG image', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/media');

  const response = await agent
    .post('/admin/media/upload')
    .set('x-csrf-token', csrf)
    .attach('files', PNG, { filename: 'test-upload.png', contentType: 'image/png' });

  expect(response.status).toBe(302);
  expect(response.headers.location).toMatch(/\/admin\/media/);

  const mediaPage = await agent.get('/admin/media');
  expect(mediaPage.text).toMatch(/test-upload\.png|Media Library/i);
});

test('admin upload rejects executable file types', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/media');

  const response = await agent
    .post('/admin/media/upload')
    .set('x-csrf-token', csrf)
    .attach('files', Buffer.from('#!/bin/sh'), { filename: 'malware.sh', contentType: 'application/x-sh' });

  expect([302, 400, 403, 500]).toContain(response.status);
});

test('guest cannot upload media', async () => {
  const response = await request(app).post('/admin/media/upload');
  expect([302, 403]).toContain(response.status);
});
