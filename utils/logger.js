const fs = require('fs');
const path = require('path');
const winston = require('winston');

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${extra}`;
      })
    )
  })
];

if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'app-error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'nodepress-cms' },
  transports
});

module.exports = logger;
