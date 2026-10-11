#!/usr/bin/env node
/* 🤖 BOT SERVER — روبوت تداول Binance يعمل على سيرفر 24/7 (بدون هاتف)
 *
 *  التشغيل:
 *    MODE=paper node bot-server.js
 *    MODE=testnet BINANCE_KEY=xxx BINANCE_SECRET=yyy node bot-server.js
 *    MODE=live BINANCE_KEY=xxx BINANCE_SECRET=yyy node bot-server.js
 *  متغيرات (اختيارية): BASE_URL STAKE_USD TP_USD MAX_TRADES MIN_VOL_USD
 *    POLL_SEC TOP_N DAILY_MAX_LOSS EQUITY_START TG_BOT TG_CHAT STATE_FILE CYCLES
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
  max: parseInt(process.env.MAX_TRADES || '3', 10),
  minVol: parseFloat(process.env.MIN_VOL_USD || '20000000'),
  poll: Math.max(15, parseInt(process.env.POLL_SEC || '60', 10)),
  topN: Math.max(3, parseInt(process.env.TOP_N || '15', 10)),
  dayMaxLoss: parseFloat(process.env.DAILY_MAX_LOSS || '10'),
  equityStart: parseFloat(process.env.EQUITY_START || '100'),
  tgBot: process.env.TG_BOT || '',
  tgChat: process.env.TG_CHAT || '',
  stateFile: process.env.STATE_FILE || './bot-state.json',
  maxCycles: parseInt(process.env.CYCLES || '0', 10),
};
const STABLES = new Set(['USDT','USDC','DAI','FDUSD','USDE','TUSD','USDD','PYUSD','EURS','SUSD']);
const nowISO = () => new Date().toISOString();
const todayUTC = () => nowISO().slice(0, 10);
const log = (...a) => console.log('[' + nowISO() + ']', ...a);

let S = { trades: {}, profit: 0, closed: 0, day: todayUTC(), dayPnl: 0, equity: CFG.equityStart, info: {}, noBin: {}, buys: 0 };
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
  if (S.equity < Math.min(10, CFG.equityStart * 0.2)) { log('equity-depleted, stopping'); stop(); return; }
  let qty = CFG.stake / plan.entry, step = 1;
  if (CFG.mode !== 'paper') {
    if (!CFG.key || !CFG.sec) { log('missing keys'); return; }
    const info = await getInfo(sym); step = info.step || 1;
    if (CFG.stake < (info.minNot || 0)) { log('below-min-notional', sym); return; }
    const o = await signed('POST', '/api/v3/order', { symbol: sym, side: 'BUY', type: 'MARKET', quoteOrderQty: CFG.stake });
    let q = 0; (o.fills || []).forEach(f => { q += parseFloat(f.qty || 0); });
    if (q > 0) qty = q;
  } else qty = floorStep(qty, 0.000001);
  S.trades[id] = { id, sym, coin: base, qty, entry: plan.entry, t1: plan.t1, t2: plan.t2, t3: plan.t3, sl: plan.sl, step, open: true, s1: false, s2: false, sold: 0, rev: 0, t0: Date.now(), stake: CFG.stake, peak: plan.entry };
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
  if (st.sold >= st.qty * 0.999 || why === 'STOP' || why === 'T3' || why === 'TP') {
    st.open = false; st.closeWhy = why; st.closeAt = Date.now();
    const pnl = st.rev - st.qty * st.entry;
    S.profit += pnl; S.closed++; S.dayPnl += pnl; S.equity += pnl;
    saveState();
    log((pnl >= 0 ? 'CLOSE-WIN' : 'CLOSE-LOSS'), st.coin, '(' + why + ')', (pnl >= 0 ? '+' : '') + pnl.toFixed(2), 'equity=' + S.equity.toFixed(2));
    await tg((pnl >= 0 ? '✅ ' : '🔴 ') + st.coin + ' (' + why + ') ' + (pnl >= 0 ? '+' : '') + pnl.toFixed(2));
    if (S.dayPnl <= -CFG.dayMaxLoss) { log('DAILY-LOSS-LIMIT hit, stopping'); stop(); }
  } else {
    saveState();
    log('PART', st.coin, why, 'sold ' + q.toFixed(4) + ' @ ' + live);
  }
  return true;
}
async function manage(st, live) {
  if (!st || !st.open) return;
  st.peak = Math.max(st.peak || st.entry, live);
  const pnlNow = (st.rev || 0) - (st.sold || 0) * st.entry + (live - st.entry) * (st.qty - (st.sold || 0));
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
  if (todayUTC() !== S.day) { S.day = todayUTC(); S.dayPnl = 0; saveState(); }
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
function stop() { running = false; }
async function selftest() {
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); } };
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
  const p = makePlan(100, K.map(r => r[4]));
  ok('plan-levels', p.t3 > p.t2 && p.t2 > p.t1 && p.t1 > p.entry && p.sl < p.entry);
  const _tp = CFG.tp; CFG.tp = 1e9;
  const st = { id: 'm5:T', sym: 'TUSDT', coin: 'T', qty: 1, entry: 100, t1: 101.5, t2: 102.5, t3: 104, sl: 99, step: 0.001, open: true, s1: false, s2: false, sold: 0, rev: 0, mode: 'paper', t0: Date.now(), stake: 100 };
  S.trades['m5:T'] = st;
  await manage(st, 101.6);
  ok('T1-partial-30%', st.s1 === true && Math.abs(st.sold - 0.3) < 1e-9 && st.open === true);
  await manage(st, 102.6);
  ok('T2-partial-50%', st.s2 === true && st.sold > 0.3 && st.open === true);
  await manage(st, 104.5);
  ok('T3-full-close', st.open === false && st.closeWhy === 'T3');
  CFG.tp = _tp;
  ok('TP-cap-closes-early', await (async () => { const sx = { id: 'm5:TP', sym: 'PUSDT', coin: 'P', qty: 100, entry: 10, t1: 10.5, t2: 11, t3: 12, sl: 9.9, step: 1, open: true, s1: false, s2: false, sold: 0, rev: 0, mode: 'paper', t0: Date.now(), stake: 1000 }; S.trades['m5:TP'] = sx; await manage(sx, 10.008); return sx.open === false && sx.closeWhy === 'TP'; })());
  const st2 = { id: 'm5:T2', sym: 'XUSDT', coin: 'X', qty: 10, entry: 100, t1: 101.5, t2: 102.5, t3: 104, sl: 99, step: 1, open: true, s1: false, s2: false, sold: 0, rev: 0, mode: 'paper', t0: Date.now(), stake: 1000 };
  S.trades['m5:T2'] = st2;
  await manage(st2, 98.5);
  ok('STOP-close', st2.open === false && st2.closeWhy === 'STOP');
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

async function main() {
  if (process.argv.includes('--selftest')) return selftest();
  if (CFG.mode !== 'paper' && (!CFG.key || !CFG.sec)) { console.error('need BINANCE_KEY + BINANCE_SECRET for ' + CFG.mode); process.exit(1); }
  loadState();
  if (todayUTC() !== S.day) { S.day = todayUTC(); S.dayPnl = 0; }
  await syncTime();
  log('BOT SERVER start mode=' + CFG.mode + ' base=' + CFG.base + ' stake=$' + CFG.stake + ' tp=$' + CFG.tp + ' max=' + CFG.max + ' equity=$' + S.equity.toFixed(2));
  let n = 0;
  process.on('SIGINT', () => { log('SIGINT, saving...'); saveState(); process.exit(0); });
  process.on('SIGTERM', () => { log('SIGTERM, saving...'); saveState(); process.exit(0); });
  process.on('unhandledRejection', e => log('unhandled:', (e && e.message) || e));
  while (running) {
    n++;
    try { await cycle(n); } catch (e) { log('cycle-error:', (e && e.message) || e); }
    if (CFG.maxCycles && n >= CFG.maxCycles) break;
    await new Promise(r => setTimeout(r, CFG.poll * 1000));
  }
  saveState();
  log('exit after ' + n + ' cycles');
}
main();
