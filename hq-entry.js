#!/usr/bin/env node
/* 🏆 HQ ENTRY FILTER — قسم منفرد يعمل وحده (Binance Spot شراء فقط، بلا رافعة)
 *
 *  يعمل وحده:  node hq-entry.js --selftest
 *  كمكتبة:     const HQE = require('./hq-entry');
 *               const r = await HQE.hqEvaluate(sym, tick, fetchKlines, {minScore:85, riskPct:1.5, equity:100});
 *               fetchKlines(sym, interval, limit) -> مصفوفة شموع Binance
 *               tick = {lastPrice} (ticker 24hr)
 *
 *  الفريمات: يومي اتجاه → 4h بنية → 1h منطقة دخول → 15m توقيت.
 *  التقييم 100: ترند25 + BOS20 + دخول20 + حجم وزخم15 + وقف وعائد15 + مساحة5.
 *  الدخول فقط score>=minScore + كل الشروط الأساسية + بلا إلغاء.
 *  التقييم المرتفع لا يضمن الربح — يُختبر تاريخياً قبل الأموال الحقيقية.
 */
'use strict';

const DEFAULTS = { minScore: 85, riskPct: 1.5 };

function emaLast(arr, n) {
  if (!arr || arr.length < n) return null;
  const k = 2 / (n + 1);
  let e = arr.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < arr.length; i++) e = arr[i] * k + e * (1 - k);
  return e;
}
function rsiLast(closes, per) {
  per = per || 14;
  if (!closes || closes.length < per + 1) return 50;
  let g = 0, l = 0;
  for (let i = closes.length - per; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d; else l -= d;
  }
  if (l === 0) return 100;
  if (g === 0) return 0;
  return 100 - 100 / (1 + g / l);
}
function atrLast(kl, n) {
  n = n || 14;
  if (!kl || kl.length < 3) return 0;
  let s = 0, c = 0;
  for (let i = Math.max(1, kl.length - n); i < kl.length; i++) {
    const h = parseFloat(kl[i][2]), l = parseFloat(kl[i][3]), pc = parseFloat(kl[i - 1][4]);
    s += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)); c++;
  }
  return c ? s / c : 0;
}
// حجم الصفقة من نسبة مخاطرة صغيرة من رأس المال — بحد أقصى نصف رأس المال
function hqStake(equity, entry, sl, riskPct) {
  riskPct = riskPct == null ? DEFAULTS.riskPct : riskPct;
  if (!(equity > 0 && entry > 0 && sl > 0 && sl < entry)) return 0;
  const riskUsd = equity * riskPct / 100;
  const stake = riskUsd / ((entry - sl) / entry);
  if (!(stake > 0)) return 0;
  return Math.min(stake, equity * 0.5);
}

async function hqEvaluate(sym, tick, fetchKlines, cfg) {
  cfg = Object.assign({}, DEFAULTS, cfg);
  const minScore = cfg.minScore, equity = cfg.equity == null ? 100 : cfg.equity;
  const rejects = [], reasons = [];
  const fail = (code, msg) => ({ ok: false, score: 0, rejects: rejects.concat(code), reasons, sym, note: msg });
  let k1d, k4h, k1h, k15;
  try {
    const r = await Promise.all([
      fetchKlines(sym, '1d', 100), fetchKlines(sym, '4h', 100),
      fetchKlines(sym, '1h', 100), fetchKlines(sym, '15m', 60),
    ]);
    k1d = r[0]; k4h = r[1]; k1h = r[2]; k15 = r[3];
  } catch (e) { return fail('no-data', 'تعذر جلب الشموع: ' + (e && e.message)); }
  if (!k1d || k1d.length < 30 || !k4h || k4h.length < 30 || !k1h || k1h.length < 30 || !k15 || k15.length < 15)
    return fail('no-data', 'شموع غير كافية');
  const C1d = k1d.slice(0, -1).map(k => parseFloat(k[4]));
  const C4h = k4h.slice(0, -1).map(k => parseFloat(k[4]));
  const C1h = k1h.slice(0, -1).map(k => parseFloat(k[4]));
  const C15 = k15.slice(0, -1).map(k => parseFloat(k[4]));
  const last = C1h[C1h.length - 1];
  if (!(last > 0)) return fail('no-price', 'سعر غير صالح');
  // —— 1) اتجاه يومي + 4h (25): شراء مع الاتجاه أو انعكاس مؤكد فقط ——
  const dE20 = emaLast(C1d, 20), dE50 = emaLast(C1d, 50);
  const h4E20 = emaLast(C4h, 20), h4E50 = emaLast(C4h, 50);
  const dailyUp = dE20 != null && dE50 != null && last > dE20 && dE20 > dE50;
  const h4Up = h4E20 != null && h4E50 != null && last > h4E20 && h4E20 > h4E50;
  const tf = { d: dailyUp ? 'صاعد' : 'غير صاعد', h4: h4Up ? 'صاعد' : 'غير صاعد', h1: '—', m15: '—' };
  let trendPts = 0;
  if (dailyUp) { trendPts += 15; reasons.push('يومي صاعد EMA20>EMA50'); }
  if (h4Up) { trendPts += 10; reasons.push('4h صاعد وبنية سليمة'); }
  let reversal = false;
  if (!dailyUp) {
    const h4prev = k4h.slice(0, -1).slice(-21, -1).map(k => parseFloat(k[2]));
    const h4Hi = Math.max.apply(null, h4prev);
    const h4Last = C4h[C4h.length - 1];
    if (h4Last > h4Hi && rsiLast(C1h, 14) > 55) { reversal = true; trendPts += 10; reasons.push('انعكاس صاعد مؤكد 4h + RSI'); }
  }
  if (!dailyUp && !reversal) return fail('trend-conflict', 'الفريمات متعارضة/الاتجاه غير واضح');
  // —— 2) كسر هيكل BOS بإغلاق 1h + حجم (20): بلا مطاردة، بلا كسر كاذب ——
  const H1h = k1h.slice(0, -1).map(k => parseFloat(k[2]));
  const L1h = k1h.slice(0, -1).map(k => parseFloat(k[3]));
  const V1h = k1h.slice(0, -1).map(k => parseFloat(k[5]) || 0);
  const n = C1h.length;
  const level = Math.max.apply(null, H1h.slice(n - 21, n - 1));
  const bosClose = C1h[n - 1];
  if (!(level > 0 && bosClose > level)) return fail('no-bos', 'لا كسر هيكل (BOS) بإغلاق شمعة');
  const dist = (bosClose - level) / level * 100;
  if (dist > 1.5) return fail('late-entry', 'دخول متأخر +' + dist.toFixed(2) + '% — مطاردة مرفوضة');
  const avgV = V1h.slice(n - 21, n - 1).reduce((a, b) => a + b, 0) / 20;
  const vr = avgV > 0 ? V1h[n - 1] / avgV : 0;
  if (!(vr >= 1.4)) return fail('weak-volume', 'اختراق بحجم ضعيف ×' + vr.toFixed(2));
  reasons.push('BOS بإغلاق فوق المستوى وحجم ×' + vr.toFixed(2));
  tf.h1 = 'BOS صاعد';
  let bosPts = 10 + Math.min(4, Math.round((vr - 1.4) * 4));
  let bi = n - 1;
  for (let i = n - 2; i >= Math.max(0, n - 5); i--) { if (C1h[i] > level) bi = i; else break; }
  let retest = false, failed = false;
  for (let i = bi; i < n; i++) {
    if (L1h[i] < level * 0.995) { failed = true; break; }
    if (L1h[i] <= level * 1.01) retest = true;
  }
  const live = parseFloat((tick && tick.lastPrice) || bosClose);
  if (!(live > 0)) return fail('no-price', 'سعر حي غير صالح');
  if (live < level * 0.995) failed = true;
  if (failed) return fail('bos-failed', 'فشل الاختراق — عودة تحت المستوى (إلغاء)');
  if (Math.abs(live - level) / level > 0.015) return fail('entry-far', 'الدخول بعيد عن المستوى — انتظر فرصة جديدة');
  if (retest) { bosPts += 6; reasons.push('إعادة اختبار ثابتة فوق المستوى'); }
  const m = C15.length, k15c = k15.slice(0, -1);
  const o15 = parseFloat(k15c[m - 1][1]), c15 = C15[m - 1];
  const h15 = parseFloat(k15c[m - 1][2]), l15 = parseFloat(k15c[m - 1][3]);
  const body = c15 - o15, range = (h15 - l15) || 1;
  if (!(c15 > o15 && body >= range * 0.4)) return fail('no-confirm', 'لا شمعة تأكيد صاعدة قوية 15m');
  bosPts += 4; tf.m15 = 'تأكيد صاعد';
  reasons.push('شمعة تأكيد 15m قوية');
  // —— 3) جودة منطقة الدخول (20): دفعة صحية + دخول ملاصق + ليست قمة 90 يوم ——
  const L30 = k1h.slice(0, -1).slice(-30).map(k => parseFloat(k[3]));
  const swingLow = Math.min.apply(null, L30);
  const impulse = (level - swingLow) / level;
  if (!(impulse >= 0.005)) return fail('flat-impulse', 'لا دفعة سعرية واضحة — تذبذب');
  if (impulse > 0.12) return fail('parabolic', 'دفعة عمودية خطرة — مطاردة مرفوضة');
  const lift = (live - level) / level;
  let entryPts = 0;
  if (lift <= 0.01) { entryPts += 10; reasons.push('دخول ملاصق للدعم المكسور'); }
  else entryPts += 5;
  entryPts += 5; // دفعة صحية غير عمودية
  const H90 = k1d.slice(0, -1).slice(-90).map(k => parseFloat(k[2]));
  const Lw90 = k1d.slice(0, -1).slice(-90).map(k => parseFloat(k[3]));
  const hi90 = Math.max.apply(null, H90), lo90 = Math.min.apply(null, Lw90);
  const top90 = hi90 > lo90 ? (live - lo90) / (hi90 - lo90) : 0.5;
  if (!(isFinite(top90)) || top90 > 0.97) return fail('near-top', 'قرب قمة 90 يوم — شراء قمة مرفوض');
  entryPts += 5;
  if (!h4Up) {
    const a4 = atrLast(k4h.slice(0, -1), 14);
    const hh14 = Math.max.apply(null, k4h.slice(0, -1).slice(-14).map(k => parseFloat(k[2])));
    const ll14 = Math.min.apply(null, k4h.slice(0, -1).slice(-14).map(k => parseFloat(k[3])));
    if (a4 > 0 && (hh14 - ll14) < a4 * 7) return fail('chop', 'تذبذب عشوائي بلا اتجاه واضح');
  }
  // —— 4) حجم وزخم RSI (15): زخم صاعد دون الاعتماد عليه منفرداً ——
  const rsi = rsiLast(C1h, 14);
  let momPts = vr >= 1.8 ? 8 : 6;
  if (rsi >= 50 && rsi <= 70) { momPts += 7; reasons.push('RSI زخم صاعد ' + rsi.toFixed(0)); }
  else if ((rsi >= 45 && rsi < 50) || (rsi > 70 && rsi <= 75)) { momPts += 4; }
  else return fail('rsi-bad', 'RSI خارج النطاق الصحي (' + rsi.toFixed(0) + ')');
  if (rsi > 80) return fail('rsi-top', 'RSI متطرف — قمة');
  // —— 5) وقف ATR مناسب (7 من 15) ——
  const atr1h = atrLast(k1h.slice(0, -1), 14) || live * 0.01;
  let sl = Math.min(level * 0.995, live - atr1h * 0.5);
  let risk = live - sl;
  if (risk / live > 0.06) { sl = live * 0.94; risk = live - sl; }
  if (risk / live < 0.005) return fail('sl-tight', 'وقف ضيق غير واقعي مقابل التذبذب');
  const slPts = (risk >= atr1h * 0.5 && risk <= atr1h * 2.5) ? 7 : 2;
  const t1 = live + risk * 1.5, t2full = live + risk * 2.5, t3 = live + risk * 4;
  // —— 6) مساحة حتى المقاومة (5) + عائد/مخاطرة ≥2 (8 من 15) ——
  const resArr = k4h.slice(0, -1).slice(-100).map(k => parseFloat(k[2])).filter(h => h > live * 1.001);
  const res = resArr.length ? Math.min.apply(null, resArr) : Infinity;
  const riskPct = risk / live * 100;
  const roomPct = isFinite(res) ? (res - live) / live * 100 : 99;
  const effTarget = isFinite(res) ? Math.min(t2full, res * 0.995) : t2full;
  const rr = (effTarget - live) / risk;
  if (!(rr >= 2)) return fail('bad-rr', 'العائد لا يبرر المخاطرة R:R=' + rr.toFixed(2));
  let roomPts = 0;
  if (roomPct >= riskPct * 2) { roomPts = 5; reasons.push('مساحة صعود كافية ' + roomPct.toFixed(1) + '%'); }
  else if (roomPct >= riskPct) { roomPts = 3; }
  else return fail('no-room', 'مقاومة قريبة — لا مساحة ربح كافية');
  const score = Math.min(100, trendPts + bosPts + entryPts + momPts + slPts + roomPts);
  const plan = { entry: live, t1, t2: effTarget, t3, sl, riskPct, rr };
  const stake = hqStake(equity, live, sl, cfg.riskPct);
  return {
    ok: score >= minScore, score, rejects, reasons, sym,
    tf, rsi: Math.round(rsi), vr: Math.round(vr * 100) / 100,
    dist: Math.round(dist * 100) / 100, impulse: Math.round(impulse * 10000) / 100,
    rr: Math.round(rr * 100) / 100, plan, stake, minScore,
  };
}

// تنبيه الفرصة المؤهلة: العملة + الفريمات + الجودة + السبب + الدخول والوقف والأهداف + R:R
function formatAlert(hq) {
  if (!hq || !hq.plan) return 'NO TRADE — شروط الدخول غير مكتملة';
  const p = hq.plan;
  return '🏆 فرصة مؤهلة ' + hq.sym +
    '\n📊 يومي:' + hq.tf.d + ' • 4h:' + hq.tf.h4 + ' • 1h:' + hq.tf.h1 + ' • 15m:' + hq.tf.m15 +
    '\n⭐ الجودة ' + hq.score + '/100 (الحد ' + (hq.minScore || 85) + ')' +
    '\n✅ ' + hq.reasons.slice(0, 4).join(' • ') +
    '\n📍 دخول ' + p.entry + ' • 🛡 وقف ' + p.sl +
    '\n🎯 T1 ' + p.t1 + ' • T2 ' + p.t2 + ' • T3 ' + p.t3 +
    '\n⚖️ R:R=' + hq.rr + ' • RSI=' + hq.rsi + ' • حجم×' + hq.vr;
}

/* —— فحص ذاتي منفرد: 6 سيناريوهات + وحدات المؤشرات —— */
function runSelftest() {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });
  const K = (o, h, l, c, v) => [0, String(o), String(h), String(l), String(c), String(v), 0, 0, 0, 0, 0, 0];
  const flat = (n, px, v) => { const a = []; for (let i = 0; i < n; i++) a.push(K(px, px * 1.001, px * 0.999, px, v || 1000)); return a; };
  // الكود الحقيقي يحذف آخر شمعة (جارية لم تُغلق) — كل السلاسل تُبنى مغلقة + شمعة جارية
  const forming = c => K(c, c * 1.0005, c * 0.9995, c, 200);
  const closed = kl => kl.concat([forming(parseFloat(kl[kl.length - 1][4]))]);
  // مؤشرات
  const up = []; for (let i = 0; i < 20; i++) up.push(100 + i);
  const dn = []; for (let i = 0; i < 20; i++) dn.push(200 - i);
  ok('rsi-up', rsiLast(up, 14) > 50, 'rsi=' + rsiLast(up, 14).toFixed(0));
  ok('rsi-down', rsiLast(dn, 14) < 50, 'rsi=' + rsiLast(dn, 14).toFixed(0));
  ok('atr-pos', atrLast(flat(20, 100), 14) >= 0, 'atr>=0');
  ok('stake-cap', hqStake(1000, 100, 98, 1.5) === 500, 'cap 50% equity');
  ok('stake-zero', hqStake(1000, 100, 101, 1.5) === 0, 'sl>entry=0');
  // —— بناء سلسلة 1h مثالية: صعود هادئ + BOS بحجم + إعادة اختبار + تأكيد ——
  const D = [0.15, 0.15, -0.18, 0.15, -0.18, 0.15, 0.15, -0.18, 0.15, -0.18, 0.15, 0.15, -0.18];
  function perfect1h() {
    const cl = [];
    for (let i = 0; i < 45; i++) cl.push(99.5 + i * 0.0284);
    let px = cl[44];
    for (let i = 0; i < D.length; i++) { px += D[i]; cl.push(px); } // 45..57
    cl.push(cl[57]); // 58 ≈ إغلاق مساوٍ
    const kl = cl.map(c => K(c - 0.02, c + 0.3, c - 0.3, c, 1000));
    const base = Math.max.apply(null, kl.slice(38, 58).map(k => parseFloat(k[2])));
    kl[57] = K(base - 0.55, base + 0.25, base - 0.85, base - 0.25, 1100); // شمعة الاختراق: قمة المستوى
    const level = base + 0.25;
    kl.push(K(level * 1.001, level * 1.006, level * 1.0005, level * 1.003, 2300)); // إغلاق فوق بحجم
    return { kl, level };
  }
  function perfect15m(lastC) {
    const kl = flat(59, lastC - 0.2, 500);
    kl.push(K(lastC - 0.25, lastC + 0.05, lastC - 0.3, lastC, 900)); // صاعدة قوية
    return closed(kl);
  }
  const rise = (n, a, b) => { const k = []; for (let i = 0; i < n; i++) { const c = a + (b - a) * i / (n - 1); k.push(K(c - 0.05, c + 0.15, c - 0.15, c, 1000)); } return closed(k); };
  const p1 = perfect1h();
  p1.kl = closed(p1.kl);
  const baseMap = () => ({
    '1d': rise(100, 86, 102.5),
    '4h': rise(100, 95, 101.4),
    '1h': p1.kl,
    '15m': perfect15m(p1.level * 1.003),
  });
  const stub = map => async (s, iv) => map[iv];
  const T = { lastPrice: p1.level * 1.0005 };
  const cfg = { minScore: 85, riskPct: 1.5, equity: 1000 };
  return (async () => {
    const r1 = await hqEvaluate('TUSDT', T, stub(baseMap()), cfg);
    ok('perfect-pass', r1.ok && r1.score >= 85, 'score=' + r1.score + ' rr=' + r1.rr + ' rejects=' + JSON.stringify(r1.rejects) + ' note=' + (r1.note || ''));
    ok('perfect-plan', r1.ok && r1.plan.t2 > r1.plan.entry && r1.plan.sl < r1.plan.entry && r1.stake > 0, 'plan+stake');
    ok('perfect-alert', typeof formatAlert(r1) === 'string' && formatAlert(r1).indexOf('TUSDT') >= 0, 'alert');
    const chop = {
      '1d': rise(100, 90, 100.2), '4h': rise(100, 94, 100.1),
      '1h': closed(flat(60, 100)), '15m': closed(flat(60, 100)),
    };
    const r2 = await hqEvaluate('CUSDT', { lastPrice: 100 }, stub(chop), cfg);
    ok('chop-reject', !r2.ok && r2.rejects.indexOf('no-bos') >= 0, JSON.stringify(r2.rejects));
    const r3 = await hqEvaluate('LUSDT', { lastPrice: p1.level * 1.06 }, stub(baseMap()), cfg);
    ok('late-reject', !r3.ok && r3.rejects.indexOf('entry-far') >= 0, JSON.stringify(r3.rejects));
    const r4 = await hqEvaluate('FUSDT', { lastPrice: p1.level * 0.99 }, stub(baseMap()), cfg);
    ok('failed-reject', !r4.ok && r4.rejects.indexOf('bos-failed') >= 0, JSON.stringify(r4.rejects));
    const tight = baseMap();
    tight['4h'] = tight['4h'].slice();
    tight['4h'][50] = K(101.9, (p1.level * 1.0005) * 1.004, 101.8, 101.9, 1000); // مقاومة ملاصقة
    const r5 = await hqEvaluate('RUSDT', T, stub(tight), cfg);
    ok('tight-reject', !r5.ok && (r5.rejects.indexOf('bad-rr') >= 0 || r5.rejects.indexOf('no-room') >= 0), JSON.stringify(r5.rejects));
    const down = [];
    for (let i = 0; i < 70; i++) down.push(95 + i * 0.19); // 95→108
    for (let i = 70; i < 100; i++) down.push(108 - (i - 70) * 0.215); // →101.75 قمة ثم كسر
    const downK = arr => closed(arr.map(c => K(c - 0.1, c + 0.2, c - 0.2, c, 1000)));
    const downMap = {
      '1d': downK(down),
      '4h': downK(down),
      '1h': p1.kl, '15m': perfect15m(p1.level * 1.003),
    };
    const r6 = await hqEvaluate('DUSDT', T, stub(downMap), cfg);
    ok('trend-reject', !r6.ok && r6.rejects.indexOf('trend-conflict') >= 0, JSON.stringify(r6.rejects));
    return out;
  })();
}

const HQE_API = { DEFAULTS, emaLast, rsiLast, atrLast, hqStake, hqEvaluate, formatAlert, runSelftest };
// متصفح: <script src="hq-entry.js"></script> ثم window.HQE — نفس المحرك بدون تكرار
if (typeof window !== 'undefined') window.HQE = HQE_API;
if (typeof module !== 'undefined' && module.exports) module.exports = HQE_API;
if (typeof require !== 'undefined' && require.main === module && typeof process !== 'undefined' && process.argv.includes('--selftest')) {
  runSelftest().then(rs => {
    let p = 0, f = 0;
    rs.forEach(r => { if (r.pass) { p++; console.log('PASS', r.name, r.detail); } else { f++; console.log('FAIL', r.name, r.detail); } });
    console.log(p + ' passed, ' + f + ' failed');
    process.exit(f ? 1 : 0);
  });
}
