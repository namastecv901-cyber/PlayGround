# 🔐 الأمان — بوت Binance Spot

## القاعدة
- لا يُسمح بالتداول الحقيقي إلا بعد نجاح فحص الصلاحيات وIP Whitelist.
- `MODE=paper` هو الافتراضي. الوضع الحقيقي لا يعمل إلا بـ `MODE=live` صراحةً.
- أول تشغيل `live` يبدأ **متوقفاً** (`enabled=false`) حتى ترسل `/control start` أو تضغط «تشغيل البوت» في واجهة 24/7.
- استخدم ملف حالة منفصلاً لكل وضع: `STATE_FILE=/var/lib/tradebot/live-state.json` للحي، وملفاً آخر للتجريبي.
- البوت يستخدم Binance API الرسمي فقط. في `live` يجب أن يكون `BASE_URL=https://api.binance.com`.
- البوت لا ينفّذ سحبًا أو تحويلًا خارجيًا، ومسارات مثل `withdraw` و`asset/transfer` مرفوضة برمجيًا.
- لا Margin ولا Futures؛ المفتاح يجب أن يكون Spot فقط.

## إعداد مفتاح API
1. أنشئ مفتاحًا جديدًا من Binance → API Management.
2. فعّل **Enable Reading** و**Enable Spot & Margin Trading** فقط إذا كنت تحتاج التداول الفوري. لا تفعّل السحب أو التحويل الداخلي أو Futures أو Margin أو Options.
3. فعّل **Restrict access to trusted IPs only** وأضف عنوان IP الثابت للسيرفر. البوت يرفض المفتاح إذا لم يكن `ipRestrict=true`.
4. لا تضع المفتاح في الكود أو `index.html` أو Git. استخدم متغيرات البيئة أو Secret Manager.
   ```bash
   export MODE=live
   export BINANCE_KEY='...'
   export BINANCE_SECRET='...'
   export SIGNAL_SECRET='مفتاح-تحكم-طويل-عشوائي'
   ```
5. شغّل السيرفر خلف جهاز موثوق، ولا تفتح منفذ التحكم للإنترنت دون HTTPS/جدار ناري.
6. عيّن `SIGNAL_SECRET` دائماً عند فتح واجهة السيرفر من متصفح. الطلبات من أصل غير محلي مرفوضة إذا لم يوجد المفتاح، و`Origin: null` مرفوض ما لم يوجد `SIGNAL_SECRET` صحيح.

## حدود التداول الإلزامية
```bash
SECURITY_MAX_STAKE_USD=10      # أقصى مبلغ لكل صفقة (افتراضي 10)
SECURITY_MAX_TRADES=3          # أقصى صفقات مفتوحة (افتراضي 3)
SECURITY_MAX_DAILY_LOSS=10     # أقصى خسارة يومية (افتراضي 10)
SECURITY_REQUIRE_IP=1          # إلزام IP Whitelist
```
- تُطبّق هذه الحدود حتى لو كانت إعدادات `STAKE_USD` أو `MAX_TRADES` أو `DAILY_MAX_LOSS` أكبر.
- عند بلوغ خسارة اليوم: يتوقف الشراء ويُقفل حتى اليوم التالي UTC.
- عند بلوغ ربح اليوم `$10`: يغلق الصفقات، ينقل الربح إلى المخزن المحاسبي، ويتوقف. زر التشغيل يصفّر ربح اليوم فقط.

## الواجهة المباشرة (بدون سيرفر)
- المفاتيح في `sessionStorage` فقط، وتُمسح عند إغلاق التبويب؛ لا تُكتب في `localStorage`.
- الاتصال المباشر يستخدم `https://api.binance.com` فقط، ويجري نفس فحص `apiRestrictions` وIP Whitelist.
- الجسر اختياري: localhost/شبكة خاصة أو HTTPS موثوق فقط؛ استخدم `PROXY_SECRET` عند فتح الواجهة من نطاق خارجي.
- الحدود القصوى في الواجهة: $10 للصفقة، 3 صفقات، وخسارة يومية $10. لا يمكن تجاوزها من الحقول.

## الفحص الأمني قبل التشغيل
- يُستدعى `GET /sapi/v1/account/apiRestrictions`، ويُرفض المفتاح إذا كان:
  - `enableWithdrawals=true`
  - `enableInternalTransfer=true`
  - `enableMargin=true` أو `enableFutures=true` أو `enableVanillaOptions=true`
  - `enableReading != true` أو `enableSpotAndMarginTrading != true`
  - `ipRestrict != true` (ما لم يُعطّل الفحص صراحةً في بيئة اختبار)
- الفشل = **قفل أمان**: إيقاف الشراء، حفظ السبب، وتنبيه Telegram دون أسرار.
- `SECURITY_SKIP_PRECHECK=1` مسموح للاختبار فقط (`paper`/`testnet`)، ويُرفض في `live`.

## منع التكرار والتحقق قبل الشراء
- صفقة واحدة لكل رمز، وفحص الصفقات المفتوحة والأوامر المفتوحة (`/api/v3/openOrders`).
- `newClientOrderId` لكل أمر، والتحقق من `executedQty` و`cummulativeQuoteQty`.
- فحص رصيد USDT الحر والحد الأدنى `minNotional` قبل الإرسال.
- إعادة المحاولة عند غموض الشبكة لا تنشئ أمرًا ثانيًا؛ تُستعلم حالة الأمر بنفس المعرّف.

## الإيقاف الطارئ
- الواجهة: زر **🛑 إيقاف طارئ (منع الشراء)**.
- السيرفر: `POST /control` مع `{"action":"stop"}` يمنع أي شراء جديد، مع إدارة الصفقات المفتوحة.
- `closeall` يبيع الصفقات المفتوحة، لكنه لا يمسح قفل الأمان.

## الجسر المحلي CORS
- شغّله فقط على جهازك:
  ```bash
  PROXY_ONLY=1 PROXY_SECRET='مفتاح-قوي' node bot-server.js
  ```
- ضع `PROXY_SECRET` في الواجهة. الجسر يرفض المسارات غير المسموحة، ولا يسجل المفاتيح.
- الواجهة المستضافة على نطاق خارجي تحتاج `PROXY_SECRET` للجسر، و`SIGNAL_SECRET` للتحكم بالسيرفر. لا تعرض الجسر للإنترنت دون HTTPS.
- لا ترسل المفاتيح إلى جسر عام أو خادم خارجي غير موثوق. الواجهة تسمح بجسر localhost/شبكة خاصة أو HTTPS فقط.

## السجلات وTelegram
- لا تُسجل المفاتيح أو التوقيعات أو ترويسات المصادقة.
- تُنقّى رسائل الأخطاء والتنبيهات من أي نمط يشبه مفتاحًا/توقيعًا قبل العرض أو الإرسال.

## إلغاء المفتاح فورًا عند الاشتباه
1. Binance → API Management → اختر المفتاح → **Delete/Disable** فورًا.
2. أوقف السيرفر: `Ctrl+C` أو أوقف خدمة `run-bot-24-7.sh`.
3. أنشئ مفتاحًا جديدًا بصلاحيات Spot فقط + IP Whitelist، ولا تعِد استخدام القديم.
4. راجع سجل النشاط في Binance، وأغلق أي صفقات/أوامر غير معروفة.
5. امسح أي نسخة من المفتاح من `.env` أو السجلات أو نسخ الاحتياط.
6. أعد التشغيل واختبر `/state` و`/control stop` قبل التداول.

## نشر آمن
- استخدم `server/bot-server.service` كمستخدم `tradebot` غير جذري، وضع الأسرار في `/etc/tradebot.env` بصلاحيات `0600`.
- أو `server/ecosystem.config.js` مع PM2، دون كتابة المفاتيح في ملف الإعداد.
- Docker: ابنِ من جذر المشروع: `docker build -f server/Dockerfile -t tradebot .`؛ الصورة تعمل كـ `node` غير جذري وتقرأ الحدود الأمنية من البيئة.

## اختبارات
```bash
node bot-server.js --selftest
```
تتضمن اختبارات: منع مسارات السحب/التحويل، رفض صلاحيات السحب/Margin، رفض غياب IP Whitelist، سقف الصفقة، وتنقية الأسرار من السجلات.

## ملاحظة
المخزن التراكمي محاسبي داخل البوت وليس تحويل USDT فعليًا إلى محفظة أخرى. أي تحويل حقيقي يحتاج صلاحية API منفصلة وقرارًا صريحًا.
