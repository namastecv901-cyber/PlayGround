#!/usr/bin/env bash
# تشغيل 24/7: ضع الأسرار في البيئة أو ملف 0600، لا تكتبها في هذا الملف.
# مثال: set -a; . /etc/tradebot.env; set +a; ./run-bot-24-7.sh
set -u
umask 077
cd "$(dirname "$0")"
trap 'echo "stopped by user"; exit 0' INT TERM
while true; do
  node bot-server.js
  code=$?
  echo "bot-server exited ($code) — restarting in 5s"
  sleep 5
done
