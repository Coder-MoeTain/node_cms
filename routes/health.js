const express = require('express');
const sequelize = require('../config/database');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

router.get('/ready', async (req, res) => {
  try {
    await sequelize.authenticate();
    return res.json({ status: 'ready', database: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(503).json({ status: 'not_ready', database: 'error' });
  }
});

module.exports = router;
