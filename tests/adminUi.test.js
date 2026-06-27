const request = require('supertest');
const { app, models } = require('../server');
const { login } = require('./helpers');

describe('admin UI upgrade', () => {
  test('admin login page loads', async () => {
    const response = await request(app).get('/admin/login');
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/login|sign in/i);
  });

  test('dashboard includes design system assets, onboarding, and admin search script', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const response = await agent.get('/admin');
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/admin-design-system\.css/);
    expect(response.text).toMatch(/admin-search\.js/);
    expect(response.text).toMatch(/At a Glance/);
    expect(response.text).toMatch(/data-admin-search/);
    expect(response.text).toMatch(/admin-sidebar|admin-nav/);
    expect(response.text).toMatch(/Welcome to NodePress|dashboard-onboarding/);
  });

  test('admin search script includes extended destinations', async () => {
    const fs = require('fs');
    const path = require('path');
    const script = fs.readFileSync(path.join(process.cwd(), 'public/js/admin-search.js'), 'utf8');
    expect(script).toMatch(/custom-post-types/);
    expect(script).toMatch(/field-groups/);
    expect(script).toMatch(/taxonomies/);
  });

  test('posts list includes mobile card fallback markup', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const response = await agent.get('/admin/posts');
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/np-list-mobile-cards/);
    expect(response.text).toMatch(/np-subsub/);
  });

  test('customizer includes design token controls', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const response = await agent.get('/admin/themes/customize');
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/Design tokens/);
  });
});
