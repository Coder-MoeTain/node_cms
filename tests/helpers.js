const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { publicUploadPath } = require('../utils/fileHelper');

const TEST_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function writeTestUpload(filePath) {
  const relative = String(filePath || '').replace(/^\/uploads\//, '');
  const diskPath = publicUploadPath(relative);
  fs.mkdirSync(path.dirname(diskPath), { recursive: true });
  fs.writeFileSync(diskPath, TEST_IMAGE);
  return `/uploads/${relative.replace(/\\/g, '/')}`;
}

function removeTestUpload(filePath) {
  const relative = String(filePath || '').replace(/^\/uploads\//, '');
  const diskPath = publicUploadPath(relative);
  if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
}

async function getCsrf(agent, url) {
  let page = await agent.get(url);
  if (page.status === 302 && page.headers.location) {
    page = await agent.get(page.headers.location);
  }
  const match = page.text.match(/name="_csrf" value="([^"]+)"/);
  const token = match?.[1] || '';
  if (!token) {
    throw new Error(`CSRF token not found on ${url} (status ${page.status})`);
  }
  return token;
}

/** POST urlencoded form with CSRF in query, body, and header (matches multipart admin forms). */
async function postForm(agent, url, fields, csrfPageUrl) {
  const csrf = await getCsrf(agent, csrfPageUrl || url);
  const separator = url.includes('?') ? '&' : '?';
  return agent
    .post(`${url}${separator}_csrf=${encodeURIComponent(csrf)}`)
    .set('X-CSRF-Token', csrf)
    .type('form')
    .send({ ...fields, _csrf: csrf });
}

async function putForm(agent, url, fields, csrfPageUrl) {
  const editUrl = csrfPageUrl || `${url.replace(/\?.*$/, '')}/edit`;
  const csrf = await getCsrf(agent, editUrl);
  const separator = url.includes('?') ? '&' : '?';
  return agent
    .put(`${url}${separator}_csrf=${encodeURIComponent(csrf)}`)
    .set('X-CSRF-Token', csrf)
    .type('form')
    .send({ ...fields, _csrf: csrf });
}

async function logout(agent) {
  const csrf = await getCsrf(agent, '/admin');
  return agent.post('/admin/logout').type('form').send({ _csrf: csrf });
}

async function login(agent, email, password, totp) {
  const adminLoginPath = require('../utils/adminLoginPath');
  const loginUrl = await adminLoginPath.getLoginUrl();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const csrf = await getCsrf(agent, loginUrl);
    const payload = { email, password, _csrf: csrf };
    if (totp) payload.totp = totp;
    const response = await agent.post(loginUrl).type('form').send(payload);
    const location = String(response.headers.location || '');
    if (response.status === 302 && !location.includes(loginUrl)) {
      return response;
    }
  }
  throw new Error(`Login failed for ${email}`);
}

function getAgentSessionId(agent) {
  const appConfig = require('../config/app');
  const cookieName = appConfig.sessionName;
  const cookieString = typeof agent.jar.getCookieStringSync === 'function'
    ? agent.jar.getCookieStringSync('http://127.0.0.1/')
    : '';
  if (!cookieString) return null;
  const prefix = `${cookieName}=`;
  const match = cookieString.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!match) return null;
  let value = decodeURIComponent(match.slice(prefix.length));
  if (value.startsWith('s:')) {
    value = value.slice(2);
    const dot = value.indexOf('.');
    if (dot >= 0) value = value.slice(0, dot);
  }
  return value;
}

async function ensurePortalTheme(models, portalConfig) {
  const { buildPortalConfigBlock } = require('../utils/portalConfig');
  await models.ThemeSetting.findOrCreate({
    where: { theme_name: 'classic-blog' },
    defaults: { theme_name: 'classic-blog', active: false, header_layout: 'standard' }
  });
  await models.ThemeSetting.update({ active: false }, { where: {} });
  const [updated] = await models.ThemeSetting.update({
    active: true,
    header_layout: 'portal',
    primary_color: '#0b5f8a',
    secondary_color: '#f4b000',
    custom_css: buildPortalConfigBlock(portalConfig)
  }, { where: { theme_name: 'classic-blog' } });
  if (!updated) {
    throw new Error('Failed to activate portal theme for tests.');
  }
  const active = await models.ThemeSetting.findOne({ where: { active: true } });
  if (!active || active.header_layout !== 'portal') {
    throw new Error(`Portal theme not active (layout=${active?.header_layout || 'none'}).`);
  }
  return active;
}

module.exports = { getCsrf, postForm, putForm, login, logout, getAgentSessionId, ensurePortalTheme, TEST_IMAGE, writeTestUpload, removeTestUpload };
