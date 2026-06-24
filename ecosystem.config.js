module.exports = {
  apps: [
    {
      name: 'nodepress-cms',
      script: 'server.js',
      instances: process.env.WEB_CONCURRENCY || 1,
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'development',
        LOG_TO_FILE: 'false'
      },
      env_production: {
        NODE_ENV: 'production',
        LOG_TO_FILE: 'true',
        LOG_LEVEL: 'info'
      },
      max_memory_restart: '512M',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      time: true,
      kill_timeout: 5000,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ],
  deploy: {
    production: {
      user: process.env.DEPLOY_USER || 'deploy',
      host: process.env.DEPLOY_HOST || 'localhost',
      ref: 'origin/main',
      repo: process.env.DEPLOY_REPO || 'git@github.com:example/nodepress-cms.git',
      path: process.env.DEPLOY_PATH || '/var/www/nodepress-cms',
      'post-deploy': 'npm ci --omit=dev && npm run migrate && npm run pm2:reload'
    }
  }
};
