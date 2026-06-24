const request = require('supertest');
const { app } = require('../server');

describe('health endpoints', () => {
  test('GET /health returns ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.uptime).toBeGreaterThan(0);
  });

  test('GET /ready reports database status', async () => {
    const response = await request(app).get('/ready');
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty('database');
  });
});
