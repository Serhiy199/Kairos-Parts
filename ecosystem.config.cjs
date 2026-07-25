module.exports = {
  apps: [
    {
      name: 'kairos-web',
      cwd: '/var/www/kairos-parts/current',
      script: 'npm',
      args: 'start -- -H 127.0.0.1 -p 3000',

      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false,
      max_memory_restart: '1500M',
      restart_delay: 3000,

      env: {
        NODE_ENV: 'production'
      },

      out_file: '/var/www/kairos-parts/logs/web-out.log',
      error_file: '/var/www/kairos-parts/logs/web-error.log',
      merge_logs: true,
      time: true
    }
  ]
};
