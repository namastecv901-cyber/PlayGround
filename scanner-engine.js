#!/usr/bin/env node
/* 🧭 فاحص الشارت — محرك مستقل يحوّل شموع أي عملة وأي فريم إلى خطة كاملة:
 *    الاتجاه • الدخول (منطقة) • الوقف • ثلاثة أهداف • R:R • حجم المركز • أسباب ومحاذير.
 *
 *  يعمل وحده:   node scanner-engine.js --selftest
 *  كمكتبة:      const SE = require('./scanner-engine');
 *                const r = SE.analyze(klines, {sym:'BTCUSDT', interval:'1h', livePrice:0, equity:1000, riskPct:1.5});
 *                klines = شموع Binance المغلقة [time,open,high,low,close,volume,...]
 *
 *  القواعد صارمة عمداً: لا صفقة بلا اتجاه واضح، ولا دخول متأخر، ولا هدف بلا مساحة.
 *  النتيجة ليست ضماناً — اختبرها تاريخياً قبل أي مال حقيقي.
 */
'use strict';

const VERSION = '1.0.0';
const DEFAULTS = { minScore: 60, pendingScore: 50, riskPct: 1.5, equity: 1000, maxRiskPct: 6 };
const STATE_LABEL = { active: 'صفقة نشطة', pending: 'خطة معلّقة', weak: 'إشارة ضعيفة', none: 'لا صفقة' };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const avg = a => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const finite = v => typeof v === 'number' && isFinite(v);

function lastDefined(a) {
  if (!a) return null;
  for (let i = a.length - 1; i >= 0; i--) if (a[i] != null && isFinite(a[i])) return a[i];
  return null;
}

/* ————— المؤشرات ————— */
function emaSeries(vals, n) {
  const out = new Array(vals.length).fill(null);
  if (!vals || vals.length < n || n <= 0) return out;
  const k = 2 / (n + 1);
  let e = vals.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = e;
  for (let i = n; i < vals.length; i++) { e = vals[i] * k + e * (1 - k); out[i] = e; }
  return out;
}
function emaLast(vals, n) { return lastDefined(emaSeries(vals, n)); }

function rsiLast(closes, per) {
  per = per || 14;
  if (!closes || closes.length < per + 1) return 50;
  let g = 0, l = 0;
  for (let i = 1; i <= per; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) g += d; else l -= d; }
  let ag = g / per, al = l / per;
  for (let i = per + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (per - 1) + Math.max(d, 0)) / per;
    al = (al * (per - 1) + Math.max(-d, 0)) / per;
  }
  if (al === 0) return 100;
  if (ag === 0) return 0;
  return 100 - 100 / (1 + ag / al);
}

function macdLast(closes) {
  const empty = { macd: 0, signal: 0, hist: 0, prevHist: 0 };
  if (!closes || closes.length < 40) return empty;
  const e12 = emaSeries(closes, 12), e26 = emaSeries(closes, 26);
  const vals = [];
  for (let i = 0; i < closes.length; i++) if (e12[i] != null && e26[i] != null) vals.push(e12[i] - e26[i]);
  if (vals.length < 12) return empty;
  const sigS = emaSeries(vals, 9);
  const cur = vals[vals.length - 1];
  const prev = vals[vals.length - 2];
  const sig = lastDefined(sigS);
  const prevSig = lastDefined(sigS.slice(0, -1)) || sig;
  return { macd: cur, signal: sig, hist: cur - sig, prevHist: prev - prevSig };
}

function atrLast(H, L, C, n) {
  n = n || 14;
  if (!C || C.length < n + 1) return 0;
  const trs = [];
  for (let i = 1; i < C.length; i++) trs.push(Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1])));
  let a = avg(trs.slice(0, n));
  for (let i = n; i < trs.length; i++) a = (a * (n - 1) + trs[i]) / n;
  return a;
}

function adxLast(H, L, C, per) {
  per = per || 14;
  if (!C || C.length < per * 2 + 2) return 0;
  const tr = [], pdm = [], ndm = [];
  for (let i = 1; i < C.length; i++) {
    tr.push(Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1])));
    const up = H[i] - H[i - 1], dn = L[i - 1] - L[i];
    pdm.push(up > dn && up > 0 ? up : 0);
    ndm.push(dn > up && dn > 0 ? dn : 0);
  }
  let a = avg(tr.slice(0, per)), p = avg(pdm.slice(0, per)), m = avg(ndm.slice(0, per));
  const dxs = [];
  for (let i = per; i < tr.length; i++) {
    a = (a * (per - 1) + tr[i]) / per;
    p = (p * (per - 1) + pdm[i]) / per;
    m = (m * (per - 1) + ndm[i]) / per;
    const pdi = a > 0 ? 100 * p / a : 0, mdi = a > 0 ? 100 * m / a : 0;
    const den = pdi + mdi;
    dxs.push(den > 0 ? 100 * Math.abs(pdi - mdi) / den : 0);
  }
  if (!dxs.length) return 0;
  let adx = avg(dxs.slice(0, per));
  for (let i = per; i < dxs.length; i++) adx = (adx * (per - 1) + dxs[i]) / per;
  return clamp(adx, 0, 100);
}

function pivots(H, L, left, right, lookback) {
  left = left || 2; right = right || 2; lookback = lookback || 120;
  const n = H.length, highs = [], lows = [];
  const start = Math.max(left, n - lookback);
  for (let i = start; i < n - right; i++) {
    let isH = true, isL = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (H[j] >= H[i]) isH = false;
      if (L[j] <= L[i]) isL = false;
    }
    if (isH) highs.push({ i, price: H[i] });
    if (isL) lows.push({ i, price: L[i] });
  }
  return { highs, lows };
}

/* ————— علاقة الفريم (للتقاء الفريمات في الواجهة) ————— */
function trendOf(klines) {
  if (!klines || klines.length < 60) return { dir: 'flat', score: 0, rsi: 50, adx: 0, note: 'بيانات قليلة' };
  const C = klines.map(k => +k[4]);
  const ema20 = emaLast(C, 20), ema50 = emaLast(C, 50), rsi = rsiLast(C, 14);
  const H = klines.map(k => +k[2]), L = klines.map(k => +k[3]);
  const adx = adxLast(H, L, C, 14);
  const p = C[C.length - 1];
  const up = p > ema20 && ema20 > ema50 && adx >= 18;
  const dn = p < ema20 && ema20 < ema50 && adx >= 18;
  return {
    dir: up ? 'up' : dn ? 'down' : 'flat',
    score: Math.round(adx),
    rsi: Math.round(rsi),
    adx: Math.round(adx),
    note: up ? 'صاعد' : dn ? 'هابط' : 'عرضي',
  };
}

/* ————— تقييم اتجاه واحد (شراء أو بيع) ————— */
function assess(dir, ctx) {
  const { O, H, L, C, V, n, price, atr, ema20, ema50, ema200, ema200Prev, rsi, macd, adx, vr, hi20, lo20, piv, opts } = ctx;
  const bull = dir === 'long';
  const sgn = bull ? 1 : -1;
  const reasons = [], warnings = [], missing = [];

  const trendOK = bull ? (price > ema200 && ema20 > ema50) : (price < ema200 && ema20 < ema50);
  let trendPts = 0;
  if (bull ? price > ema200 : price < ema200) { trendPts += 10; reasons.push(bull ? 'السعر فوق EMA200' : 'السعر تحت EMA200'); }
  else missing.push(bull ? 'السعر تحت EMA200' : 'السعر فوق EMA200');
  if (bull ? ema20 > ema50 : ema20 < ema50) { trendPts += 8; reasons.push(bull ? 'EMA20 فوق EMA50' : 'EMA20 تحت EMA50'); }
  else missing.push('ترتيب المتوسطات معاكس');
  if (ema200Prev != null) {
    const rising = bull ? ema200 > ema200Prev : ema200 < ema200Prev;
    if (rising) { trendPts += 4; reasons.push(bull ? 'EMA200 صاعد' : 'EMA200 هابط'); }
  }
  if (adx >= 25) { trendPts += 8; reasons.push('اتجاه قوي ADX ' + Math.round(adx)); }
  else if (adx >= 20) { trendPts += 5; }
  else if (adx >= 15) { trendPts += 2; }
  else { warnings.push('ADX ضعيف — السوق عرضي'); }

  /* البنية: كسر مستوى 20 شمعة أو ارتداد داخل اتجاه */
  const beyond = bull ? C[n - 1] > hi20 : C[n - 1] < lo20;
  const ext = bull ? (price - hi20) / atr : (lo20 - price) / atr;
  const hh = piv.highs.length >= 2 && piv.highs[piv.highs.length - 1].price > piv.highs[piv.highs.length - 2].price;
  const hl = piv.lows.length >= 2 && piv.lows[piv.lows.length - 1].price > piv.lows[piv.lows.length - 2].price;
  const ll = piv.lows.length >= 2 && piv.lows[piv.lows.length - 1].price < piv.lows[piv.lows.length - 2].price;
  const lh = piv.highs.length >= 2 && piv.highs[piv.highs.length - 1].price < piv.highs[piv.highs.length - 2].price;
  const structTrend = bull ? (hh && hl) : (ll && lh);

  let structPts = 0;
  if (beyond) {
    structPts += 8;
    reasons.push(bull ? 'إغلاق فوق قمة 20 شمعة' : 'إغلاق تحت قاع 20 شمعة');
  } else if (structTrend) {
    structPts += 4;
    reasons.push(bull ? 'قمم وقيعان صاعدة (HH/HL)' : 'قمم وقيعان هابطة (LL/LH)');
  }
  if (structTrend) structPts += 6;
  else if (hh || hl || ll || lh) structPts += 3;

  let late = false;
  if (ext > 2.5) { late = true; warnings.push('دخول متأخر جداً — السعر بعيد عن مستوى الكسر'); }
  else if (ext > 1.5) warnings.push('السعر ممتد عن مستوى الكسر');
  if (ext <= 1.5) structPts += 6;
  else if (ext <= 3) structPts += 3;
  structPts = clamp(structPts, 0, 20);

  /* الزخم */
  let momPts = 0;
  const rsiBest = bull ? (rsi >= 50 && rsi <= 72) : (rsi >= 28 && rsi <= 50);
  const rsiOk = bull ? ((rsi >= 45 && rsi < 50) || (rsi > 72 && rsi <= 78)) : ((rsi > 50 && rsi <= 55) || (rsi >= 22 && rsi < 28));
  if (rsiBest) { momPts += 8; reasons.push('RSI في منطقة الزخم ' + Math.round(rsi)); }
  else if (rsiOk) momPts += 5;
  else if (bull && rsi > 78) warnings.push('RSI متشبع شراء ' + Math.round(rsi));
  else if (!bull && rsi < 22) warnings.push('RSI متشبع بيع ' + Math.round(rsi));

  const histOk = bull ? macd.hist > 0 : macd.hist < 0;
  const histRising = bull ? (macd.hist > macd.prevHist) : (macd.hist < macd.prevHist);
  if (histOk) { momPts += 6; reasons.push('MACD يدعم الاتجاه'); }
  if (histRising) momPts += 3;
  const body = C[n - 1] - O[n - 1], range = (H[n - 1] - L[n - 1]) || 1;
  const bodyOk = bull ? (body > 0 && body >= range * 0.4) : (body < 0 && -body >= range * 0.4);
  if (bodyOk) momPts += 3;
  momPts = clamp(momPts, 0, 20);

  /* الحجم */
  let volPts = 0;
  if (vr >= 2) volPts = 15;
  else if (vr >= 1.5) volPts = 12;
  else if (vr >= 1.2) volPts = 9;
  else if (vr >= 1.0) volPts = 5;
  if (vr >= 1.2) reasons.push('حجم أعلى من المتوسط ×' + vr.toFixed(2));
  if (beyond && vr < 1.1) warnings.push('كسر بحجم ضعيف ×' + vr.toFixed(2));

  /* نوع الفرصة */
  let setup = null;
  if (beyond && !late && vr >= 1.0) setup = 'اختراق';
  else if (trendOK && Math.abs(price - ema20) <= 0.9 * atr) {
    const pullZone = bull ? (rsi >= 42 && rsi <= 68) : (rsi >= 32 && rsi <= 58);
    if (pullZone && !late) setup = 'ارتداد';
  }

  /* منطقة الدخول */
  const trigger = bull ? hi20 : lo20;
  let entryRef, entryLow, entryHigh;
  if (setup === 'اختراق') {
    entryRef = price;
    if (bull) { entryLow = Math.max(trigger, price - 0.6 * atr); entryHigh = price; }
    else { entryHigh = Math.min(trigger, price + 0.6 * atr); entryLow = price; }
  } else if (setup === 'ارتداد') {
    entryRef = price;
    entryLow = price - 0.35 * atr; entryHigh = price + 0.25 * atr;
    if (!bull) { entryLow = price - 0.25 * atr; entryHigh = price + 0.35 * atr; }
  } else {
    /* خطة معلّقة: الدخول عند إعادة اختبار مستوى الكسر */
    entryRef = trigger;
    entryLow = trigger - 0.25 * atr; entryHigh = trigger + 0.25 * atr;
  }

  /* الوقف: خلف أدنى قاع/أعلى قمة + هامش ATR، مع سقف للمخاطرة */
  const swing = bull ? Math.min.apply(null, L.slice(-20)) : Math.max.apply(null, H.slice(-20));
  let sl = bull
    ? Math.min(swing, entryRef - 1.4 * atr) - 0.25 * atr
    : Math.max(swing, entryRef + 1.4 * atr) + 0.25 * atr;
  let risk = Math.abs(entryRef - sl);
  let capped = false;
  const maxRisk = opts.maxRiskPct / 100;
  if (risk / entryRef > maxRisk) {
    sl = entryRef * (1 - sgn * maxRisk);
    risk = Math.abs(entryRef - sl);
    capped = true;
    warnings.push('الوقف الفني أوسع من ' + opts.maxRiskPct + '% — قُلّص للحد الأقصى');
  }
  if (risk < atr * 0.5) {
    sl = entryRef - sgn * atr * 0.8;
    risk = Math.abs(entryRef - sl);
  }
  if (!(risk > 0)) return { dir, score: 0, trendOK, setup: null, missing: missing.concat('وقف غير صالح'), reasons, warnings, plan: null };

  /* الأهداف + المساحة حتى أقرب مقاومة/دعم */
  let levels = bull
    ? piv.highs.filter(p => p.price > entryRef * 1.004).map(p => p.price)
    : piv.lows.filter(p => p.price < entryRef * 0.996).map(p => p.price);
  if (bull && hi20 > entryRef * 1.004) levels.push(hi20);
  if (!bull && lo20 < entryRef * 0.996) levels.push(lo20);
  levels.sort((a, b) => (bull ? a - b : b - a));
  const nearest = levels.length ? levels[0] : null;
  const roomR = nearest ? Math.abs(nearest - entryRef) / risk : Infinity;

  const tps = [];
  let prev = entryRef;
  [1.2, 2.5, 4].forEach(m => {
    let px = entryRef + sgn * m * risk;
    const lvl = levels.find(x => Math.abs(x - entryRef) >= 1.0 * risk &&
      (bull ? (x > entryRef && x < px) : (x < entryRef && x > px)));
    if (lvl) px = lvl - sgn * Math.abs(lvl) * 0.002;
    px = bull ? Math.max(px, prev + 0.35 * risk) : Math.min(px, prev - 0.35 * risk);
    tps.push(px);
    prev = px;
  });
  const rr = Math.abs(tps[1] - entryRef) / risk;
  const riskPct = risk / entryRef * 100;

  let riskPts = 0;
  if (riskPct >= 0.3 && riskPct <= opts.maxRiskPct) riskPts += 5;
  if (rr >= 2.5) riskPts += 6;
  else if (rr >= 2) riskPts += 4;
  else if (rr >= 1.5) riskPts += 2;
  if (roomR >= 3) riskPts += 4;
  else if (roomR >= 1.5) riskPts += 2;
  else if (isFinite(roomR)) warnings.push('مساحة محدودة حتى أقرب مستوى (' + roomR.toFixed(1) + 'R)');
  riskPts = clamp(riskPts, 0, 15);

  let score = trendPts + structPts + momPts + volPts + riskPts;
  if (!trendOK) score = Math.min(score, 45);
  if (adx < 15) score = Math.min(score, 40);
  if (late) score = Math.min(score, 55);
  if (!setup) score = Math.min(score, 65);
  if (bull ? rsi > 78 : rsi < 22) score = Math.min(score, 88);
  if (capped) score = Math.min(score, score - 4);
  score = clamp(Math.round(score), 0, 100);

  if (!trendOK) missing.unshift(bull ? 'لا اتجاه صاعد مؤكد' : 'لا اتجاه هابط مؤكد');
  if (adx < 15) missing.unshift('ADX ضعيف (' + adx.toFixed(1) + ') — سوق عرضي');

  const stake = risk > 0 ? Math.min(opts.equity * opts.riskPct / 100 / (risk / entryRef), opts.equity) : 0;
  return {
    dir, score, trendOK, setup, reasons, warnings, missing,
    parts: {
      trend: Math.round(trendPts / 30 * 100),
      structure: Math.round(structPts / 20 * 100),
      momentum: Math.round(momPts / 20 * 100),
      volume: Math.round(volPts / 15 * 100),
      risk: Math.round(riskPts / 15 * 100),
    },
    plan: {
      entry: entryRef, entryLow, entryHigh, sl, tps, risk, riskPct,
      rr, roomR: isFinite(roomR) ? roomR : null, trigger,
      stake, qty: stake / entryRef, nearestLevel: nearest,
    },
  };
}

/* ————— التحليل الكامل ————— */
function analyze(klines, options) {
  const opts = Object.assign({}, DEFAULTS, options || {});
  const sym = opts.sym || '—';
  const base = {
    version: VERSION, sym, interval: opts.interval || '—', price: null,
    state: 'none', stateLabel: STATE_LABEL.none, direction: 'none',
    score: 0, setup: null, reasons: [], warnings: [], missing: [],
    plan: null, parts: null, indicators: null, mtfNote: null, error: null,
  };
  if (!Array.isArray(klines) || klines.length < 60) {
    return Object.assign(base, { error: 'شموع غير كافية — نحتاج 60 شمعة مغلقة على الأقل' });
  }
  let O, H, L, C, V;
  try {
    O = klines.map(k => +k[1]); H = klines.map(k => +k[2]);
    L = klines.map(k => +k[3]); C = klines.map(k => +k[4]);
    V = klines.map(k => +(k[5] || 0));
  } catch (e) {
    return Object.assign(base, { error: 'صيغة الشموع غير صالحة' });
  }
  const n = C.length;
  const live = +(opts.livePrice || 0);
  const price = live > 0 ? live : C[n - 1];
  if (!(price > 0) || !isFinite(price)) return Object.assign(base, { error: 'سعر غير صالح' });

  const atr = atrLast(H, L, C, 14) || price * 0.01;
  const ema20 = emaLast(C, 20) || price;
  const ema50 = emaLast(C, 50) || price;
  const ema200s = emaSeries(C, 200);
  const ema200 = lastDefined(ema200s) || ema50;
  const ema200Prev = ema200s.length > 11 ? ema200s[n - 11] : null;
  const rsi = rsiLast(C, 14);
  const macd = macdLast(C);
  const adx = adxLast(H, L, C, 14);
  const volAvg = avg(V.slice(Math.max(0, n - 21), n - 1));
  const vr = volAvg > 0 ? V[n - 1] / volAvg : 1;
  const hi20 = Math.max.apply(null, H.slice(Math.max(0, n - 21), n - 1));
  const lo20 = Math.min.apply(null, L.slice(Math.max(0, n - 21), n - 1));
  const piv = pivots(H, L, 2, 2, 120);
  const TF_MIN = { '1m': 1, '3m': 3, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '2h': 120, '4h': 240, '6h': 360, '8h': 480, '12h': 720, '1d': 1440, '3d': 4320, '1w': 10080, '1M': 43200 };
  const tfMin = TF_MIN[opts.interval] || 60;
  const minAtrPct = 0.006 * Math.sqrt(tfMin);

  const indicators = {
    rsi: Math.round(rsi), adx: Math.round(adx), atr: +atr.toPrecision(6), atrPct: +(atr / price * 100).toFixed(2),
    ema20, ema50, ema200, macdHist: +(macd.hist).toPrecision(5), volRatio: +vr.toFixed(2),
  };
  if (atr / price * 100 < minAtrPct) {
    return Object.assign(base, {
      price, indicators, candles: n,
      missing: [
        'متوسط المدى (ATR) ' + (atr / price * 100).toFixed(3) + '% أقل من الحد الأدنى ' + minAtrPct.toFixed(3) +
        '% لهذا الفريم — عملة مستقرة أو سوق ميت لا يستحق المخاطرة',
      ],
    });
  }

  const ctx = { O, H, L, C, V, n, price, atr, ema20, ema50, ema200, ema200Prev, rsi, macd, adx, vr, hi20, lo20, piv, opts };
  const longR = assess('long', ctx);
  const shortR = assess('short', ctx);
  const best = longR.score === shortR.score
    ? (shortR.trendOK && !longR.trendOK ? shortR : longR)
    : (longR.score > shortR.score ? longR : shortR);

  /* حالة الإشارة */
  let state = 'none';
  const watch = best.setup ? best.plan && best.plan.trigger : (longR.trendOK ? hi20 : shortR.trendOK ? lo20 : null);
  if (best.setup && best.score >= opts.minScore) state = 'active';
  else if (best.setup && best.trendOK && adx >= 15) state = 'weak';
  else if (best.trendOK && best.plan) {
    const distToTrigger = Math.abs(best.plan.trigger - price) / atr;
    if (best.score >= opts.pendingScore && distToTrigger <= 2.5) state = 'pending';
  }
  /* تعارض الاتجاهين = لا صفقة */
  if (Math.abs(longR.score - shortR.score) < 5 && best.score < 70) state = 'none';

  const setupName = state === 'pending' ? 'بانتظار التأكيد' : (state === 'none' ? null : best.setup);
  const result = Object.assign(base, {
    price,
    state,
    stateLabel: STATE_LABEL[state],
    direction: state === 'none' ? 'none' : best.dir,
    score: state === 'none' ? 0 : best.score,
    setup: setupName,
    reasons: state === 'none' ? [] : best.reasons.slice(0, 8),
    warnings: state === 'none' ? [] : best.warnings.slice(0, 6),
    missing: state === 'none' ? (best.missing || []).slice(0, 4) : [],
    plan: state === 'none' ? null : best.plan,
    parts: state === 'none' ? null : best.parts,
    watchLevel: state === 'pending' ? watch : null,
    indicators: {
      rsi: Math.round(rsi), adx: Math.round(adx), atr: +atr.toPrecision(6), atrPct: +(atr / price * 100).toFixed(2),
      ema20, ema50, ema200, macdHist: +(macd.hist).toPrecision(5), volRatio: +vr.toFixed(2),
    },    bias: { long: longR.score, short: shortR.score },
    candles: n,
  });

  if (state === 'none') {
    result.direction = 'none';
    const why = [];
    if (!longR.trendOK && !shortR.trendOK) why.push('لا اتجاه مؤكد (EMA20/50/200 + ADX)');
    if (adx < 15) why.push('ADX ضعيف (' + adx.toFixed(1) + ') — سوق عرضي');
    if (best.setup && best.score < opts.minScore) why.push('جودة الإشارة ' + best.score + '/100 أقل من الحد ' + opts.minScore);
    if (!best.setup && best.trendOK) {
      const lvl = best.dir === 'long' ? hi20 : lo20;
      why.push('لا اختراق ولا ارتداد صالح الآن — راقب ' + fmtNum(lvl));
    }
    result.missing = (why.length ? why : (best.missing || [])).slice(0, 4);
  }
  return result;
}

/* ————— نص جاهز للنسخ ————— */
function fmtNum(x) {
  if (!isFinite(x)) return '—';
  const a = Math.abs(x);
  const d = a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  return x.toFixed(d).replace(/0+$/, '').replace(/\.$/, '');
}
function formatPlan(r) {
  if (!r || !r.plan) return '🚫 لا صفقة — ' + (r && (r.missing || []).join(' • ') || 'الشروط غير مكتملة');
  const p = r.plan;
  const dir = r.direction === 'long' ? 'شراء' : 'بيع';
  return '🧭 ' + r.sym + ' • ' + r.interval + ' — ' + dir + ' (' + r.stateLabel + ' ' + r.score + '/100)\n' +
    '📥 الدخول: ' + fmtNum(p.entry) + (p.entryLow !== p.entryHigh ? ' (منطقة ' + fmtNum(Math.min(p.entryLow, p.entryHigh)) + ' → ' + fmtNum(Math.max(p.entryLow, p.entryHigh)) + ')' : '') + '\n' +
    '🛡️ الوقف: ' + fmtNum(p.sl) + ' (' + p.riskPct.toFixed(2) + '%)\n' +
    '🎯 T1: ' + fmtNum(p.tps[0]) + ' • T2: ' + fmtNum(p.tps[1]) + ' • T3: ' + fmtNum(p.tps[2]) + '\n' +
    '⚖️ R:R ' + p.rr.toFixed(2) + ' • المخاطرة ' + p.riskPct.toFixed(2) + '% • الكمية ' + fmtNum(p.qty) + '\n' +
    (r.reasons.length ? '✅ ' + r.reasons.slice(0, 3).join(' • ') + '\n' : '') +
    '⚠️ ليست نصيحة مالية — اختبرها بنفسك.';
}

/* ————— فحص ذاتي ————— */
function runSelftest() {
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, pass: !!cond, detail: detail || '' });
  const K = (o, h, l, c, v) => [0, String(o), String(h), String(l), String(c), String(v || 1000), 0, 0, 0, 0, 0, 0];
  const mkSeries = (from, to, count, wobble) => {
    const a = [];
    for (let i = 0; i < count; i++) {
      const base = from + (to - from) * i / (count - 1);
      const c = base + Math.sin(i * 0.9) * wobble;
      const o = base + Math.sin((i - 1) * 0.9) * wobble;
      const hi = Math.max(o, c) + wobble * 0.6 + 0.02;
      const lo = Math.min(o, c) - wobble * 0.6 - 0.02;
      a.push(K(o, hi, lo, c, 1000 + (i % 7) * 30));
    }
    return a;
  };

  /* 1) اختراق صاعد */
  const up = mkSeries(80, 112, 260, 0.45);
  const prevHi = Math.max.apply(null, up.slice(-21, -1).map(k => +k[2]));
  const lastClose = prevHi + 0.55;
  up.push(K(lastClose - 0.55, lastClose + 0.25, lastClose - 0.75, lastClose, 4200));
  const rUp = analyze(up, { sym: 'UPUSDT', interval: '1h' });
  ok('up-active', rUp.state === 'active' && rUp.direction === 'long', 'state=' + rUp.state + ' score=' + rUp.score + ' setup=' + rUp.setup + ' miss=' + JSON.stringify(rUp.missing));
  ok('up-order', rUp.plan && rUp.plan.sl < rUp.plan.entry && rUp.plan.tps[0] > rUp.plan.entry && rUp.plan.tps[1] > rUp.plan.tps[0] && rUp.plan.tps[2] > rUp.plan.tps[1], 'entry=' + (rUp.plan && rUp.plan.entry) + ' sl=' + (rUp.plan && rUp.plan.sl));
  ok('up-rr', rUp.plan && rUp.plan.rr >= 1.5, 'rr=' + (rUp.plan && rUp.plan.rr));
  ok('up-risk', rUp.plan && rUp.plan.riskPct > 0 && rUp.plan.riskPct <= 6.001, 'risk%=' + (rUp.plan && rUp.plan.riskPct));
  ok('up-stake', rUp.plan && rUp.plan.stake > 0 && rUp.plan.stake <= 1000, 'stake=' + (rUp.plan && rUp.plan.stake));

  /* 2) كسر هابط */
  const dn = mkSeries(130, 96, 260, 0.45);
  const prevLo = Math.min.apply(null, dn.slice(-21, -1).map(k => +k[3]));
  const dnClose = prevLo - 0.55;
  dn.push(K(dnClose + 0.55, dnClose + 0.75, dnClose - 0.25, dnClose, 4200));
  const rDn = analyze(dn, { sym: 'DNUSDT', interval: '4h' });
  ok('dn-active', rDn.state === 'active' && rDn.direction === 'short', 'state=' + rDn.state + ' score=' + rDn.score + ' miss=' + JSON.stringify(rDn.missing));
  ok('dn-order', rDn.plan && rDn.plan.sl > rDn.plan.entry && rDn.plan.tps[0] < rDn.plan.entry && rDn.plan.tps[2] < rDn.plan.tps[1], 'entry=' + (rDn.plan && rDn.plan.entry) + ' sl=' + (rDn.plan && rDn.plan.sl));

  /* 3) سوق عرضي */
  const chop = [];
  for (let i = 0; i < 260; i++) {
    const c = 100 + Math.sin(i * 0.7) * 0.45;
    chop.push(K(c - 0.02, c + 0.4, c - 0.4, c, 1000));
  }
  const rChop = analyze(chop, { sym: 'CHOPUSDT', interval: '15m' });
  ok('chop-none', rChop.state === 'none' && rChop.direction === 'none', 'state=' + rChop.state + ' score=' + rChop.score);

  /* 3b) عملة شبه ثابتة (stablecoin) */
  const flatCoin = [];
  for (let i = 0; i < 260; i++) {
    const c = 1 + Math.sin(i * 0.4) * 0.00002;
    flatCoin.push(K(c, c + 0.00002, c - 0.00002, c, 900));
  }
  const rFlat = analyze(flatCoin, { sym: 'STABLEUSDT', interval: '1h' });
  ok('flat-none', rFlat.state === 'none' && (rFlat.missing || []).join(' ').indexOf('ATR') >= 0, JSON.stringify(rFlat.missing));

  /* 4) شموع قليلة */
  const rFew = analyze(up.slice(0, 30), { sym: 'FEWUSDT', interval: '1m' });
  ok('few-error', rFew.state === 'none' && !!rFew.error, 'err=' + rFew.error);

  /* 5) تحديث حي أعلى من الإغلاق لا يقلب الاتجاه */
  const rLive = analyze(up, { sym: 'UPUSDT', interval: '1h', livePrice: lastClose * 1.0005 });
  ok('live-ok', rLive.state === 'active' && rLive.plan && rLive.plan.entry > 0, 'state=' + rLive.state);

  /* 6) المؤشرات ضمن الحدود */
  ok('rsi-bounds', rUp.indicators.rsi >= 0 && rUp.indicators.rsi <= 100, 'rsi=' + rUp.indicators.rsi);
  ok('adx-bounds', rUp.indicators.adx >= 0 && rUp.indicators.adx <= 100, 'adx=' + rUp.indicators.adx);
  ok('atr-positive', rUp.indicators.atr > 0, 'atr=' + rUp.indicators.atr);
  ok('ema-order', rUp.indicators.ema20 > rUp.indicators.ema50, 'ema20=' + rUp.indicators.ema20 + ' ema50=' + rUp.indicators.ema50);

  /* 7) نص الخطة */
  const txt = formatPlan(rUp);
  ok('format', txt.indexOf('الدخول') >= 0 && txt.indexOf('الوقف') >= 0 && txt.indexOf('T1') >= 0 && txt.indexOf('UPUSDT') >= 0, txt.split('\n')[0]);

  /* 8) اتجاه الفريم */
  const tr = trendOf(up);
  ok('trend-up', tr.dir === 'up', 'dir=' + tr.dir + ' adx=' + tr.adx);
  ok('trend-chop', trendOf(chop).dir === 'flat', 'dir=' + trendOf(chop).dir);

  /* 9) ارتداد من المتوسط داخل اتجاه صاعد */
  const pb = up.slice(0, -1); // نفس الصعود بلا شمعة الاختراق
  const pbC = pb.map(k => +k[4]), pbH = pb.map(k => +k[2]), pbL = pb.map(k => +k[3]);
  const pbE20 = emaLast(pbC, 20), pbAtr = atrLast(pbH, pbL, pbC, 14);
  for (let i = 0; i < 2; i++) {
    const c = pbE20 + pbAtr * (0.2 - i * 0.15);
    pb.push(K(c + pbAtr * 0.3, c + pbAtr * 0.35, c - pbAtr * 0.2, c, 1200));
  }
  const rPb = analyze(pb, { sym: 'PBUSDT', interval: '1h' });
  ok('pullback-active', rPb.state === 'active' && rPb.setup === 'ارتداد' && rPb.direction === 'long', 'state=' + rPb.state + ' setup=' + rPb.setup + ' score=' + rPb.score);
  ok('pullback-plan', rPb.plan && rPb.plan.sl < rPb.plan.entry && rPb.plan.tps[2] > rPb.plan.tps[1], 'rr=' + (rPb.plan && rPb.plan.rr));

  /* 10) خطة معلّقة: اتجاه صاعد بلا اختراق، والسعر ممتد عن المتوسط */
  let pend = mkSeries(80, 110, 259, 0.4);
  let pxp = +pend[pend.length - 1][4];
  for (let i = 0; i < 6; i++) { const c = pxp + (i + 1) * 0.6; pend.push(K(c - 0.5, c + 0.5, c - 0.6, c, 1500)); }
  const hiP = Math.max.apply(null, pend.slice(-21, -1).map(k => +k[2]));
  const lastP = +pend[pend.length - 1][4];
  pend.push(K(lastP + 0.3, hiP + 1.2, lastP - 0.4, lastP + 0.1, 2600));
  const rPend = analyze(pend, { sym: 'PENDUSDT', interval: '1h' });
  ok('pending-plan', rPend.state === 'pending' && rPend.direction === 'long' && rPend.plan && rPend.plan.entry > rPend.price, 'state=' + rPend.state + ' entry=' + (rPend.plan && rPend.plan.entry) + ' price=' + rPend.price);
  ok('pending-cap', rPend.score <= 65, 'score=' + rPend.score);

  /* 11) سقف المخاطرة 6% */
  const wild = mkSeries(80, 112, 259, 0.45);
  const pxw = +wild[wild.length - 1][4];
  wild.push(K(pxw + 8, pxw + 12, pxw - 9, pxw + 2, 5000));
  const rWild = analyze(wild, { sym: 'WILDUSDT', interval: '4h' });
  ok('risk-cap', rWild.plan && rWild.plan.riskPct <= 6.001 && rWild.plan.sl < rWild.plan.entry, 'risk%=' + (rWild.plan && rWild.plan.riskPct));

  return out;
}

const API = {
  VERSION, DEFAULTS, STATE_LABEL, emaSeries, emaLast, rsiLast, macdLast, atrLast, adxLast,
  pivots, trendOf, analyze, formatPlan, fmtNum, runSelftest,
};
if (typeof window !== 'undefined') window.ScannerEngine = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof require !== 'undefined' && require.main === module && typeof process !== 'undefined' && process.argv.includes('--selftest')) {
  Promise.resolve(runSelftest()).then(rs => {
    let p = 0, f = 0;
    rs.forEach(r => { if (r.pass) { p++; console.log('PASS', r.name, r.detail); } else { f++; console.log('FAIL', r.name, r.detail); } });
    console.log(p + ' passed, ' + f + ' failed');
    process.exit(f ? 1 : 0);
  });
}
