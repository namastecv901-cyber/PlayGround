function renderPricing(){
  const p=state.pricing||(state.pricing=defaultPricing());
  $('#prService').value=p.service;
  $('#prPrice').value=p.price;
  $('#prHours').value=p.hours;
  $('#prWeek').value=p.perWeek;
  $('#prRate').value=p.rate;
  computePricing();
}

function computePricing(){
  if(!state.profile)return;
  const service=$('#prService').value.trim()||'خدمتي';
  const price=Math.max(1,Number($('#prPrice').value)||1);
  const hours=Math.max(0.5,Number($('#prHours').value)||1);
  const perWeek=Math.max(1,Number($('#prWeek').value)||1);
  const rate=Math.max(1,Number($('#prRate').value)||1);
  state.pricing={service,price,hours,perWeek,rate};
  save();
  const st=stats();
  const remaining=Math.max(0,st.goal-st.earned);
  const clients=Math.ceil(remaining/price);
  const weeks=Math.ceil(clients/perWeek);
  const effective=price/hours;
  const monthIncome=perWeek*4*price;
  $('#prOut').innerHTML=`<h3>النتيجة</h3>
    <div class="fit">
      <div class="line"><span>سعر الخدمة</span><b class="gold">${fmt(price)}</b></div>
      <div class="line"><span>قيمة ساعتك الفعلية</span><b>${fmt(effective)}/ساعة</b></div>
      <div class="line"><span>المتبقي للهدف</span><b>${fmt(remaining)}</b></div>
      <div class="line"><span>عملاء مطلوبون</span><b class="green">${clients} عميل</b></div>
      <div class="line"><span>بمعدل ${perWeek}/أسبوع</span><b>${weeks} أسابيع</b></div>
      <div class="line"><span>دخل شهري محتمل عند الامتلاء</span><b>${fmt(monthIncome)}</b></div>
    </div>
    <div class="tip">${weeks<=Math.ceil(st.left/7)?'✅ الأرقام داخل المدة. ثبّت على التواصل اليومي.':'⚠️ الأرقام تحتاج تسريعاً: ارفع السعر، زد العملاء أسبوعياً، أو أضف مصدراً ثانياً.'}</div>`;
  const mk=(name,mult,extra)=>{
    const v=Math.round(price*mult);
    return `<div class="src"><h4>${name} — ${fmt(v)}</h4><p>${extra}</p><button class="mini" data-offer="${v}">استخدم في العرض</button></div>`;
  };
  $('#prPacks').innerHTML=`<h3>3 باقات جاهزة</h3><div class="srcgrid">
    ${mk('الأساسية',1,'الخدمة الأساسية + مراجعة واحدة + تسليم عادي.')}
    ${mk('الوسطى',1.8,'الخدمة + مراجعتان + تسليم سريع + ملف نهائي منظم. (الأكثر ربحاً)')}
    ${mk('المتقدمة',3,'الخدمة + 3 مراجعات + أولوية تنفيذ + نسخة إضافية للمنصات.')}
  </div>`;
  $('#prOfferText').textContent=`مرحباً 👋
أنا ${(state.profile&&state.profile.name)||''}، وأساعد أصحاب المتاجر الصغيرة في ${service}.

ما ستحصل عليه:
• ${service} بجودة جاهزة للنشر
• مراجعة واحدة مشمولة
• تسليم خلال ${Math.max(24,Math.round(hours*8))} ساعة

السعر: ${fmt(price)} فقط.
عرض محدود: أول 3 عملاء هذا الأسبوع بسعر ${fmt(Math.round(price*0.9))}.

تحب أرسل لك عينة قبل البدء؟`;
}

function renderContent(){
  fillContentDefaults();
  $('#ctOut').innerHTML='<div class="emptybox">اكتب بيانات خدمتك ثم اضغط «ولّد 3 نسخ».</div>';
}

function fillContentDefaults(){
  if($('#ctService').value)return;
  const s=SKILLS[state.profile&&state.profile.skill]||SKILLS.none;
  $('#ctService').value=(state.pricing&&state.pricing.service)||s.service;
  $('#ctAudience').value='أصحاب المتاجر الصغيرة على إنستقرام';
  $('#ctBenefit').value=s.tip.split('.')[0];
  $('#ctPrice').value=(state.pricing&&state.pricing.price)||s.price;
}

function generateContent(){
  const service=$('#ctService').value.trim()||'خدمتي';
  const audience=$('#ctAudience').value.trim()||'أصحاب المشاريع الصغيرة';
  const benefit=$('#ctBenefit').value.trim()||'نتيجة أفضل في وقت أقل';
  const price=Math.max(1,Number($('#ctPrice').value)||10);
  const platform=$('#ctPlatform').value;
  const tone=$('#ctTone').value;
  const name=(state.profile&&state.profile.name)||'';
  const soft=tone==='احترافية رسمية'?'يسعدني أن أشارككم':'تحب نجرب؟';
  const hook=tone==='حماسية تسويقية'?'🔥 عرض سريع':'فكرة قد تفيدك';
  const proof={design:'تصاميم ومنشورات',photo:'صور منتجات',writing:'نصوص ووصف',dev:'صفحات ومواقع',marketing:'حملات ومحتوى',support:'ردود ومتابعة',none:'خدمات جاهزة'}[state.profile&&state.profile.skill]||'خدمات';
  const sample={design:'عينة تصميم',photo:'صورة محسّنة',writing:'نصاً تجريبياً',dev:'مراجعة سريعة',marketing:'خطة مصغرة',support:'تجربة ردود',none:'عينة صغيرة'}[state.profile&&state.profile.skill]||'عينة صغيرة';
  const posts=[
    {t:'عرض مباشر',body:`${hook} لـ ${audience}

${benefit}.

أقدم ${service} بسعر ${fmt(price)}، مع تسليم منظم ومراجعة واحدة.

مناسب لك إذا:
• تحتاج ${proof} بمستوى احترافي
• تحتاج تسليماً سريعاً وواضحاً

${soft} أرسل لك عينة مجانية صغيرة قبل البدء.

— ${name}`},
    {t:'قبل / بعد',body:`قبل: نسخة عادية لا توقف أحداً.
بعد: ${benefit}.

هذا بالضبط ما أفعله في ${service}.

أعمل مع ${audience}، والسعر يبدأ من ${fmt(price)}.

أرسل لي كلمة «عينة» وسأجهّز ${sample} لك مجاناً.

— ${name}`},
    {t:'رسالة متابعة',body:`مرحباً 👋
أتابع بخصوص رسالتي السابقة عن ${service}.

أعرف أن الرسائل كثيرة، لذا سأختصر:
• ${benefit}
• السعر ${fmt(price)}
• أبدأ بعينة مجانية لتتأكد من الجودة

إذا لم يكن الوقت مناسباً الآن، أخبرني وأتوقف عن المتابعة. وإذا كان مناسباً، أرسل «تمام» وأبدأ اليوم.

— ${name}`}
  ];
  $('#ctOut').innerHTML=`<h3>3 نسخ لـ ${esc(platform)}</h3>`+posts.map((p,i)=>`<div class="card" style="padding:12px;margin-bottom:9px"><div class="row"><b style="flex:1;font-size:.85rem">${i+1}. ${esc(p.t)}</b><button class="mini" data-copy="${i}">نسخ</button></div><div class="resultbox" style="margin-top:7px">${esc(p.body)}</div></div>`).join('')+
    `<div class="hint">عدّل السطر الأول والأخير فقط. الرسائل القصيرة المخصصة أفضل من الطويلة العامة.</div>`;
  $('#ctOut').dataset.posts=JSON.stringify(posts.map(p=>p.body));
}

function renderClients(){
  const sel=$('#clStage');
  if(sel&&!sel.options.length)sel.innerHTML=STAGES.map(s=>`<option>${s}</option>`).join('');
  const total=state.leads.reduce((a,l)=>a+(Number(l.value)||0),0);
  const won=state.leads.filter(l=>l.stage==='فاز').reduce((a,l)=>a+(Number(l.value)||0),0);
  const active=state.leads.filter(l=>!['فاز','خسر'].includes(l.stage)).length;
  $('#clStats').innerHTML=[['عملاء محتملون',state.leads.length,''],['قيمة الفرص',fmt(total),'gold'],['صفقات فازت',fmt(won),'green'],['قيد المتابعة',active,'']]
    .map(([k,v,c])=>`<div class="kpi"><small>${k}</small><b class="${c}">${v}</b></div>`).join('');
  if(!state.leads.length){
    $('#clList').innerHTML='<div class="emptybox">لا عملاء بعد. أضف أول 10 أسماء اليوم — القائمة نفسها ترفع فرصك.</div>';
    return;
  }
  const order={'جديد':0,'تم التواصل':1,'تفاوض':2,'فاز':3,'خسر':4};
  const sorted=state.leads.slice().sort((a,b)=>(order[a.stage]??9)-(order[b.stage]??9));
  $('#clList').innerHTML=sorted.map(l=>`<div class="item">
    <div class="grow"><b>${esc(l.name)}</b><small>${esc(l.channel||'—')} · ${esc(l.service||'—')}${l.note?' · '+esc(l.note):''}</small>
      <div class="row" style="margin-top:6px">
        <select data-stage="${l.id}" style="width:auto;padding:5px 8px;font-size:.72rem">${STAGES.map(s=>`<option ${s===l.stage?'selected':''}>${s}</option>`).join('')}</select>
        ${l.stage==='فاز'?`<button class="mini" data-leadincome="${l.id}">سجّل الدخل</button>`:''}
      </div>
    </div>
    <div style="text-align:left"><div class="amt">${fmt(l.value||0)}</div><button class="xbtn" data-dellead="${l.id}" style="margin-top:6px">حذف</button></div>
  </div>`).join('');
}

function renderIncome(){
  const st=stats();
  const dateEl=$('#inDate');
  if(!dateEl.value)dateEl.value=todayStr();
  $('#inStats').innerHTML=[
    ['المحصّل',fmt(st.earned),'green'],['الهدف',fmt(st.goal),'gold'],['المتبقي',fmt(Math.max(0,st.goal-st.earned)),''],
    ['مطلوب/يوم',fmt1(st.need),''],['سرعتك/يوم',fmt1(st.avg),st.avg>=st.need?'green':'red'],['توقع '+st.days+' يوم',st.elapsed>=6?fmt(st.projected):'قيد القياس',st.elapsed>=6&&st.projected>=st.goal?'green':'gold']
  ].map(([k,v,c])=>`<div class="kpi"><small>${k}</small><b class="${c}">${v}</b></div>`).join('');
  const weeks=[];
  const now=new Date();
  const dow=(now.getDay()+1)%7;
  const weekStart=new Date(now);
  weekStart.setHours(0,0,0,0);
  weekStart.setDate(now.getDate()-dow);
  for(let i=7;i>=0;i--){
    const start=new Date(weekStart);
    start.setDate(weekStart.getDate()-i*7);
    const end=new Date(start);
    end.setDate(start.getDate()+7);
    const amt=state.income.filter(x=>{const d=parseDate(x.date);return d>=start&&d<end;}).reduce((a,x)=>a+(Number(x.amount)||0),0);
    weeks.push({label:i===0?'الآن':'-'+i+'أ',amt});
  }
  const max=Math.max(1,...weeks.map(w=>w.amt));
  $('#inChart').innerHTML=weeks.map(w=>`<div class="bar" title="${fmt(w.amt)}"><i style="height:${Math.max(2,w.amt/max*100)}%"></i><small>${w.label}</small></div>`).join('');
  if(!state.income.length){
    $('#inList').innerHTML='<div class="emptybox">لا دخل مسجل بعد. أول 10$ تستحق التسجيل — الأرقام تصنع القرارات.</div>';
    return;
  }
  $('#inList').innerHTML=state.income.slice().reverse().map(x=>`<div class="item">
    <div class="grow"><b>${esc(x.source||'دخل')}</b><small>${esc(x.date)}${x.note?' · '+esc(x.note):''}</small></div>
    <div style="text-align:left"><div class="amt">+${fmt(x.amount)}</div><button class="xbtn" data-delin="${x.id}" style="margin-top:6px">حذف</button></div>
  </div>`).join('');
}

let srcFilter='all';
function renderSources(){
  const filters=[['all','الكل'],['design','تصميم'],['photo','صور'],['writing','كتابة'],['dev','برمجة'],['marketing','تسويق'],['support','دعم'],['none','بدون مهارة']];
  $('#srcFilters').innerHTML=filters.map(([k,t])=>`<button type="button" class="${srcFilter===k?'active':''}" data-filter="${k}">${t}</button>`).join('');
  const list=SOURCES.filter(s=>srcFilter==='all'||s.skills.includes(srcFilter));
  $('#srcList').innerHTML=list.map(s=>`<div class="src">
    <div class="row"><h4 style="flex:1">${s.icon} ${esc(s.title)}</h4><span class="badge ${s.level==='سهل'?'green':s.level==='صعب'?'red':''}">${esc(s.level)}</span></div>
    <div class="meta"><span>أول دخل: ${esc(s.first)}</span><span>رأس مال: ${s.capital?fmt(s.capital):'0$'}</span><span>${esc(s.channels.split('،')[0])}</span></div>
    <p>${esc(s.desc)}</p>
    <ol>${s.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
    <button class="btn ghost small" data-addsrc="${s.id}">➕ أضف 3 مهام لخطتي</button>
  </div>`).join('');
}

function addSourceTasks(id){
  const s=SOURCES.find(x=>x.id===id);
  if(!s)return;
  const existing=new Set(state.extraTasks.map(t=>t.text));
  (state.plan||[]).forEach(w=>w.tasks.forEach(t=>existing.add(t.text)));
  const fresh=s.steps.filter(t=>!existing.has(t)).slice(0,3);
  if(!fresh.length){toast('هذه المهام موجودة في خطتك بالفعل');return;}
  state.extraTasks.push(...fresh.map((t,i)=>({id:'x'+Date.now()+i,text:t,done:false})));
  save();
  renderHome();
  switchView('home');
  toast('أُضيفت '+fresh.length+' مهام إلى خطتك');
}

function addIncome(amount,source,date,note){
  amount=Number(amount);
  if(!amount||amount<=0){toast('أدخل مبلغاً صحيحاً');return false;}
  state.income.push({id:'i'+Date.now()+Math.random().toString(36).slice(2,6),amount,source:source||'دخل',date:date||todayStr(),note:note||''});
  save();
  renderIncome();
  renderHome();
  toast('تم تسجيل '+fmt(amount));
  return true;
}

function renderAll(){
  if(!state.profile){
    $('#onboard').classList.remove('hidden');
    return;
  }
  $('#onboard').classList.add('hidden');
  ensureDaily();
  renderHome();
  renderChat();
  renderPricing();
  fillContentDefaults();
  renderClients();
  renderIncome();
  renderSources();
  $('#headGoal').innerHTML='🎯 <b>'+fmt(stats().earned)+'</b> من '+fmt(stats().goal);
}

function renderOnboardSkills(){
  $('#obSkills').innerHTML=Object.entries(SKILLS).map(([k,s])=>`<button type="button" class="skill ${k===state._obSkill?'active':''}" data-skill="${k}"><span>${s.icon}</span><span>${esc(s.label)}<small>${esc(s.service)}</small></span></button>`).join('');
}

function updateOnboardSummary(){
  const skill=state._obSkill||'none';
  const s=SKILLS[skill];
  const hours=Number($('#obHours').value)||3;
  const cap=Number($('#obCapital').value)||0;
  const need=Math.ceil(1000/s.price);
  $('#obSummary').innerHTML=`<div class="fit">
    <div class="line"><span>المهارة</span><b>${s.icon} ${esc(s.label)}</b></div>
    <div class="line"><span>الخدمة</span><b>${esc(s.service)}</b></div>
    <div class="line"><span>السعر المقترح</span><b class="gold">${fmt(s.price)}</b></div>
    <div class="line"><span>عملاء للهدف</span><b>${need} عميل</b></div>
    <div class="line"><span>وقتك اليومي</span><b>${hours} ساعات</b></div>
    <div class="line"><span>رأس المال</span><b>${cap?fmt(cap):'0$ (كافٍ)'}</b></div>
  </div>
  <div class="tip">أول مهمة: ${esc(s.portfolio)}. سأذكّرك بثلاث مهام يومية.</div>`;
}

function finishOnboard(){
  const name=$('#obName').value.trim()||'صاحب المشروع';
  const skill=state._obSkill||'none';
  const hours=Number($('#obHours').value)||3;
  const capital=Number($('#obCapital').value)||0;
  const exp=$('#obExp').value;
  const device=$('#obDevice').value;
  state.profile={name,skill,hours,capital,experience:exp,device,goal:1000,days:60,start:todayStr()};
  state.plan=buildPlan(skill);
  state.pricing=defaultPricing();
  state.chat=[];
  state.daily=null;
  state.ui={view:'home',openWeeks:[0]};
  save();
  $('#onboard').classList.add('hidden');
  renderAll();
  switchView('home');
  toast('خطتك جاهزة — ابدأ بمهمة اليوم');
}

const AI_PRESETS={
  openai:{base:'https://api.openai.com/v1',model:'gpt-4o-mini'},
  openrouter:{base:'https://openrouter.ai/api/v1',model:'meta-llama/llama-3.3-70b-instruct:free'},
  groq:{base:'https://api.groq.com/openai/v1',model:'llama-3.3-70b-versatile'},
  deepseek:{base:'https://api.deepseek.com/v1',model:'deepseek-chat'},
  ollama:{base:'http://127.0.0.1:11434/v1',model:'llama3.2'},
  custom:{base:'',model:''}
};
function aiProviderKey(ai){
  const base=String(ai.base||'').replace(/\/+$/,'');
  const hit=Object.entries(AI_PRESETS).find(([k,v])=>v.base&&v.base.replace(/\/+$/,'')===base);
  return hit?hit[0]:(ai.provider&&AI_PRESETS[ai.provider]?ai.provider:'custom');
}
function openSettings(){
  if(!state.profile)return;
  $('#setName').value=state.profile.name;
  $('#setSkill').innerHTML=Object.entries(SKILLS).map(([k,s])=>`<option value="${k}" ${k===state.profile.skill?'selected':''}>${s.label}</option>`).join('');
  $('#setHours').value=state.profile.hours;
  $('#setCapital').value=state.profile.capital;
  $('#setGoal').value=state.profile.goal;
  $('#setDays').value=state.profile.days;
  $('#aiEnabled').checked=!!state.settings.ai.enabled;
  $('#aiProvider').value=aiProviderKey(state.settings.ai);
  $('#aiBase').value=state.settings.ai.base;
  $('#aiModel').value=state.settings.ai.model;
  $('#aiKey').value=state.settings.ai.key;
  $('#settingsModal').classList.remove('hidden');
}

function copyText(text){
  const done=()=>toast('تم النسخ');
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>fallbackCopy(text,done));
  }else fallbackCopy(text,done);
}
function fallbackCopy(text,done){
  const ta=document.createElement('textarea');
  ta.value=text;
  ta.style.position='fixed';
  ta.style.opacity='0';
  document.body.appendChild(ta);
  ta.select();
  try{document.execCommand('copy');done();}catch(e){toast('تعذر النسخ — حدد النص يدوياً');}
  ta.remove();
}

function saveProfile(){
  const oldSkill=state.profile.skill;
  const name=$('#setName').value.trim()||state.profile.name;
  const skill=$('#setSkill').value;
  const hours=clamp(Number($('#setHours').value)||3,1,12);
  const capital=Math.max(0,Number($('#setCapital').value)||0);
  const goal=Math.max(50,Number($('#setGoal').value)||1000);
  const days=clamp(Number($('#setDays').value)||60,7,365);
  if(skill!==oldSkill&&!confirm('تغيير المهارة سيولّد خطة جديدة ويمسح علامات المهام الحالية. متابعة؟'))return;
  const rebuild=skill!==oldSkill;
  state.profile=Object.assign({},state.profile,{name,skill,hours,capital,goal,days});
  if(rebuild){state.plan=buildPlan(skill);state.ui.openWeeks=[0];}
  save();
  renderAll();
  $('#settingsModal').classList.add('hidden');
  toast('حُفظت بياناتك');
}

function saveAI(){
  state.settings.ai={
    enabled:$('#aiEnabled').checked,
    provider:$('#aiProvider').value,
    base:$('#aiBase').value.trim()||'https://api.openai.com/v1',
    model:$('#aiModel').value.trim()||'gpt-4o-mini',
    key:$('#aiKey').value.trim()
  };
  save();
  renderChat();
  toast(state.settings.ai.enabled?'فُعّل الذكاء السحابي':'المرشد المحلي فقط');
}

async function testAI(){
  const base=$('#aiBase').value.trim().replace(/\/+$/,'');
  const model=$('#aiModel').value.trim();
  const key=$('#aiKey').value.trim();
  if(!base||!model){toast('أدخل عنوان API والموديل');return;}
  if(!key&&!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base)){toast('أدخل المفتاح أولاً');return;}
  const btn=$('#btnTestAI');
  const old=btn.textContent;
  btn.disabled=true;btn.textContent='جارٍ الاختبار…';
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),15000);
  try{
    const res=await fetch(base+'/chat/completions',{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},key?{'Authorization':'Bearer '+key}:{}),
      body:JSON.stringify({model,messages:[{role:'user',content:'قل: جاهز'}],max_tokens:8,temperature:0}),
      signal:ctrl.signal
    });
    clearTimeout(timer);
    if(!res.ok){
      let detail='';
      try{const j=await res.json();detail=(j.error&&j.error.message)||'';}catch(e){}
      throw new Error('HTTP '+res.status+(detail?' — '+detail.slice(0,90):''));
    }
    const j=await res.json();
    const txt=j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;
    if(!txt)throw new Error('رد فارغ');
    toast('الاتصال ناجح ✅');
  }catch(e){
    const msg=e.name==='AbortError'?'انتهت المهلة':(e instanceof TypeError?'تعذر الاتصال — قد يمنع المزوّد CORS أو العنوان خاطئ':e.message);
    toast('فشل الاتصال: '+msg);
  }finally{
    clearTimeout(timer);
    btn.disabled=false;btn.textContent=old;
  }
}

function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='maksab-backup-'+todayStr()+'.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  toast('صُدّرت نسخة من بياناتك');
}

function importData(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const obj=JSON.parse(String(reader.result));
      if(!obj||typeof obj!=='object'||!obj.profile)throw new Error('bad');
      if(!confirm('سيتم استبدال بياناتك الحالية بالنسخة المستوردة. متابعة؟'))return;
      localStorage.setItem(STORE,JSON.stringify(obj));
      location.reload();
    }catch(e){toast('ملف غير صالح');}
  };
  reader.readAsText(file);
}

function bind(){
  $$('.tab').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('#btnSettings').addEventListener('click',openSettings);
  $('#setClose').addEventListener('click',()=>$('#settingsModal').classList.add('hidden'));
  $('#settingsModal').addEventListener('click',e=>{if(e.target.id==='settingsModal')$('#settingsModal').classList.add('hidden');});

  $('#obSkills').addEventListener('click',e=>{
    const b=e.target.closest('[data-skill]');
    if(!b)return;
    state._obSkill=b.dataset.skill;
    renderOnboardSkills();
    updateOnboardSummary();
  });
  $('#obNext1').addEventListener('click',()=>{
    if(!$('#obName').value.trim()){toast('اكتب اسمك أولاً');$('#obName').focus();return;}
    if(!state._obSkill)state._obSkill='none';
    $$('.ob-step').forEach(s=>s.classList.toggle('hidden',s.dataset.step!=='2'));
    $$('.steps i').forEach((i,x)=>i.classList.toggle('on',x<2));
    updateOnboardSummary();
  });
  $('#obBack2').addEventListener('click',()=>{
    $$('.ob-step').forEach(s=>s.classList.toggle('hidden',s.dataset.step!=='1'));
    $$('.steps i').forEach((i,x)=>i.classList.toggle('on',x<1));
  });
  $('#obHours').addEventListener('input',e=>{
    $('#obHoursOut').textContent=e.target.value;
    updateOnboardSummary();
  });
  $('#obNext2').addEventListener('click',()=>{
    $$('.ob-step').forEach(s=>s.classList.toggle('hidden',s.dataset.step!=='3'));
    $$('.steps i').forEach(i=>i.classList.add('on'));
    updateOnboardSummary();
  });
  $('#obBack3').addEventListener('click',()=>{
    $$('.ob-step').forEach(s=>s.classList.toggle('hidden',s.dataset.step!=='2'));
    $$('.steps i').forEach((i,x)=>i.classList.toggle('on',x<2));
  });
  $('#obFinish').addEventListener('click',finishOnboard);

  document.addEventListener('click',e=>{
    const go=e.target.closest('[data-go]');
    if(go){switchView(go.dataset.go);return;}
    const copy=e.target.closest('[data-copy]');
    if(copy){
      const posts=JSON.parse($('#ctOut').dataset.posts||'[]');
      copyText(posts[Number(copy.dataset.copy)]||'');
      return;
    }
    const offer=e.target.closest('[data-offer]');
    if(offer){
      fillContentDefaults();
      $('#ctPrice').value=offer.dataset.offer;
      generateContent();
      switchView('content');
      toast('السعر انتقل للمحتوى');
      return;
    }
    const filter=e.target.closest('[data-filter]');
    if(filter){srcFilter=filter.dataset.filter;renderSources();return;}
    const add=e.target.closest('[data-addsrc]');
    if(add){addSourceTasks(add.dataset.addsrc);return;}
    const delLead=e.target.closest('[data-dellead]');
    if(delLead){state.leads=state.leads.filter(l=>l.id!==delLead.dataset.dellead);save();renderClients();return;}
    const li=e.target.closest('[data-leadincome]');
    if(li){
      const l=state.leads.find(x=>x.id===li.dataset.leadincome);
      if(!l)return;
      $('#inAmount').value=l.value||'';
      $('#inSource').value=(l.name||'')+' — '+(l.service||'');
      $('#inNote').value='من قسم العملاء';
      switchView('income');
      $('#inAmount').focus();
      return;
    }
    const delIn=e.target.closest('[data-delin]');
    if(delIn){
      state.income=state.income.filter(x=>x.id!==delIn.dataset.delin);
      save();renderIncome();renderHome();
      return;
    }
  });

  document.addEventListener('change',e=>{
    const st=e.target.closest('[data-stage]');
    if(st){
      const l=state.leads.find(x=>x.id===st.dataset.stage);
      if(l){l.stage=st.value;save();renderClients();}
      return;
    }
    const cb=e.target.closest('[data-daily]');
    if(cb){
      const it=state.daily.items.find(x=>x.id===cb.dataset.daily);
      if(it){it.done=cb.checked;save();renderHome();}
      return;
    }
    const task=e.target.closest('[data-task]');
    if(task){
      const t=findTask(task.dataset.task);
      if(t){t.done=task.checked;save();renderHome();}
      return;
    }
    const extra=e.target.closest('[data-extra]');
    if(extra){
      const t=state.extraTasks.find(x=>x.id===extra.dataset.extra);
      if(t){t.done=extra.checked;save();renderHome();}
    }
  });

  $('#roadmap').addEventListener('click',e=>{
    const head=e.target.closest('.whead');
    if(!head)return;
    const weekEl=head.closest('.week');
    const wi=Number(weekEl.dataset.week);
    const arr=state.ui.openWeeks||[];
    state.ui.openWeeks=arr.includes(wi)?arr.filter(x=>x!==wi):arr.concat(wi);
    weekEl.classList.toggle('open');
    save();
  });

  $('#chatForm').addEventListener('submit',e=>{e.preventDefault();sendChat($('#chatInput').value);});
  $('#chatChips').addEventListener('click',e=>{
    const c=e.target.closest('[data-chip]');
    if(!c)return;
    if(c.dataset.chip==='حسّن صوري'){switchView('studio');return;}
    sendChat(c.dataset.chip);
  });

  ['prService','prPrice','prHours','prWeek','prRate'].forEach(id=>{
    $('#'+id).addEventListener('input',computePricing);
  });
  $('#prCalc').addEventListener('click',computePricing);
  $('#prCopy').addEventListener('click',()=>copyText($('#prOfferText').textContent));

  $('#ctGen').addEventListener('click',generateContent);

  $('#clAdd').addEventListener('click',()=>{
    const name=$('#clName').value.trim();
    if(!name){toast('اكتب اسم العميل');return;}
    state.leads.push({
      id:'l'+Date.now()+Math.random().toString(36).slice(2,5),
      name,
      channel:$('#clChannel').value.trim(),
      service:$('#clService').value.trim(),
      value:Number($('#clValue').value)||0,
      stage:$('#clStage').value||'جديد',
      note:$('#clNote').value.trim()
    });
    save();
    renderClients();
    $('#clName').value='';$('#clChannel').value='';$('#clService').value='';$('#clValue').value='';$('#clNote').value='';
    toast('أُضيف العميل');
  });

  $('#inAdd').addEventListener('click',()=>{
    const ok=addIncome($('#inAmount').value,$('#inSource').value.trim(),$('#inDate').value,$('#inNote').value.trim());
    if(ok){$('#inAmount').value='';$('#inSource').value='';$('#inNote').value='';}
  });

  $('#btnSaveProfile').addEventListener('click',saveProfile);
  $('#btnSaveAI').addEventListener('click',saveAI);
  $('#aiProvider').addEventListener('change',e=>{const p=AI_PRESETS[e.target.value];if(!p||e.target.value==='custom')return;$('#aiBase').value=p.base;$('#aiModel').value=p.model;});
  $('#btnTestAI').addEventListener('click',testAI);
  $('#btnExport').addEventListener('click',exportData);
  $('#btnImport').addEventListener('click',()=>$('#importFile').click());
  $('#importFile').addEventListener('change',e=>{importData(e.target.files&&e.target.files[0]);e.target.value='';});
  $('#btnResetPlan').addEventListener('click',()=>{
    if(!confirm('إعادة توليد الخطة ستمسح علامات المهام الحالية. متابعة؟'))return;
    state.plan=buildPlan(state.profile.skill);
    state.ui.openWeeks=[0];
    save();renderAll();
    $('#settingsModal').classList.add('hidden');
    toast('أُعيد توليد الخطة');
  });
  $('#btnResetAll').addEventListener('click',()=>{
    if(!confirm('سيُمسح كل شيء: الملف، الدخل، العملاء، الخطة. متابعة؟'))return;
    localStorage.removeItem(STORE);
    location.reload();
  });
}

function init(){
  if(state.profile&&!state.plan)state.plan=buildPlan(state.profile.skill);
  if(state.profile&&!state.pricing)state.pricing=defaultPricing();
  if(!state.profile){
    renderOnboardSkills();
    updateOnboardSummary();
  }
  bind();
  if(typeof bindStudio==='function')bindStudio();
  if(state.profile){
    renderAll();
    switchView(state.ui.view||'home');
  }else{
    $('#onboard').classList.remove('hidden');
    ensureDaily();
  }
}

document.addEventListener('DOMContentLoaded',init);
