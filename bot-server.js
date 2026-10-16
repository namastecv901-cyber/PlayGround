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
 *  فحص ذاتي: node bot-server.js --selftest
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
  ownerCode: process.env.OWNER_CODE || process.env.NOTIFY_SECRET || '1234',
  privateFile: process.env.PRIVATE_FILE || './private-system.json',
  autosaveSec: Math.max(10, parseInt(process.env.AUTOSAVE_SEC || '20', 10)),
  port: parseInt(process.env.PORT || '8787', 10),
  stateFile: process.env.STATE_FILE || './bot-state.json',
  maxCycles: parseInt(process.env.CYCLES || '0', 10),
};
const BOOT_AT = Date.now();
const STABLES = new Set(['USDT','USDC','DAI','FDUSD','USDE','TUSD','USDD','PYUSD','EURS','SUSD']);
const nowISO = () => new Date().toISOString();
const todayUTC = () => nowISO().slice(0, 10);
const log = (...a) => console.log('[' + nowISO() + ']', ...a);

let S = { trades: {}, profit: 0, closed: 0, day: todayUTC(), dayPnl: 0, equity: CFG.equityStart, info: {}, noBin: {}, buys: 0, stopDay: null, stopWhy: '' };
// 🗄️ مخزن النظام الخاص (my-system.html) — يبقى في السيرفر 24/7 حتى بعد خروجك ودخولك
let PRIV = { updatedAt: null, db: null };
function ensureDirFor(f) { try { const d = require('path').dirname(f); if (d && d !== '.' && d !== './') fs.mkdirSync(d, { recursive: true }); } catch (e) {} }
// 💾 حفظ ذري: كتابة لملف مؤقت ثم rename — لا يضيع أبداً حتى لو انطفأ السيرفر فجأة + نسخة احتياطية
function atomicWrite(file, data) {
  ensureDirFor(file);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, data);
  try {
    if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
  } catch (e) {}
  fs.renameSync(tmp, file);
}
function loadState() {
  try { const j = JSON.parse(fs.readFileSync(CFG.stateFile, 'utf8')); Object.keys(j).forEach(k => { S[k] = j[k]; }); }
  catch (e) {
    try { const j = JSON.parse(fs.readFileSync(CFG.stateFile + '.bak', 'utf8')); Object.keys(j).forEach(k => { S[k] = j[k]; }); log('state-restored-from-backup ✅'); }
    catch (e2) {}
  }
}
function saveState() { try { atomicWrite(CFG.stateFile, JSON.stringify(S)); } catch (e) { log('state-save-fail', e.message); } }
function loadPriv() { try { PRIV = JSON.parse(fs.readFileSync(CFG.privateFile, 'utf8')); if (!PRIV || typeof PRIV !== 'object') PRIV = { updatedAt: null, db: null }; } catch (e) { try { PRIV = JSON.parse(fs.readFileSync(CFG.privateFile + '.bak', 'utf8')); } catch (e2) { PRIV = { updatedAt: null, db: null }; } } }
function savePriv() { try { PRIV.updatedAt = nowISO(); atomicWrite(CFG.privateFile, JSON.stringify(PRIV)); } catch (e) { log('priv-save-fail', e.message); } }

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

async function openTrade(sym, base, plan) {
  const id = 'm5:' + sym;
  if (S.trades[id]) return;
  if (Object.values(S.trades).filter(t => t && t.open).length >= CFG.max) return;
  if (S.equity < Math.min(10, CFG.equityStart * 0.2)) { log('equity-depleted, pausing'); stop('equity'); return; }
  const firstStake = stakeFor() * CFG.splitInit;
  let qty = firstStake / plan.entry, step = 1;
  if (CFG.mode !== 'paper') {
    if (!CFG.key || !CFG.sec) { log('missing keys'); return; }
    const info = await getInfo(sym); step = info.step || 1;
    if (firstStake < (info.minNot || 0)) { log('below-min-notional', sym); return; }
    const o = await signed('POST', '/api/v3/order', { symbol: sym, side: 'BUY', type: 'MARKET', quoteOrderQty: firstStake });
    let q = 0; (o.fills || []).forEach(f => { q += parseFloat(f.qty || 0); });
    if (q > 0) qty = q;
  } else qty = floorStep(qty, 0.000001);
  S.trades[id] = { id, sym, coin: base, qty, entry: plan.entry, t1: plan.t1, t2: plan.t2, t3: plan.t3, sl: plan.sl, step, open: true, s1: false, s2: false, sold: 0, rev: 0, t0: Date.now(), stake: firstStake, stakePlanned: stakeFor(), splitInit: CFG.splitInit, adds: 0, rT1: plan.t1 / plan.entry, rT2: plan.t2 / plan.entry, rT3: plan.t3 / plan.entry, rSl: plan.sl / plan.entry, peak: plan.entry };
  S.buys++;
  saveState();
  log('BUY', base, 'x' + qty, '@' + plan.entry);
  await tg('🟢 شراء ' + base + ' @ ' + plan.entry);
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
  let scanned = 0;
  for (const t of cands) {
    try {
      if (Object.values(S.trades).filter(x => x && x.open).length >= CFG.max) break;
      const sym = t.symbol;
      if (S.trades['m5:' + sym]) continue;
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
      await openTrade(sym, baseOf(sym), makePlan(setup.close, setup.closes));
    } catch (e) {
      if (/400|404|451|restricted/i.test(e.message)) S.noBin[baseOf(t.symbol)] = Date.now();
    }
  }
  log('scanned-klines=' + scanned);
  if (n % CFG.heartbeat === 0) log('heartbeat: alive, open=' + Object.values(S.trades).filter(t => t && t.open).length + ' equity=$' + S.equity.toFixed(2) + ' dayPnl=' + (S.dayPnl >= 0 ? '+' : '') + S.dayPnl.toFixed(2));
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
  saveState();
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
  // 💾 الحفظ الدائم 24/7: ذري + مفتاح المالك + مخزن خاص
  ok('atomic-write-roundtrip', (() => { try { atomicWrite('/tmp/opencode/selftest-state.json', JSON.stringify({ a: 1 })); const r = JSON.parse(fs.readFileSync('/tmp/opencode/selftest-state.json', 'utf8')); return r.a === 1; } catch (e) { return false; } })());
  ok('owner-key-accept', (() => { const keep = CFG.ownerCode; CFG.ownerCode = 'SECRET123'; const r = checkKey({ key: 'SECRET123' }, new URLSearchParams('')) === true; CFG.ownerCode = keep; return r; })());
  ok('owner-key-reject', (() => { const keep = CFG.ownerCode; CFG.ownerCode = 'SECRET123'; const r = !checkKey({ key: 'WRONG' }, new URLSearchParams('')); CFG.ownerCode = keep; return r; })());
  ok('priv-save-load', (() => { const kf = CFG.privateFile; CFG.privateFile = '/tmp/opencode/selftest-priv.json'; PRIV = { updatedAt: null, db: { eq: 555 } }; savePriv(); loadPriv(); const r = PRIV.db && PRIV.db.eq === 555; CFG.privateFile = kf; loadPriv(); return r; })());
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

let lastPost = 0;
function checkKey(j, q) {
  const k = (j && j.key) || (q && q.get('key')) || '';
  return k && CFG.ownerCode && k === CFG.ownerCode;
}
// 🖥️ سيرفر حقيقي واحد: نفس الرابط يخدم الواجهة + الحفظ (بدون localhost)
//  GET  /health                  → نبض السيرفر (بدون مفتاح)
//  GET  /                        → الواجهة الرئيسية index.html
//  GET  /my-system.html          → نظامك الخاص (يفتح من نفس رابط السيرفر ✅)
//  GET  /api/bot                 → حالة البوت (بدون مفتاح، بيانات عامة فقط)
//  GET  /api/state?key=CODE      → تحميل نظامك الخاص
//  POST /api/state {key, data}   → حفظ نظامك الخاص (يبقى حتى بعد خروجك ودخولك)
//  POST /notify {key, text}       → بوابة التلغرام (التوكن لا يخرج من السيرفر)
const STATIC_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
function serveStatic(pathname, res) {
  try {
    let f = decodeURIComponent(pathname);
    if (f === '/') f = '/index.html';
    if (f.includes('..') || f.includes('\0')) return false;
    const path = require('path');
    const file = path.join(__dirname, f.slice(1));
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': STATIC_TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
    return true;
  } catch (e) { return false; }
}
function startServer() {
  const http = require('http');
  const srv = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const u = new URL(req.url || '/', 'http://x');
    // نبض — يكفي تفتحه لتعرف السيرفر حي
    if (req.method === 'GET' && u.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, alive: true, uptimeSec: Math.floor((Date.now() - BOOT_AT) / 1000), time: nowISO(), mode: CFG.mode, equity: S.equity, dayPnl: S.dayPnl, open: Object.values(S.trades).filter(t => t && t.open).length, privSavedAt: PRIV.updatedAt || null }));
      return;
    }
    if (req.method === 'GET' && u.pathname === '/api/bot') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, time: nowISO(), mode: CFG.mode, equity: S.equity, dayPnl: S.dayPnl, profit: S.profit, closed: S.closed, buys: S.buys, open: Object.values(S.trades).filter(t => t && t.open).map(t => ({ sym: t.sym, coin: t.coin, entry: t.entry, qty: t.qty })), stopDay: S.stopDay || null, stopWhy: S.stopWhy || '' }));
      return;
    }
    // تحميل النظام الخاص — يحتاج كود المالك
    if (req.method === 'GET' && u.pathname === '/api/state') {
      if (!checkKey(null, u.searchParams)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"bad key"}'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, updatedAt: PRIV.updatedAt, data: PRIV.db }));
      return;
    }
    if ((req.method === 'POST' && (u.pathname === '/api/state' || u.pathname === '/notify')) || (req.method === 'POST' && u.pathname === '/state')) {
      let b = '';
      req.on('data', c => { b += c; if (b.length > 1000000) { try { req.destroy(); } catch (e) {} } });
      req.on('end', async () => {
        try {
          const j = JSON.parse(b || '{}');
          if (!checkKey(j, u.searchParams)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"bad key"}'); return; }
          // حفظ النظام الخاص — أهم endpoint: كل شيء يحدث في نظامك يُحفظ هنا
          if (u.pathname === '/api/state' || u.pathname === '/state') {
            if (!j.data || typeof j.data !== 'object') { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"empty data"}'); return; }
            PRIV.db = j.data; savePriv(); saveState();
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, savedAt: PRIV.updatedAt }));
            return;
          }
          // بوابة التلغرام
          const text = String(j.text || '').slice(0, 900);
          if (!text) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"empty"}'); return; }
          if (Date.now() - lastPost < 3000) { res.writeHead(429, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"slow down"}'); return; }
          lastPost = Date.now();
          await tgCh(text);
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
        } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"ok":false}'); }
      });
      return;
    }
    // 📄 ملفات الواجهة من نفس السيرفر — نظامك يفتح من نفس الرابط (لا localhost بعد اليوم)
    if (req.method === 'GET' && !u.pathname.startsWith('/api/') && u.pathname !== '/health' && u.pathname !== '/notify') {
      if (serveStatic(u.pathname, res)) return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"not found"}');
  });
  srv.on('error', e => log('http-error:', e.message));
  srv.listen(CFG.port, () => {
    log('🌐 24/7 server listening :' + CFG.port + ' — /health /api/state /api/bot');
    if (CFG.tgBot && CFG.tgChannel) tgCh('🚀 سيرفر البوت يعمل 24/7 — الحفظ التلقائي شغال ✅');
    else log('notify OFF (no TG_BOT/TG_CHANNEL) — لكن الحفظ والسيرفر شغالان ✅');
  });
  // التقاط أي خطأ غير متوقع بدون إسقاط السيرفر
  process.on('uncaughtException', e => log('uncaught (kept alive):', (e && e.message) || e));
  return srv;
}

async function main() {
  if (process.argv.includes('--selftest')) return selftest();
  if (CFG.mode !== 'paper' && (!CFG.key || !CFG.sec)) { console.error('need BINANCE_KEY + BINANCE_SECRET for ' + CFG.mode); process.exit(1); }
  loadState();
  loadPriv();
  if (todayUTC() !== S.day) { S.day = todayUTC(); S.dayPnl = 0; }
  await syncTime();
  startServer();
  // 💾 حفظ دوري تلقائي — حتى لو حدث أي شيء، آخر نسخة محفوظة قبل ≤ AUTOSAVE_SEC ثانية
  setInterval(() => { try { saveState(); savePriv(); } catch (e) {} }, CFG.autosaveSec * 1000);
  log('BOT SERVER start mode=' + CFG.mode + ' base=' + CFG.base + ' stake=$' + CFG.stake + ' tp=$' + CFG.tp + ' max=' + CFG.max + ' goal=$' + CFG.dailyGoal + ' equity=$' + S.equity.toFixed(2) + ' | owner-protection=' + (CFG.ownerCode ? 'ON' : 'OFF') + ' privSavedAt=' + (PRIV.updatedAt || 'never'));
  let n = 0;
  const graceful = (sig) => { log(sig + ', saving...'); try { saveState(); savePriv(); } catch (e) {} process.exit(0); };
  process.on('SIGINT', () => graceful('SIGINT'));
  process.on('SIGTERM', () => graceful('SIGTERM'));
  process.on('unhandledRejection', e => log('unhandled:', (e && e.message) || e));
  while (true) {
    n++;
    try {
      if (S.stopDay === todayUTC()) {
        if (n % 10 === 1) log('paused (' + (S.stopWhy || 'limit') + ') — waiting for next day, will resume automatically 🔁');
      } else {
        S.stopDay = null;
        await cycle(n);
      }
    } catch (e) { log('cycle-error:', (e && e.message) || e); }
    if (CFG.maxCycles && n >= CFG.maxCycles) break;
    await new Promise(r => setTimeout(r, CFG.poll * 1000));
  }
  saveState();
  log('exit after ' + n + ' cycles');
}
main();
