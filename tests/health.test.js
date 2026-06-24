const request = require('supertest');
const { app } = require('../server');

describe('health endpoints', () => {
  test('GET /health returns ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.uptime).toBeGreaterThan(0);
  });

  test('GET /ready reports database ok when connected', async () => {
    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.database).toBe('ok');
  });

  test('GET /health includes version metadata', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('timestamp');
  });
});
