const request = require('supertest');

async function getCsrf(agent, url) {
  const page = await agent.get(url);
  const match = page.text.match(/name="_csrf" value="([^"]+)"/);
  return match?.[1] || '';
}

async function login(agent, email, password) {
  const csrf = await getCsrf(agent, '/admin/login');
  return agent
    .post('/admin/login')
    .type('form')
    .send({ email, password, _csrf: csrf });
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

module.exports = { getCsrf, login, ensurePortalTheme };
