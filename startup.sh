#!/usr/bin/env bash
set -uo pipefail
# ♾️ تشغيل 24/7 بدون توقف: لو سقط البوت لأي سبب يعيد تشغيله بعد 5 ثواني — للأبد
# الاستعمال: OWNER_CODE="كودك" bash startup.sh
# (كود المالك = كلمة سر my-system.html — الافتراضي 1234، غيّره!)
cd "$(dirname "$0")"
export MODE="${MODE:-paper}" PORT="${PORT:-8787}"
export STATE_FILE="${STATE_FILE:-./bot-state.json}"
export PRIVATE_FILE="${PRIVATE_FILE:-./private-system.json}"
export OWNER_CODE="${OWNER_CODE:-1234}"
export AUTOSAVE_SEC="${AUTOSAVE_SEC:-20}"
echo "[startup] 24/7 loop — OWNER_CODE protection ON, state=$STATE_FILE priv=$PRIVATE_FILE"
while true; do
  node bot-server.js
  code=$?
  echo "[startup] exited code=$code — restart in 5s..."
  sleep 5
done
