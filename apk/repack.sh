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
[ -f "$ROOT/icon-192.png" ] && cp "$ROOT/icon-192.png" "$WORK/base/assets/www/icon-192.png"
# اسم التطبيق المعروض
APP_LABEL="${APP_LABEL:-TRAININGV8 Premium}"
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
