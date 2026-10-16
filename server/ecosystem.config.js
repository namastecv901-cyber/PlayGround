// pm2: تشغيل دائم 24/7 مع إعادة تشغيل تلقائية عند أي عطل
// التشغيل: pm2 start server/ecosystem.config.js && pm2 save && pm2 startup
// كود المالك = كلمة سر my-system.html (غيّره!): OWNER_CODE="كودك"
// كل شيء في نظامك يُحفظ في PRIVATE_FILE ويبقى حتى بعد خروجك ودخولك
module.exports = {
  apps: [{
    name: 'tradebot',
    script: './bot-server.js',
    cwd: __dirname + '/..',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 1000,
    min_uptime: '10s',
    restart_delay: 3000,
    exp_backoff_restart_delay: 100,
    max_memory_restart: '400M',
    kill_timeout: 5000,
    listen_timeout: 5000,
    out_file: './bot-out.log',
    error_file: './bot-err.log',
    time: true,
    env: {
      MODE: 'paper',
      STAKE_USD: '20',
      TP_USD: '0.7',
      MIN_TP_USD: '0.3',
      MAX_TRADES: '3',
      DAILY_MAX_LOSS: '10',
      DAILY_GOAL_USD: '10',
      EQUITY_START: '100',
      POLL_SEC: '60',
      PORT: '8787',
      STATE_FILE: './bot-state.json',
      PRIVATE_FILE: './private-system.json',
      OWNER_CODE: '1234',
      AUTOSAVE_SEC: '20',
    },
  }],
};
