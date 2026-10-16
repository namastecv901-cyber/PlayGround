#!/usr/bin/env node
/* 🧠 ANALYST-X ENGINE — 55 أداة فنية + 11 محللاً + صفقة جاهزة
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
  if(body<0&&up>=Math.abs(body)*2&&dn<=Math.abs(body)*0.8) return 'shooting-star';
  if(body>0&&Math.abs(body)>=range*0.7) return 'marubozu-bull';
  if(body<0&&Math.abs(body)>=range*0.7) return 'marubozu-bear';
  return body>0?'bull':'bear';
}
// ===== 55 أداة — كل أداة ترجع {id,name,v:0-100,bull:boolean} =====
function fiftyTools(c,pr){
  const last=pr[pr.length-1], e20=emaLast(pr,20), e50=emaLast(pr,Math.min(50,pr.length)), e200=pr.length>=60?emaLast(pr,60):null;
  const s20=sma(pr,20), R=rsi(pr,14), atr=atrP(pr,14), sd=stdev(pr,20), mid=sma(pr,20)||last;
  const up2=(mid?((last-mid)/mid*100):0), bw=(mid?(4*sd/mid*100):0);
  const h20=Math.max(...pr.slice(-20)), l20=Math.min(...pr.slice(-20)), h90=Math.max(...pr.slice(-90)), l90=Math.min(...pr.slice(-90));
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
 return {tools:T,candle:engulf?'engulfing-bull':ct,lastCandle:lc};
}
/* ===== 11 محللاً (10 + المطور ذاتياً) + الرئيسي ===== */
const ANALYSTS=[
 {id:'trend',name:'📈 محلل الترند',tools:[1,2,3,4,5,6,7,8],w:0.14},
 {id:'momentum',name:'🚀 محلل الزخم',tools:[9,10,11,12,13,14,15,16,17,18],w:0.13},
 {id:'volatility',name:'🌊 محلل التقلب',tools:[19,20,21,22,23,24,25,26],w:0.07},
 {id:'liquidity',name:'💧 محلل السيولة',tools:[27,28,29,30,34],w:0.11},
 {id:'whale',name:'🐋 محلل الحيتان',tools:[27,29,31,32,30],w:0.09},
 {id:'structure',name:'🏗 محلل الهيكل BOS',tools:[35,36,37,40,41],w:0.11},
 {id:'candle',name:'🕯 محلل الشمعة الانعكاسية',tools:[43,44,45,46,47,48,49,50],w:0.09},
 {id:'levels',name:'🎯 محلل الدعم والمقاومة',tools:[37,38,39,40,42],w:0.07},
 {id:'trap',name:'🛡 محلل الفخاخ (الحارس)',tools:[34,42,41,9,28],w:0.09},
 {id:'evo',name:'🧬 المحلل المطور ذاتياً',tools:[51,52,53,54,55,9,35,27],w:0.10},
 {id:'chief',name:'👑 المحلل الرئيسي',tools:[1,9,23,27,35,38,44,42,51],w:0},
];
function evaluate(c){
  const pr=(c.sparkline_in_7d&&c.sparkline_in_7d.price&&c.sparkline_in_7d.price.length>10)?c.sparkline_in_7d.price.slice():[c.current_price*0.99,c.current_price];
  const {tools,candle}=fiftyTools(c,pr);
  const byId={}; tools.forEach(t=>byId[t.id]=t);
  const votes=ANALYSTS.map(a=>{ const vs=a.tools.map(id=>byId[id].v); const avg=vs.reduce((x,y)=>x+y,0)/vs.length; const bulls=a.tools.filter(id=>byId[id].bull).length;
    const verdict=a.id==='trap'?(avg>=55?'آمن ✅':'فخ 🚫'):avg>=62?'شراء 🟢':avg>=52?'مراقبة 👀':'تجنب 🔴';
    return {id:a.id,name:a.name,score:clamp(avg),bulls,total:a.tools.length,verdict,w:a.w}; });
  const v=id=>votes.find(x=>x.id===id);
  const price=c.current_price, atr=atrP(pr,14)||price*0.015;
  const h1=c.price_change_percentage_1h_in_currency||0, h24=c.price_change_percentage_24h_in_currency||0, to=(c.total_volume||0)/(c.market_cap||1);
  const rec=pr.slice(-48), swingL=Math.min(...rec);
  const w90=pr.slice(-90), hi90=Math.max(...w90), lo90=Math.min(...w90);
  const topPos=(hi90>lo90)?((price-lo90)/(hi90-lo90)):0.5;
  // ===== استراتيجية القاع + الارتداد فقط =====
  const rsiNow=rsi(pr,14), rsiPrev=rsi(pr.slice(0,-3),14);
  const revCandle=(candle==='engulfing-bull'||candle==='hammer'||candle==='marubozu-bull');
  const candleAr={hammer:'مطرقة انعكاسية 🔨','engulfing-bull':'ابتلاع صاعد 🔥','marubozu-bull':'زخم شرائي 💪',bull:'شمعة صاعدة 🟢',doji:'دوجي حيرة ➖','doji-dragon':'دوجي تنين 🐉','shooting-star':'شهاب هابط ⚠️','marubozu-bear':'ضغط بيعي 🔻',bear:'شمعة هابطة 🔻'}[candle]||candle;
  const dipDepth=(price-swingL)/price*100; // البعد عن قاع 48
  const isDip=(topPos<=0.35&&dipDepth<=3.5); // ملاصق للقاع تماماً
  // أول ارتداد: قاع مجموعة الانعكاس هو أدنى قاع في آخر 24 نقطة (الارتداد بدأ من القاع نفسه)
  const revGroup=pr.slice(-6), revLow=Math.min(...revGroup);
  const firstBounce=(revLow<=Math.min(...pr.slice(-24)));
  const bounced=(revCandle&&firstBounce&&rsiNow>=rsiPrev&&rsiNow>30); // شمعة انعكاسية أولى + RSI صاعد
  // ===== أهداف ثابتة +10%: T1 +3% / T2 +6% / T3 +10% — ستوب تحت القاع =====
  let sl0=swingL*0.997; if(!(sl0<price)) sl0=price-Math.max(atr*0.5,price*0.005);
  let risk=price-sl0;
  if(risk/price>0.06){ sl0=price*0.94; risk=price-sl0; }
  const sl=sl0, t1=price*1.03, t2=price*1.06, t3=price*1.10;
  const rr=(t3-price)/risk, roomPct=(hi90-price)/price*100, riskPct=risk/price*100;
  const reasons=[];
  votes.forEach(x=>{ if(x.id!=='chief') reasons.push(x.name+': '+x.verdict+' '+x.score); });
  let score=Math.round(votes.filter(x=>x.id!=='chief').reduce((s,x)=>s+x.score*x.w,0));
  // بوابات صارمة: الشراء من القاع مع ارتداد فقط
  const gates=[];
  const fail=(code,msg)=>gates.push({code,ok:false,msg});
  if(v('trap').score<50) fail('trap','فخ وهمي — مرفوض');
  if(!(isDip&&bounced)) fail('dip-bounce','ليست قاعاً مرتداً — الشراء من القاع مع أول ارتداد فقط');
  if(risk/price<0.003) fail('sl-tight','وقف ضيق غير واقعي');
  if(!(rr>=1.5)) fail('rr','العائد لا يبرر المخاطرة R:R='+rr.toFixed(2));
  if(!(roomPct>=6)) fail('room','لا مساحة لهدف +10% (المتاح '+roomPct.toFixed(1)+'%)');
  if((c.total_volume||0)<3000000) fail('liq','سيولة ضعيفة');
  if(topPos>0.97) fail('top','قرب قمة 90 — شراء قمة مرفوض');
  if(h1>12) fail('spike','شمعة متفجرة — فخ محتمل');
  if(h24>45&&to<0.05) fail('pump','بامب بلا سيولة');
  const hardFail=gates.filter(g=>!g.ok);
  let grade,action,isBuy=false;
  if(hardFail.length){ grade='avoid'; action='🔴 تجنب — '+hardFail[0].msg; score=Math.min(score,44); }
  else{
    score=Math.min(95,score+15); reasons.push('مكافأة ارتداد القاع +15');
    if(score>=72&&v('trap').score>=60){ grade='strong'; action='⭐ شراء قوي — قاع مرتد'; isBuy=true; }
    else if(score>=55&&v('trap').score>=55){ grade='buy'; action='🟢 شراء — قاع مرتد'; isBuy=true; }
    else if(score>=50){ grade='watch'; action='👀 مراقبة'; }
    else { grade='avoid'; action='🔴 تجنب'; }
  }
  const chief={id:'chief',name:'👑 المحلل الرئيسي',score,verdict:action,checks:gates.length?gates.map(g=>g.msg):['كل البوابات خضراء ✅'],w:0};
  const plan={entry:price,t1,t2,t3,sl,risk,rr:Math.round(rr*100)/100,riskPct:Math.round(riskPct*100)/100,roomPct:Math.round(roomPct*100)/100,
    support:Math.min(swingL,sl),resistance:Math.max(hi90,price),
    entryType:'شراء قاع + ارتداد ('+candleAr+')',
    invalidate:'يُلغى بإغلاق ساعة تحت '+sl, tf:'1H ارتداد',
    candle:candleAr, stakePct:riskPct>3?1:riskPct>1.5?2:3};
  return {c,price,score,grade,action,isBuy,plan,analysts:votes.concat([chief]),tools,candle:candleAr,gates,topPos:Math.round(topPos*100),reasons};
}
function runSelftest(){
  const out=[]; const ok=(n,c,d)=>out.push({name:n,pass:!!c,detail:d||''});
  const mk=(px,h1,h24,vol,mc)=>({symbol:'T',current_price:px,price_change_percentage_1h_in_currency:h1,price_change_percentage_24h_in_currency:h24,total_volume:vol,market_cap:mc,sparkline_in_7d:{price:Array.from({length:120},(_,i)=>px*(0.9+i/1200))}});
  const good=mk(100,1,4,5e7,1e9); const r1=evaluate(good);
  ok('tools-55',r1.tools.length===55,'n='+r1.tools.length);
  ok('analysts-12',r1.analysts.length===12,'n='+r1.analysts.length);
  ok('plan-rr',r1.plan.t3>r1.plan.t2&&r1.plan.t2>r1.plan.t1&&r1.plan.sl<r1.plan.entry,'rr='+r1.plan.rr);
  ok('good-not-avoid-trap',r1.gates.filter(g=>g.code==='trap').length===0,'score='+r1.score);
  const pump=mk(100,15,80,1e5,1e9); const r2=evaluate(pump);
  ok('pump-rejected',!r2.isBuy,'action='+r2.action);
  const thin=mk(100,0.5,2,1e5,1e9); const r3=evaluate(thin);
  ok('thin-rejected',!r3.isBuy,'action='+r3.action);
  const hammerPx=Array.from({length:114},(_,i)=>100+i*0.05); const r4=fiftyTools(mk(106,1,3,5e7,1e9),hammerPx.concat([106,105.9,105.8,106.5,107.2,108]));
  ok('candle-detect',typeof r4.candle==='string'&&r4.candle.length>0,r4.candle);
  // قاع حقيقي + أول مطرقة من القاع نفسه: هبوط 120→95 ثم مجموعة أخيرة (o=97,h=98,l=95,c=98) وقاعها هو الأدنى
  const pre=[]; for(let i=0;i<114;i++) pre.push(120-i*0.22);
  const dipPx=pre.concat([97,96,95,96.5,97.5,98]);
  const dip={symbol:'D',current_price:98,price_change_percentage_1h_in_currency:1.5,price_change_percentage_24h_in_currency:-3,total_volume:3e7,market_cap:1e9,sparkline_in_7d:{price:dipPx}};
  const r5=evaluate(dip);
  ok('dip-bounce-buy',r5.isBuy&&r5.plan.t3===r5.plan.entry*1.10,'action='+r5.action+' score='+r5.score+' t3='+r5.plan.t3);
  ok('dip-sl-under-low',r5.plan.sl<r5.plan.entry&&r5.plan.sl<=95,'sl='+r5.plan.sl);
  const mid=mk(100,1,4,5e7,1e9); const r6=evaluate(mid); // صعود mid-trend: ليست قاعاً مرتداً
  ok('midtrend-rejected',!r6.isBuy&&r6.gates.some(g=>g.code==='dip-bounce'),'action='+r6.action);
  // ارتداد متأخر: السعر صعد 7% فوق القاع — مرفوض (نريد أول ارتداد فقط)
  const latePx=pre.concat([99,99.5,100,100.5,101,102]);
  const late={symbol:'L',current_price:102,price_change_percentage_1h_in_currency:2,price_change_percentage_24h_in_currency:1,total_volume:3e7,market_cap:1e9,sparkline_in_7d:{price:latePx}};
  const r7=evaluate(late);
  ok('late-bounce-rejected',!r7.isBuy,'action='+r7.action+' score='+r7.score);
  return out;
}
const API={sma,emaLast,rsi,fiftyTools,evaluate,runSelftest,ANALYSTS};
if(typeof window!=='undefined') window.ANALYSTX=API;
if(typeof module!=='undefined'&&module.exports) module.exports=API;
if(typeof require!=='undefined'&&require.main===module&&typeof process!=='undefined'&&process.argv.includes('--selftest')){
  const rs=runSelftest(); let p=0,f=0; rs.forEach(r=>{ if(r.pass){p++;console.log('PASS',r.name,r.detail);} else{f++;console.log('FAIL',r.name,r.detail);} }); console.log(p+' passed, '+f+' failed'); process.exit(f?1:0);
}
