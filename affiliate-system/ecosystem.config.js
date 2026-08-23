/**
 * Phase 5 — the ONE canonical production launch path:
 *
 *   npm install  ->  npm run build  ->  pm2 startOrReload ecosystem.config.js
 *
 * Architecture: Windows Server → PM2 (fork, single instance) → next start
 *               → Cloudflare Tunnel → public internet.
 *
 * Single instance is REQUIRED while the app runs on SQLite (WAL allows one
 * writer; a second process would contend). Revisit only together with the
 * PostgreSQL migration.
 */
module.exports = {
  apps: [
    {
      name: "affiliate-system",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "1G",
      restart_delay: 3000,
      max_restarts: 20,
      time: true,
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      merge_logs: true,
    },
  ],
}
