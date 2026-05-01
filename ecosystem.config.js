module.exports = {
  apps: [
    {
      name: 'avera_backend_master',
      script: 'dist/index.js',
      cwd: '/www/wwwroot/master-backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
