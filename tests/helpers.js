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

module.exports = { getCsrf, login };
