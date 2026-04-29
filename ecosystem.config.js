module.exports = {
  apps: [
    {
      name: 'avera-master-backend',
      script: 'dist/index.js',
      cwd: '/www/wwwroot/master-backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
