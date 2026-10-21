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
 *    PROXY_ONLY=1 PROXY_SECRET=xxx (جسر CORS فقط — POST /binance يوقّع طلبات المتصفح)
 *    HQ_MIN_SCORE(85: حد جودة الدخول) RISK_PCT(1.5: مخاطرة الصفقة%) HQ_COOLDOWN_H(4: منع تكرار الإشارة)
 *    SIGNAL_SECRET(مفتاح /state و/signal و/control) SIGNAL_ONLY(1: يتداول إشارات التطبيق فقط)
 *    AUTO_STOP(1: يوقف عند استنزاف equity فقط — خسارة اليوم حد صارم دائماً)
 *    DAILY_GOAL_USD=10: هدف الربح اليومي؛ عند بلوغه يتوقف ويُنقل الربح لمخزن تراكمي (لا يُتداول)
 *    SECURITY_MAX_STAKE_USD=10 SECURITY_MAX_TRADES=3 SECURITY_MAX_DAILY_LOSS=10
 *    SECURITY_REQUIRE_IP=1 (إلزام IP Whitelist) — SECURITY_SKIP_PRECHECK=1 للاختبار فقط
 *    الأمان: لا سحب/تحويل/Margin/Futures، فحص apiRestrictions قبل live، قفل عند خطأ مصادقة
 *    /control start: يصفّر ربح اليوم ويبدأ من جديد؛ المخزن التراكمي يبقى محفوظاً
 *  واجهة التطبيق: GET /state • POST /signal • POST /control • POST /notify • POST /binance (جسر CORS)
 *  /control: {action:'start'|'stop'|'closeall'|'status'} — الحالة تُحفظ وتستأنف بعد إعادة التشغيل
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
  proxyOnly: process.env.PROXY_ONLY === '1',
  proxySecret: process.env.PROXY_SECRET || '',
  port: parseInt(process.env.PORT || '8787', 10),
  stateFile: process.env.STATE_FILE || './bot-state.json',
  maxCycles: parseInt(process.env.CYCLES || '0', 10),
  autoStop: process.env.AUTO_STOP === '1',
  maxStake: parseFloat(process.env.SECURITY_MAX_STAKE_USD || '10'),
  maxTradesHard: parseInt(process.env.SECURITY_MAX_TRADES || '3', 10),
  maxDayLossHard: parseFloat(process.env.SECURITY_MAX_DAILY_LOSS || '10'),
  requireIp: process.env.SECURITY_REQUIRE_IP !== '0',
  skipPrecheck: process.env.SECURITY_SKIP_PRECHECK === '1'
};
if (!['paper', 'testnet', 'live'].includes(CFG.mode)) { console.error('bad MODE (paper|testnet|live)'); process.exit(1); }
function finiteEnv(v, d) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; }
CFG.maxStake = finiteEnv(CFG.maxStake, 10);
CFG.maxTradesHard = finiteEnv(CFG.maxTradesHard, 3);
CFG.maxDayLossHard = finiteEnv(CFG.maxDayLossHard, 10);
if (CFG.maxStake <= 0) CFG.maxStake = 10;
if (CFG.maxTradesHard <= 0) CFG.maxTradesHard = 3;
if (CFG.maxDayLossHard <= 0) CFG.maxDayLossHard = 10;
CFG.stake = finiteEnv(CFG.stake, 20);
CFG.max = finiteEnv(CFG.max, 3);
CFG.dayMaxLoss = finiteEnv(CFG.dayMaxLoss, 50);
CFG.stake = Math.min(Math.max(1, CFG.stake), Math.max(5, CFG.maxStake));
CFG.max = Math.min(Math.max(1, CFG.max), Math.max(1, CFG.maxTradesHard));
CFG.dayMaxLoss = Math.min(Math.max(1, CFG.dayMaxLoss), Math.max(1, CFG.maxDayLossHard));
const ONLY = [
  'SOL', 'XRP', 'DOGE', 'ADA', 'SUI', 'AVAX', 'LINK', 'WLD', 'DOT', 'ARB',
  'NEAR', 'LTC', 'SEI', 'HBAR', 'XLM', 'OP', 'FET', 'APT', 'TIA', 'TAO',
  'ATOM', 'ALGO', 'PYTH', 'GALA', 'FIL', 'GRT', 'TON', 'VET', 'POL', 'ICP',
  'BCH', 'ARKM', 'ETC', 'SAND', 'BIO', 'KAITO', 'MANA', 'THETA', 'JASMY', 'ROSE',
  'AR', 'APE', 'STX', 'CHZ', 'CFX', 'OM', 'QNT', 'IO', 'ZRO', 'ENS',
  'EGLD', 'ORDI', 'IMX', 'VIRTUAL', 'PAXG', 'ZK', 'ONE', 'ZIL', 'IOTA', 'XTZ',
  'MANTA', 'AIXBT', 'TRB', 'LUNA', 'BAND', 'MASK', 'MAGIC', 'API3', 'SKL', 'LPT',
  'XAI', 'ENJ', 'COOKIE', 'CGPT', 'ALT', 'ID', 'FLUX', 'MOVE', 'PROVE', 'LRC',
  'HYPER', 'PORTAL', 'DASH', 'PHB', 'VANRY', 'RVN', 'MINA', 'GMT', 'AXL', 'HOT',
  'SAHARA', 'FLOW', 'SAGA', 'KSM', 'CYBER', 'GPS', 'RLC', 'BAT', 'CHR', 'ARPA',
  'PHA', 'CKB', 'SXP', 'CELO', 'MDT', 'QTUM', 'INIT', 'BLUR', 'PLUME', 'HOOK',
  'RARE', 'TOWNS', 'ACH', 'DUSK', 'ANKR', 'NIL', 'METIS', 'EPIC', 'CELR', 'TWT',
  'SSV', 'DIA', 'ZEN', 'SHELL', 'ALICE', 'MOVR', 'ACT', 'STORJ', 'GLMR', 'VANA',
  'IOTX', 'DENT', 'CTSI', 'POLYX', 'XVG', 'FIDA', 'DGB', 'RONIN', 'ASTR', 'LAYER',
  'SCR', 'AVA', 'BICO', 'SXT', 'VTHO', 'NFP', 'EDU', 'ICX', 'HIGH', 'ALPINE',
  'TNSR', 'WCT', 'ACE', 'A', 'KAIA', 'AMP', 'DEXE', 'PARTI', 'TFUEL', 'NKN',
  'NEWT', 'RAD', 'VIC', 'POND', 'PUNDIX', 'AGLD', 'GTC', 'WIN', 'SYS', 'XNO',
  'A2Z', 'GLM', 'SC', 'IOST', 'RIF', 'SIGN', 'XEC', 'GAS', 'UTK', 'FIO',
  'SOPH', 'SCRT', 'HEI', 'BMT', 'SFP', 'ATA', 'ARK', 'DATA', 'ERA', 'ADX',
  'OXT', 'LINEA', 'SOMI', 'DCR', 'G', 'ARDR', 'LSK', 'STEEM', 'QKC', 'PIVX',
  'AT', 'SAPIEN', 'KITE', 'ENSO', 'WAL', '2Z', 'MIRA', 'XPL', 'OG', 'ZKC',
  'HOLO', 'OPEN', 'C', 'LA', 'AWE', 'TUT', 'MTL', 'CVC', 'COS', 'POWR',
  'ZEC', 'RENDER', 'BANANA', 'UMA', 'RSR', 'W', '0G', 'BEAMX', 'BREV', 'IQ',
  'HIVE', 'ZKP', 'STRAX', 'REQ', 'PROM', 'AI', 'EIGEN', 'ME', 'ONG', 'SKY'
];
const ONLY_SET = new Set(ONLY);
const STABLES = new Set(['USDT','USDC','DAI','FDUSD','USDE','TUSD','USDD','PYUSD','EURS','SUSD']);
const nowISO = () => new Date().toISOString();
const todayUTC = () => nowISO().slice(0, 10);
function redact(v) {
  return String(v == null ? '' : v)
    .replace(/(signature|apiKey|apiSecret|secret|X-MBX-APIKEY)(\s*[:=]\s*)[^&\s,;}]+/gi, '$1$2***')
    .replace(/([?&]signature=)[^&\s]+/gi, '$1***')
    .replace(/\b[a-f0-9]{64}\b/gi, '***');
}
const log = (...a) => console.log('[' + nowISO() + ']', ...a.map(redact));
const SAFE_PATHS = [
  /^\/api\/v3\/account$/,
  /^\/api\/v3\/time$/,
  /^\/api\/v3\/exchangeInfo$/,
  /^\/api\/v3\/order$/,
  /^\/api\/v3\/openOrders$/,
  /^\/api\/v3\/allOrders$/,
  /^\/api\/v3\/myTrades$/,
  /^\/api\/v3\/account\/commission$/,
  /^\/api\/v3\/ticker\/price$/,
  /^\/api\/v3\/klines$/,
  /^\/sapi\/v1\/account\/apiRestrictions$/
];
function safePath(p) { return SAFE_PATHS.some(rx => rx.test(String(p || ''))); }
function checkApiRestrictions(r, requireIp) {
  const bad = [];
  if (!r || r.enableReading !== true) bad.push('reading');
  if (r && r.enableWithdrawals === true) bad.push('withdrawals');
  if (r && r.enableInternalTransfer === true) bad.push('internal-transfer');
  if (r && r.enableMargin === true) bad.push('margin');
  if (r && r.enableFutures === true) bad.push('futures');
  if (r && r.enableVanillaOptions === true) bad.push('options');
  if (r && r.enableSpotAndMarginTrading !== true) bad.push('spot-trading');
  if (requireIp && (!r || r.ipRestrict !== true)) bad.push('ip-whitelist');
  return bad;
}
function isLocalAddr(addr) { return /^(127\.|::1$|::ffff:127\.)/.test(String(addr || '')); }

let preflightOK = false;
let S = { mode: CFG.mode, trades: {}, profit: 0, closed: 0, day: todayUTC(), dayPnl: 0, equity: CFG.equityStart, usdt: 0, availableUsdt: 0, vault: 0, goalHit: false, goalBusy: false, lastGoalAt: 0, securityLock: false, securityReason: '', lossLockDay: '', info: {}, noBin: {}, buys: 0, stopDay: null, stopWhy: '', enabled: true, pauseWhy: '', health: { at: 0, binance: false, account: false, error: '' }, lastCycleAt: 0, lastError: '' };
function loadState() { try { const j = JSON.parse(fs.readFileSync(CFG.stateFile, 'utf8')); Object.keys(j).forEach(k => { S[k] = j[k]; }); } catch (e) {} if (typeof S.enabled !== 'boolean') S.enabled = true; S.goalBusy = false; }
function saveState() { try { fs.writeFileSync(CFG.stateFile, JSON.stringify(S)); } catch (e) { log('state-save-fail', e.message); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function setEnabled(v, why) { S.enabled = !!v; if (!v) S.pauseWhy = why || 'manual'; else { S.pauseWhy = ''; S.stopDay = null; S.stopWhy = ''; } saveState(); }
function isAuthSecurityError(e) { return /-2015|-1022|-2014|invalid api-key|signature|unauthorized|IP.*(not|denied)/i.test(String(e && e.message || e)); }
function securityLock(reason) {
  const r = redact(reason || 'security').slice(0, 180);
  if (S.securityLock) return;
  S.securityLock = true; S.securityReason = r;
  setEnabled(false, 'security');
  log('SECURITY-LOCK:', r);
  tg('🛑 قفل أمان — أُوقفت الشراء: ' + r).catch(() => {});
}
async function securityPreflight() {
  if (CFG.mode === 'paper') return true;
  if (CFG.skipPrecheck) {
    if (CFG.mode === 'live') { securityLock('precheck-skip-forbidden-live'); throw new Error('SECURITY precheck skip forbidden in live'); }
    log('SECURITY: precheck skipped for non-live mode (test only)');
    return true;
  }
  let r;
  try { r = await signed('GET', '/sapi/v1/account/apiRestrictions'); }
  catch (e) { securityLock('api-restrictions-unavailable: ' + (e.message || e)); throw e; }
  const bad = checkApiRestrictions(r, CFG.requireIp);
  if (bad.length) {
    securityLock('permissions: ' + bad.join(','));
    throw new Error('SECURITY permissions: ' + bad.join(','));
  }
  return true;
}

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
async function syncTime() { if (CFG.mode === 'paper' && !CFG.proxyOnly) return; try { const j = await jget(CFG.base + '/api/v3/time'); timeOffset = (j.serverTime || Date.now()) - Date.now(); } catch (e) {} }
function sign(qs) { return crypto.createHmac('sha256', CFG.sec).update(qs).digest('hex'); }
async function signed(method, path, params) {
  if (!safePath(path)) throw new Error('SECURITY_BLOCKED_PATH ' + path);
  params = params || {}; delete params.signature; params.timestamp = Date.now() + timeOffset; params.recvWindow = 5000;
  const qs = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const url = CFG.base + path + '?' + qs + '&signature=' + sign(qs);
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { method, headers: { 'X-MBX-APIKEY': CFG.key }, signal: ctl.signal });
    const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) {}
    if (!r.ok) throw new Error((j && j.msg) || ('HTTP ' + r.status) + (j && j.code ? ' [' + j.code + ']' : ''));
    return j;
  } catch (e) {
    if (isAuthSecurityError(e)) securityLock('auth-error: ' + e.message);
    throw e;
  } finally { clearTimeout(to); }
}
async function accountInfo() { return signed('GET', '/api/v3/account'); }
async function hasOpenOrders(sym) { if (CFG.mode === 'paper') return false; const a = await signed('GET', '/api/v3/openOrders', { symbol: sym }); return Array.isArray(a) && a.length > 0; }
function usdtFree(a) { const b = ((a && a.balances) || []).find(x => x.asset === 'USDT') || {}; return (+b.free || 0); }
function usdtTotal(a) { const b = ((a && a.balances) || []).find(x => x.asset === 'USDT') || {}; return (+b.free || 0) + (+b.locked || 0); }
async function healthCheck() {
  const h = { at: Date.now(), binance: false, account: false, error: '' };
  try {
    const t = await jget(CFG.base + '/api/v3/time', null, 10000);
    if (!(t && t.serverTime)) throw new Error('bad server time');
    timeOffset = (+t.serverTime) - Date.now(); h.binance = true;
    if (CFG.mode !== 'paper') { await accountInfo(); h.account = true; }
  } catch (e) { h.error = redact(String((e && e.message) || e)).slice(0, 160); if (isAuthSecurityError(e)) securityLock('health-auth: ' + e.message); }
  S.health = h; saveState(); return h;
}
async function syncLiveEquity() {
  if (CFG.mode === 'paper') return;
  const a = await accountInfo();
  S.usdt = usdtTotal(a); S.availableUsdt = usdtFree(a);
  const open = Object.values(S.trades).filter(t => t && t.open && (t.mode || 'paper') === CFG.mode);
  const syms = [...new Set(open.map(t => t.sym))];
  const px = {};
  if (syms.length) {
    const arr = await jget(CFG.base + '/api/v3/ticker/price?symbols=' + encodeURIComponent(JSON.stringify(syms)));
    (Array.isArray(arr) ? arr : [arr]).forEach(x => { px[x.symbol] = parseFloat(x.price) || 0; });
  }
  let posVal = 0;
  open.forEach(t => { const p = px[t.sym] || +t.entry || 0; posVal += (t.qty - (t.sold || 0)) * p; });
  S.equity = S.usdt + posVal;
  saveState();
}
function clientOrderId() { return 'bot' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'); }
async function queryOrder(sym, id) {
  try { return await signed('GET', '/api/v3/order', { symbol: sym, origClientOrderId: id }); }
  catch (e) { if (/-2013|does not exist|not found/i.test(String(e.message))) return null; throw e; }
}
async function waitFill(sym, id, order, timeoutMs) {
  let o = order;
  if (!id) return o;
  const until = Date.now() + (timeoutMs || 8000);
  while (Date.now() < until) {
    if (o && ((+o.executedQty || 0) > 0 || o.status === 'FILLED')) return o;
    await sleep(500);
    const q = await queryOrder(sym, id);
    if (q) o = q;
  }
  return o;
}
async function safeOrder(params) {
  params = Object.assign({}, params || {});
  const id = params.newClientOrderId || clientOrderId();
  params.newClientOrderId = id;
  let last;
  for (let i = 0; i < 3; i++) {
    try { return await signed('POST', '/api/v3/order', params); }
    catch (e) {
      last = e; const m = String((e && e.message) || e);
      const ambiguous = /abort|timeout|network|fetch|ECONN|ETIMEDOUT|socket|502|503|504|429|418/i.test(m);
      const duplicate = /-2010|duplicate/i.test(m);
      if (!ambiguous && !duplicate) throw e;
      await sleep(400 * (i + 1));
      try { const q = await queryOrder(params.symbol, id); if (q) return await waitFill(params.symbol, id, q); } catch (qe) {}
    }
  }
  throw last;
}
async function tg(msg) {
  if (!CFG.tgBot || !CFG.tgChat) return;
  msg = redact(msg);
  try { await jget('https://api.telegram.org/bot' + CFG.tgBot + '/sendMessage?chat_id=' + encodeURIComponent(CFG.tgChat) + '&text=' + encodeURIComponent(msg), null, 10000); } catch (e) {}
  await tgCh(msg);
}
async function tgCh(msg) {
  if (!CFG.tgBot || !CFG.tgChannel) return;
  msg = redact(msg);
  try { await jget('https://api.telegram.org/bot' + CFG.tgBot + '/sendMessage?chat_id=' + encodeURIComponent(CFG.tgChannel) + '&text=' + encodeURIComponent(msg), null, 10000); } catch (e) { log('channel-send-fail', e.message); }
}
// ➗ حصة الصفقة: تقسيم رأس المال على N عملات (4/6/8) أو حصة ثابتة
function stakeFor() {
  const v = CFG.splitN > 1 ? Math.max(5, S.equity / CFG.splitN) : CFG.stake;
  return Math.min(CFG.maxStake, Math.max(5, v));
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
  if (!ONLY_SET.has(baseOf(sym))) { log('symbol-not-allowed', sym); return; }
  if (CFG.mode !== 'paper' && !CFG.skipPrecheck && !preflightOK) { log('preflight-not-ok — entry refused'); return; }
  const id = idOpt || ('m5:' + sym);
  if (S.trades[id] && S.trades[id].open) return;
  if (Object.values(S.trades).some(t => t && t.open && t.sym === sym)) return; // صفقة واحدة لكل عملة
  if (!idOpt && S.lastClose[sym] && Date.now() - S.lastClose[sym] < HQCFG.cooldownH * 3600e3) return; // منع تكرار الدخول على نفس الإشارة
  if (Object.values(S.trades).filter(t => t && t.open).length >= CFG.max) return;
  if (!S.enabled || S.securityLock || S.lossLockDay === todayUTC()) return;
  if (S.dayPnl <= -CFG.dayMaxLoss) { S.lossLockDay = todayUTC(); log('daily-loss-limit — refusing new entry'); setEnabled(false, 'loss-limit'); return; }
  if (S.equity < Math.min(10, CFG.equityStart * 0.2)) { log('equity-depleted — skip new entries'); if (CFG.autoStop) stop('equity'); return; }
  const firstStake = Math.min(CFG.maxStake, stakeOpt > 0 ? stakeOpt : stakeFor() * CFG.splitInit);
  if (!(firstStake >= 5)) { log('stake-below-security-min', sym); return; }
  let qty = firstStake / plan.entry, step = 1, avgFill = 0;
  if (CFG.mode !== 'paper') {
    if (!CFG.key || !CFG.sec) { log('missing keys'); return; }
    const info = await getInfo(sym); step = info.step || 1;
    if (firstStake < (info.minNot || 0)) { log('below-min-notional', sym); return; }
    const acct = await accountInfo(); const free = usdtFree(acct); S.usdt = usdtTotal(acct); S.availableUsdt = free;
    if (free < firstStake) { log('insufficient-usdt', sym, 'free=' + free, 'need=' + firstStake); return; }
    if (await hasOpenOrders(sym)) { log('skip-existing-open-order', sym); return; }
    let o = await safeOrder({ symbol: sym, side: 'BUY', type: 'MARKET', quoteOrderQty: firstStake, newOrderRespType: 'FULL' });
    o = await waitFill(sym, o.clientOrderId, o);
    let q = 0, qv = 0; (o.fills || []).forEach(f => { const fq = parseFloat(f.qty || 0); q += fq; qv += fq * parseFloat(f.price || 0); });
    if (!(q > 0) && +o.executedQty > 0) { q = +o.executedQty; qv = +o.cummulativeQuoteQty || 0; }
    if (!(q > 0)) throw new Error('BUY_NOT_FILLED ' + sym + ' status=' + (o.status || '?'));
    qty = q; if (qv > 0) avgFill = qv / q;
  } else qty = floorStep(qty, 0.000001);
  const entryPx = avgFill > 0 ? avgFill : plan.entry;
  S.trades[id] = { id, sym, coin: base, qty, entry: entryPx, t1: plan.t1, t2: plan.t2, t3: plan.t3, sl: plan.sl, step, mode: CFG.mode, open: true, s1: false, s2: false, sold: 0, rev: 0, t0: Date.now(), stake: firstStake, stakePlanned: stakeFor(), splitInit: CFG.splitInit, adds: 0, rT1: plan.t1 / entryPx, rT2: plan.t2 / entryPx, rT3: plan.t3 / entryPx, rSl: plan.sl / entryPx, peak: entryPx, hqScore: (hqOpt && hqOpt.score) || 0 };
  S.buys++;
  saveState();
  log('BUY', base, 'x' + qty, '@' + plan.entry, hqOpt ? ('HQscore=' + hqOpt.score + ' RR=' + hqOpt.rr) : '');
  await tg(hqOpt ? HQE.formatAlert(Object.assign({}, hqOpt, { sym: base })) : ('🟢 شراء ' + base + ' @ ' + plan.entry));
}
async function sellPart(st, frac, why, live) {
  let q = st.qty * frac, proceeds = q * live;
  if (CFG.mode !== 'paper') {
    q = floorStep(q, st.step || 1); if (q <= 0) return false;
    let o = await safeOrder({ symbol: st.sym, side: 'SELL', type: 'MARKET', quantity: q, newOrderRespType: 'FULL' });
    o = await waitFill(st.sym, o.clientOrderId, o);
    if (!(+o.executedQty > 0)) throw new Error('SELL_NOT_FILLED ' + st.sym + ' status=' + (o.status || '?'));
    q = +o.executedQty; proceeds = +o.cummulativeQuoteQty || proceeds;
  }
  st.sold += q; st.rev += proceeds;
  if (why === 'T1') st.s1 = true;
  if (why === 'T2') st.s2 = true;
  if (st.sold >= st.qty * 0.999 || why === 'STOP' || why === 'T3' || why === 'TP' || why === 'INST' || why === 'TRAIL' || why === 'MANUAL' || why === 'CLOSEALL') {
    st.open = false; st.closeWhy = why; st.closeAt = Date.now();
    const pnl = st.rev - st.qty * st.entry;
    S.profit += pnl; S.closed++; S.dayPnl += pnl; S.equity += pnl;
    S.lastClose[st.sym] = Date.now(); // منع إعادة الدخول الفوري على نفس الإشارة
    saveState();
    log((pnl >= 0 ? 'CLOSE-WIN' : 'CLOSE-LOSS'), st.coin, '(' + why + ')', (pnl >= 0 ? '+' : '') + pnl.toFixed(2), 'equity=' + S.equity.toFixed(2));
    await tg((pnl >= 0 ? '✅ ' : '🔴 ') + st.coin + ' (' + why + ') ' + (pnl >= 0 ? '+' : '') + pnl.toFixed(2));
    if (S.dayPnl <= -CFG.dayMaxLoss) { log('DAILY-LOSS-LIMIT hit — new entries locked until next UTC day'); S.lossLockDay = todayUTC(); stop('loss-limit'); }
    if (!S.goalBusy && S.dayPnl >= CFG.dailyGoal) await goalReached();
  } else {
    saveState();
    log('PART', st.coin, why, 'sold ' + q.toFixed(4) + ' @ ' + live);
  }
  return true;
}
async function reinforce(st, live) {
  if (!CFG.rein || !st || !st.open) return false;
  if (!S.enabled || S.securityLock || S.lossLockDay === todayUTC() || S.dayPnl <= -CFG.dayMaxLoss) return false;
  if ((st.adds || 0) >= CFG.reinMax) return false;
  if (!(live <= st.entry * (1 - CFG.reinDrop))) return false;
  const planned = st.stakePlanned || st.stake || 0;
  const rem = Math.max(0, planned * (1 - (st.splitInit || 1)) - (st.added || 0));
  if (rem <= 0) return false;
  let addStake = rem / Math.max(1, CFG.reinMax - (st.adds || 0));
  addStake = Math.min(addStake, S.equity * 0.5, Math.max(0, CFG.maxStake - (+st.stake || 0)));
  if (addStake <= 0) return false;
  let addQty = addStake / live;
  if (CFG.mode !== 'paper') {
    const info = await getInfo(st.sym);
    if (addStake < (info.minNot || 0)) return false;
    const acct = await accountInfo(); const free = usdtFree(acct); S.usdt = usdtTotal(acct); S.availableUsdt = free;
    if (free < addStake) { log('reinforce-insufficient-usdt', st.sym, 'free=' + free, 'need=' + addStake); return false; }
    if (await hasOpenOrders(st.sym)) { log('reinforce-open-order-skip', st.sym); return false; }
    const o = await safeOrder({ symbol: st.sym, side: 'BUY', type: 'MARKET', quoteOrderQty: addStake, newOrderRespType: 'FULL' });
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
  if (todayUTC() !== S.day) { S.day = todayUTC(); S.dayPnl = 0; S.lossLockDay = ''; S.stopDay = null; S.stopWhy = ''; saveState(); log('new-day: counters reset, resuming 🎯'); }
  log('--- cycle', n, 'mode=' + CFG.mode, 'equity=' + S.equity.toFixed(2), 'dayPnl=' + S.dayPnl.toFixed(2));
  let tickers;
  try { tickers = await jget(CFG.base + '/api/v3/ticker/24hr'); }
  catch (e) { log('ticker-fetch-fail:', e.message); return; }
  const cands = tickers
    .filter(t => t.symbol && t.symbol.endsWith('USDT') && ONLY_SET.has(baseOf(t.symbol)) && !/(UP|DOWN|BULL|BEAR)USDT$/.test(t.symbol) && !STABLES.has(baseOf(t.symbol)))
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
    const syms = [...new Set(Object.values(S.trades).filter(t => t && t.open && (t.mode || 'paper') === CFG.mode).map(t => t.sym))];
    if (syms.length) {
      const arr = await jget(CFG.base + '/api/v3/ticker/price?symbols=' + encodeURIComponent(JSON.stringify(syms)));
      (Array.isArray(arr) ? arr : [arr]).forEach(x => { prices[x.symbol] = parseFloat(x.price); });
    }
    for (const st of Object.values(S.trades)) {
      if (!st || !st.open) continue;
      if ((st.mode || 'paper') !== CFG.mode) continue;
      const live = prices[st.sym];
      if (!live) continue;
      await manage(st, live);
    }
  } catch (e) { log('manage-fail:', e.message); }
}

async function closeAllOpen() {
  const open = Object.values(S.trades).filter(t => t && t.open && (t.mode || 'paper') === CFG.mode);
  if (!open.length) return { closed: 0 };
  const syms = [...new Set(open.map(t => t.sym))];
  const px = {};
  try {
    const arr = await jget(CFG.base + '/api/v3/ticker/price?symbols=' + encodeURIComponent(JSON.stringify(syms)));
    (Array.isArray(arr) ? arr : [arr]).forEach(x => { px[x.symbol] = parseFloat(x.price) || 0; });
  } catch (e) { log('closeall-price-fail', e.message); }
  let closed = 0;
  for (const st of open) {
    const live = px[st.sym];
    if (!(live > 0)) { log('closeall-no-price', st.sym); continue; }
    try { const rem = st.qty - (st.sold || 0); if (rem > 0) { await sellPart(st, rem / st.qty, 'MANUAL', live); closed++; } }
    catch (e) { log('closeall-fail', st.sym, e.message); }
  }
  saveState();
  return { closed };
}

async function goalReached() {
  if (S.goalBusy) return;
  S.goalBusy = true;
  S.enabled = false; S.pauseWhy = 'goal'; S.stopWhy = 'goal'; S.stopDay = todayUTC();
  saveState();
  log('DAILY-GOAL $' + CFG.dailyGoal + ' hit — closing open trades and locking profit');
  try {
    await closeAllOpen();
    const amount = Math.max(0, +S.dayPnl || 0);
    S.vault = (+S.vault || 0) + amount;
    S.dayPnl = 0; S.goalHit = true; S.lastGoalAt = Date.now();
    saveState();
    log('VAULT +$' + amount.toFixed(2) + ' — total $' + S.vault.toFixed(2) + ' (not used for trading)');
    await tg('🏆 هدف اليوم $' + CFG.dailyGoal + ' تحقق — أُضيف $' + amount.toFixed(2) + ' للمخزن التراكمي، إجمالي $' + S.vault.toFixed(2));
  } finally {
    S.goalBusy = false; saveState();
  }
}

let running = true;
function stop(why) { running = false; S.enabled = false; S.pauseWhy = why || 'manual'; S.stopDay = todayUTC(); S.stopWhy = why || ''; saveState(); }
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
  ok('reinforce-adds-on-dip', await (async () => { const sr = { id: 'm5:R', sym: 'RUSDT', coin: 'R', qty: 0.5, entry: 100, t1: 102, t2: 103, t3: 105, sl: 99, step: 0.001, open: true, s1: false, s2: false, sold: 0, rev: 0, mode: 'paper', t0: Date.now(), stake: 5, stakePlanned: 10, splitInit: 0.5, adds: 0, rT1: 1.02, rT2: 1.03, rT3: 1.05, rSl: 0.99 }; S.trades['m5:R'] = sr; S.equity = 1000; const okAdd = await reinforce(sr, 98.5); return okAdd === true && sr.adds === 1 && sr.qty > 0.5 && sr.entry < 100; })());
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
  S.dayPnl = 9.5; S.vault = 0; S.goalHit = false; S.enabled = true;
  const st3 = { id: 'm5:G', sym: 'GUSDT', coin: 'G', qty: 100, entry: 10, t1: 10.5, t2: 11, t3: 12, sl: 9.9, step: 1, open: true, s1: false, s2: false, sold: 0, rev: 0, mode: 'paper', t0: Date.now(), stake: 1000 };
  S.trades['m5:G'] = st3;
  await manage(st3, 10.008);
  ok('DAILY-GOAL-stop-vault', st3.open === false && S.enabled === false && S.goalHit === true && S.dayPnl === 0 && S.vault >= 10);
  S.enabled = true; S.goalHit = false; S.vault = 0;
  S.equity = 100; CFG.splitN = 4;
  ok('split-4-stake-capped', stakeFor() === CFG.maxStake);
  CFG.splitN = 0;
  ok('split-off-fixed', stakeFor() === CFG.stake);
  CFG.splitN = 4;
  ok('security-stake-cap', stakeFor() <= CFG.maxStake);
  ok('security-block-withdraw', !safePath('/sapi/v1/capital/withdraw/apply'));
  ok('security-block-transfer', !safePath('/sapi/v1/asset/transfer'));
  ok('security-allow-order', safePath('/api/v3/order'));
  ok('security-allow-restrictions', safePath('/sapi/v1/account/apiRestrictions'));
  ok('security-allow-open-orders', safePath('/api/v3/openOrders'));
  ok('security-dayloss-cap', CFG.dayMaxLoss <= CFG.maxDayLossHard);
  ok('security-trades-cap', CFG.max <= CFG.maxTradesHard);
  ok('security-origin-remote-block', !trustedOrigin({ headers: { origin: 'https://evil.example' } }));
  ok('security-origin-local-ok', trustedOrigin({ headers: { origin: 'http://localhost:5500' } }));
  ok('security-safe-key', checkApiRestrictions({ enableReading: true, enableSpotAndMarginTrading: true, ipRestrict: true }, true).length === 0);
  ok('security-withdraw-reject', checkApiRestrictions({ enableReading: true, enableSpotAndMarginTrading: true, ipRestrict: true, enableWithdrawals: true }, true).includes('withdrawals'));
  ok('security-margin-reject', checkApiRestrictions({ enableReading: true, enableSpotAndMarginTrading: true, ipRestrict: true, enableMargin: true }, true).includes('margin'));
  ok('security-ip-reject', checkApiRestrictions({ enableReading: true, enableSpotAndMarginTrading: true, ipRestrict: false }, true).includes('ip-whitelist'));
  ok('security-redact', !/abc123|supersecret|deadbeef/i.test(redact('apiKey=abc123 apiSecret=supersecret signature=deadbeef')));
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Bot-Key,X-Proxy-Secret');
  res.setHeader('Cache-Control', 'no-store');
}
function jbody(res, code, obj) { cors(res); res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
function trustedOrigin(req) {
  const o = req.headers && req.headers.origin;
  if (!o) return true;
  if (o === 'null') return false;
  try { const h = new URL(o).hostname; return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'; } catch (e) { return false; }
}
function auth(req, url) {
  var k = req.headers['x-bot-key'] || url.searchParams.get('key') || '';
  if (CFG.signalSecret) return k === CFG.signalSecret;
  if (!trustedOrigin(req)) return false;
  return isLocalAddr(req.socket && req.socket.remoteAddress);
}
function stateOut() {
  var open = Object.values(S.trades).filter(t => t && t.open && (t.mode || 'paper') === CFG.mode).map(t => ({ sym: t.sym, coin: t.coin, entry: t.entry, qty: t.qty, t1: t.t1, t2: t.t2, t3: t.t3, sl: t.sl, t0: t.t0, stake: t.stake }));
  var last = Object.values(S.trades).filter(t => t && !t.open && (t.mode || 'paper') === CFG.mode).sort((a, b) => (b.closeAt || 0) - (a.closeAt || 0)).slice(0, 20)
    .map(t => ({ sym: t.sym, coin: t.coin, entry: t.entry, exit: (t.rev && t.qty) ? t.rev / (t.sold || t.qty) : null, reason: t.closeWhy, pnl: t.rev - t.qty * t.entry, stake: t.stake, t0: t.t0, closeAt: t.closeAt }));
  return { ok: true, mode: CFG.mode, enabled: !!S.enabled, pauseWhy: S.pauseWhy || '', securityLock: !!S.securityLock, securityReason: redact(S.securityReason || ''), lossLockDay: S.lossLockDay || '', goalHit: !!S.goalHit, dailyGoal: CFG.dailyGoal, maxStake: CFG.maxStake, maxTradesHard: CFG.maxTradesHard, maxDayLoss: CFG.dayMaxLoss, vault: +S.vault || 0, lastGoalAt: S.lastGoalAt || 0, health: S.health || null, lastCycleAt: S.lastCycleAt || 0, lastError: redact(S.lastError || ''), equity: S.equity, usdt: S.usdt, availableUsdt: S.availableUsdt, profit: S.profit, closed: S.closed, day: S.day, dayPnl: S.dayPnl, buys: S.buys, maxTrades: CFG.max, open, last };
}
// 🔌 جسر CORS: يوقّع طلبات Binance نيابة عن المتصفح (المفاتيح لا تُسجّل)
async function binanceProxy(method, path, params, key, sec) {
  if (!safePath(path)) throw new Error('SECURITY_BLOCKED_PATH');
  if (method !== 'GET' && method !== 'POST') throw new Error('bad method');
  if (!key || !sec) throw new Error('missing api key/secret');
  params = Object.assign({}, params || {});
  delete params.signature;
  params.timestamp = Date.now() + timeOffset; params.recvWindow = 5000;
  const qs = Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
  const sig = crypto.createHmac('sha256', sec).update(qs).digest('hex');
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(CFG.base + path + '?' + qs + '&signature=' + sig, {
      method, headers: { 'X-MBX-APIKEY': key }, signal: ctl.signal
    });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { code: -1, msg: String(t).slice(0, 180) }; }
    return { status: r.status, body: j };
  } finally { clearTimeout(to); }
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
    if (req.method === 'POST' && url.pathname === '/control') {
      let b = '';
      req.on('data', c => { b += c; if (b.length > 2000) { try { req.destroy(); } catch (e) {} } });
      req.on('end', async () => {
        try {
          const j = JSON.parse(b || '{}');
          if (!auth(req, url)) return jbody(res, 403, { ok: false, error: 'bad key' });
          const action = String(j.action || '').toLowerCase();
          if (action === 'start' && S.securityLock) return jbody(res, 423, { ok: false, error: 'security lock — fix key/IP and restart' });
          if (action === 'start' && S.dayPnl <= -CFG.dayMaxLoss) S.lossLockDay = todayUTC();
          if (action === 'start' && S.lossLockDay === todayUTC()) return jbody(res, 423, { ok: false, error: 'daily loss lock — wait until next UTC day' });
          if (action === 'start') {
            S.day = todayUTC(); S.dayPnl = 0; S.goalHit = false; S.lastGoalAt = 0;
            setEnabled(true, '');
            const h = await healthCheck();
            if (h.account) { try { await syncLiveEquity(); } catch (e) { log('equity-sync-fail', e.message); } }
            log('manual START — enabled=true');
          } else if (action === 'stop') {
            setEnabled(false, 'manual');
            log('manual STOP — new entries disabled, open trades still managed');
          } else if (action === 'closeall') {
            const out = await closeAllOpen();
            log('manual CLOSEALL — closed=' + out.closed);
          } else if (action !== 'status') {
            return jbody(res, 400, { ok: false, error: 'bad action' });
          }
          return jbody(res, 200, stateOut());
        } catch (e) { return jbody(res, 500, { ok: false, error: redact(String((e && e.message) || e)).slice(0, 160) }); }
      });
      return;
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
          if (!ONLY_SET.has(baseOf(sym))) return jbody(res, 400, { ok: false, error: 'symbol not allowed' });
          if ((t1 - entry) / (entry - sl) < 1.2) return jbody(res, 400, { ok: false, error: 'bad plan (RR < 1.2)' });
          if (CFG.mode !== 'paper' && !preflightOK) {
            await securityPreflight();
            preflightOK = true;
          }
          if (S.securityLock) return jbody(res, 423, { ok: false, error: 'security lock' });
          if (!S.enabled) return jbody(res, 409, { ok: false, error: 'bot stopped by user' });
          if (S.lossLockDay === todayUTC()) return jbody(res, 423, { ok: false, error: 'daily loss lock' });
          if (S.dayPnl <= -CFG.dayMaxLoss) { S.lossLockDay = todayUTC(); saveState(); return jbody(res, 423, { ok: false, error: 'daily loss limit reached' }); }
          if (Object.values(S.trades).some(t => t && t.open && t.sym === sym)) return jbody(res, 409, { ok: false, error: 'already open' });
          if (S.lastClose && S.lastClose[sym] && Date.now() - S.lastClose[sym] < 10 * 60e3) return jbody(res, 409, { ok: false, error: 'cooldown after close' });
          if (lastSignal[sym] && Date.now() - lastSignal[sym] < 15000) return jbody(res, 429, { ok: false, error: 'slow down' });
          lastSignal[sym] = Date.now();
          const px = (await jget(CFG.base + '/api/v3/ticker/price?symbol=' + sym)).price;
          if (!(px > 0) || px > entry * 1.015 || px < sl) return jbody(res, 409, { ok: false, error: 'price moved', price: px });
          const sp = Math.min(25, Math.max(1, +j.stakePct || 15));
          const used = Object.values(S.trades).filter(t => t && t.open).reduce((a, t) => a + (+t.stake || 0), 0);
          const stake = Math.min(CFG.maxStake, S.equity * sp / 100, S.equity * 0.5, Math.max(0, S.equity - used));
          if (stake < 5) return jbody(res, 409, { ok: false, error: 'rejected (no free equity)' });
          const plan = { entry, t1, t2: t2 > t1 ? t2 : t1 * 1.01, t3: t3 > t2 ? t3 : (t2 > t1 ? t2 : t1 * 1.01) * 1.01, sl };
          const id = 'sig:' + sym + ':' + Date.now();
          await openTrade(sym, baseOf(sym), plan, stake, null, id);
          const ok = !!(S.trades[id] && S.trades[id].open);
          return jbody(res, ok ? 200 : 409, ok ? { ok: true, id, sym, stake, price: px } : { ok: false, error: 'rejected (max trades / min notional / equity)' });
        } catch (e) { return jbody(res, 500, { ok: false, error: redact(String((e && e.message) || e)).slice(0, 120) }); }
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/binance') {
      let b = '';
      req.on('data', c => { b += c; if (b.length > 12000) { try { req.destroy(); } catch (e) {} } });
      req.on('end', async () => {
        try {
          const remote = String(req.socket.remoteAddress || '');
          const local = isLocalAddr(remote);
          if (CFG.proxySecret && req.headers['x-proxy-secret'] !== CFG.proxySecret) return jbody(res, 403, { code: -1, msg: 'bad proxy secret' });
          if (!CFG.proxySecret && !local) return jbody(res, 403, { code: -1, msg: 'set PROXY_SECRET for remote access' });
          if (!CFG.proxySecret && !trustedOrigin(req)) return jbody(res, 403, { code: -1, msg: 'untrusted origin — set PROXY_SECRET' });
          const j = JSON.parse(b || '{}');
          const out = await binanceProxy(String(j.method || 'GET').toUpperCase(), String(j.path || ''), j.params, String(j.key || ''), String(j.secret || ''));
          return jbody(res, out.status || 200, out.body);
        } catch (e) { if (/SECURITY_BLOCKED_PATH/.test(String(e && e.message))) { securityLock('blocked-api-path'); return jbody(res, 403, { code: -1, msg: 'blocked by security policy' }); } return jbody(res, 502, { code: -1, msg: redact(String((e && e.message) || e)).slice(0, 160) }); }
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
  if (CFG.mode === 'live' && !/^https:\/\/api\.binance\.com\/?$/i.test(CFG.base)) { console.error('SECURITY: live mode requires official https://api.binance.com'); process.exit(1); }
  const hadState = fs.existsSync(CFG.stateFile);
  loadState();
  if (S.mode && S.mode !== CFG.mode) { console.error('STATE_FILE belongs to ' + S.mode + ' — use a separate STATE_FILE for ' + CFG.mode); process.exit(1); }
  S.mode = CFG.mode;
  if (!hadState && CFG.mode === 'live') { S.enabled = false; S.pauseWhy = 'manual'; log('first live start — disabled until /control start'); }
  if (todayUTC() !== S.day) { S.day = todayUTC(); S.dayPnl = 0; S.lossLockDay = ''; }
  if (!CFG.autoStop) { S.stopDay = null; S.stopWhy = ''; }
  await syncTime();
  startApi();
  if (CFG.proxyOnly) { log('PROXY ONLY — CORS bridge listening :' + CFG.port); return; }
  const h0 = await healthCheck();
  if (CFG.mode !== 'paper') {
    try {
      await securityPreflight(); preflightOK = true;
      if (S.securityLock && /(permissions|api-restrictions|auth-error|health-auth|cycle-auth|precheck)/i.test(S.securityReason || '')) { S.securityLock = false; S.securityReason = ''; saveState(); log('security lock cleared after successful preflight'); }
    } catch (e) { log('SECURITY preflight failed:', e.message); }
  }
  if (h0.account) { try { await syncLiveEquity(); } catch (e) { log('equity-sync-fail', e.message); } }
  log('BOT SERVER start mode=' + CFG.mode + ' base=' + CFG.base + ' stake=$' + CFG.stake + ' tp=$' + CFG.tp + ' max=' + CFG.max + ' goal=$' + CFG.dailyGoal + ' equity=$' + S.equity.toFixed(2) + ' enabled=' + S.enabled);
  let n = 0;
  process.on('SIGINT', () => { log('SIGINT, saving...'); saveState(); process.exit(0); });
  process.on('SIGTERM', () => { log('SIGTERM, saving...'); saveState(); process.exit(0); });
  process.on('unhandledRejection', e => { S.lastError = redact(String((e && e.message) || e)).slice(0, 160); log('unhandled:', S.lastError); saveState(); });
  while (true) {
    n++;
    try {
      S.lastCycleAt = Date.now();
      const h = await healthCheck();
      if (h.account) { try { await syncLiveEquity(); } catch (e) { S.lastError = redact('equity-sync: ' + e.message); log('equity-sync-fail', e.message); } }
      if (!S.enabled) {
        await manageOpen();
        if (n % 10 === 1) log(S.securityLock ? 'security-locked — open trades managed, fix key/IP and restart' : (S.pauseWhy === 'loss-limit' ? 'daily-loss-locked — open trades managed, wait for next UTC day' : 'paused by user — open trades managed, waiting for START'));
      } else if (CFG.signalOnly) {
        await manageOpen();
        if (n % 30 === 1) log('signal-only mode — managing open trades, waiting for /signal');
      } else if (CFG.autoStop && S.stopDay === todayUTC()) {
        if (n % 10 === 1) log('paused (' + (S.stopWhy || 'limit') + ') — waiting for next day, will resume automatically 🔁');
      } else {
        S.stopDay = null; S.stopWhy = '';
        await cycle(n);
      }
      if (!h.binance) log('binance-health-fail: ' + (h.error || 'unknown'));
    } catch (e) {
      S.lastError = redact(String((e && e.message) || e)).slice(0, 160);
      if (isAuthSecurityError(e)) securityLock('cycle-auth: ' + e.message);
      log('cycle-error:', S.lastError);
      saveState();
    }
    if (CFG.maxCycles && n >= CFG.maxCycles) break;
    await new Promise(r => setTimeout(r, (CFG.signalOnly ? Math.min(CFG.poll, 15) : CFG.poll) * 1000));
  }
  saveState();
  log('exit after ' + n + ' cycles');
}
main();
