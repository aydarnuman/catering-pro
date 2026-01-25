/**
 * PM2 Ecosystem Configuration
 * Production deployment için process manager yapılandırması
 * 
 * Kullanım:
 *   pm2 start ecosystem.config.js
 *   pm2 restart all
 *   pm2 stop all
 *   pm2 logs
 */

module.exports = {
  apps: [
    {
      name: 'catering-backend',
      script: './backend/src/server.js',
      cwd: './',
      instances: 1, // Cluster mode için: 'max' veya sayı
      exec_mode: 'fork', // 'fork' veya 'cluster'
      watch: false, // Production'da false
      max_memory_restart: '500M', // 500MB'da restart
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/pm2-backend-error.log',
      out_file: './logs/pm2-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000,
    },
    {
      name: 'catering-frontend',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M', // 300MB'da restart
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-frontend-error.log',
      out_file: './logs/pm2-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000,
    },
  ],
};
