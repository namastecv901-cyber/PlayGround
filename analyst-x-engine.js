#!/usr/bin/env node
/* 🧠 ANALYST-X ENGINE — 56 أداة فنية + 11 محللاً (قاع 15m فقط) + صفقة جاهزة
 * يعمل في المتصفح (window.ANALYSTX) وفي Node (require).
 * المدخل: كائن عملة CoinGecko市场的 (current_price, sparkline_in_7d.price, total_volume, market_cap, changes)
 * المخرج: {score 0-100, grade, isBuy, plan{entry,t1,t2,t3,sl,rr}, analysts[10], tools[50], candle, reasons}
 * تنبيه صادق: يقلل الإشارات الكاذبة لكن لا يمنع الخسارة — التداول مخاطرة.
 */
'use strict';
function sma(a,n){ if(!a||!a.length) return null; n=Math.min(n,a.length); const s=a.slice(-n); return s.reduce((x,y)=>x+y,0)/s.length; }
function emaArr(a,n){ if(!a||a.length<n) return null; const k=2/(n+1); let e=a.slice(0,n).reduce((x,y)=>x+y,0)/n; const out=new Array(a.length).fill(null); out[n-1]=e; for(let i=n;i<a.length;i++){ e=a[i]*k+e*(1-k); out[i]=e; } return out; }
function emaLast(a,n){ const o=emaArr(a,n); return o?o[o.length-1]:null; }
function rsi(a,p){ p=p||14; if(!a||a.length<p+1) return 50; let g=0,l=0; for(let i=a.length-p;i<a.length;i++){ const d=a[i]-a[i-1]; if(d>0)g+=d; else l-=d; } if(l===0)return 100; if(g===0)return 0; const rs=g/l; return 100-100/(1+rs); }
function stdev(a,n){ n=Math.min(n||20,a.length); const s=a.slice(-n); const m=s.reduce((x,y)=>x+y,0)/s.length; return Math.sqrt(s.reduce((x,y)=>x+(y-m)*(y-m),0)/s.length); }
function atrP(pr,n){ n=n||14; if(pr.length<3) return pr[pr.length-1]*0.01; const d=[]; for(let i=1;i<pr.length;i++) d.push(Math.abs(pr[i]-pr[i-1])); const t=d.slice(-n); return t.reduce((x,y)=>x+y,0)/t.length||pr[pr.length-1]*0.01; }
function slopePct(pr){ if(!pr||pr.length<6) return 0; const a=sma(pr.slice(0,Math.floor(pr.length/2)),Math.floor(pr.length/2))||pr[0]; const b=pr[pr.length-1]; return a?(b-a)/a*100:0; }
function clamp(v){ return Math.max(0,Math.min(100,Math.round(v))); }
// اشتقاق شموع OHLC من sparkline للكشف عن الشموع الانعكاسية
function toCandles(pr,per){ per=per||6; const k=[]; for(let i=0;i<pr.length;i+=per){ const s=pr.slice(i,i+per); if(!s.length)continue; k.push({o:s[0],h:Math.max(...s),l:Math.min(...s),c:s[s.length-1]}); } return k; }
function candleType(k){ // k:{o,h,l,c}
  const body=k.c-k.o, range=(k.h-k.l)||1e-9, up=k.h-Math.max(k.o,k.c), dn=Math.min(k.o,k.c)-k.l;
  if(Math.abs(body)<=range*0.1) return Math.max(up,dn)>range*0.4?'doji-dragon':'doji';
  if(body>0&&dn>=body*2&&up<=body*0.8) return 'hammer';
  // شمعة رفض حمراء: جسم أحمر صغير + ذيل سفلي طويل + علوي قصير = سر الصعود (رفض البيع)
  if(body<0&&dn>=Math.abs(body)*1.5&&dn>=range*0.35&&up<=range*0.3) return 'red-rejection';
  if(body<0&&up>=Math.abs(body)*2&&dn<=Math.abs(body)*0.8) return 'shooting-star';
  if(body>0&&Math.abs(body)>=range*0.7) return 'marubozu-bull';
  if(body<0&&Math.abs(body)>=range*0.7) return 'marubozu-bear';
  return body>0?'bull':'bear';
}
// فريم 15 دقيقة: نبني شمعة 15m من آخر 3-4 نقاط (أدق وحدة متاحة من sparkline) لكشف الرفض الأحمر
function m15Rejection(pr){
  if(!pr||pr.length<5) return {hit:false};
  const s=pr.slice(-4), o=s[0], c=s[s.length-1], h=Math.max(...s), l=Math.min(...s);
  const k={o,h,l,c}, ct=candleType(k);
  const body=Math.abs(c-o), range=(h-l)||1e-9, dn=Math.min(o,c)-l, up=h-Math.max(o,c);
  const redrej=(ct==='red-rejection')||(c<o&&dn>=body*1.5&&dn>=range*0.3&&up<=range*0.35);
  return {hit:!!redrej, k, ct:redrej?'red-rejection':ct, dnR:range?dn/range:0};
}
// ===== 56 أداة — كل أداة ترجع {id,name,v:0-100,bull:boolean} =====
function fiftyTools(c,pr){
  const last=pr[pr.length-1], e20=emaLast(pr,20), e50=emaLast(pr,Math.min(50,pr.length)), e200=pr.length>=60?emaLast(pr,60):null;
  const s20=sma(pr,20), R=rsi(pr,14), atr=atrP(pr,14), sd=stdev(pr,20), mid=sma(pr,20)||last;
  const up2=(mid?((last-mid)/mid*100):0), bw=(mid?(4*sd/mid*100):0);
  const h20=Math.max(...pr.slice(-20)), l20=Math.min(...pr.slice(-20)), h90=Math.max(...pr.slice(-60)), l90=Math.min(...pr.slice(-60));
  const v=c.total_volume||0, mc=c.market_cap||1, to=v/mc, h1=c.price_change_percentage_1h_in_currency||0, h24=c.price_change_percentage_24h_in_currency||0;
  const kc=toCandles(pr,6), lc=kc[kc.length-1]||{o:last,h:last,l:last,c:last}, pc=kc[kc.length-2]||lc;
  const ct=candleType(lc), prevBull=pc.c>pc.o, curBull=lc.c>lc.o;
  const engulf=(curBull&&!prevBull&&lc.c>=pc.o&&lc.o<=pc.c);
  const T=[]; const add=(id,name,v,bull)=>T.push({id,name,v:clamp(v),bull:!!bull});
  add(1,'EMA20 فوق السعر',last>e20?75:30,last>e20);
  add(2,'تقاطع EMA20/50',e20&&e50?(e20>e50?78:28):50,!!(e20&&e50&&e20>e50));
  add(3,'EMA بعيد المدى',e200?(last>e200?72:32):50,!e200||last>e200);
  add(4,'SMA20 دعم',last>s20?70:35,last>s20);
  add(5,'ميل المنحنى',slopePct(pr)>0?65+slopePct(pr)*2:40+slopePct(pr)*3,slopePct(pr)>0);
  add(6,'قمم أعلى متتالية',pr[pr.length-1]>pr[pr.length-6]?68:38,pr[pr.length-1]>pr[pr.length-6]);
  add(7,'ADX بديل (قوة اتجاه)',Math.abs(slopePct(pr))>3?75:Math.abs(slopePct(pr))>1?60:40,last>s20);
  add(8,'سوبرترند بديل',last>(mid-2*sd)?70:30,last>(mid-2*sd));
  add(9,'RSI14',R>=50&&R<=68?80:R>68&&R<=75?55:R>75?25:R>=40?55:35,R>=50&&R<=72);
  add(10,'RSI في منطقة صحية',R>=50&&R<=70?80:45,R>=50&&R<=70);
  add(11,'MACD بديل (EMA12-26)',(emaLast(pr,12)-emaLast(pr,Math.min(26,pr.length)))>0?72:32,(emaLast(pr,12)-emaLast(pr,Math.min(26,pr.length)))>0);
  add(12,'ستوكاستك بديل',h20>l20?((last-l20)/(h20-l20)*100>20&&((last-l20)/(h20-l20)*100<85)?75:45):50,h20>l20&&(last-l20)/(h20-l20)>0.2);
  add(13,'ويليامز %R',h20>l20?((h20-last)/(h20-l20)*-100>-80&&((h20-last)/(h20-l20)*-100<-15)?72:42):50,last>l20);
  add(14,'CCI بديل',Math.abs(up2)<3?70:Math.abs(up2)<6?55:35,up2>-1);
  add(15,'ROC (5)',pr.length>6?(pr[pr.length-1]>pr[pr.length-6]?70:35):50,pr.length>6&&pr[pr.length-1]>pr[pr.length-6]);
  add(16,'مومنتم 10',pr.length>11?(pr[pr.length-1]>pr[pr.length-11]?68:36):50,pr.length>11&&pr[pr.length-1]>pr[pr.length-11]);
  add(17,'MFI بديل (حجم+سعر)',to>0.02&&h24>0?72:to>0.01?58:40,to>0.01);
  add(18,'OBV بديل',h24>0?65:h24>-3?50:35,h24>0);
  add(19,'ATR طبيعي',atr/last*100<8?70:45,atr/last*100<8);
  add(20,'موقع بولنجر',up2>-2&&up2<3?75:up2>=3?45:55,up2>-2);
  add(21,'عرض بولنجر',bw<10?70:bw<20?58:40,bw<15);
  add(22,'كيلتنر بديل',Math.abs(up2)<2.5?68:48,Math.abs(up2)<2.5);
  add(23,'اختراق دونشيان 20',last>=h20*0.999?80:last>l20?55:35,last>=h20*0.999);
  add(24,'انحراف معياري',sd/last*100<4?68:45,sd/last*100<5);
  add(25,'Z-Score',Math.abs(last-mid)/(sd||1)<1.5?70:45,last>=mid);
  add(26,'توسع النطاق',atr>atrP(pr.slice(0,-10),14)*0.8?62:48,true);
  add(27,'نسبة الحجم/القيمة',to>0.05?80:to>0.02?68:to>0.008?52:32,to>0.01);
  add(28,'دوران السيولة',v>2e7?75:v>5e6?58:35,v>5e6);
  add(29,'ضغط الشراء (1h مقابل 24h)',h1>0&&h24>0?72:h1>0?58:38,h1>0);
  add(30,'اتجاه الحجم',h24>-2?60:40,h24>-2);
  add(31,'سبايك حيتان',to>0.05&&h24>3?78:to>0.02?58:42,!(to<0.01));
  add(32,'تراكم/توزيع بديل',h24>-5?60:35,h24>-5);
  add(33,'انحراف VWAP بديل',Math.abs(up2)<2?68:48,up2>-2);
  add(34,'حجم صحي غير وهمي',!(h24>40&&to<0.05)?65:20,!(h24>40&&to<0.05));
  add(35,'كسر هيكل BOS',last>=h20*0.998?80:45,last>=h20*0.998);
  add(36,'ثبات فوق الكسر',last>=h20*0.99?70:40,last>=h20*0.99);
  add(37,'مسافة الدعم',((last-l20)/last*100)<6?68:52,true);
  add(38,'مساحة المقاومة',h90>last?(((h90-last)/last*100)>4?72:45):70,h90>last?((h90-last)/last*100)>2:true);
  add(39,'فيبوناتشي 0.618',h90>l90?(((last-l90)/(h90-l90))<0.85?68:42):50,h90>l90&&(last-l90)/(h90-l90)<0.85);
  add(40,'بيفوت',last>pc.c?62:48,last>pc.c);
  add(41,'دفعة صحية (غير عمودية)',h1>-2&&h1<8?70:40,h1<8);
  add(42,'بعيد عن القمة 90',h90>l90?(((last-l90)/(h90-l90))<0.97?72:25):50,h90>l90&&(last-l90)/(h90-l90)<0.97);
  add(43,'همر/مطرقة',ct==='hammer'?85:50,ct==='hammer'||curBull);
  add(44,'ابتلاع صاعد',engulf?88:50,engulf||curBull);
  add(45,'دوجي (حيرة)',ct.indexOf('doji')===0?50:60,!ct.match(/star|bear/));
  add(46,'نجمة الصباح بديل',(!prevBull&&curBull&&lc.c>pc.o)?80:50,curBull);
  add(47,'جسم قوي (ماروبوزو)',ct==='marubozu-bull'?82:ct==='bull'?62:42,curBull);
  add(48,'3 إغلاقات خضراء',pr[pr.length-1]>pr[pr.length-2]&&pr[pr.length-2]>pr[pr.length-3]?72:46,pr[pr.length-1]>pr[pr.length-3]);
  add(49,'ذيل رفض سفلي',((Math.min(lc.o,lc.c)-lc.l)/(((lc.h-lc.l)||1)))>0.35?75:48,true);
 add(50,'إغلاق تأكيدي',curBull?70:35,curBull);
  // أداة 56: شمعة الرفض الحمراء 15m — سر الدخول من القاع
  const rej15=m15Rejection(pr);
  add(56,'شمعة رفض حمراء 15m (سر الصعود)',rej15.hit?92:(ct==='hammer'?70:35),!!rej15.hit);
 // ===== الجيل الجديد الذكي 51-55: يطور الأدوات القديمة بإجماع تكيفي =====
 const keyIds=[9,11,23,27,35].map(id=>T[id-1].v), cons=keyIds.reduce((x,y)=>x+y,0)/keyIds.length;
 add(51,'إجماع الأدوات الذكي',cons,cons>=55);
 const div=((R>=50)===(slopePct(pr)>0))?72:40;
 add(52,'توافق السعر والزخم (كشف الدايفرجنس)',div,div>=55);
 const al=[slopePct(pr)>0,last>e20,(emaLast(pr,12)-emaLast(pr,Math.min(26,pr.length)))>0,last>=h20*0.998].filter(Boolean).length;
 add(53,'محاذاة الإشارات (ترند+زخم+كسر)',40+al*10,al>=3);
 const smf=to*100*(h24>0?1:-1);
 add(54,'تدفق الأموال الذكية',smf>0.05?78:smf>0?60:smf>-0.05?45:30,smf>0);
  const vam=pr.length>6?((pr[pr.length-1]-pr[pr.length-6])/(atr||1)):0;
  add(55,'زخم معدل بالتقلب',vam>0.5?75:vam>0?62:vam>-0.5?48:32,vam>0);
  const finCandle=rej15.hit?'red-rejection':(engulf?'engulfing-bull':ct);
  return {tools:T,candle:finCandle,lastCandle:lc,rej15};
}
/* ===== 11 محللاً (10 + المطور ذاتياً) + الرئيسي ===== */
const ANALYSTS=[
 {id:'trend',name:'📈 محلل الترند',tools:[1,2,3,4,5,6,7,8],w:0.14},
 {id:'momentum',name:'🚀 محلل الزخم',tools:[9,10,11,12,13,14,15,16,17,18],w:0.13},
 {id:'volatility',name:'🌊 محلل التقلب',tools:[19,20,21,22,23,24,25,26],w:0.07},
 {id:'liquidity',name:'💧 محلل السيولة',tools:[27,28,29,30,34],w:0.11},
 {id:'whale',name:'🐋 محلل الحيتان',tools:[27,29,31,32,30],w:0.09},
 {id:'structure',name:'🏗 محلل الهيكل BOS',tools:[35,36,37,40,41],w:0.11},
 {id:'candle',name:'🕯 محلل الشمعة الانعكاسية 15m',tools:[43,44,45,46,47,48,49,50,56],w:0.09},
 {id:'levels',name:'🎯 محلل الدعم والمقاومة',tools:[37,38,39,40,42],w:0.07},
 {id:'trap',name:'🛡 محلل الفخاخ (الحارس)',tools:[34,42,41,9,28],w:0.09},
 {id:'evo',name:'🧬 المحلل المطور ذاتياً',tools:[51,52,53,54,55,56,9,35,27],w:0.10},
 {id:'chief',name:'👑 المحلل الرئيسي',tools:[1,9,23,27,35,38,44,42,51,56],w:0},
];
function evaluate(c){
  const pr=(c.sparkline_in_7d&&c.sparkline_in_7d.price&&c.sparkline_in_7d.price.length>10)?c.sparkline_in_7d.price.slice():[c.current_price*0.99,c.current_price];
  const {tools,candle,rej15}=fiftyTools(c,pr);
  const byId={}; tools.forEach(t=>byId[t.id]=t);
  const votes=ANALYSTS.map(a=>{ const vs=a.tools.map(id=>byId[id].v); const avg=vs.reduce((x,y)=>x+y,0)/vs.length; const bulls=a.tools.filter(id=>byId[id].bull).length;
    const verdict=a.id==='trap'?(avg>=55?'آمن ✅':'فخ 🚫'):avg>=62?'شراء 🟢':avg>=52?'مراقبة 👀':'تجنب 🔴';
    return {id:a.id,name:a.name,score:clamp(avg),bulls,total:a.tools.length,verdict,w:a.w}; });
  const v=id=>votes.find(x=>x.id===id);
  const price=c.current_price, atr=atrP(pr,14)||price*0.015;
  const risk=Math.min(Math.max(atr*1.2,price*0.008),price*0.06);
  const rec=pr.slice(-30), swingH=Math.max(...rec), swingL=Math.min(...rec);
  // قاع/قمة حقيقي من 60 شمعة 15m فقط: شراء قاع وبيع قمة
  const w90=pr.slice(-60), wHi=Math.max(...w90), wLo=Math.min(...w90);
  const topPos90=(wHi>wLo)?((price-wLo)/(wHi-wLo)):0.5;
  // القاع فقط: النصف السفلي من 60 شمعة — فوقه ليس قاعاً
  const bottomZone=topPos90<=0.50, topZone=topPos90>=0.75;
  const support=Math.min(swingL,price);
  // القمة = أعلى 90 شمعة (بيع القمة الحقيقية)، وليس 48 فقط
  const resistance=Math.max(wHi,swingH,price);
  // وقف tight أصلاً، ويلتصق تحت القاع فقط إذا كان قريباً (شراء قاع حقيقي)
  let sl=price-risk;
  if((price-support)/price<0.02) sl=Math.min(sl, support*0.998);
  let t1=price+risk*1.5, t2=price+risk*2.5, t3=price+risk*4;
  // بيع القمة: إذا القمة بعيدة فوق السعر، اجعل الهدف الأخير عندها
  if(resistance>price*1.02){
    t3=Math.min(Math.max(t3,resistance*0.995),resistance*0.995);
    if(t2>=resistance*0.99) t2=resistance*0.985;
  }
  if(t3<=price) t3=price+risk*4;
  if(t2<=price) t2=price+(t3-price)*0.6;
  if(t1<=price||t1>=t2) t1=price+(t2-price)*0.5;
  const rr=(t2-price)/Math.max(1e-9,(price-sl)), roomPct=(resistance-price)/price*100, riskPct=(price-sl)/price*100;
  const h1=c.price_change_percentage_1h_in_currency||0, h24=c.price_change_percentage_24h_in_currency||0, to=(c.total_volume||0)/(c.market_cap||1);
  const isRedRej=(candle==='red-rejection')||!!(rej15&&rej15.hit);
  const isHammer=(candle==='hammer'), isEngulf=(candle==='engulfing-bull');
  const isGreenTop=(candle==='marubozu-bull'||candle==='bull');
  const bullCandle=isRedRej||isHammer||isEngulf;
  const reasons=[];
  votes.forEach(x=>{ if(x.id!=='chief') reasons.push(x.name+': '+x.verdict+' '+x.score); });
  let score=Math.round(votes.filter(x=>x.id!=='chief').reduce((s,x)=>s+x.score*x.w,0));
  // بوابات صارمة — تركيز 15m: ممنوع الشراء المرتفع الأخضر
  const gates=[];
  const fail=(code,msg)=>gates.push({code,ok:false,msg});
  if(v('trap').score<50) fail('trap','فخ وهمي — مرفوض');
  if(!(rr>=2)) fail('rr','عائد/مخاطرة ضعيف '+rr.toFixed(2));
  if(!(roomPct>=riskPct)) fail('room','مقاومة ملاصقة — لا مساحة');
  if((c.total_volume||0)<3000000) fail('liq','سيولة ضعيفة');
  const topPos=(Math.max(...pr.slice(-60))-Math.min(...pr.slice(-60)))>0?((price-Math.min(...pr.slice(-60)))/(Math.max(...pr.slice(-60))-Math.min(...pr.slice(-60)))):0.5;
  if(topPos>0.97) fail('top','قرب قمة 60 — شراء قمة مرفوض');
  if(h1>12) fail('spike','شمعة متفجرة — فخ محتمل');
  if(h24>45&&to<0.05) fail('pump','بامب بلا سيولة');
  // القاع فقط: فوق النصف السفلي ليس قاعاً — لا يظهر أبداً
  if(topPos90>0.50) fail('high','فوق القمة — ليس قاعاً ('+(Math.round(topPos90*100))+'% من 60 شمعة)');
  // مطاردة خضراء مرفوضة: شمعة خضراء قوية + قمة = لا دخول
  if(isGreenTop&&topPos90>=0.6) fail('chase','شراء مرتفع — شمعة خضراء في القمة (انتظر شمعة رفض حمراء 15m)');
  // تأكيد القاع فقط: شمعة رفض حمراء 15m + حارس آمن — بلا BOS وبلا زخم (محذوفان لأنهما يشتريان القمم)
  const confirmOK=isRedRej&&bottomZone&&v('trap').score>=55;
  if(!confirmOK) fail('confirm','لا تأكيد: انتظر شمعة رفض حمراء 15m من القاع');
  // سر الصعود: شمعة رفض حمراء 15m + قاع = بونص كبير
  if(isRedRej&&bottomZone&&v('trap').score>=50){ score=Math.min(98,score+12); reasons.push('✅ سر الصعود: شمعة رفض حمراء 15m من القاع ('+(Math.round(topPos90*100))+'% من 60 شمعة)'); }
  else if(bottomZone&&(isHammer||isEngulf)&&v('trap').score>=55){ score=Math.min(98,score+8); reasons.push('✅ شراء قاع: السعر في أسفل '+(Math.round(topPos90*100))+'% من 60 شمعة + '+candle); }
  else if(bottomZone&&v('trap').score>=55){ score=Math.min(95,score+4); reasons.push('✅ قرب القاع: '+(Math.round(topPos90*100))+'% من 60 شمعة'); }
  const hardFail=gates.filter(g=>!g.ok);
  let grade,action,isBuy=false;
  if(hardFail.length){ grade='avoid'; action='🔴 تجنب — '+hardFail[0].msg; score=Math.min(score,44); }
  else if(topZone&&score>=62){ grade='avoid'; action='🔴 قمة — بيع وليس شراء ('+(Math.round(topPos90*100))+'% من 60 شمعة)'; score=Math.min(score,44); }
  // القاع فقط: كل شراء يشترط النصف السفلي + رفض حمراء — بدون قاع لا دخول
  else if(score>=72&&v('trap').score>=60&&isRedRej&&bottomZone){ grade='strong'; action='⭐ شراء قاع + رفض حمراء 15m'; isBuy=true; }
  else if(score>=72&&v('trap').score>=60){ grade='watch'; action='👀 ليس قاعاً — انتظر القاع + شمعة رفض حمراء'; score=Math.min(score,68); }
  else if(score>=62&&v('trap').score>=55&&isRedRej&&bottomZone){ grade='buy'; action='🟢 شراء قاع + رفض حمراء'; isBuy=true; }
  else if(score>=62&&v('trap').score>=55&&(isHammer||isEngulf)&&bottomZone){ grade='buy'; action='🟢 شراء قاع'; isBuy=true; }
  else if(score>=62&&v('trap').score>=55){ grade='watch'; action='👀 ليس قاعاً — انتظر القاع'; score=Math.min(score,60); }
  else if(score>=52){ grade='watch'; action='👀 مراقبة'; }
  else { grade='avoid'; action='🔴 تجنب'; }
  const chief={id:'chief',name:'👑 المحلل الرئيسي',score,verdict:action,checks:gates.length?gates.map(g=>g.msg):['كل البوابات خضراء ✅'],w:0};
  const candleAr={'red-rejection':'🔴 شمعة رفض حمراء 15m (سر الصعود)',hammer:'🔨 مطرقة انعكاسية', 'engulfing-bull':'🔥 ابتلاع صاعد','marubozu-bull':'💪 زخم شرائي','bull':'🟢 شمعة صاعدة',doji:'➖ دوجي حيرة','doji-dragon':'🐉 دوجي تنين','shooting-star':'⚠️ شهاب هابط','marubozu-bear':'🔻 ضغط بيعي',bear:'🔻 شمعة هابطة'}[candle]||candle;
  const plan={entry:price,t1,t2,t3,sl,risk:price-sl,rr:Math.round(rr*100)/100,riskPct:Math.round(riskPct*100)/100,roomPct:Math.round(roomPct*100)/100,
    support,resistance,low90:wLo,high90:wHi,pos90:Math.round(topPos90*100),isRedRej,
    entryType:(isRedRej?'دخول مع شمعة رفض حمراء 15m 🔴':(bottomZone?'شراء قاع 🟢 ':'')+(candle==='engulfing-bull'?'ابتلاع صاعد ⚡':candle==='hammer'?'ارتداد مطرقة 🔨':'دخول زخم 📈'))+' → بيع القمة 🔴 '+money0(resistance),
    invalidate:'يُلغى بإغلاق 15m تحت القاع '+sl, tf:'15m',
    candle:candleAr, stakePct:riskPct>3?1:riskPct>1.5?2:3};
  function money0(n){ try{ return n>=1000?n.toLocaleString('en',{maximumFractionDigits:1}):n>=1?n.toFixed(3):String(Number(n.toPrecision(3))); }catch(e){ return String(n); } }
  return {c,price,score,grade,action,isBuy,plan,analysts:votes.concat([chief]),tools,candle:candleAr,gates,topPos:Math.round(topPos*100),reasons};
}
function runSelftest(){
  const out=[]; const ok=(n,c,d)=>out.push({name:n,pass:!!c,detail:d||''});
  const mk=(px,h1,h24,vol,mc)=>({symbol:'T',current_price:px,price_change_percentage_1h_in_currency:h1,price_change_percentage_24h_in_currency:h24,total_volume:vol,market_cap:mc,sparkline_in_7d:{price:Array.from({length:120},(_,i)=>px*(0.9+i/1200))}});
  const good=mk(100,1,4,5e7,1e9); const r1=evaluate(good);
  ok('tools-56',r1.tools.length===56,'n='+r1.tools.length);
  ok('analysts-12',r1.analysts.length===12,'n='+r1.analysts.length);
  ok('plan-rr',r1.plan.t3>r1.plan.t2&&r1.plan.t2>r1.plan.t1&&r1.plan.sl<r1.plan.entry,'rr='+r1.plan.rr);
  ok('tf-15m',r1.plan.tf==='15m','tf='+r1.plan.tf);
  ok('good-not-avoid-trap',r1.gates.filter(g=>g.code==='trap').length===0,'score='+r1.score);
  const pump=mk(100,15,80,1e5,1e9); const r2=evaluate(pump);
  ok('pump-rejected',!r2.isBuy,'action='+r2.action);
  const thin=mk(100,0.5,2,1e5,1e9); const r3=evaluate(thin);
  ok('thin-rejected',!r3.isBuy,'action='+r3.action);
  const hammerPx=Array.from({length:114},(_,i)=>100+i*0.05); const r4=fiftyTools(mk(106,1,3,5e7,1e9),hammerPx.concat([106,105.9,105.8,106.5,107.2,108]));
  ok('candle-detect',typeof r4.candle==='string'&&r4.candle.length>0,r4.candle);
  // شمعة رفض حمراء 15m: جسم أحمر صغير + ذيل سفلي طويل (رفض البيع)
  const rejPr=Array.from({length:116},(_,i)=>100+i*0.05);
  const r5=fiftyTools(mk(105,0.5,2,5e7,1e9),rejPr.concat([106.0,105.8,104.0,105.5]));
  ok('red-rejection-detect',r5.candle==='red-rejection'||r5.rej15.hit,'candle='+r5.candle);
  // مطاردة خضراء في القمة مرفوضة
  const topPr=Array.from({length:120},(_,i)=>80+i*0.3);
  const r6=evaluate({symbol:'TOP',current_price:116,price_change_percentage_1h_in_currency:2,price_change_percentage_24h_in_currency:10,total_volume:5e7,market_cap:1e9,sparkline_in_7d:{price:topPr}});
  ok('chase-rejected',!r6.isBuy,'action='+r6.action);
  // القاع + رفض حمراء 15m = شراء (هبوط 120→80 ثم رفض أحمر)
  const botPr=Array.from({length:56},(_,i)=>120-i*0.7);
  const r7=evaluate({symbol:'BOT',current_price:82,price_change_percentage_1h_in_currency:1,price_change_percentage_24h_in_currency:-8,total_volume:5e7,market_cap:1e9,sparkline_in_7d:{price:botPr.concat([83.0,82.7,80.2,82.0])}});
  ok('bottom-rejection-buy',r7.isBuy===true,'action='+r7.action+' score='+r7.score+' pos='+r7.plan.pos90);
  // القمة + رفض حمراء = مرفوض (ليس قاعاً)
  const topRejPr=Array.from({length:56},(_,i)=>80+i*0.65);
  const r8=evaluate({symbol:'TOPR',current_price:116.4,price_change_percentage_1h_in_currency:1,price_change_percentage_24h_in_currency:8,total_volume:5e7,market_cap:1e9,sparkline_in_7d:{price:topRejPr.concat([117.0,116.8,114.5,116.2])}});
  ok('top-rejection-rejected',!r8.isBuy&&(r8.gates||[]).some(g=>g.code==='high'),'action='+r8.action);
  return out;
}
const API={sma,emaLast,rsi,fiftyTools,evaluate,runSelftest,ANALYSTS};
if(typeof window!=='undefined') window.ANALYSTX=API;
if(typeof module!=='undefined'&&module.exports) module.exports=API;
if(typeof require!=='undefined'&&require.main===module&&typeof process!=='undefined'&&process.argv.includes('--selftest')){
  const rs=runSelftest(); let p=0,f=0; rs.forEach(r=>{ if(r.pass){p++;console.log('PASS',r.name,r.detail);} else{f++;console.log('FAIL',r.name,r.detail);} }); console.log(p+' passed, '+f+' failed'); process.exit(f?1:0);
}
