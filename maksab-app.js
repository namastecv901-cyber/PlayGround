const STORE='maksab.v1';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>'$'+Math.round(Number(n)||0).toLocaleString('en-US');
const fmt1=n=>(Math.round((Number(n)||0)*10)/10).toFixed(1);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));

function defaultState(){
  return {profile:null,plan:null,daily:null,income:[],leads:[],extraTasks:[],pricing:null,chat:[],
    settings:{ai:{enabled:false,base:'https://api.openai.com/v1',model:'gpt-4o-mini',key:''}},
    ui:{view:'home',openWeeks:[]}};
}
function loadState(){
  try{
    const raw=localStorage.getItem(STORE);
    if(!raw)return defaultState();
    const p=JSON.parse(raw);
    const base=defaultState();
    const merged=Object.assign(base,p);
    merged.settings=Object.assign(base.settings,p.settings||{});
    merged.settings.ai=Object.assign(base.settings.ai,(p.settings&&p.settings.ai)||{});
    merged.ui=Object.assign(base.ui,p.ui||{});
    return merged;
  }catch(e){return defaultState();}
}
let state=loadState();

function save(){
  try{
    if(state.chat.length>60)state.chat=state.chat.slice(-60);
    localStorage.setItem(STORE,JSON.stringify(state));
  }catch(e){toast('تعذر الحفظ: مساحة المتصفح ممتلئة');}
}
function todayStr(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function parseDate(s){const p=String(s||todayStr()).split('-').map(Number);return new Date(p[0],(p[1]||1)-1,p[2]||1);}
function dayDiff(a,b){return Math.floor((b-a)/86400000);}
function timeNow(){return new Date().toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});}
function arDate(s){return parseDate(s).toLocaleDateString('ar-EG',{day:'numeric',month:'long'});}

function stats(){
  const p=state.profile||{goal:1000,days:60,start:todayStr()};
  const goal=Number(p.goal)||1000;
  const days=Number(p.days)||60;
  const elapsed=clamp(dayDiff(parseDate(p.start),new Date()),0,days);
  const left=Math.max(0,days-elapsed);
  const earned=state.income.reduce((a,x)=>a+(Number(x.amount)||0),0);
  const avg=earned/Math.max(1,elapsed+1);
  const need=Math.max(0,goal-earned)/Math.max(1,left);
  const projected=avg*days;
  const pct=clamp(earned/goal*100,0,100);
  return {goal,days,elapsed,left,earned,avg,need,projected,pct};
}

function buildPlan(skillKey){
  const s=SKILLS[skillKey]||SKILLS.none;
  return PLAN_WEEKS.map((w,wi)=>{
    const tasks=w.tasks.slice();
    if(wi===0)tasks.splice(1,0,s.portfolio);
    if(wi===1)tasks.splice(1,0,s.outreach);
    if(wi===4)tasks.splice(2,0,'طوّر مصدراً ثانياً مناسباً لمهارتك: '+s.channels[0]);
    return {title:w.title,focus:w.focus,tasks:tasks.map((t,ti)=>({id:'w'+wi+'t'+ti,text:t,done:false}))};
  });
}
function defaultPricing(){
  const s=SKILLS[state.profile&&state.profile.skill]||SKILLS.none;
  return {service:s.service,price:s.price,hours:s.hours,perWeek:s.perWeek,rate:Math.max(5,Math.round(s.price/Math.max(1,s.hours)))};
}
function ensureDaily(){
  const t=todayStr();
  if(!state.daily||state.daily.date!==t||state.daily.items.length<4){
    const s=SKILLS[state.profile&&state.profile.skill]||SKILLS.none;
    const pool=[
      'تواصل مع 5 عملاء محتملين جدد',
      'انشر نموذج عمل أو مقارنة قبل/بعد',
      'تابع 3 عملاء لم يردّوا بعد',
      'أرسل عرضاً مخصصاً لعميل واحد',
      s.daily,
      'سجّل أي دخل اليوم في قسم الدخل',
      'اطلب توصية من عميل سابق',
      'حسّن صورة أو نموذجاً واحداً في الاستوديو',
      'راجع أرقامك واختر مهمة واحدة للأسبوع'
    ];
    const seed=Math.floor(Date.now()/86400000);
    const items=[];
    for(let k=0;items.length<4&&k<pool.length*2;k++){
      const text=pool[(seed+k)%pool.length];
      if(!items.some(x=>x.text===text))items.push({id:'d'+items.length,text,done:false});
    }
    state.daily={date:t,items};
    save();
  }
}

function toast(msg){
  const el=$('#toast');
  if(!el)return;
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.classList.remove('show'),2400);
}

function switchView(v){
  state.ui.view=v;
  $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  $$('.view').forEach(s=>s.classList.toggle('active',s.id==='view-'+v));
  if(v==='home')renderHome();
  if(v==='mentor')renderChat();
  if(v==='pricing')renderPricing();
  if(v==='content')fillContentDefaults();
  if(v==='clients')renderClients();
  if(v==='income')renderIncome();
  if(v==='sources')renderSources();
  window.scrollTo({top:0,behavior:'smooth'});
  save();
}

function nextAction(){
  const st=stats();
  if(st.earned>=st.goal)return {title:'وصلت للهدف 🎉',desc:'ثبّت الدخل: ارفع السعر، أضف باقة أعلى، وابدأ مصدراً ثانياً. الهدف القادم: 2000$.',view:'income',btn:'راجع أرقامك'};
  if(!state.profile)return {title:'أكمل ملفك',desc:'حتى تبني الخطة على مهارتك ووقتك.',view:'home',btn:'ابدأ'};
  if(st.elapsed<=1)return {title:'أكمل تأسيس الأسبوع الأول',desc:'خدمة واحدة + 3 نماذج + طريقة دفع. لا تبدأ التسويق قبلها.',view:'pricing',btn:'حدد سعرك'};
  const newLeads=state.leads.filter(l=>l.stage==='جديد').length;
  if(newLeads>0)return {title:'تابع '+newLeads+' عميلاً جديداً',desc:'رسالة واحدة اليوم أفضل من انتظار رد. ابدأ بالأسهل.',view:'clients',btn:'افتح العملاء'};
  if(st.earned===0)return {title:'أرسل 15 عرضاً اليوم',desc:'لا دخل بلا تواصل. 15 رسالة مخصصة + 1 منشور قبل/بعد.',view:'sources',btn:'اختر قناة'};
  const week=state.plan?state.plan[clamp(Math.floor(st.elapsed/7),0,7)]:null;
  const pending=week?week.tasks.find(t=>!t.done):null;
  if(pending)return {title:'أكمل مهمة الأسبوع',desc:pending.text,view:'home',btn:'افتح الخطة'};
  return {title:'حافظ على الإيقاع',desc:'انشر نموذجاً، تواصل مع 5 جدد، واطلب إحالة من عميل راضٍ.',view:'sources',btn:'وسّع مصدرك'};
}

function renderHome(){
  const st=stats();
  if(!state.profile){$('#onboard').classList.remove('hidden');return;}
  const s=SKILLS[state.profile.skill]||SKILLS.none;
  $('#heroTitle').textContent=fmt(st.goal)+' في '+st.days+' يوم';
  $('#heroSub').textContent='مرحباً '+state.profile.name+' — '+s.service+' · '+state.profile.hours+' ساعات/يوم';
  $('#heroBadge').textContent=st.left>0?('متبقي '+st.left+' يوم'):'انتهت المدة';
  $('#ring').style.setProperty('--p',st.pct.toFixed(1));
  $('#ringPct').textContent=Math.round(st.pct)+'%';
  $('#bar').style.width=st.pct.toFixed(1)+'%';
  $('#headGoal').innerHTML='🎯 <b>'+fmt(st.earned)+'</b> من '+fmt(st.goal);
  $('#kpis').innerHTML=[
    ['المحصّل',fmt(st.earned),'green'],
    ['المتبقي',fmt(Math.max(0,st.goal-st.earned)),'gold'],
    ['مطلوب/يوم',fmt1(st.need),''],
    ['سرعتك/يوم',fmt1(st.avg),st.avg>=st.need?'green':'red']
  ].map(([k,v,c])=>`<div class="kpi"><small>${k}</small><b class="${c}">${v}</b></div>`).join('');

  const nx=nextAction();
  $('#nextCard').innerHTML=`<div class="lbl">الخطوة التالية</div><h3>${esc(nx.title)}</h3><p>${esc(nx.desc)}</p>
    <button class="btn small" data-go="${nx.view}">${esc(nx.btn)}</button>`;

  ensureDaily();
  $('#todayCard').innerHTML=`<h3>مهام اليوم <span class="muted" style="font-size:.7rem">${arDate(state.daily.date)}</span></h3>`+
    state.daily.items.map(it=>`<label class="mission ${it.done?'done':''}"><input type="checkbox" data-daily="${it.id}" ${it.done?'checked':''}><span>${esc(it.text)}</span></label>`).join('')+
    `<div class="hint">أنجز 3 من 4 على الأقل. الأفعال اليومية أهم من الأرقام.</div>`;

  const price=(state.pricing&&state.pricing.price)||s.price;
  const needClients=Math.ceil(Math.max(0,st.goal-st.earned)/Math.max(1,price));
  const perWeek=(state.pricing&&state.pricing.perWeek)||s.perWeek;
  const weeks=Math.ceil(needClients/Math.max(1,perWeek));
  $('#fitCard').innerHTML=`<h3>الأنسب لك: ${s.icon} ${esc(s.label)}</h3>
    <div class="fit">
      <div class="line"><span>الخدمة المقترحة</span><b>${esc(s.service)}</b></div>
      <div class="line"><span>سعر البداية</span><b class="gold">${fmt(price)}</b></div>
      <div class="line"><span>عملاء مطلوبون</span><b>${needClients} عميل</b></div>
      <div class="line"><span>بمعدل ${perWeek}/أسبوع</span><b>${weeks} أسابيع</b></div>
      <div class="line"><span>أفضل قناة</span><b>${esc(s.channels[0])}</b></div>
    </div>
    <div class="row" style="margin-top:9px"><button class="mini" data-go="pricing">اضبط سعرك</button><button class="mini" data-go="mentor">اسأل المرشد</button></div>`;

  const curWeek=clamp(Math.floor(st.elapsed/7),0,7);
  if(!state.ui.openWeeks||!state.ui.openWeeks.length)state.ui.openWeeks=[curWeek];
  $('#roadmap').innerHTML='<h3>خطة الـ 8 أسابيع</h3><p class="sub" style="margin-bottom:10px">أنجز المهام بالترتيب. يمكنك فتح أي أسبوع.</p>'+
    state.plan.map((w,wi)=>{
      const done=w.tasks.filter(t=>t.done).length,pct=Math.round(done/w.tasks.length*100);
      const open=state.ui.openWeeks.includes(wi);
      return `<div class="week ${open?'open':''} ${wi===curWeek?'now':''}" data-week="${wi}">
        <div class="whead"><span class="arrow">▶</span><b>${esc(w.title)}</b><span class="wprog"><i style="width:${pct}%"></i></span><small>${done}/${w.tasks.length}</small></div>
        <div class="wbody"><p class="sub" style="margin-bottom:6px">${esc(w.focus)}</p>
        ${w.tasks.map(t=>`<label class="mission ${t.done?'done':''}"><input type="checkbox" data-task="${t.id}" ${t.done?'checked':''}><span>${esc(t.text)}</span></label>`).join('')}
        </div></div>`;
    }).join('')+
    (state.extraTasks.length?`<h3 style="margin-top:13px">مهام إضافية من المكتبة</h3>`+state.extraTasks.map(t=>`<label class="mission ${t.done?'done':''}"><input type="checkbox" data-extra="${t.id}" ${t.done?'checked':''}><span>${esc(t.text)}</span></label>`).join(''):'');
}

function findTask(id){
  for(const w of state.plan||[])for(const t of w.tasks)if(t.id===id)return t;
  return null;
}

function renderChat(){
  const log=$('#chatlog');
  if(!log)return;
  if(!state.chat.length){
    const s=SKILLS[state.profile&&state.profile.skill]||SKILLS.none;
    const st=stats();
    state.chat.push({role:'bot',html:`<p>أهلاً ${esc((state.profile&&state.profile.name)||'بك')} 👋 أنا مرشد مِكسب.</p><p>هدفك: <b>${fmt(st.goal)}</b> خلال <b>${st.days}</b> يوماً. المتبقي ${st.left} يوماً، أي <b>${fmt1(st.need)} يومياً</b>.</p><p>أقترح أن نبدأ بخدمة واحدة: <b>${esc(s.service)}</b> بسعر ${fmt((state.pricing&&state.pricing.price)||s.price)}.</p><p>اسألني عن أي شيء: البداية، العملاء، التسعير، أو خطوة اليوم.</p>`,ts:timeNow()});
    save();
  }
  log.innerHTML=state.chat.map(m=>{
    const inner=m.html||esc(m.text).replace(/\n/g,'<br>');
    return `<div class="msg ${m.role==='user'?'user':'bot'}">${inner}<span class="ts">${esc(m.ts||'')}</span></div>`;
  }).join('');
  log.scrollTop=log.scrollHeight;
  const chips=['كيف أبدأ اليوم؟','كيف ألاقي عملاء؟','أول 100$','كيف أسعّر؟','كيف أتفاوض؟','أساسيات التصوير','أدوات مجانية','حسّن صوري'];
  $('#chatChips').innerHTML=chips.map(c=>`<button class="chip" type="button" data-chip="${esc(c)}">${esc(c)}</button>`).join('');
  const cloudOn=state.settings.ai.enabled&&!!state.settings.ai.key;
  $('#mentorMode').textContent=cloudOn?'سحابي':'محلي';
  $('#mentorMode').className='badge'+(cloudOn?' green':'');
  $('#mentorSub').textContent='أنا أعرف خطتك وأرقامك. اسأل بالعامية أو بالفصحى.';
}

function chatPush(role,payload){
  state.chat.push(Object.assign({role,ts:timeNow()},payload));
  save();
  renderChat();
}

function localAnswer(q){
  const n=String(q).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/[ىي]/g,'ي').replace(/[\u064B-\u0652]/g,'');
  const st=stats();
  const s=SKILLS[state.profile&&state.profile.skill]||SKILLS.none;
  const price=(state.pricing&&state.pricing.price)||s.price;
  const needClients=Math.ceil(Math.max(0,st.goal-st.earned)/Math.max(1,price));
  const has=(...w)=>w.some(x=>/^[a-z0-9]+$/.test(x)?new RegExp('(^|[^a-z0-9])'+x+'([^a-z0-9]|$)').test(n):n.includes(x));
  const go=(v,t)=>`<button class="mini" data-go="${v}">${t}</button>`;

  if(has('سلام','مرحبا','هلا','اهلا')&&n.length<12)
    return `<p>أهلاً! جاهز نبدأ؟</p><p>أسرع خطوة الآن: ${go('pricing','اضبط سعرك')} ثم أرسل 5 عروض.</p>`;

  if(has('1000','الف دولار','ألف دولار','هدف','شهرين','60')){
    return `<p><b>رياضيات الهدف:</b></p><ul>
      <li>${fmt(st.goal)} ÷ ${st.days} يوم = <b>${fmt1(st.goal/st.days)}/يوم</b></li>
      <li>بسعر ${fmt(price)} تحتاج <b>${needClients} عميلاً</b> فقط خلال المدة.</li>
      <li>وزّعها على 3 مصادر: 60% خدمة أساسية، 25% خدمة ثانية، 15% منتج/عمولة.</li>
      <li>بمعدل ${(state.pricing&&state.pricing.perWeek)||s.perWeek} عملاء أسبوعياً، تحتاج ${Math.ceil(needClients/Math.max(1,(state.pricing&&state.pricing.perWeek)||s.perWeek))} أسابيع.</li></ul>
      <p>الأهم: 15 تواصلاً يومياً. التحويل الواقعي 5–15% في البداية.</p><p>${go('pricing','احسب بدقة')} ${go('sources','اختر مصدراً')}</p>`;
  }
  if(has('ابدأ','بدايه','اول خطوه','كيف ابدا','من وين')){
    const days=[
      ['اليوم 1','اختر خدمة واحدة وسعراً واضحاً + جهّز طريقة دفع'],
      ['اليوم 2','جهّز 3 نماذج عمل حقيقية (قبل/بعد أو نماذج مصغرة)'],
      ['اليوم 3','افتح بروفايلاً على منصتين واكتب عرضك في 3 أسطر'],
      ['اليوم 4','اكتب قائمة 30 عميلاً محتملاً (متاجر/حسابات/شركات)'],
      ['اليوم 5','أرسل 15 عرضاً مخصصاً وانشر نموذجاً'],
      ['اليوم 6','تابع من رد + أرسل 15 عرضاً جديداً'],
      ['اليوم 7','راجع الأرقام: من رد؟ ماذا طلب؟ عدّل العرض']
    ];
    return `<p>خطة 7 أيام مبنية على مهارتك (<b>${esc(s.label)}</b>):</p><ul>${days.map(d=>`<li><b>${d[0]}:</b> ${d[1]}</li>`).join('')}</ul>
      <p>توقع واقعي: أول عميل خلال 3–14 يوماً، وأول 100$ خلال أول 2–3 أسابيع إذا التزمت بالتواصل.</p>
      <p>${go('pricing','حدد سعرك')} ${go('content','جهّز عرضك')} ${go('sources','شوف المصادر')}</p>`;
  }
  if(has('عميل صعب','شكوي','رفض','زعل','مشكله')){
    return `<p><b>التعامل مع العميل الصعب:</b></p><ul>
      <li>لا تجادل؛ أعد صياغة المشكلة واسأل عن النتيجة المطلوبة.</li>
      <li>حدد ما هو داخل النطاق وما يحتاج سعراً إضافياً.</li>
      <li>الرفض ليس فشلاً؛ 10 رفض = عميل واحد غالباً.</li>
      <li>أنهِ التعامل باحترام؛ السمعة تجلب عملاء أكثر من أي إعلان.</li></ul>
      <p>${go('content','جهّز رداً')} ${go('mentor','اسأل عن حالة محددة')}</p>`;
  }
  if(has('عميل','عملاء','زبون','زباين','تواصل','رسائل')){
    return `<p><b>5 قنوات تجيب عملاء الآن:</b></p><ul>
      <li><b>المتاجر الصغيرة على إنستقرام:</b> ابحث عن حسابات تبيع منتجات بصور ضعيفة. أرسل عينة مجانية صغيرة.</li>
      <li><b>مجموعات فيسبوك/واتساب المحلية:</b> مجموعات أصحاب المتاجر والمشاريع. قدّم قيمة أولاً.</li>
      <li><b>المنصات:</b> خمسات ومستقل (عربي)، Fiverr/Upwork (إنجليزي). ابدأ بسعر منخفض لأول 3 تقييمات.</li>
      <li><b>لينكدإن:</b> للشركات والخدمات الأعلى سعراً. رسالة قصيرة + نتيجة محددة.</li>
      <li><b>المعرفة المباشرة:</b> أسرع قناة. أخبر 10 أشخاص تعرفهم بما تفعله.</li></ul>
      <p><b>قاعدة:</b> 10 تواصلات يومياً × 5 أيام = 50 فرصة. تابع كل من لم يرد مرة واحدة بعد 48 ساعة.</p>
      <p><b>نموذج رسالة:</b> «مرحباً [اسم]، لاحظت صور منتجاتكم. أحسّن 10 صور لكم وأرسل عينة واحدة مجاناً — تحب أجرب؟»</p>
      <p>${go('clients','سجّل عملاءك')} ${go('content','ولّد رسالة')}</p>`;
  }
  if(has('تفاوض','اتفاوض','مساومه','سعر اعلي','خصم','تخفيض')){
    return `<p><b>تفاوض بلا خسارة:</b></p><ul>
      <li>لا تخفض السعر بدون تقليل النطاق (صور أقل/مراجعة أقل).</li>
      <li>اعرض 3 باقات بدل خصم مباشر — العميل يختار القيمة.</li>
      <li>ابدأ بسعر أعلى 20% واترك مساحة تفاوض.</li>
      <li>اطلب 50% مقدماً؛ هذا يحمي وقتك من التأجيل.</li>
      <li>إذا كان الطلب أكبر من قدرتك، ارفض بأدب أو قدّم سعراً أعلى.</li></ul>
      <p>${go('pricing','جهّز باقاتك')}</p>`;
  }
  if(has('سعر','تسعير','كم اخذ','بكم','تكلفه')){
    return `<p><b>قواعد تسعير سريعة:</b></p><ul>
      <li>لا تبدأ بالأرخص. ابدأ بسعر منخفض نسبياً مقابل <b>تقييم ونتيجة</b>، ثم ارفع 20% بعد 3 عملاء.</li>
      <li>سعّر بالنتيجة لا بالساعة: «10 صور بـ 20$» أسهل من «ساعة بـ 3$».</li>
      <li>اطلب 50% مقدماً من العميل الجديد.</li>
      <li>اعرض 3 باقات: أساسي، متوسط (الأكثر ربحاً)، متقدم.</li>
      <li>سعرك الحالي المقترح: <b>${fmt(price)}</b> للخدمة. قيمة ساعتك ≈ ${fmt((state.pricing&&state.pricing.rate)||Math.round(price/Math.max(1,s.hours)))}.</li></ul>
      <p>${go('pricing','افتح الحاسبة')} ${go('content','اكتب عرضك')}</p>`;
  }
  if(has('تصوير','اصور','اضاءه','كاميرا','خلفيه','زوايا')){
    return `<p><b>أساسيات تصوير تبيع:</b></p><ul>
      <li>استخدم نافذة نهارية بجانب المنتج، لا فلاش مباشر.</li>
      <li>خلفية بيضاء أو سادة + مسافة بين المنتج والخلفية.</li>
      <li>نظّف عدسة الهاتف، ثبّت الهاتف، وصوّر من 3 زوايا.</li>
      <li>صوّر بإضاءة ثابتة ثم حسّن في الاستوديو.</li>
      <li>لا تبالغ في الحدّة أو التشبّع حتى لا يبدو المنتج مختلفاً.</li></ul>
      <p>${go('studio','جرّب على صورة')} ${go('content','اعرض قبل/بعد')}</p>`;
  }
  if(has('صور','صوره','تحسين','جوده','استوديو','منتج')){
    return `<p>افتح <b>الاستوديو</b> وارفع الصورة، ثم اكتب نوع العمل:</p><ul>
      <li><b>منتج/متجر:</b> تكبير 2×، توازن أبيض تلقائي، حدّة متوسطة، تشبّع بسيط.</li>
      <li><b>بورتريه:</b> تقليل ضوضاء أعلى وحدّة أقل حتى لا تبدو البشرة صناعية.</li>
      <li><b>لوجو/طباعة:</b> تكبير 4× وحدّة عالية، وتصدير PNG للشفافية.</li>
      <li><b>سوشيال:</b> قص مربع 1080×1080 وألوان أوضح.</li>
      <li><b>قديمة/تالفة:</b> قلّل الضوضاء أولاً ثم ارفع التباين.</li></ul>
      <p>نصيحة بيع: اعرض <b>قبل/بعد</b> دائماً — هي أقوى إعلان لخدمة تحسين الصور.</p>
      <p>${go('studio','افتح الاستوديو')}</p>`;
  }
  if(has('فريلانس','فايفر','خمسات','مستقل','upwork','منصه','منصات')){
    return `<p><b>خطة المنصات:</b></p><ul>
      <li><b>خمسات/مستقل:</b> ابدأ بخدمة واحدة واضحة، 5 صور، وسعر منخفض لأول 3 طلبات. الرد السريع يرفع ترتيبك.</li>
      <li><b>Fiverr:</b> اكتب الخدمة بالإنجليزية، واستخدم عنواناً بنتيجة («I will enhance 10 product photos»).</li>
      <li><b>Upwork:</b> قدّم على 5 وظائف يومياً برسالة مخصصة أول سطرين، لا نسخ ولصق.</li>
      <li>لا تدفع لوسطاء يطلبون رسوماً قبل العمل.</li></ul>
      <p>${go('content','جهّز وصف الخدمة')} ${go('pricing','حدد سعرك')}</p>`;
  }
  if(has('واتساب','واتس اب','بزنس')){
    return `<p><b>واتساب أعمال يبيع:</b></p><ul>
      <li>أنشئ واتساب أعمال برقم مخصص إن أمكن.</li>
      <li>اكتب وصفاً واضحاً + ساعات الرد + رابط أعمالك.</li>
      <li>استخدم رسالة ترحيب وقوالب ردود سريعة.</li>
      <li>لا ترسل رسائل جماعية مزعجة؛ ابدأ بعرض مخصص.</li></ul>
      <p>${go('content','جهّز رسالة أول تواصل')}</p>`;
  }
  if(!n.includes('قمع')&&has('تسويق','اسوق','انستقرام','تيك','واتساب','منشور','محتوي','نشر')){
    return `<p><b>3 أنواع محتوى تكفي:</b></p><ul>
      <li><b>قبل/بعد:</b> أقوى إثبات. صورة واحدة + سطر نتيجة.</li>
      <li><b>نصيحة سريعة:</b> «3 أخطاء في صور المنتجات» — يبني ثقة.</li>
      <li><b>عرض مباشر:</b> خدمة + سعر + خطوة واضحة + موعد.</li></ul>
      <p>انشر 4–5 مرات أسبوعياً، وأرسل 10 رسائل مباشرة يومياً. المحتوى وحده لا يبيع في البداية.</p>
      <p>أفضل وقت تجريبي: 7–9 مساءً بتوقيت جمهورك. راقب أرقامك وعدّل.</p>
      <p>${go('content','ولّد محتوى')}</p>`;
  }
  if(has('دفع','فلوس','استلم','بايبال','paypal','تحويل','بنك','payoneer','باينونير')){
    return `<p><b>طرق استلام الدفع:</b></p><ul>
      <li><b>PayPal:</b> واسع الانتشار لكن قد يكون مقيداً في بعض الدول. تحقق قبل الاعتماد عليه.</li>
      <li><b>Payoneer / Wise:</b> جيدان للعملاء الدوليين والتحويل لبنكك.</li>
      <li><b>تحويل بنكي/محفظة محلية:</b> مناسب للعملاء المحليين وسريع.</li>
      <li><b>Gumroad/Payhip:</b> للمنتجات الرقمية، يتولى الدفع والتسليم.</li></ul>
      <p>اطلب 50% مقدماً، وأرسل فاتورة بسيطة (اسمك، الخدمة، المبلغ، التاريخ). سجّل كل عملية في قسم الدخل.</p>
      <p>${go('income','سجّل أول دخل')}</p>`;
  }
  if(has('قانون','ضريبه','نصب','احتيال','امان','حقوق')){
    return `<p><b>حماية أساسية:</b></p><ul>
      <li>لا تضمن نتائج مبيعات أو أرباحاً للعميل — هذا التزام قانوني خطير.</li>
      <li>اتفق كتابياً على النطاق وعدد التعديلات وموعد التسليم.</li>
      <li>لا تستخدم صوراً أو خطوطاً لا تملك ترخيصها.</li>
      <li>الضرائب تختلف حسب بلدك؛ احتفظ بسجل دخل واسأل مختصاً عند التوسع.</li>
      <li>أي جهة تضمن لك 1000$ مقابل دفع مسبق = علامة خطر.</li></ul>
      <p>هذه معلومات عامة وليست استشارة قانونية.</p>`;
  }
  if(has('وقت','ساعات','تنظيم','اداره الوقت','مشغول')){
    const h=(state.profile&&state.profile.hours)||3;
    return `<p>خطة يومية لـ <b>${h} ساعات</b>:</p><ul>
      <li><b>${Math.max(1,Math.round(h*0.4))} ساعة:</b> تواصل وعروض ومتابعة (الأولوية القصوى في البداية).</li>
      <li><b>${Math.max(1,Math.round(h*0.4))} ساعة:</b> تنفيذ العملاء والنماذج.</li>
      <li><b>${Math.max(0.5,Math.round(h*0.2*10)/10)} ساعة:</b> تعلم/محتوى/مراجعة أرقام.</li></ul>
      <p>الأيام الأولى: 70% بيع و30% تنفيذ. من دون بيع لن يكون هناك تنفيذ.</p>
      <p>${go('home','افتح مهام اليوم')}</p>`;
  }
  if(has('ادوات','أدوات','برامج','ai','ذكاء','مجاني')){
    return `<p><b>أدوات مجانية تكفي للبداية:</b></p><ul>
      <li><b>تحسين الصور:</b> استوديو مِكسب (داخل التطبيق).</li>
      <li><b>تصميم:</b> Canva — قوالب منشورات وعروض.</li>
      <li><b>مونتاج:</b> CapCut — مقاطع قبل/بعد قصيرة.</li>
      <li><b>إزالة خلفية:</b> remove.bg — للصور والمنتجات.</li>
      <li><b>تنظيم:</b> Google Sheets / Notion — عملاء ودخل.</li>
      <li><b>ذكاء اصطناعي:</b> ChatGPT/Claude للكتابة والأفكار — راجع الناتج دائماً.</li></ul>
      <p>لا تشترِ أداة قبل أن تربح منها. المجاني يكفي لأول 500$.</p>`;
  }
  if(has('منتج رقمي','قالب','قوالب','بريسيت','دخل سلبي')){
    return `<p><b>منتج رقمي صغير يبدأ سريعاً:</b></p><ul>
      <li>قالب منشورات لقطاع واحد (مطاعم/تجميل) بـ 9–19$.</li>
      <li>بريسيت تحسين صور لهاتف معين بـ 5–12$.</li>
      <li>دليل PDF قصير «كيف تصوّر منتجاتك بالهاتف» بـ 7–15$.</li></ul>
      <p>البيع عبر Gumroad أو Payhip أو صفحة بسيطة. لكن المنتج يحتاج جمهوراً؛ اجمع 100 متابع مهتم أولاً أو استخدمه كمصدر ثانٍ.</p>
      <p>${go('content','اكتب صفحة البيع')} ${go('sources','شوف المسار')}</p>`;
  }
  if(has('يأس','صعب','مافي','فشل','تحفيز','احباط','تعب')){
    return `<p>طبيعي. المشكلة غالباً ليست القدرة، بل حجم الخطوة.</p><ul>
      <li>قلّص الهدف اليومي إلى: <b>رسالة واحدة</b> + <b>نموذج واحد</b>.</li>
      <li>لا تقارن نفسك بالنتائج، قارن نفسك بعدد المحاولات.</li>
      <li>إذا مر أسبوع بلا رد، غيّر العرض أو الجمهور — لا تتوقف.</li>
      <li>سجّل كل تقدم صغير في قسم الدخل؛ سترى أنك تتحرك.</li></ul>
      <p>${go('home','مهمة واحدة الآن')} ${go('mentor','اسألني عن العقبة')}</p>`;
  }
  if(has('افضل خدمه','اي خدمه','ماذا ابيع','شنو ابيع','مهارتي')){
    return `<p>حسب ملفك (<b>${esc(s.label)}</b>)، أفضل بداية:</p><ul>
      <li><b>${esc(s.service)}</b> بسعر ${fmt(price)}.</li>
      <li>القنوات: ${s.channels.map(c=>esc(c)).join('، ')}.</li>
      <li>أول خطوة: ${esc(s.portfolio)}.</li></ul>
      <p>لا تبع أكثر من خدمة واحدة في أول أسبوعين. التشتت يقتل الدخل.</p>
      <p>${go('sources','قارن المصادر')} ${go('pricing','حدد السعر')}</p>`;
  }
  if(has('كم عميل','عدد العملاء','كم احتاج')){
    return `<p>بسعر <b>${fmt(price)}</b> تحتاج <b>${needClients} عميلاً</b> للوصول إلى ${fmt(st.goal)}.</p>
      <p>إذا خدمت ${(state.pricing&&state.pricing.perWeek)||s.perWeek} عملاء أسبوعياً فتحتاج ${Math.ceil(needClients/Math.max(1,(state.pricing&&state.pricing.perWeek)||s.perWeek))} أسابيع.</p>
      <p>في الواقع: أرسل 10 عروض لكل عميل محتمل واحد. أي 10–15 تواصلاً يومياً.</p>
      <p>${go('pricing','جرّب أرقاماً أخرى')} ${go('clients','ابدأ قائمة عملاء')}</p>`;
  }
  if(has('دروبشيب','عموله','affiliate','تسويق بالعموله')){
    return `<p>الدروبشيبينغ والعمولة <b>ليستا بداية سريعة</b>: تحتاج جمهوراً أو ميزانية إعلانات.</p><ul>
      <li>ابدأ بخدمة تقدمها بنفسك لتوليد تدفق نقدي أولاً.</li>
      <li>العمولة مناسبة إذا كان لديك محتوى/جمهور بالفعل.</li>
      <li>لا تشترِ منتجاً بكميات قبل اختبار الطلب.</li></ul>
      <p>${go('sources','اختر مساراً أسرع')}</p>`;
  }
  if(has('اول 100','100 دولار','اول ميه','أول 100')){
    return `<p><b>خطة أول 100$ (أسرع مسار):</b></p><ul>
      <li>اختر خدمة صغيرة واحدة: تحسين 10 صور، 5 منشورات، أو وصف 10 منتجات.</li>
      <li>سعر البداية 15–25$ للحزمة، لا بالساعة.</li>
      <li>أرسل 20 عرضاً مخصصاً في 3 أيام، مع عينة واحدة مجانية.</li>
      <li>أغلق 4–6 عملاء = 100$ تقريباً.</li></ul>
      <p>لا تنتظر التقييمات؛ اصنع 3 نماذج بنفسك. أول 100$ تثبت أن العرض يبيع.</p>
      <p>${go('pricing','اضبط السعر')} ${go('content','جهّز العرض')} ${go('clients','ابدأ التواصل')}</p>`;
  }
  if(has('تصميم','الوان','هويه','خطوط','هرميه')){
    return `<p><b>أساسيات تصميم تبيع:</b></p><ul>
      <li>تباين واضح بين النص والخلفية.</li>
      <li>هرمية: عنوان كبير، ثم فائدة، ثم زر واضح.</li>
      <li>مساحة بيضاء أكثر = مظهر أغلى وأوضح.</li>
      <li>خطان كحد أقصى + لون أساسي + لون محايد.</li>
      <li>صدّر PNG للشفافية، JPG للصور، PDF للطباعة.</li></ul>
      <p>${go('studio','حسّن الصورة')} ${go('pricing','سعّر التصميم')}</p>`;
  }
  if(has('كتابه','كوبي','اعلان','aida','pas','نص بيع')){
    return `<p><b>صيغ كتابة إعلانية:</b></p><ul>
      <li><b>AIDA:</b> انتباه → اهتمام → رغبة → فعل.</li>
      <li><b>PAS:</b> مشكلة → تضخيم → حل.</li>
      <li>اكتب فائدة لا مواصفة: «صور تبيع» لا «دقة 4K».</li>
      <li>جملة واحدة لكل فكرة، وCTA واضح في النهاية.</li>
      <li>أضف دليلاً: قبل/بعد أو رأي عميل.</li></ul>
      <p>${go('content','ولّد 3 نسخ')}</p>`;
  }
  if(has('تعلم','اتعلم','كورس','تدريب','مهاره جديده')){
    return `<p><b>تعلّم بسرعة وبلا إدمان كورسات:</b></p><ul>
      <li>اختر مهارة واحدة و20 ساعة مركزة خلال أسبوعين.</li>
      <li>تعلّم بالمشروع: أنجز 3 أعمال حقيقية لا تمارين.</li>
      <li>اطلب نقداً محدداً من شخص أفضل منك.</li>
      <li>لا تشترِ كورساً قبل أول 50$ من المجال نفسه.</li>
      <li>استخدم أدوات AI لتسريع التنفيذ مع مراجعة يدوية.</li></ul>
      <p>${go('sources','اختر مساراً')} ${go('home','ابدأ اليوم')}</p>`;
  }
  if(has('فاتوره','عقد','اتفاق','دفعه')){
    return `<p><b>فاتورة/اتفاق يحميك:</b></p><ul>
      <li>حدد النطاق، عدد المراجعات، مدة التسليم، السعر، وطريقة الدفع.</li>
      <li>50% مقدماً و50% قبل التسليم النهائي.</li>
      <li>اذكر أن الملفات المصدرية اختيارية أو مدفوعة.</li>
      <li>احتفظ بسجل كل عميل وفاتورة في مكان واحد.</li>
      <li>لا تبدأ عملاً كبيراً برسالة شفهية فقط.</li></ul>
      <p>${go('income','سجّل الدخل')} ${go('clients','تابع العملاء')}</p>`;
  }
  if(has('منافس','بحث السوق','دراسه السوق','سوق')){
    return `<p><b>ابحث عن منافسيك في 10 دقائق:</b></p><ul>
      <li>ابحث في خمسات/Fiverr عن نفس خدمتك.</li>
      <li>سجّل: السعر، الوصف، عدد التقييمات، وما يعدون به.</li>
      <li>اعرض شيئاً واحداً أفضل: سرعة، عينة مجانية، أو تخصصاً.</li>
      <li>لا تنافس بالأرخص؛ نافس بالوضوح والنتيجة.</li></ul>
      <p>${go('content','اكتب عرضاً مختلفاً')} ${go('pricing','حدد موقعك السعري')}</p>`;
  }
  if(has('تقييم','مراجعه','شهاده','توصيه')){
    return `<p><b>اجمع تقييمات تبيع:</b></p><ul>
      <li>اطلب التقييم فور التسليم وأرسل رابطاً مباشراً.</li>
      <li>اجعل الطلب محدداً: «جملة واحدة عن النتيجة».</li>
      <li>اعرض خصم 10% على الخدمة القادمة مقابل التقييم.</li>
      <li>انشر الشهادات في ملفك ومحتواك.</li></ul>
      <p>${go('content','اصنع منشور شهادة')}</p>`;
  }
  if(has('شكرا','مشكور','تمام','اوك')){
    return `<p>بالتوفيق. لا تنسَ: <b>15 تواصلاً اليوم</b> أهم من أي خطة.</p><p>${go('home','ارجع للخطة')}</p>`;
  }
  const glossary=[
    {k:['seo','السيو'],t:'SEO',d:'تحسين ظهورك في نتائج بحث جوجل مجاناً.',u:'ابدأ بكلمة يبحث عنها عميلك، واكتب صفحة تشرح خدمتك بوضوح، واطلب من مواقع صغيرة ذكرك. في البداية يكفي تحسين وصف حسابك ومنشوراتك بنفس الكلمات.',g:'content'},
    {k:['cta'],t:'CTA',d:'دعوة لاتخاذ إجراء: الجملة التي تطلب الخطوة التالية.',u:'مثال: «أرسل صورك الآن» أو «اطلب العرض». كل منشور أو صفحة تحتاج CTA واحداً واضحاً فقط.',g:'content'},
    {k:['ctr'],t:'CTR',d:'نسبة النقر: النقرات ÷ مرات الظهور.',u:'إذا كانت منخفضة، غيّر العنوان أو الصورة أولاً، لا الميزانية. جرّب 3 عناوين مختلفة واحتفظ بالأفضل.',g:'content'},
    {k:['roi'],t:'ROI',d:'العائد على الاستثمار: (الربح − التكلفة) ÷ التكلفة.',u:'أنفقت 10$ وأربحت 30$ → ROI = 200%. لا تزد الإعلان قبل أن يكون العائد موجباً.',g:'income'},
    {k:['kpi'],t:'KPI',d:'مؤشر أداء تقيس به التقدم.',u:'اختر 3 فقط: عدد العروض، عدد الردود، الدخل. راقبها أسبوعياً في قسم الدخل.',g:'income'},
    {k:['usp'],t:'USP',d:'عرض القيمة الفريد: ما يجعلك مختلفاً عن غيرك.',u:'مثال: «تسليم 24 ساعة + تعديلان مجاناً». لا تقل «جودة عالية»؛ فهذا ليس تميزاً.',g:'pricing'},
    {k:['crm'],t:'CRM',d:'إدارة علاقات العملاء: سجل لكل عميل ومحادثاته ومرحلته.',u:'قسم العملاء في مِكسب يكفي: الاسم، القناة، آخر تواصل، المرحلة، المبلغ. تابع كل عميل خلال 48 ساعة.',g:'clients'},
    {k:['b2b'],t:'B2B',d:'بيع لشركة أو صاحب مشروع، لا لمستهلك نهائي.',u:'القرار أبطأ لكن السعر أعلى. اكتب بلغة النتيجة والتكلفة والوقت، وليس بلغة عاطفية.',g:'clients'},
    {k:['b2c'],t:'B2C',d:'بيع لمستهلك نهائي.',u:'القرار أسرع وعاطفي. استخدم صوراً واضحة، عرضاً محدوداً، وسهولة طلب.',g:'content'},
    {k:['landing page','صفحه هبوط','هبوط','لاندنج'],t:'صفحة هبوط',d:'صفحة واحدة هدفها إجراء واحد: طلب أو حجز أو شراء.',u:'عنوان + فائدة + دليل (قبل/بعد أو رأي) + زر + نموذج قصير. احذف كل رابط لا يخدم الهدف.',g:'pricing'},
    {k:['funnel','قمع'],t:'قمع التسويق',d:'رحلة العميل: مشاهدة → اهتمام → عرض → شراء.',u:'لا تبع في أول رسالة. ابدأ بقيمة أو عينة، ثم اعرض، ثم اطلب الخطوة.',g:'content'},
    {k:['lead'],t:'Lead',d:'عميل محتمل أبدى اهتماماً لكنه لم يشترِ بعد.',u:'سجّله فوراً وتابعه خلال 48 ساعة. الاهتمام يبرد بسرعة.',g:'clients'},
    {k:['conversion'],t:'Conversion',d:'نسبة من أكمل الإجراء المطلوب (شراء/حجز/رسالة).',u:'حسّن الوضوح والسرعة وسهولة الطلب قبل زيادة الإعلان.',g:'pricing'},
    {k:['retainer'],t:'Retainer',d:'عقد شهري بمبلغ ثابت مقابل عمل متكرر.',u:'ابدأ بعميل واحد ثم 3. الدخل الثابت يقلل ضغط البحث الشهري.',g:'income'},
    {k:['niche'],t:'Niche',d:'تخصص ضيق يسهّل عليك التسويق.',u:'«صور منتجات عطور» أفضل من «تصميم لأي شخص». التخصص يرفع السعر ويقلل المنافسة.',g:'sources'},
    {k:['portfolio'],t:'Portfolio',d:'ملف أعمال يضم أفضل نماذجك.',u:'3–6 نماذج قوية مع قبل/بعد أفضل من 30 عملاً متوسطاً. ضعه في أول رسالة.',g:'content'},
    {k:['tradingview','تردينغ فيو','تريدينغ فيو','شارت'],t:'TradingView',d:'منصة رسوم بيانية وتحليل أسواق: أسهم، عملات، سلع، وعملات رقمية.',u:'تستخدمها لقراءة الشارت ومتابعة سوق تهتم به، وليست مصدر دخل بحد ذاتها. التداول عالي المخاطر وقد تخسر رأس مالك؛ لا تعتمد عليه لهدف 1000$ في 60 يوماً، ولا تدفع مقابل توصيات.',g:'sources'}
  ];
  const term=glossary.find(x=>x.k.some(k=>n.includes(k)));
  if(term){
    const gv={content:'content',income:'income',pricing:'pricing',clients:'clients',sources:'sources'}[term.g]||'home';
    const gt={content:'ولّد محتوى',income:'سجّل الدخل',pricing:'اضبط السعر',clients:'افتح العملاء',sources:'اختر مصدراً',home:'الخطة'}[term.g]||'الخطة';
    return `<p><b>${term.t}:</b> ${term.d}</p><p>${term.u}</p><p>${go(gv,gt)}</p>`;
  }
  if(has('ما هو','ما معني','معني','تعريف','وش يعني')){
    return `<p>سؤالك عام. المرشد المحلي متخصص في خطة الربح والخدمات والتسويق. للأسئلة العامة جداً، فعّل <b>الذكاء السحابي</b> من الإعدادات (مفتاحك يبقى في جهازك).</p>
      <p>أو اسألني بصيغة عملية، مثل: «كيف أستخدم هذا في أول 100$؟» وسأجيب بخطوات.</p>
      <p>${go('sources','مصادر الربح')} ${go('mentor','جرّب سؤالاً عملياً')}</p>`;
  }
  return `<p>سؤال جيد. خلّني أحوّله لخطوة عملية:</p><ul>
    <li><b>إن كان عن البداية:</b> اختر خدمة واحدة بسعر ${fmt(price)} وجهّز 3 نماذج.</li>
    <li><b>إن كان عن العملاء:</b> أرسل 10 رسائل مخصصة اليوم وتابع بعد 48 ساعة.</li>
    <li><b>إن كان عن السعر:</b> ابدأ بـ ${fmt(price)} وارفع 20% بعد 3 عملاء.</li>
    <li><b>إن كان عن الوقت:</b> 70% بيع و30% تنفيذ في أول أسبوعين.</li></ul>
  <p>تقدر تسألني أيضاً: «كيف أبدأ اليوم؟» أو «كم عميل أحتاج؟» أو «كيف ألاقي عملاء؟».</p>
  <p>${go('home','خطتي')} ${go('studio','الاستوديو')} ${go('pricing','التسعير')}</p>`;
}

function systemPrompt(){
  const st=stats();
  const s=SKILLS[state.profile&&state.profile.skill]||SKILLS.none;
  return `أنت "مرشد مِكسب"، مرشد عربي عملي هدفه مساعدة المستخدم على تحقيق ${st.goal}$ خلال ${st.days} يوماً.
بيانات المستخدم: الاسم ${(state.profile&&state.profile.name)||'غير معروف'}، المهارة ${s.label}، ${(state.profile&&state.profile.hours)||3} ساعات/يوم، رأس مال ${(state.profile&&state.profile.capital)||0}$، محصّل ${st.earned.toFixed(0)}$، متبقي ${st.left} يوم.
الخدمة المقترحة: ${s.service} بسعر ${(state.pricing&&state.pricing.price)||s.price}$.
أجب بالعربية، بإيجاز، بخطوات قابلة للتنفيذ وأرقام. لا تضمن أرباحاً. لا تطلب بيانات حساسة. اربط النصيحة بخطة المستخدم وأقسام التطبيق (الاستوديو، التسعير، المحتوى، العملاء، الدخل، المصادر).`;
}

async function cloudReply(userText){
  const ai=state.settings.ai;
  const url=ai.base.replace(/\/+$/,'')+'/chat/completions';
  const msgs=[{role:'system',content:systemPrompt()}];
  state.chat.slice(-11,-1).forEach(m=>{
    if(m.role==='user')msgs.push({role:'user',content:m.text||''});
    else if(m.text)msgs.push({role:'assistant',content:m.text});
  });
  msgs.push({role:'user',content:userText});
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+ai.key},body:JSON.stringify({model:ai.model,messages:msgs,temperature:0.6,max_tokens:800})});
  if(!res.ok)throw new Error('HTTP '+res.status);
  const j=await res.json();
  const txt=j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;
  if(!txt)throw new Error('رد فارغ');
  return txt.trim();
}

async function sendChat(text){
  const q=String(text||'').trim();
  if(!q)return;
  chatPush('user',{text:q});
  const input=$('#chatInput');
  if(input)input.value='';
  const log=$('#chatlog');
  const typing=document.createElement('div');
  typing.className='msg bot';
  typing.innerHTML='<div class="typing"><i></i><i></i><i></i></div>';
  log.appendChild(typing);
  log.scrollTop=log.scrollHeight;
  const ai=state.settings.ai;
  if(ai.enabled&&ai.key&&ai.base&&ai.model){
    try{
      const ans=await cloudReply(q);
      typing.remove();
      chatPush('bot',{text:ans});
    }catch(e){
      typing.remove();
      chatPush('bot',{html:`<p class="red"><b>تعذر الاتصال بالذكاء السحابي</b> (${esc(e.message)}).</p><p>هذه إجابة المرشد المحلي:</p>`+localAnswer(q)});
    }
  }else{
    await new Promise(r=>setTimeout(r,320));
    typing.remove();
    chatPush('bot',{html:localAnswer(q)});
  }
}
