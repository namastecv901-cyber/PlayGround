#!/usr/bin/env bash
# يعيد تغليف التطبيق: يحقن أحدث index.html والأيقونة داخل القالب ثم يوقّع بنفس المفتاح دائماً
# الاستخدام: ./apk/repack.sh [output.apk]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/bataqa-wahida.apk}"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
BT="$SDK/build-tools/35.0.0"
[ -x "$BT/apksigner" ] || BT="$(ls -d "$SDK"/build-tools/*/ | sort -V | tail -n1)"
[ -x "$BT/apksigner" ] || { echo "apksigner not found"; exit 1; }
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
unzip -oq "$ROOT/apk/base.apk" -d "$WORK/base"
cp "$ROOT/index.html" "$WORK/base/assets/www/index.html"
# 📡 خبز تنبيه المالك داخل النسخة: أي زائر يدخل اسمه في أي هاتف يصل المالك تلقائياً
# المصدر: apk/alert.conf (سطر BOT=... و CHAT=...) أو متغيرات البيئة OWNER_BOT / OWNER_CHAT — الملف مستثنى من git
ALERT_CONF="$ROOT/apk/alert.conf"
ABOT="${OWNER_BOT:-}"; ACHAT="${OWNER_CHAT:-}"
if [ -f "$ALERT_CONF" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ALERT_CONF"; set +a
  [ -z "${ABOT:-}" ] && ABOT="${BOT:-}"; [ -z "${ACHAT:-}" ] && ACHAT="${CHAT:-}"
fi
if [ -n "${ABOT:-}" ] && [ -n "${ACHAT:-}" ]; then
  python3 - "$WORK/base/assets/www/index.html" "$ABOT" "$ACHAT" <<'PYEOF'
import json,sys
p,bot,chat=sys.argv[1],sys.argv[2],sys.argv[3]
t=open(p,encoding='utf-8').read()
mark='/*__OWNER_ALERT__*/window.OWNER_ALERT=null;'
assert mark in t, 'alert marker missing'
t=t.replace(mark,'/*__OWNER_ALERT__*/window.OWNER_ALERT='+json.dumps({'bot':bot,'chat':chat},ensure_ascii=False)+';',1)
open(p,'w',encoding='utf-8').write(t)
print('alert baked OK')
PYEOF
else
  echo "alert skipped (no OWNER_BOT/OWNER_CHAT or apk/alert.conf)"
fi
# 📣 خبز سيرفر القناة: الأحداث تُرسل عبر السيرفر فقط (المفتاح لا يُرفع أبداً)
# المصدر: apk/srv.conf (سطر URL=... و KEY=...) أو متغيرات البيئة SRV_URL / SRV_KEY — الملف مستثنى من git
SRV_CONF="$ROOT/apk/srv.conf"
SURL="${SRV_URL:-}"; SKEY="${SRV_KEY:-}"
if [ -f "$SRV_CONF" ]; then
  # shellcheck disable=SC1090
  set -a; . "$SRV_CONF"; set +a
  [ -z "${SURL:-}" ] && SURL="${URL:-}"; [ -z "${SKEY:-}" ] && SKEY="${KEY:-}"
fi
if [ -n "${SURL:-}" ] && [ -n "${SKEY:-}" ]; then
  python3 - "$WORK/base/assets/www/index.html" "$SURL" "$SKEY" <<'PYEOF'
import json,sys
p,url,key=sys.argv[1],sys.argv[2],sys.argv[3]
t=open(p,encoding='utf-8').read()
mark='/*__SRV__*/window.SRV=null;'
assert mark in t, 'srv marker missing'
t=t.replace(mark,'/*__SRV__*/window.SRV='+json.dumps({'url':url,'key':key},ensure_ascii=False)+';',1)
open(p,'w',encoding='utf-8').write(t)
print('srv baked OK')
PYEOF
else
  echo "srv skipped (no SRV_URL/SRV_KEY or apk/srv.conf)"
fi
[ -f "$ROOT/icon-192.png" ] && cp "$ROOT/icon-192.png" "$WORK/base/assets/www/icon-192.png"
# اسم التطبيق المعروض
APP_LABEL="${APP_LABEL:-فريم الدقيقة + بوت}"
python3 "$ROOT/apk/patch_arsc.py" "$WORK/base/resources.arsc" "بطاقة واحدة" "$APP_LABEL" "$WORK/base/resources.arsc"
rm -rf "$WORK/base/META-INF"
rm -f "$OUT"
(
  cd "$WORK/base"
  zip -qr "$WORK/unsigned.apk" AndroidManifest.xml classes.dex resources.arsc assets res
)
"$BT/zipalign" -f 4 "$WORK/unsigned.apk" "$WORK/aligned.apk"
"$BT/apksigner" sign --ks "$ROOT/apk/release.jks" --ks-pass pass:android123 --key-pass pass:android123 --out "$OUT" "$WORK/aligned.apk"
"$BT/apksigner" verify "$OUT" && echo "OK -> $OUT"
