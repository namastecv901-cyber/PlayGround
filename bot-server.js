#!/usr/bin/env node
/* 🤖 BOT SERVER — روبوت تداول Binance يعمل على سيرفر 24/7 (بدون هاتف)
 *
 *  التشغيل:
 *    MODE=paper node bot-server.js
 *    MODE=testnet BINANCE_KEY=xxx BINANCE_SECRET=yyy node bot-server.js
 *    MODE=live BINANCE_KEY=xxx BINANCE_SECRET=yyy node bot-server.js
 *  متغيرات (اختيارية): BASE_URL STAKE_USD TP_USD MAX_TRADES MIN_VOL_USD
 *    POLL_SEC TOP_N DAILY_MAX_LOSS DAILY_GOAL_USD EQUITY_START TG_BOT TG_CHAT STATE_FILE CYCLES
 *    REINFORCE SPLIT_INIT REIN_DROP REIN_MAX HEARTBEAT_CYCLES
 *    SPLIT_N(4/6/8: تقسيم رأس المال) TG_CHANNEL(القناة) NOTIFY_SECRET(بوابة /notify) PORT(8787)
 *    HQ_MIN_SCORE(85: حد جودة الدخول) RISK_PCT(1.5: مخاطرة الصفقة%) HQ_COOLDOWN_H(4: منع تكرار الإشارة)
 *    SIGNAL_SECRET(مفتاح /state و/signal) SIGNAL_ONLY(1: يتداول إشارات التطبيق فقط)
 *  واجهة التطبيق: GET /state • POST /signal • POST /notify
 *  فحص ذاتي: node bot-server.js --selftest | القسم المنفرد وحده: node hq-entry.js --selftest
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const CFG = {
  mode: (process.env.MODE || 'paper').toLowerCase(),
  base: process.env.BASE_URL || 'https://api.binance.com',
  key: process.env.BINANCE_KEY || process.env.KEY || '',
  sec: process.env.BINANCE_SECRET || process.env.SECRET || '',
  stake: parseFloat(process.env.STAKE_USD || '20'),
  tp: parseFloat(process.env.TP_USD || '0.7'),
  minTp: parseFloat(process.env.MIN_TP_USD || '0.3'),
  max: parseInt(process.env.MAX_TRADES || '4', 10),
  splitN: Math.max(0, parseInt(process.env.SPLIT_N || '4', 10)),
  minVol: parseFloat(process.env.MIN_VOL_USD || '20000000'),
  poll: Math.max(15, parseInt(process.env.POLL_SEC || '60', 10)),
  topN: Math.max(3, parseInt(process.env.TOP_N || '15', 10)),
  dayMaxLoss: parseFloat(process.env.DAILY_MAX_LOSS || '10'),
  dailyGoal: parseFloat(process.env.DAILY_GOAL_USD || '10'),
  heartbeat: Math.max(10, parseInt(process.env.HEARTBEAT_CYCLES || '30', 10)),
  equityStart: parseFloat(process.env.EQUITY_START || '100'),
  rein: process.env.REINFORCE !== '0',
  splitInit: Math.min(1, Math.max(0.2, parseFloat(process.env.SPLIT_INIT || '0.5'))),
  reinDrop: parseFloat(process.env.REIN_DROP || '0.01'),
  reinMax: Math.max(0, Math.min(3, parseInt(process.env.REIN_MAX || '2', 10))),
  tgBot: process.env.TG_BOT || '',
  tgChat: process.env.TG_CHAT || '',
  tgChannel: process.env.TG_CHANNEL || '',
  notifySecret: process.env.NOTIFY_SECRET || '',
  signalSecret: process.env.SIGNAL_SECRET || process.env.NOTIFY_SECRET || '',
  signalOnly: process.env.SIGNAL_ONLY === '1',
  port: parseInt(process.env.PORT || '8787', 10),
  stateFile: process.env.STATE_FILE || './bot-state.json',
  maxCycles: parseInt(process.env.CYCLES || '0', 10),
};
const STABLES = new Set(['USDT','USDC','DAI','FDUSD','USDE','TUSD','USDD','PYUSD','EURS','SUSD']);
const nowISO = () => new Date().toISOString();
const todayUTC = () => nowISO().slice(0, 10);
const log = (...a) => console.log('[' + nowISO() + ']', ...a);

let S = { trades: {}, profit: 0, closed: 0, day: todayUTC(), dayPnl: 0, equity: CFG.equityStart, info: {}, noBin: {}, buys: 0, stopDay: null, stopWhy: '' };
function loadState() { try { const j = JSON.parse(fs.readFileSync(CFG.stateFile, 'utf8')); Object.keys(j).forEach(k => { S[k] = j[k]; }); } catch (e) {} }
function saveState() { try { fs.writeFileSync(CFG.stateFile, JSON.stringify(S)); } catch (e) { log('state-save-fail', e.message); } }

async function jget(url, headers, timeoutMs) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), timeoutMs || 20000);
  try {
    const r = await fetch(url, { headers: headers || {}, signal: ctl.signal });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) {}
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + ((j && j.msg) || t.slice(0, 80)));
    return j;
  } finally { clearTimeout(to); }
}
let timeOffset = 0;
async function syncTime() { if (CFG.mode === 'paper') return; try { const j = await jget(CFG.base + '/api/v3/time'); timeOffset = (j.serverTime || Date.now()) - Date.now(); } catch (e) {} }
function sign(qs) { return crypto.createHmac('sha256', CFG.sec).update(qs).digest('hex'); }
async function signed(method, path, params) {
  params = params || {}; params.timestamp = Date.now() + timeOffset; params.recvWindow = 5000;
  const qs = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const url = CFG.base + path + '?' + qs + '&signature=' + sign(qs);
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { method, headers: { 'X-MBX-APIKEY': CFG.key }, signal: ctl.signal });
    const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) {}
    if (!r.ok) throw new Error((j && j.msg) || ('HTTP ' + r.status));
    return j;
  } finally { clearTimeout(to); }
}
async function tg(msg) {
  if (!CFG.tgBot || !CFG.tgChat) return;
  try { await jget('https://api.telegram.org/bot' + CFG.tgBot + '/sendMessage?chat_id=' + encodeURIComponent(CFG.tgChat) + '&text=' + encodeURIComponent(msg), null, 10000); } catch (e) {}
  await tgCh(msg);
}
async function tgCh(msg) {
  if (!CFG.tgBot || !CFG.tgChannel) return;
  try { await jget('https://api.telegram.org/bot' + CFG.tgBot + '/sendMessage?chat_id=' + encodeURIComponent(CFG.tgChannel) + '&text=' + encodeURIComponent(msg), null, 10000); } catch (e) { log('channel-send-fail', e.message); }
}
// ➗ حصة الصفقة: تقسيم رأس المال على N عملات (4/6/8) أو حصة ثابتة
function stakeFor() {
  if (CFG.splitN > 1) return Math.max(5, S.equity / CFG.splitN);
  return CFG.stake;
}
async function getInfo(sym) {
  if (S.info[sym] && Date.now() - S.info[sym].at < 3600000) return S.info[sym];
  const j = await signed('GET', '/api/v3/exchangeInfo', { symbol: sym });
  const s = (j.symbols || [])[0]; if (!s) throw new Error('NO_SYMBOL ' + sym);
  const lot = (s.filters || []).find(f => f.filterType === 'LOT_SIZE') || {};
  const nn = (s.filters || []).find(f => f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL') || {};
  const info = { step: parseFloat(lot.stepSize || '1'), minNot: parseFloat(nn.minNotional || nn.notional || '0'), at: Date.now() };
  S.info[sym] = info; return info;
}
function floorStep(q, step) { if (!step || step <= 0) return q; const dec = (String(step).split('.')[1] || '').length; return parseFloat((Math.floor(q / step) * step).toFixed(dec)); }

function tfRising(kl) {
  if (!kl || kl.length < 12) return false;
  const c = kl.map(k => parseFloat(k[4])), o = kl.map(k => parseFloat(k[1])), v = kl.map(k => parseFloat(k[5]));
  if (c.some(x => !isFinite(x) || x <= 0)) return false;
  const sma = c.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const lc = c.slice(-3), lo = o.slice(-3);
  const green = lo.filter((x, i) => lc[i] > x).length;
  const rising = lc[2] > lc[1] && lc[1] >= lc[0] * 0.999;
  const avgV = v.slice(-6, -1).reduce((a, b) => a + b, 0) / 5;
  return green >= 2 && rising && lc[2] > sma && v[v.length - 1] > avgV * 0.8;
}
function m5setup(kl) {
  if (!kl || kl.length < 12) return null;
  const c = kl.map(k => parseFloat(k[4])), o = kl.map(k => parseFloat(k[1])), v = kl.map(k => parseFloat(k[5]));
  if (c.some(x => !isFinite(x) || x <= 0)) return null;
  const sma = c.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const lc = c.slice(-3), lo = o.slice(-3);
  const green = lo.filter((x, i) => lc[i] > x).length;
  const rising = lc[2] > lc[1] && lc[1] >= lc[0] * 0.999;
  const avgV = v.slice(-6, -1).reduce((a, b) => a + b, 0) / 5;
  if (green >= 2 && rising && lc[2] > sma && v[v.length - 1] > avgV) return { close: lc[2], closes: c.slice(-20) };
  return null;
}
function makePlan(entry, closes) {
  let atr = entry * 0.015;
  const d = []; for (let i = 1; i < closes.length; i++) d.push(Math.abs(closes[i] - closes[i - 1]));
  const tail = d.slice(-14); if (tail.length) atr = tail.reduce((x, y) => x + y, 0) / tail.length || atr;
  const risk = Math.min(Math.max(atr * 1.2, entry * 0.008), entry * 0.06);
  return { entry, t1: entry + risk * 1.5, t2: entry + risk * 2.5, t3: entry + risk * 4, sl: entry - risk };
}

/* HQ ENTRY FILTER — قسم منفرد يعمل وحده: المنطق الكامل في hq-entry.js
 *  فحصه وحده: node hq-entry.js --selftest | بيئة: HQ_MIN_SCORE(85) RISK_PCT(1.5) HQ_COOLDOWN_H(4) */
const HQE = require('./hq-entry');
const HQCFG = {
  minScore: Math.max(0, Math.min(100, parseInt(process.env.HQ_MIN_SCORE || '85', 10))),
  riskPct: Math.min(5, Math.max(0.25, parseFloat(process.env.RISK_PCT || '1.5'))),
  cooldownH: Math.max(0, parseFloat(process.env.HQ_COOLDOWN_H || '4')),
};
if (!S.lastClose) S.lastClose = {};
const hqCache = {};
async function hqIO(sym, interval, limit) {
  const ttl = interval === '1d' ? 1800000 : interval === '4h' ? 300000 : 120000;
  const k = sym + ':' + interval;
  const c = hqCache[k];
  if (c && Date.now() - c.t < ttl) return c.kl;
  const kl = await jget(CFG.base + '/api/v3/klines?symbol=' + sym + '&interval=' + interval + '&limit=' + (limit || 100));
  if (!kl || kl.length < 30) return null;
  hqCache[k] = { kl, t: Date.now() };
  return kl;
}

async function openTrade(sym, base, plan, stakeOpt, hqOpt, idOpt) {
  const id = idOpt || ('m5:' + sym);
  if (S.trades[id] && S.trades[id].open) return;
  if (Object.values(S.trades).some(t => t && t.open && t.sym === sym)) return; // صفقة واحدة لكل عملة
  if (!idOpt && S.lastClose[sym] && Date.now() - S.lastClose[sym] < HQCFG.cooldownH * 3600e3) return; // منع تكرار الدخول على نفس الإشارة
  if (Object.values(S.trades).filter(t => t && t.open).length >= CFG.max) return;
  if (S.equity < Math.min(10, CFG.equityStart * 0.2)) { log('equity-depleted, pausing'); stop('equity'); return; }
  const firstStake = stakeOpt > 0 ? stakeOpt : stakeFor() * CFG.splitInit;
  let qty = firstStake / plan.entry, step = 1, avgFill = 0;
  if (CFG.mode !== 'paper') {
    if (!CFG.key || !CFG.sec) { log('missing keys'); return; }
    const info = await getInfo(sym); step = info.step || 1;
    if (firstStake < (info.minNot || 0)) { log('below-min-notional', sym); return; }
    const o = await signed('POST', '/api/v3/order', { symbol: sym, side: 'BUY', type: 'MARKET', quoteOrderQty: firstStake });
    let q = 0, qv = 0; (o.fills || []).forEach(f => { const fq = parseFloat(f.qty || 0); q += fq; qv += fq * parseFloat(f.price || 0); });
    if (q > 0) { qty = q; if (qv > 0) avgFill = qv / q; }
  } else qty = floorStep(qty, 0.000001);
  const entryPx = avgFill > 0 ? avgFill : plan.entry;
  S.trades[id] = { id, sym, coin: base, qty, entry: entryPx, t1: plan.t1, t2: plan.t2, t3: plan.t3, sl: plan.sl, step, open: true, s1: false, s2: false, sold: 0, rev: 0, t0: Date.now(), stake: firstStake, stakePlanned: stakeFor(), splitInit: CFG.splitInit, adds: 0, rT1: plan.t1 / entryPx, rT2: plan.t2 / entryPx, rT3: plan.t3 / entryPx, rSl: plan.sl / entryPx, peak: entryPx, hqScore: (hqOpt && hqOpt.score) || 0 };
  S.buys++;
  saveState();
  log('BUY', base, 'x' + qty, '@' + plan.entry, hqOpt ? ('HQscore=' + hqOpt.score + ' RR=' + hqOpt.rr) : '');
  await tg(hqOpt ? HQE.formatAlert(Object.assign({}, hqOpt, { sym: base })) : ('🟢 شراء ' + base + ' @ ' + plan.entry));
}
async function sellPart(st, frac, why, live) {
  let q = st.qty * frac;
  if (CFG.mode !== 'paper') {
    q = floorStep(q, st.step || 1); if (q <= 0) return false;
    await signed('POST', '/api/v3/order', { symbol: st.sym, side: 'SELL', type: 'MARKET', quantity: q });
  }
  st.sold += q; st.rev += q * live;
  if (why === 'T1') st.s1 = true;
  if (why === 'T2') st.s2 = true;
  if (st.sold >= st.qty * 0.999 || why === 'STOP' || why === 'T3' || why === 'TP' || why === 'INST' || why === 'TRAIL') {
    st.open = false; st.closeWhy = why; st.closeAt = Date.now();
    const pnl = st.rev - st.qty * st.entry;
    S.profit += pnl; S.closed++; S.dayPnl += pnl; S.equity += pnl;
    S.lastClose[st.sym] = Date.now(); // منع إعادة الدخول الفوري على نفس الإشارة
    saveState();
    log((pnl >= 0 ? 'CLOSE-WIN' : 'CLOSE-LOSS'), st.coin, '(' + why + ')', (pnl >= 0 ? '+' : '') + pnl.toFixed(2), 'equity=' + S.equity.toFixed(2));
    await tg((pnl >= 0 ? '✅ ' : '🔴 ') + st.coin + ' (' + why + ') ' + (pnl >= 0 ? '+' : '') + pnl.toFixed(2));
    if (S.dayPnl <= -CFG.dayMaxLoss) { log('DAILY-LOSS-LIMIT hit, pausing till tomorrow'); stop('loss-limit'); }
    if (S.dayPnl >= CFG.dailyGoal) { log('DAILY-GOAL $' + CFG.dailyGoal + ' hit — stopping for today 🏆'); await tg('🏆 هدف اليوم $' + CFG.dailyGoal + ' تحقق — توقف حتى الغد'); stop('goal'); }
  } else {
    saveState();
    log('PART', st.coin, why, 'sold ' + q.toFixed(4) + ' @ ' + live);
  }
  return true;
}
async function reinforce(st, live) {
  if (!CFG.rein || !st || !st.open) return false;
  if ((st.adds || 0) >= CFG.reinMax) return false;
  if (!(live <= st.entry * (1 - CFG.reinDrop))) return false;
  const planned = st.stakePlanned || st.stake || 0;
  const rem = Math.max(0, planned * (1 - (st.splitInit || 1)) - (st.added || 0));
  if (rem <= 0) return false;
  let addStake = rem / Math.max(1, CFG.reinMax - (st.adds || 0));
  addStake = Math.min(addStake, S.equity * 0.5);
  if (addStake <= 0) return false;
  let addQty = addStake / live;
  if (CFG.mode !== 'paper') {
    const info = await getInfo(st.sym);
    if (addStake < (info.minNot || 0)) return false;
    const o = await signed('POST', '/api/v3/order', { symbol: st.sym, side: 'BUY', type: 'MARKET', quoteOrderQty: addStake });
    let q = 0; (o.fills || []).forEach(f => { q += parseFloat(f.qty || 0); });
    if (q > 0) addQty = q;
  } else addQty = floorStep(addQty, 0.000001);
  if (!(addQty > 0)) return false;
  const newQty = st.qty + addQty;
  const newAvg = (st.entry * st.qty + live * addQty) / newQty;
  st.qty = newQty; st.entry = newAvg;
  st.t1 = newAvg * (st.rT1 || 1.02); st.t2 = newAvg * (st.rT2 || 1.03); st.t3 = newAvg * (st.rT3 || 1.05); st.sl = newAvg * (st.rSl || 0.99);
  st.stake = (st.stake || 0) + addStake; st.added = (st.added || 0) + addStake; st.adds = (st.adds || 0) + 1;
  saveState();
  log('ADD', st.coin, '#' + st.adds, '@' + live, 'avg=' + newAvg);
  await tg('➕ تعزيز ' + st.coin + ' #' + st.adds + ' @ ' + live);
  return true;
}
async function manage(st, live) {
  if (!st || !st.open) return;
  st.peak = Math.max(st.peak || st.entry, live);
  await reinforce(st, live);
  const pnlNow = (st.rev || 0) - (st.sold || 0) * st.entry + (live - st.entry) * (st.qty - (st.sold || 0));
  st.peakPnl = Math.max(st.peakPnl || 0, pnlNow);
  // سلم الربح التكيفي: هبوط + 0.60$+ → قفل كبير، هبوط + 0.30$+ → خروج صغير، صعود مستمر → يُترك حتى سقف 0.70$
  const down = live < (st.peak || live) * 0.999;
  if (pnlNow >= 0.6 && down) { const rem = st.qty - (st.sold || 0); if (rem > 0) await sellPart(st, rem / st.qty, 'TRAIL', live); return; }
  if (pnlNow >= CFG.minTp && down) { const rem = st.qty - (st.sold || 0); if (rem > 0) await sellPart(st, rem / st.qty, 'INST', live); return; }
  if (pnlNow >= CFG.tp) { const rem = st.qty - (st.sold || 0); if (rem > 0) await sellPart(st, rem / st.qty, 'TP', live); return; }
  if (live >= st.t1 && !st.s1) await sellPart(st, 0.30, 'T1', live);
  // 🏆 عند TP1: نقل الوقف لنقطة الدخول + هامش رسوم — حماية رأس المال
  if (st.s1 && st.open && st.sl < st.entry * 1.002) { st.sl = st.entry * 1.002; saveState(); log('BREAKEVEN', st.coin, 'stop→entry'); }
  if (st.open && live >= st.t2 && !st.s2) await sellPart(st, 0.50, 'T2', live);
  if (!st.open) return;
  // تراجع بعد هدف 1 والوقف مرفوع للدخول: إغلاق كامل بربح فوق القفل بدل انتظار العودة للتعادل
  if (st.s1 && live < st.peak * 0.99 && live > st.entry) { const rem = st.qty - st.sold; if (rem > 0) await sellPart(st, rem / st.qty, 'PULLBACK', live); return; }
  if (st.open && live >= st.t2 && !st.s2) await sellPart(st, 0.50, 'T2', live);
  if (!st.open) return;
  if (live <= st.sl) { const rem = st.qty - st.sold; if (rem > 0) await sellPart(st, rem / st.qty, 'STOP', live); return; }
  if (live >= st.t3) { const rem = st.qty - st.sold; if (rem > 0) await sellPart(st, rem / st.qty, 'T3', live); }
}
function baseOf(sym) { return sym.slice(0, -4); }
async function cycle(n) {
  if (todayUTC() !== S.day) { S.day = todayUTC(); S.dayPnl = 0; S.stopDay = null; S.stopWhy = ''; saveState(); log('new-day: counters reset, resuming 🎯'); }
  log('--- cycle', n, 'mode=' + CFG.mode, 'equity=' + S.equity.toFixed(2), 'dayPnl=' + S.dayPnl.toFixed(2));
  let tickers;
  try { tickers = await jget(CFG.base + '/api/v3/ticker/24hr'); }
  catch (e) { log('ticker-fetch-fail:', e.message); return; }
  const cands = tickers
    .filter(t => t.symbol && t.symbol.endsWith('USDT') && !/(UP|DOWN|BULL|BEAR)USDT$/.test(t.symbol) && !STABLES.has(baseOf(t.symbol)))
    .filter(t => parseFloat(t.quoteVolume || 0) >= CFG.minVol)
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, CFG.topN * 3);
  let scanned = 0, hqRuns = 0, hqBuys = 0;
  const rej = {};
  if (!S.lastClose) S.lastClose = {};
  for (const k of Object.keys(S.lastClose)) { if (Date.now() - S.lastClose[k] > 24 * 3600e3) delete S.lastClose[k]; }
  for (const t of cands) {
    try {
      if (Object.values(S.trades).filter(x => x && x.open).length >= CFG.max) break;
      const sym = t.symbol;
      if (S.trades['m5:' + sym]) continue;
      if (S.lastClose[sym] && Date.now() - S.lastClose[sym] < HQCFG.cooldownH * 3600e3) continue; // بلا تكرار على نفس الإشارة
      if (S.noBin[baseOf(sym)] && Date.now() - S.noBin[baseOf(sym)] < 3600000) continue;
      const kl = await jget(CFG.base + '/api/v3/klines?symbol=' + sym + '&interval=5m&limit=21');
      scanned++;
      const setup = m5setup(kl);
      if (!setup) continue;
      // تأكيد الفريمات الصغيرة: 15m اتجاه + 1m توقيت
      const kl15 = await jget(CFG.base + '/api/v3/klines?symbol=' + sym + '&interval=15m&limit=21');
      scanned++;
      if (!tfRising(kl15)) continue;
      const kl1 = await jget(CFG.base + '/api/v3/klines?symbol=' + sym + '&interval=1m&limit=21');
      scanned++;
      if (!tfRising(kl1)) continue;
      const chg = parseFloat(t.priceChangePercent || 0);
      if (chg > 25 || chg < -8) continue;
      if (Math.abs(setup.close - parseFloat(t.lastPrice)) / parseFloat(t.lastPrice) > 0.005) continue;
      // 🏆 بوابة الدخول الاحترافي: الفحص الكامل قبل أي شراء
      let hq = null;
      try { hq = await HQE.hqEvaluate(sym, t, hqIO, { minScore: HQCFG.minScore, riskPct: HQCFG.riskPct, equity: S.equity }); }
      catch (e) { log('hq-eval-fail', sym, e.message); continue; }
      hqRuns++;
      if (!hq.ok) { const r0 = (hq.rejects && hq.rejects[0]) || 'reject'; rej[r0] = (rej[r0] || 0) + 1; continue; }
      if (!(hq.stake > 0)) { rej['size-too-small'] = (rej['size-too-small'] || 0) + 1; continue; }
      hqBuys++;
      await openTrade(sym, baseOf(sym), hq.plan, hq.stake, hq);
    } catch (e) {
      if (/400|404|451|restricted/i.test(e.message)) S.noBin[baseOf(t.symbol)] = Date.now();
    }
  }
  log('scanned-klines=' + scanned + ' hq-evaluated=' + hqRuns + ' hq-buys=' + hqBuys);
  if (hqBuys === 0 && hqRuns > 0) {
    const top = Object.keys(rej).sort((a, b) => rej[b] - rej[a]).slice(0, 3).map(k => k + '×' + rej[k]).join(', ');
    log('NO TRADE — شروط الدخول غير مكتملة | مرفوضات: ' + (top || '—'));
  }
  if (n % CFG.heartbeat === 0) log('heartbeat: alive, open=' + Object.values(S.trades).filter(t => t && t.open).length + ' equity=$' + S.equity.toFixed(2) + ' dayPnl=' + (S.dayPnl >= 0 ? '+' : '') + S.dayPnl.toFixed(2));
  await manageOpen();
  saveState();
}
async function manageOpen() {
  if (todayUTC() !== S.day) { S.day = todayUTC(); S.dayPnl = 0; S.stopDay = null; S.stopWhy = ''; saveState(); }
  try {
    const prices = {};
    const syms = [...new Set(Object.values(S.trades).filter(t => t && t.open).map(t => t.sym))];
    if (syms.length) {
      const arr = await jget(CFG.base + '/api/v3/ticker/price?symbols=' + encodeURIComponent(JSON.stringify(syms)));
      (Array.isArray(arr) ? arr : [arr]).forEach(x => { prices[x.symbol] = parseFloat(x.price); });
    }
    for (const st of Object.values(S.trades)) {
      if (!st || !st.open) continue;
      const live = prices[st.sym];
      if (!live) continue;
      await manage(st, live);
    }
  } catch (e) { log('manage-fail:', e.message); }
}

let running = true;
function stop(why) { running = false; S.stopDay = todayUTC(); S.stopWhy = why || ''; saveState(); }
async function selftest() {
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); } };
  S.dayPnl = 0; S.day = todayUTC(); S.trades = {}; running = true;
  const K = [];
  for (let i = 0; i < 20; i++) { const o = 100 + i * 0.3; K.push([0, o, o + 0.5, o - 0.2, o + 0.4, 1000 + i * 100]); }
  const s1 = m5setup(K.map(r => r.map(String)));
  ok('m5-bullish-setup', !!s1 && s1.close > 0);
  const Kb = [];
  for (let i = 0; i < 20; i++) { const o = 100 - i * 0.5; Kb.push([0, o, o + 0.2, o - 0.5, o - 0.4, 1000]); }
  ok('m5-bearish-reject', m5setup(Kb.map(r => r.map(String))) === null);
  ok('m5-short-reject', m5setup([[0, '1', '2', '0.5', '1.5', '10']]) === null);
  ok('tf-bullish-accept', tfRising(K.map(r => r.map(String))) === true);
  ok('tf-bearish-reject', tfRising(Kb.map(r => r.map(String))) === false);
  ok('reinforce-adds-on-dip', await (async () => { const sr = { id: 'm5:R', sym: 'RUSDT', coin: 'R', qty: 0.5, entry: 100, t1: 102, t2: 103, t3: 105, sl: 99, step: 0.001, open: true, s1: false, s2: false, sold: 0, rev: 0, mode: 'paper', t0: Date.now(), stake: 50, stakePlanned: 100, splitInit: 0.5, adds: 0, rT1: 1.02, rT2: 1.03, rT3: 1.05, rSl: 0.99 }; S.trades['m5:R'] = sr; S.equity = 1000; const okAdd = await reinforce(sr, 98.5); return okAdd === true && sr.adds === 1 && sr.qty > 0.5 && sr.entry < 100; })());
  const p = makePlan(100, K.map(r => r[4]));
  ok('plan-levels', p.t3 > p.t2 && p.t2 > p.t1 && p.t1 > p.entry && p.sl < p.entry);
  const _tp = CFG.tp; CFG.tp = 1e9;
  const _minTp = CFG.minTp; CFG.minTp = 1e9;
  const st = { id: 'm5:T', sym: 'TUSDT', coin: 'T', qty: 1, entry: 100, t1: 101.5, t2: 102.5, t3: 104, sl: 99, step: 0.001, open: true, s1: false, s2: false, sold: 0, rev: 0, mode: 'paper', t0: Date.now(), stake: 100 };
  S.trades['m5:T'] = st;
  await manage(st, 101.6);
  ok('T1-partial-30%', st.s1 === true && Math.abs(st.sold - 0.3) < 1e-9 && st.open === true);
  await manage(st, 102.6);
  ok('T2-partial-50%', st.s2 === true && st.sold > 0.3 && st.open === true);
  await manage(st, 104.5);
  ok('T3-full-close', st.open === false && st.closeWhy === 'T3');
  CFG.tp = _tp; CFG.minTp = _minTp;
  ok('TP-cap-closes-early', await (async () => { const sx = { id: 'm5:TP', sym: 'PUSDT', coin: 'P', qty: 100, entry: 10, t1: 10.5, t2: 11, t3: 12, sl: 9.9, step: 1, open: true, s1: false, s2: false, sold: 0, rev: 0, mode: 'paper', t0: Date.now(), stake: 1000 }; S.trades['m5:TP'] = sx; await manage(sx, 10.008); return sx.open === false && sx.closeWhy === 'TP'; })());
  const st2 = { id: 'm5:T2', sym: 'XUSDT', coin: 'X', qty: 10, entry: 100, t1: 101.5, t2: 102.5, t3: 104, sl: 99, step: 1, open: true, s1: false, s2: false, sold: 0, rev: 0, mode: 'paper', t0: Date.now(), stake: 1000 };
  S.trades['m5:T2'] = st2;
  await manage(st2, 98.5);
  ok('STOP-close', st2.open === false && st2.closeWhy === 'STOP');
  S.dayPnl = 9.5;
  running = true;
  const st3 = { id: 'm5:G', sym: 'GUSDT', coin: 'G', qty: 100, entry: 10, t1: 10.5, t2: 11, t3: 12, sl: 9.9, step: 1, open: true, s1: false, s2: false, sold: 0, rev: 0, mode: 'paper', t0: Date.now(), stake: 1000 };
  S.trades['m5:G'] = st3;
  await manage(st3, 10.008);
  ok('DAILY-GOAL-stop', st3.open === false && running === false && S.dayPnl >= 10);
  S.equity = 100; CFG.splitN = 4;
  ok('split-4-stake', stakeFor() === 25);
  CFG.splitN = 0;
  ok('split-off-fixed', stakeFor() === CFG.stake);
  CFG.splitN = 4;
  const hqrs = await HQE.runSelftest();
  hqrs.forEach(r => ok('hq-' + r.name, r.pass));
  // وقف التعادل بعد TP1: يُرفع الوقف للدخول+هامش رسوم
  const _tp2 = CFG.tp, _minTp2 = CFG.minTp; CFG.tp = 1e9; CFG.minTp = 1e9;
  const stb = { id: 'm5:B', sym: 'BUSDT', coin: 'B', qty: 10, entry: 100, t1: 101.5, t2: 102.5, t3: 104, sl: 99, step: 1, open: true, s1: false, s2: false, sold: 0, rev: 0, mode: 'paper', t0: Date.now(), stake: 1000 };
  S.trades['m5:B'] = stb;
  await manage(stb, 101.6);
  CFG.tp = _tp2; CFG.minTp = _minTp2;
  ok('breakeven-after-T1', stb.s1 === true && stb.sl >= stb.entry, 'sl=' + stb.sl);
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

let lastPost = 0, lastSignal = {};
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Bot-Key');
  res.setHeader('Cache-Control', 'no-store');
}
function jbody(res, code, obj) { cors(res); res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
function auth(req, url) { if (!CFG.signalSecret) return true; var k = req.headers['x-bot-key'] || url.searchParams.get('key') || ''; return k === CFG.signalSecret; }
function stateOut() {
  var open = Object.values(S.trades).filter(t => t && t.open).map(t => ({ sym: t.sym, coin: t.coin, entry: t.entry, qty: t.qty, t1: t.t1, t2: t.t2, t3: t.t3, sl: t.sl, t0: t.t0, stake: t.stake }));
  var last = Object.values(S.trades).filter(t => t && !t.open).sort((a, b) => (b.closeAt || 0) - (a.closeAt || 0)).slice(0, 20)
    .map(t => ({ sym: t.sym, coin: t.coin, entry: t.entry, exit: (t.rev && t.qty) ? t.rev / (t.sold || t.qty) : null, reason: t.closeWhy, pnl: t.rev - t.qty * t.entry, stake: t.stake, t0: t.t0, closeAt: t.closeAt }));
  return { ok: true, mode: CFG.mode, equity: S.equity, profit: S.profit, closed: S.closed, day: S.day, dayPnl: S.dayPnl, buys: S.buys, maxTrades: CFG.max, open, last };
}
// 📣 بوابة التطبيق: /notify للأحداث • /state لحالة الحساب • /signal لاستقبال إشارات الأقسام
function startApi() {
  const http = require('http');
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }
    if (req.method === 'GET' && url.pathname === '/state') {
      if (!auth(req, url)) return jbody(res, 403, { ok: false, error: 'bad key' });
      return jbody(res, 200, stateOut());
    }
    if (req.method === 'POST' && url.pathname === '/signal') {
      let b = '';
      req.on('data', c => { b += c; if (b.length > 4000) { try { req.destroy(); } catch (e) {} } });
      req.on('end', async () => {
        try {
          const j = JSON.parse(b || '{}');
          if (!auth(req, url) || (j.key && j.key !== CFG.signalSecret)) return jbody(res, 403, { ok: false, error: 'bad key' });
          const sym = String(j.sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const entry = +j.entry, sl = +j.sl, t1 = +j.t1, t2 = +j.t2, t3 = +j.t3;
          if (!/^[A-Z0-9]{2,20}USDT$/.test(sym) || !(entry > 0) || !(sl > 0) || !(t1 > entry) || !(sl < entry)) return jbody(res, 400, { ok: false, error: 'bad plan' });
          if ((t1 - entry) / (entry - sl) < 1.2) return jbody(res, 400, { ok: false, error: 'bad plan (RR < 1.2)' });
          if (S.stopDay === todayUTC()) return jbody(res, 409, { ok: false, error: 'daily limit reached' });
          if (Object.values(S.trades).some(t => t && t.open && t.sym === sym)) return jbody(res, 409, { ok: false, error: 'already open' });
          if (S.lastClose && S.lastClose[sym] && Date.now() - S.lastClose[sym] < 10 * 60e3) return jbody(res, 409, { ok: false, error: 'cooldown after close' });
          if (lastSignal[sym] && Date.now() - lastSignal[sym] < 15000) return jbody(res, 429, { ok: false, error: 'slow down' });
          lastSignal[sym] = Date.now();
          const px = (await jget(CFG.base + '/api/v3/ticker/price?symbol=' + sym)).price;
          if (!(px > 0) || px > entry * 1.015 || px < sl) return jbody(res, 409, { ok: false, error: 'price moved', price: px });
          const sp = Math.min(25, Math.max(1, +j.stakePct || 15));
          const used = Object.values(S.trades).filter(t => t && t.open).reduce((a, t) => a + (+t.stake || 0), 0);
          const stake = Math.min(S.equity * sp / 100, S.equity * 0.5, Math.max(0, S.equity - used));
          if (stake < 5) return jbody(res, 409, { ok: false, error: 'rejected (no free equity)' });
          const plan = { entry, t1, t2: t2 > t1 ? t2 : t1 * 1.01, t3: t3 > t2 ? t3 : (t2 > t1 ? t2 : t1 * 1.01) * 1.01, sl };
          const id = 'sig:' + sym + ':' + Date.now();
          await openTrade(sym, baseOf(sym), plan, stake, null, id);
          const ok = !!(S.trades[id] && S.trades[id].open);
          return jbody(res, ok ? 200 : 409, ok ? { ok: true, id, sym, stake, price: px } : { ok: false, error: 'rejected (max trades / min notional / equity)' });
        } catch (e) { return jbody(res, 500, { ok: false, error: String((e && e.message) || e).slice(0, 120) }); }
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/notify') {
      let b = '';
      req.on('data', c => { b += c; if (b.length > 2000) { try { req.destroy(); } catch (e) {} } });
      req.on('end', async () => {
        try {
          const j = JSON.parse(b || '{}');
          if (!CFG.notifySecret || j.key !== CFG.notifySecret) return jbody(res, 403, { ok: false, error: 'bad key' });
          const text = String(j.text || '').slice(0, 900);
          if (!text) return jbody(res, 400, { ok: false, error: 'empty' });
          if (Date.now() - lastPost < 3000) return jbody(res, 429, { ok: false, error: 'slow down' });
          lastPost = Date.now();
          await tgCh(text);
          return jbody(res, 200, { ok: true });
        } catch (e) { return jbody(res, 500, { ok: false }); }
      });
      return;
    }
    return jbody(res, 404, {});
  });
  srv.listen(CFG.port, () => { log('api listening :' + CFG.port); if (CFG.notifySecret) tgCh('🚀 سيرفر البوت يعمل — القناة مربوطة ✅'); });
}

async function main() {
  if (process.argv.includes('--selftest')) return selftest();
  if (CFG.mode !== 'paper' && (!CFG.key || !CFG.sec)) { console.error('need BINANCE_KEY + BINANCE_SECRET for ' + CFG.mode); process.exit(1); }
  loadState();
  if (todayUTC() !== S.day) { S.day = todayUTC(); S.dayPnl = 0; }
  await syncTime();
  startApi();
  log('BOT SERVER start mode=' + CFG.mode + ' base=' + CFG.base + ' stake=$' + CFG.stake + ' tp=$' + CFG.tp + ' max=' + CFG.max + ' goal=$' + CFG.dailyGoal + ' equity=$' + S.equity.toFixed(2));
  let n = 0;
  process.on('SIGINT', () => { log('SIGINT, saving...'); saveState(); process.exit(0); });
  process.on('SIGTERM', () => { log('SIGTERM, saving...'); saveState(); process.exit(0); });
  process.on('unhandledRejection', e => log('unhandled:', (e && e.message) || e));
  while (true) {
    n++;
    try {
      if (CFG.signalOnly) {
        await manageOpen();
        if (n % 30 === 1) log('signal-only mode — managing open trades, waiting for /signal');
      } else if (S.stopDay === todayUTC()) {
        if (n % 10 === 1) log('paused (' + (S.stopWhy || 'limit') + ') — waiting for next day, will resume automatically 🔁');
      } else {
        S.stopDay = null;
        await cycle(n);
      }
    } catch (e) { log('cycle-error:', (e && e.message) || e); }
    if (CFG.maxCycles && n >= CFG.maxCycles) break;
    await new Promise(r => setTimeout(r, (CFG.signalOnly ? Math.min(CFG.poll, 15) : CFG.poll) * 1000));
  }
  saveState();
  log('exit after ' + n + ' cycles');
}
main();
