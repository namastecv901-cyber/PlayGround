// pm2: تشغيل دائم مع إعادة تشغيل تلقائية عند أي عطل
// التشغيل: pm2 start server/ecosystem.config.js && pm2 save && pm2 startup
module.exports = {
  apps: [{
    name: 'tradebot',
    script: './bot-server.js',
    cwd: __dirname + '/..',
    instances: 1,
    autorestart: true,
    max_restarts: 100,
    min_uptime: '30s',
    restart_delay: 5000,
    out_file: './bot-out.log',
    error_file: './bot-err.log',
    time: true,
    env: {
      MODE: 'paper',
      STAKE_USD: '10',
      TP_USD: '0.7',
      MIN_TP_USD: '0.3',
      MAX_TRADES: '3',
      DAILY_MAX_LOSS: '10',
      DAILY_GOAL_USD: '10',
      EQUITY_START: '100',
      POLL_SEC: '60',
      SECURITY_MAX_STAKE_USD: '10',
      SECURITY_MAX_TRADES: '3',
      SECURITY_MAX_DAILY_LOSS: '10',
      SECURITY_REQUIRE_IP: '1',
    },
  }],
};
