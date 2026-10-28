const ROBOTS=[
  {key:'scout',name:'راصد السوق',icon:'🔭',role:'يبحث عن أمثلة حقيقية وأفضل زاوية لأي عمل',color:'#60a5fa'},
  {key:'architect',name:'مهندس العرض',icon:'📐',role:'يبني العرض والباقات لأي عمل ليصل الهدف الشهري',color:'#e8c258'},
  {key:'maker',name:'صانع الأصول',icon:'🎨',role:'ينتج النماذج والملف التعريفي لأي عمل',color:'#a78bfa'},
  {key:'hunter',name:'صائد العملاء',icon:'🎯',role:'يجد 30 عميلاً لأي عمل ويكتب رسائل التواصل',color:'#34d399'},
  {key:'operator',name:'مدير التسليم',icon:'📦',role:'ينظم التسليم والدفع والخطة اليومية لأي عمل',color:'#f87171'}
];

const ROBOT_STEPS=[
  ['أقرأ ملفك والعمل المختار','أفحص السعر والوقت المتاح','أراجع الأمثلة المنشورة','أتحقق من المصادر','أحدد أفضل زاوية للسوق','أكتب تقرير الرادار'],
  ['أحسب هدف الشهر من السعر الحالي','أبني 3 باقات متدرجة','أحدد عدد العملاء والمحادثات المطلوبة','أكتب العرض والضمان والترقية','أراجع منطق الأرقام'],
  ['أختار 3 أصول سريعة','أبني قبل/بعد ودراسة مصغرة وكواليس','أكتب الملف التعريفي','أكتب 3 كابشنات','أراجع عدم وجود ادعاءات غير حقيقية'],
  ['أبني قائمة 30 هدفاً في 3 قوائم','أجهز روابط البحث','أكتب 3 رسائل تواصل','أضبط جدول المتابعة','أراجع معايير التأهيل'],
  ['أجهز أسئلة العميل','أكتب خطوات التسليم','أبني قائمة الجودة','أجهز الفاتورة وبوابة الدفع','أرتب خطة 7 أيام والمؤشرات']
];


const BIZ_CASES=[
  {who:'سارة بليكلي، مؤسسة Spanx',title:'من فكرة بسيطة إلى علامة عالمية',service:'ملابس داخلية وتجارب منتجات',
    tags:['منتج','ملابس','تجميل','صالون','حلاقة','عناية','عطور','مكياج','إكسسوارات','حرف','هدايا','متجر','إلكتروني','product','fashion','beauty','ecommerce'],
    wiki:'Sara Blakely',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Sara_Blakely',
    result:'أسست Spanx وبنَت علامة ملابس داخلية عالمية من فكرة حلّت مشكلة شخصية.',
    steps:['بدأت بفكرة منتج بسيط','جرّبت النموذج بنفسها','عرضت المنتج على متاجر','وسّعت العلامة'],
    lesson:'فكرة تحل مشكلة شخصية + جرأة العرض = بداية قوية.',general:true},
  {who:'برايان سكودامور، مؤسس 1-800-GOT-JUNK?',title:'من شاحنة مستعملة إلى شبكة فروع',service:'إزالة المخلفات والخدمات المنزلية',
    tags:['تنظيف','مخلفات','نقل','صيانة','سباكة','كهرباء','دهان','سيارات','غسيل','ميكانيكا','ورشة','توصيل','خدمات','منزلية','دعم','مساعد','إداري','خدمة عملاء','local','cleaning','junk','repair','moving','service','support'],
    wiki:'Brian Scudamore',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Brian_Scudamore',
    result:'حوّل خدمة إزالة مخلفات بسيطة إلى علامة وشبكة فروع في أمريكا الشمالية.',
    steps:['بدأ بخدمة محلية صغيرة','استخدم شاحنة مستعملة','وحّد طريقة العمل','وسّع بالفروع'],
    lesson:'الخدمة المحلية المتكررة تكبر عندما تصبح نظاماً واضحاً.',general:true},
  {who:'يان كوم، شريك مؤسس WhatsApp',title:'من مهاجر إلى صفقة بمليارات',service:'تطبيقات وبرمجيات',
    tags:['تطبيق','برمجة','تقنية','موقع','برنامج','ذكاء','اصطناعي','منصة','app','software','website','tech','ai','saas'],
    wiki:'Jan Koum',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Jan_Koum',
    result:'شارك في تأسيس WhatsApp، واشترته فيسبوك بـ19.3 مليار دولار عام 2014.',
    steps:['تعلّم البرمجة','عمل في شركات تقنية','أسس WhatsApp مع شريك','ركّز على البساطة'],
    lesson:'حل مشكلة واحدة بشكل ممتاز يتفوق على الميزات الكثيرة.',general:true},
  {who:'ميلاني بيركنز، شريكة مؤسسة Canva',title:'من فكرة مرفوضة إلى منصة عالمية',service:'تصميم ومنصات رقمية',
    tags:['تصميم','شعار','هوية','مونتاج','منصة','تطبيق','تقنية','رقمي','منتجات رقمية','design','logo','brand','canva','tech','app'],
    wiki:'Melanie Perkins',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Melanie_Perkins',
    result:'شاركت في تأسيس Canva، من أشهر منصات التصميم في العالم.',
    steps:['بدأت بفكرة تبسيط التصميم','رفضها مستثمرون كثيرون','أطلقت Canva','وسّعت المنتج عالمياً'],
    lesson:'الرفض لا يعني نهاية الفكرة؛ حسّن العرض وكرر المحاولة.',general:true},
  {who:'برايان تشيسكي، شريك مؤسس Airbnb',title:'من تأجير مرتبة هوائية إلى منصة حجوزات',service:'سفر واستضافة',
    tags:['سفر','سياحة','رحلات','حجوزات','فندق','استضافة','عقارات','إيجار','travel','tourism','tour','hotel','booking','airbnb'],
    wiki:'Brian Chesky',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Brian_Chesky',
    result:'شارك في تأسيس Airbnb، منصة حجوزات عالمية.',
    steps:['استضاف ضيوفاً في شقته','أطلق فكرة الحجز','تجاوز رفض المستثمرين','وسّع عالمياً'],
    lesson:'ابدأ بحل صغير لمشكلة حقيقية ثم وسّع.',general:true},
  {who:'توم موناغان، مؤسس Domino’s Pizza',title:'من مطعم بيتزا واحد إلى سلسلة عالمية',service:'مطاعم ووجبات',
    tags:['مطعم','طعام','وجبات','بيتزا','مقهى','كافيه','قهوة','مخبز','حلويات','طبخ','شيف','food','restaurant','pizza','cafe','bakery'],
    wiki:'Tom Monaghan',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Tom_Monaghan',
    result:'أسس Domino’s Pizza عام 1960 ووسّعها عالمياً.',
    steps:['بدأ بمطعم بيتزا واحد','ركّز على التوصيل','وسّع الفروع','بنى نظام تشغيل'],
    lesson:'وعد واضح مثل التوصيل السريع يصنع الفرق.'},
  {who:'هارلاند ساندرز، مؤسس KFC',title:'من وصفة دجاج إلى سلسلة عالمية',service:'مطاعم ووجبات',
    tags:['مطعم','طعام','وجبات','دجاج','مقهى','كافيه','طبخ','شيف','food','restaurant','chicken','cafe'],
    wiki:'Harland Sanders',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Harland_Sanders',
    result:'أسس KFC من وصفة دجاج ومطعم على الطريق، ووسّعها بالامتياز.',
    steps:['بدأ ببيع الدجاج','طوّر وصفته','بدأ الامتياز','وسّع السلسلة'],
    lesson:'المنتج المميز + الامتياز = توسع.'},
  {who:'ويتني وولف هيرد، مؤسسة Bumble',title:'من Tinder إلى Bumble',service:'تطبيقات وسوشيال',
    tags:['تطبيق','تقنية','سوشيال','تسويق','إعلانات','محتوى','tech','app','social','marketing','ads','content'],
    wiki:'Whitney Wolfe Herd',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Whitney_Wolfe_Herd',
    result:'أسست Bumble بعد تجربة في Tinder، وبنَت علامة عالمية.',
    steps:['شاركت في تأسيس Tinder','غادرت وأسست Bumble','ركّزت على تجربة المرأة','وسّعت العلامة'],
    lesson:'اعرف جمهورك وابنِ تجربة تحترمه.'},
  {who:'إميلي فايس، مؤسسة Glossier',title:'من مدونة جمال إلى علامة تجميل',service:'تجميل ومحتوى',
    tags:['تجميل','عناية','بشرة','شعر','عطور','مكياج','منتجات','متجر','محتوى','كتابة','ترجمة','beauty','skincare','product','ecommerce','content','writing'],
    wiki:'Emily Weiss',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Emily_Weiss',
    result:'حوّلت مدونة Into The Gloss إلى علامة تجميل Glossier.',
    steps:['بدأت مدونة','جمعت آراء الجمهور','أطلقت منتجات','بنت مجتمعاً'],
    lesson:'ابنِ جمهوراً أولاً ثم بعه ما يطلبه.'},
  {who:'بول أورفاليا، مؤسس Kinko’s',title:'من كشك نسخ إلى سلسلة',service:'نسخ وطباعة',
    tags:['نسخ','طباعة','متجر','خدمات','local','print','copy','shop','service'],
    wiki:'Paul Orfalea',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Paul_Orfalea',
    result:'أسس Kinko’s للنسخ والطباعة من كشك صغير.',
    steps:['بدأ بكشك صغير','قدّم خدمة النسخ','وسّع الفروع','بنى علامة'],
    lesson:'خدمة يومية متكررة تبني دخلاً ثابتاً.'},
  {who:'كايلا إتساينز، مؤسسة Sweat',title:'من كتاب إلكتروني إلى تطبيق لياقة',service:'لياقة وتغذية',
    tags:['رياضة','لياقة','تمرين','تغذية','جيم','يوغا','تطبيق','fitness','gym','trainer','yoga','app'],
    wiki:'Kayla Itsines',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Kayla_Itsines',
    result:'بنَت برامج لياقة وتطبيق Sweat وانتشرت عالمياً.',
    steps:['بدأت ببرامج PDF','نشرت على إنستقرام','أطلقت التطبيق','وسّعت الجمهور'],
    lesson:'المحتوى + المتابعة + منتج رقمي = توسع.'},
  {who:'ستيف إلز، مؤسس Chipotle',title:'من مطعم واحد إلى سلسلة',service:'مطاعم ووجبات',
    tags:['مطعم','طعام','وجبات','مكسيكي','food','restaurant','chipotle'],
    wiki:'Steve Ells',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Steve_Ells',
    result:'أسس Chipotle عام 1993 ووسّعها.',
    steps:['بدأ بمطعم واحد','ركّز على مكونات واضحة','وسّع الفروع','بنى علامة'],
    lesson:'وعد واضح بالجودة يبني ثقة.'},
  {who:'كيفن سيستروم، شريك مؤسس Instagram',title:'من تطبيق صور إلى صفقة بمليار',service:'تصوير وسوشيال',
    tags:['تصوير','صور','فيديو','يوتيوب','سوشيال','تطبيق','photo','photography','video','youtube','social','app','instagram'],
    wiki:'Kevin Systrom',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Kevin_Systrom',
    result:'شارك في تأسيس Instagram، وبيعه لفيسبوك بمليار دولار.',
    steps:['تعلّم البرمجة','بنى تطبيقاً بسيطاً','ركّز على الصور','وسّع الشبكة'],
    lesson:'بساطة التجربة + الشبكة الاجتماعية = نمو سريع.'},
  {who:'إرين بالي، شريك مؤسس Udemy',title:'من تعليم الرياضيات إلى منصة كورسات',service:'تعليم وتدريب',
    tags:['تعليم','دروس','تدريب','كورس','مدرسة','لغة','رياضيات','education','course','teaching','tutor','udemy'],
    wiki:'Eren Bali',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Eren_Bali',
    result:'شارك في تأسيس Udemy، منصة كورسات عالمية.',
    steps:['بدأ بتعليم الرياضيات','بنى منصة','وسّع المحتوى','جذب مدربين'],
    lesson:'حوّل مهارة تعليمية إلى منتج رقمي قابل للتوسع.'},
  {who:'بن كوهين وجيري غرينفيلد، مؤسسا Ben & Jerry’s',title:'من محل آيس كريم إلى علامة عالمية',service:'حلويات وآيس كريم',
    tags:['مطعم','طعام','حلويات','آيس','كريم','food','dessert','icecream'],
    wiki:"Ben & Jerry's",source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Ben_%26_Jerry%27s',
    result:'أسسا Ben & Jerry’s من محل آيس كريم صغير إلى علامة عالمية.',
    steps:['بدأا بمحل صغير','ابتكرا نكهات','بنيا قصة العلامة','وسّعا التوزيع'],
    lesson:'المنتج المميز + القصة = علامة.'},
  {who:'دانييل إيك، مؤسس Spotify',title:'من فكرة إلى منصة بث عالمية',service:'موسيقى وتقنية',
    tags:['موسيقى','تطبيق','تقنية','بث','tech','music','app','streaming','spotify'],
    wiki:'Daniel Ek',source:'Wikipedia',url:'https://en.wikipedia.org/wiki/Daniel_Ek',
    result:'أسس Spotify، منصة بث موسيقى عالمية.',
    steps:['بدأ بالبرمجة','أطلق المنصة','وسّع المحتوى','جذب المستخدمين'],
    lesson:'المنتج الرقمي + تجربة مستخدم بسيطة = نمو.'}
];

let robotRunToken=0;

function robotDefault(){
  return {active:false,stage:0,status:'idle',goal:500,business:'',price:0,outputs:{},approvals:{},notes:{},logs:{},verify:{},editing:false,startedAt:null,finishedAt:null,error:'',mode:''};
}

function robotData(){
  if(!state.robots||typeof state.robots!=='object')state.robots=robotDefault();
  const r=state.robots;
  const d=robotDefault();
  Object.keys(d).forEach(k=>{if(r[k]===undefined)r[k]=d[k];});
  ['outputs','approvals','notes','logs','verify'].forEach(k=>{if(!r[k]||typeof r[k]!=='object')r[k]={};});
  r.stage=clamp(Number(r.stage)||0,0,ROBOTS.length-1);
  r.goal=Math.max(50,Math.round(Number(r.goal)||500));
  return r;
}

function robotSkillKey(){
  return (state.profile&&state.profile.skill)||'none';
}

function robotSkill(){
  return SKILLS[robotSkillKey()]||SKILLS.none;
}

function robotGoal(){
  return Math.max(50,Math.round(Number(robotData().goal)||500));
}

function robotBusiness(){
  const r=robotData();
  return String(r.business||'').trim()||robotSkill().service;
}

function robotField(){
  const r=robotData();
  return String(r.business||'').trim()||robotSkill().label;
}

function robotPrice(){
  const r=robotData();
  const p=Number(r.price)||(state.pricing&&Number(state.pricing.price))||Number(robotSkill().price)||25;
  return Math.max(1,Math.round(p));
}

function robotChannels(){
  const r=robotData();
  if(!String(r.business||'').trim())return robotSkill().channels;
  return ['إنستقرام','خرائط جوجل','فيسبوك','منصات العمل الحر'];
}

function robotTip(){
  const r=robotData();
  if(!String(r.business||'').trim())return robotSkill().tip;
  return 'لا تبع وصفاً عاماً. اختر جمهوراً واحداً، وعداً واحداً، وسعراً واضحاً. أول 3 عملاء اطلب منهم تقييماً مكتوباً.';
}

function robotOutreach(){
  const r=robotData();
  if(!String(r.business||'').trim())return robotSkill().outreach;
  return 'اعرض على 5 عملاء محتملين نتيجة محددة أو عينة قصيرة مجانية';
}

function robotPortfolio(){
  const r=robotData();
  if(!String(r.business||'').trim())return robotSkill().portfolio;
  return 'جهّز 3 نماذج: قبل/بعد، عينة مصغرة، وكواليس التنفيذ';
}

function robotCaseKey(){
  const b=robotBusiness().toLowerCase();
  const map=[['تصميم','design'],['شعار','design'],['هوية','design'],['مونتاج','design'],['تصوير','photo'],['صور','photo'],['فيديو','photo'],['كتاب','writing'],['محتوى','writing'],['ترجمة','writing'],['برمج','dev'],['موقع','dev'],['تطبيق','dev'],['تسويق','marketing'],['إعلان','marketing'],['سوشيال','marketing'],['دعم','support'],['مساعد','support'],['إداري','support']];
  for(const [k,v] of map){if(b.includes(k))return v;}
  return robotSkillKey();
}

function robotCaseExact(){
  const b=String(robotData().business||'').trim().toLowerCase();
  if(!b)return false;
  return BIZ_CASES.some(c=>(c.tags||[]).some(t=>b.includes(String(t).toLowerCase())));
}

function robotCases(){
  const b=String(robotData().business||'').trim().toLowerCase();
  if(b){
    const matched=BIZ_CASES.filter(c=>(c.tags||[]).some(t=>b.includes(String(t).toLowerCase())));
    if(matched.length){
      const extra=BIZ_CASES.filter(c=>c.general&&!matched.includes(c));
      return matched.concat(extra).slice(0,3);
    }
    return BIZ_CASES.filter(c=>c.general);
  }
  return (typeof CASES!=='undefined'&&CASES[robotCaseKey()])||(typeof CASES!=='undefined'&&CASES.none)||[];
}

function robotAIMode(){
  const ai=state.settings&&state.settings.ai;
  return !!(ai&&ai.enabled&&ai.key&&ai.base&&ai.model);
}

function robotDays(n){
  n=Math.max(1,Math.round(Number(n)||1));
  if(n===1)return 'يوم واحد';
  if(n===2)return 'يومين';
  return n+' أيام';
}

function robotSleep(ms){
  return new Promise(r=>setTimeout(r,ms));
}

function robotLog(stage,msg){
  const r=robotData();
  const arr=r.logs[stage]||(r.logs[stage]=[]);
  arr.push({ts:timeNow(),at:Date.now(),msg:String(msg)});
  if(arr.length>20)arr.splice(0,arr.length-20);
  save();
  if(state.ui.view==='robots')renderRobots();
}

function robotStatusLabel(s){
  if(s==='working')return 'يعمل الآن';
  if(s==='waiting')return 'بانتظار موافقتك';
  if(s==='done')return 'مكتمل';
  return 'متوقف';
}

function robotStepPercent(i){
  const r=robotData();
  if(r.status==='done'||r.approvals[i])return 100;
  if(i<r.stage)return r.outputs[i]?100:0;
  if(i===r.stage){
    if(r.status==='waiting')return 100;
    if(r.status==='working')return 55;
    return r.outputs[i]?100:0;
  }
  return 0;
}

function robotHeroPercent(){
  const r=robotData();
  if(r.status==='done')return 100;
  const base=r.stage*20;
  if(r.status==='waiting')return Math.min(100,base+20);
  if(r.status==='working')return Math.min(100,base+10);
  return base;
}

async function robotWiki(title){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),8000);
  try{
    const res=await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(String(title).replace(/ /g,'_')),{signal:ctrl.signal});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const j=await res.json();
    return {ok:true,title:j.title||String(title),extract:String(j.extract||'').slice(0,260),url:(j.content_urls&&j.content_urls.desktop&&j.content_urls.desktop.page)||('https://en.wikipedia.org/wiki/'+encodeURIComponent(String(title).replace(/ /g,'_')))};
  }catch(e){
    return {ok:false,error:String(e.message||e)};
  }finally{
    clearTimeout(timer);
  }
}

async function robotVerifyCases(){
  const r=robotData();
  const cs=robotCases().slice(0,3).filter(c=>c.wiki);
  if(!cs.length)return;
  r.verify=r.verify||{};
  const results=await Promise.all(cs.map(c=>robotWiki(c.wiki)));
  cs.forEach((c,i)=>{r.verify[c.wiki]=results[i];});
  save();
}

function robotScoutText(){
  const biz=robotBusiness();
  const field=robotField();
  const cs=robotCases();
  const p=robotPrice();
  const g=robotGoal();
  const low=Math.max(5,Math.round(p*0.8));
  const high=Math.round(p*1.6);
  const r=robotData();
  const ch=robotChannels();
  const exact=robotCaseExact();
  const label=!String(r.business||'').trim()?'أمثلة منشورة':(exact?'أمثلة قريبة من عملك + أمثلة عامة':'أمثلة عامة + بحث مباشر');
  const lines=[];
  lines.push('تقرير راصد السوق — دقة عالية');
  lines.push('العمل المختار: '+biz);
  lines.push('المجال: '+field+' — القناة الأولى: '+ch[0]);
  lines.push('هدف الشهر: '+fmt(g)+' => '+Math.ceil(g/p)+' عميل/طلب بسعر '+fmt(p)+'.');
  lines.push('نطاق سعري آمن: '+fmt(low)+'–'+fmt(high)+'.');
  lines.push('');
  lines.push('لماذا هذا العمل؟');
  lines.push(robotTip());
  lines.push('الميزة التي ستبيعها: نتيجة واضحة، تسليم سريع، ومتابعة منظمة.');
  lines.push('');
  lines.push(label+':');
  cs.slice(0,3).forEach((c,i)=>{
    lines.push((i+1)+') '+c.title);
    lines.push('   من: '+c.who+' — '+c.service);
    lines.push('   البداية: '+c.steps.join(' ← '));
    lines.push('   النتيجة: '+c.result);
    lines.push('   الدرس: '+c.lesson);
    lines.push('   المصدر: '+c.url);
  });
  lines.push('');
  lines.push('التحقق:');
  cs.slice(0,3).forEach(c=>{
    const v=c.wiki&&r.verify&&r.verify[c.wiki];
    const vtext=c.wiki?(v&&v.ok?'✅ تحقق آلي من ويكيبيديا ('+v.title+')':'⚠️ تعذر التحقق الآلي الآن — افتح المصدر'):'📎 المصدر الأصلي متاح (لا يوجد تحقق آلي)';
    lines.push('• '+c.who+': '+vtext+' — '+c.url);
  });
  lines.push('• الحساب: '+fmt(g)+' ÷ '+fmt(p)+' = '+Math.ceil(g/p)+' عميل/طلب. تحقق حسابي.');
  lines.push('• تنبيه: القصص المنشورة ليست ضماناً لنتيجتك. تحقق من المصدر قبل الاقتباس.');
  lines.push('');
  lines.push('الفجوة: المنافسون يعرضون '+field+' بشكل عام. أنت ستعرض نتيجة محددة: '+robotOutreach()+'.');
  lines.push('أفضل نموذج للبدء: '+robotPortfolio());
  lines.push('أفضل قناة أولى: '+ch[0]);
  lines.push('كلمات بحث: '+biz+' + '+field+' + [مدينتك]');
  lines.push('بحث جوجل: ابحث عن «'+biz+' success story revenue».');
  lines.push('بحث المنصات: افتح Upwork أو مستقل وابحث عن «'+biz+'».');
  lines.push('');
  lines.push('قرار الرادار: ابدأ بـ '+biz+' بسعر '+fmt(p)+'، ولا تنزل عن '+fmt(low)+' قبل أول 3 تقييمات.');
  return lines.join('\n');
}

function robotArchitectText(){
  const biz=robotBusiness();
  const p=robotPrice();
  const g=robotGoal();
  const name=(state.profile&&state.profile.name)||'[اسمك]';
  const ch=robotChannels();
  const packs=[
    {name:'الأساسية',price:p,desc:'خدمة واحدة + مراجعتان'},
    {name:'الوسطى',price:Math.round(p*1.8),desc:'3 مخرجات + 3 مراجعات + ملفات المصدر'},
    {name:'العليا',price:Math.round(p*3),desc:'5 مخرجات + أولوية تسليم + حقوق استخدام + متابعة شهر'}
  ];
  const clients=packs.map(x=>Math.ceil(g/x.price));
  const best=1;
  const need=clients[best];
  const leads=Math.ceil(need/0.1);
  const weekly=Math.ceil(leads/4);
  const daily=Math.ceil(weekly/5);
  const low=Math.max(5,Math.round(p*0.8));
  return `عرض شهر ${fmt(g)} — ${biz}
الجمهور: العملاء الذين يحتاجون ${biz} الآن — ابدأ من ${ch[0]}
السعر الأساسي: ${fmt(p)}
نطاق آمن: ${fmt(low)}–${fmt(Math.round(p*1.6))}

3 باقات:
• ${packs[0].name}: ${fmt(packs[0].price)} — ${packs[0].desc} — ${clients[0]} عميل/طلب = ${fmt(packs[0].price*clients[0])}
• ${packs[1].name}: ${fmt(packs[1].price)} — ${packs[1].desc} — ${clients[1]} عميل/طلب = ${fmt(packs[1].price*clients[1])}
• ${packs[2].name}: ${fmt(packs[2].price)} — ${packs[2].desc} — ${clients[2]} عميل/طلب = ${fmt(packs[2].price*clients[2])}

السيناريو الأنسب: الباقة ${packs[best].name} بسعر ${fmt(packs[best].price)}.
تحتاج ${need} عميل/طلب شهرياً للوصول إلى ${fmt(g)}.

خطة الوصول:
• بمعدل تحويل واقعي 10% تحتاج ${leads} محادثة شهرياً.
• ${weekly} محادثة أسبوعياً = ${daily} محادثة يومياً (5 أيام).
• إن أرسلت 10 محادثات يومياً، لديك فائض أمان.
• لا تحسب الردود وحدها؛ تابع كل من لم يرد مرة واحدة بعد 48 ساعة.

العرض الجاهز:
مرحباً [الاسم]، أنا ${name}. أساعد ${ch[0]} على ${biz} بنتيجة واضحة وتسليم سريع. باقة ${packs[best].name} تشمل ${packs[best].desc} مقابل ${fmt(packs[best].price)}. أرسل تفاصيل طلبك وأبدأ خلال 24 ساعة.

الضمان: مراجعتان مشمولتان + تسليم واضح + لا وعود بنتائج مبيعات.
الترقية: بعد التسليم اعرض 3 مخرجات إضافية أو متابعة شهرية بسعر واضح.
قاعدة: لا تخفض السعر؛ قلل النطاق أو عدد المراجعات.

تحقق الدقة:
• ${need} × ${fmt(packs[best].price)} = ${fmt(need*packs[best].price)} — تحقق حسابي.
• 10% تحويل من ${leads} محادثة = ${need} عميل — افتراض واقعي وليس وعداً.
• لا تنزل عن ${fmt(low)} قبل أول 3 تقييمات.
• لا تضمن ربحاً؛ الأرقام خطة وليست نتيجة.`;
}

function robotMakerText(){
  const biz=robotBusiness();
  const cs=robotCases();
  const c=cs[0]||{title:'دراسة مصغرة'};
  const ch=robotChannels();
  return `خطة الأصول في 90 دقيقة — ${biz}
الهدف: 3 أصول تثبت أنك تنفذ، بلا ادعاء نتائج.

1) قبل/بعد
• خذ عنصراً واحداً في ${biz} وأعد تنفيذه.
• انشر الصورتين مع سطر واحد: ما المشكلة؟ ما الذي تغير؟
• استخدم ${robotPortfolio()}.

2) دراسة مصغرة
• استخدم هيكل المثال «${c.title}»: المشكلة، ما فعلته، النتيجة، الدرس.
• اكتبها في 5 أسطر فقط.
• لا تنشر رقماً أو نتيجة لم تحدث لك.

3) كواليس
• صوّر 3 خطوات: قبل، أثناء، بعد.
• أضف سطراً: «هكذا أضمن أن كل عميل يحصل على نفس الجودة».
• انشرها في ${ch[0]}.

الملف التعريفي (3 أسطر):
أساعد ${ch[0]} على ${biz} خلال ${robotDays(2)}.
أرسل لي [مدخل] وأعيده لك [مخرج] جاهزاً للنشر.
أعمل عبر ${ch.join('، ')} — وأبدأ خلال 24 ساعة.

3 كابشنات جاهزة:
1. «أغلب ${ch[0]} يخسرون عملاء لأن الرسالة عامة ولا تعرض نتيجة محددة.»
2. «قبل/بعد: نفس المنتج/الخدمة، وضوح مختلف. هذا ما أفعله في ${biz}.»
3. «3 أخطاء تجعل ${biz} لا تبيع: [خطأ 1]، [خطأ 2]، [خطأ 3].»

قائمة النشر:
• الأصل 1 اليوم في ${ch[0]}.
• الأصل 2 بعد يومين.
• الأصل 3 بعد 4 أيام.
• ثبّت أفضل أصل في أعلى الملف التعريفي.

تحقق الدقة:
• لا أرقام وهمية.
• لا أسماء عملاء بدون إذن.
• لا ادعاء نتائج لم تحدث.
• راجع أن كل أصل يطابق ${biz} فعلاً.`;
}

function robotHunterText(){
  const biz=robotBusiness();
  const p=robotPrice();
  const g=robotGoal();
  const need=Math.ceil(g/p);
  const name=(state.profile&&state.profile.name)||'[اسمك]';
  const ch=robotChannels();
  return `خطة 30 عميلاً — ${biz}
الهدف: ${need} عميل/طلب شهرياً بسعر ${fmt(p)} للوصول إلى ${fmt(g)}.

القاعدة: 10 + 10 + 10.

1) 10 حسابات/متاجر على إنستقرام
• ابحث عن حسابات تبيع ${biz} أو تحتاجه وتعرض صوراً ضعيفة أو غير منتظمة.
• ابدأ بتفصيل واحد رأيته واذكر مشكلة محددة.
• بحث إنستقرام: ابحث في جوجل عن «site:instagram.com ${biz}».

2) 10 مشاريع/شركات محلية
• استخدم خرائط جوجل: «${biz}» + اسم مدينتك.
• تحقق: هل الموقع واضح؟ هل الردود سريعة؟ هل الصور ضعيفة؟

3) 10 منصات وطلبات
• خمسات، مستقل، Upwork، ومجموعات فيسبوك/واتساب.
• ابحث عن طلبات فيها: «مطلوب ${biz}» أو «أبحث عن ${biz}».

لكل هدف سجّل: الاسم، القناة، الرابط، المشكلة، الرسالة، الحالة، تاريخ المتابعة.
استخدم زر «تحميل 30 عميلاً CSV» لتحصل على قالب جاهز.

3 رسائل:
1) أول تواصل:
مرحباً [الاسم]، لاحظت [تفصيل محدد] في [الحساب/المشروع]. أنا ${name} وأساعد ${ch[0]} على ${biz} بنتيجة واضحة. جهّزت لك [عينة/فكرة] مجانية. تحب أرسلها؟

2) متابعة بعد 48 ساعة:
مرحباً [الاسم]، أتابع فقط: هل وصلتك الفكرة؟ إن كان الوقت غير مناسب أخبرني وأتوقف. وإن أردت، أرسل لك عينة قصيرة بدون التزام.

3) إغلاق مهذب:
مرحباً [الاسم]، سأغلق الموضوع حتى لا أزعجك. إن احتجت ${biz} لاحقاً، هذا رابط عملي: [الرابط]. بالتوفيق في [المشروع].

معيار التأهيل: يحتاج الخدمة الآن + يستطيع الدفع + يمكن الوصول لصاحب القرار.
المتابعة: يوم 0 إرسال، يوم 2 متابعة، يوم 5 إغلاق، يوم 14 عرض جديد.

تحقق الدقة:
• 3 رسائل كحد أقصى لنفس الشخص.
• لا بيانات حساسة في الرسائل.
• لا إرسال تلقائي — أنت توافق قبل أي خطوة خارجية.
• تحقق أن الهدف يستطيع الدفع قبل إضاعة الوقت.`;
}

function robotOperatorText(){
  const biz=robotBusiness();
  const p=robotPrice();
  const g=robotGoal();
  return `خطة التسليم والدفع — ${biz}
الهدف: تسليم يرضي العميل ويحمي وقتك.

أسئلة قبل البدء:
1. ما الهدف من العمل؟ (بيع، ثقة، إطلاق، تحديث)
2. من الجمهور المستهدف؟
3. ما الملفات/المعلومات التي سترسلها؟
4. ما الموعد النهائي الحقيقي؟
5. من صاحب القرار ومن يراجع؟

خطوات التسليم:
1. استلم الملفات وسمّها بتاريخ واسم العميل.
2. أنجز نسخة أولى سريعة وأرسل معاينة.
3. اجمع الملاحظات في رسالة واحدة.
4. نفّذ مراجعتين كحد أقصى ثم أي تعديل إضافي بسعر واضح.
5. سلّم الملفات النهائية + نسخة خفيفة للمعاينة.
6. اكتب ما تم إنجازه وما لم يُنجز.
7. احتفظ بنسخة احتياطية 30 يوماً.

قائمة الجودة:
• هل المخرج يطابق ${biz}؟
• هل النص واضح بلا أخطاء؟
• هل الملفات مسمّاة ومرتبة؟
• هل أرسلت تعليمات الاستخدام؟
• هل راجعت ما وعدت به فقط؟

رسالة التسليم:
مرحباً [الاسم]، هذا تسليم ${biz}. تجد الملفات في [الرابط]. راجعت [ما راجعته] وتأكدت من [ما تأكدت منه]. إن كان هناك تعديل ضمن المراجعتين، أرسله في رسالة واحدة وسأنفذه. شكراً لثقتك.

الفاتورة:
العميل: [الاسم]
الخدمة: ${biz}
السعر: ${fmt(p)}
المدفوع: 50% = ${fmt(Math.round(p/2))}
المتبقي: ${fmt(p-Math.round(p/2))} عند التسليم
التسليم: ${robotDays(2)} عمل
ملاحظة: أي عمل خارج النطاق يُسعّر قبل التنفيذ.

بوابة الدفع:
• لن أدفع أي مبلغ الآن.
• أي دفع أو شراء يحتاج موافقتك الصريحة أولاً.
• استخدم منصة وسيطة أو فاتورة موثقة.
• لا تشارك بيانات بنكية حساسة في رسائل عادية.

خطة 7 أيام:
اليوم 1: ثبّت الخدمة والسعر وافتح طريقة دفع.
اليوم 2: أنجز 3 نماذج وانشرها.
اليوم 3: اكتب قائمة 30 هدفاً.
اليوم 4: أرسل 10 رسائل مخصصة.
اليوم 5: أرسل 10 + تابع من لم يرد.
اليوم 6: أرسل 10 + انشر نموذجاً.
اليوم 7: راجع الأرقام وعدّل الرسالة والسعر.

مؤشرات:
• عدد المحادثات.
• عدد الردود.
• عدد طلبات السعر.
• عدد العملاء.
• الدخل الشهري مقابل ${fmt(g)}.

تحقق الدقة:
• لا دفع بدون موافقتك.
• النطاق مكتوب قبل البدء.
• المراجعتان محددتان.
• لا بيانات بنكية في رسائل عادية.`;
}

function robotLocalText(stage){
  if(stage===0)return robotScoutText();
  if(stage===1)return robotArchitectText();
  if(stage===2)return robotMakerText();
  if(stage===3)return robotHunterText();
  return robotOperatorText();
}

function robotOutputText(stage){
  const r=robotData();
  return r.outputs[stage]||robotLocalText(stage);
}

function robotPrompt(stage){
  const s=robotSkill();
  const bot=ROBOTS[stage];
  const r=robotData();
  const prev=ROBOTS.slice(0,stage).map((b,i)=>`${b.name}:\n${String(r.outputs[i]||'').slice(0,700)}`).filter(Boolean).join('\n\n');
  return `أنت ${bot.name}، الروبوت ${stage+1} من 5 في فريق مِكسب.
مهمتك: ${bot.role}.
بيانات المستخدم: الاسم ${(state.profile&&state.profile.name)||'غير معروف'}، العمل المختار ${robotBusiness()}، المجال ${robotField()}، السعر ${fmt(robotPrice())}، هدف الشهر ${fmt(robotGoal())}، الوقت ${(state.profile&&state.profile.hours)||3} ساعات/يوم.
اكتب تقريراً عربياً عملياً منظماً بالأرقام. لا تضمن أرباحاً. لا تخترع أسماء عملاء أو روابط أو نتائج. استخدم المصادر الموجودة في المسودة. لا تطلب بيانات حساسة. حافظ على قسم التحقق والمصادر كما هو، ولا تحذف أي رابط.
${prev?'نتائج الروبوتات السابقة:\n'+prev+'\n':''}
المسودة المحلية المعتمدة:
${robotLocalText(stage)}
${r.notes[stage]?'\nملاحظة المستخدم: '+r.notes[stage]:''}
أعد كتابة التقرير بشكل أقوى وأكثر ذكاءً، مع الحفاظ على الحقائق والأرقام والمصادر وقسم التحقق.`;
}

async function robotAI(stage){
  const ai=state.settings.ai;
  const url=ai.base.replace(/\/+$/,'')+'/chat/completions';
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),45000);
  let res;
  try{
    res=await fetch(url,{
      method:'POST',
      signal:ctrl.signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+ai.key},
      body:JSON.stringify({
        model:ai.model,
        messages:[
          {role:'system',content:'أنت روبوت تنفيذي داخل فريق مِكسب. أجب بالعربية، بلا حشو، بخطوات وأرقام، ولا تخترع مصادر أو نتائج.'},
          {role:'user',content:robotPrompt(stage)}
        ],
        temperature:0.5,
        max_tokens:1100
      })
    });
  }finally{
    clearTimeout(timer);
  }
  if(!res.ok)throw new Error('HTTP '+res.status);
  const j=await res.json();
  const txt=j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;
  if(!txt)throw new Error('رد فارغ');
  return String(txt).replace(/^```[a-z]*\s*/i,'').replace(/```\s*$/,'').trim().slice(0,12000);
}

async function robotRun(stage){
  const r=robotData();
  const token=++robotRunToken;
  r.active=true;
  r.stage=stage;
  r.status='working';
  r.editing=false;
  r.error='';
  r.approvals[stage]=false;
  r.outputs[stage]='';
  r.logs[stage]=[];
  if(stage===0)r.verify={};
  r.startedAt=r.startedAt||Date.now();
  r.mode=robotAIMode()?'ai':'local';
  save();
  if(state.ui.view==='robots')renderRobots();
  const steps=ROBOT_STEPS[stage]||[];
  for(const msg of steps){
    if(token!==robotRunToken)return;
    robotLog(stage,msg);
    await robotSleep(300);
  }
  if(stage===0){
    if(token!==robotRunToken)return;
    robotLog(stage,'أتحقق من المصادر على ويكيبيديا...');
    await robotVerifyCases();
    if(token!==robotRunToken)return;
  }
  let text='';
  let usedAI=false;
  if(robotAIMode()){
    if(token!==robotRunToken)return;
    robotLog(stage,'يتصل بالذكاء السحابي ('+state.settings.ai.model+')...');
    try{
      text=await robotAI(stage);
      usedAI=true;
    }catch(e){
      if(token!==robotRunToken)return;
      r.error='تعذر الذكاء السحابي: '+e.message+' — استخدمت المحرك المحلي.';
      robotLog(stage,r.error);
    }
  }
  if(token!==robotRunToken)return;
  if(!text){
    text=robotLocalText(stage);
    if(r.notes[stage])text='📝 ملاحظة مطبقة: '+r.notes[stage]+'\n\n'+text;
  }
  r.outputs[stage]=text;
  r.status='waiting';
  r.mode=usedAI?'ai':'local';
  save();
  if(state.ui.view==='robots')renderRobots();
}

function robotRecover(){
  const r=robotData();
  if(r.status==='working'){
    r.status='idle';
    r.active=false;
    save();
  }
}

function robotStart(){
  if(!state.profile){toast('أكمل ملفك أولاً');return;}
  const r=robotData();
  const bi=$('#robotBusiness');
  const pi=$('#robotPrice');
  if(bi)r.business=bi.value.trim();
  if(pi)r.price=Math.max(1,Math.round(Number(pi.value)||robotPrice()));
  r.active=true;
  r.status='idle';
  r.stage=0;
  r.outputs={};
  r.approvals={};
  r.notes={};
  r.logs={};
  r.startedAt=Date.now();
  r.finishedAt=null;
  r.error='';
  r.editing=false;
  r.mode=robotAIMode()?'ai':'local';
  save();
  switchView('robots');
  renderRobots();
  toast('5 روبوتات بدأوا العمل');
  robotRun(0);
}

function robotResume(){
  if(!state.profile){toast('أكمل ملفك أولاً');return;}
  const r=robotData();
  r.active=true;
  if(r.outputs[r.stage]&&!r.approvals[r.stage]){
    r.status='waiting';
    save();
    renderRobots();
  }else{
    save();
    robotRun(r.stage);
  }
}

function robotApprove(){
  const r=robotData();
  if(r.status!=='waiting'||!r.outputs[r.stage])return;
  r.approvals[r.stage]=true;
  r.active=true;
  if(r.stage<ROBOTS.length-1){
    r.stage++;
    r.status='idle';
    save();
    renderRobots();
    robotRun(r.stage);
  }else{
    r.active=false;
    r.status='done';
    r.finishedAt=Date.now();
    save();
    renderRobots();
    toast('اكتملت خطة '+fmt(robotGoal())+'/شهر');
  }
}

function robotStop(){
  robotRunToken++;
  const r=robotData();
  r.active=false;
  if(r.status==='working')r.status='idle';
  save();
  renderRobots();
  toast('أوقفنا الفريق — يمكنك المتابعة من نفس المرحلة');
}

function robotReset(){
  if(!confirm('إعادة الفريق من البداية؟ سيتم مسح التقارير الحالية.'))return;
  robotRunToken++;
  const old=robotData();
  const g=old.goal, b=old.business, pr=old.price;
  state.robots=robotDefault();
  state.robots.goal=g;
  state.robots.business=b;
  state.robots.price=pr;
  save();
  renderRobots();
  toast('الفريق جاهز من جديد');
}

function robotEdit(){
  const r=robotData();
  if(!r.outputs[r.stage])return;
  r.editing=true;
  save();
  renderRobots();
  setTimeout(()=>{const el=$('#robotEditInput');if(el)el.focus();},40);
}

function robotCancelEdit(){
  robotData().editing=false;
  save();
  renderRobots();
}

function robotApplyEdit(){
  const el=$('#robotEditInput');
  const text=el?el.value.trim():'';
  const r=robotData();
  if(text)r.notes[r.stage]=text;
  r.editing=false;
  save();
  if(text)robotRun(r.stage);
  else renderRobots();
}

function robotLinkify(text){
  let s=esc(text||'');
  s=s.replace(/^#{1,4}\s*(.+)$/gm,'<b>$1</b>');
  s=s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
  s=s.replace(/^[-*]\s+/gm,'• ');
  s=s.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  return s.replace(/\n/g,'<br>');
}

function robotSearchLinks(stage){
  const biz=robotBusiness();
  const field=robotField();
  if(stage===0){
    const google='https://www.google.com/search?q='+encodeURIComponent(biz+' success story revenue');
    const youtube='https://www.youtube.com/results?search_query='+encodeURIComponent(biz+' business journey');
    const upwork='https://www.upwork.com/nx/search/jobs/?q='+encodeURIComponent(biz);
    return '<div class="rLinks"><a href="'+esc(google)+'" target="_blank" rel="noopener">🔎 قصص نجاح على جوجل</a><a href="'+esc(youtube)+'" target="_blank" rel="noopener">▶️ YouTube</a><a href="'+esc(upwork)+'" target="_blank" rel="noopener">Upwork</a></div>';
  }
  if(stage===3){
    const insta='https://www.google.com/search?q='+encodeURIComponent('site:instagram.com '+biz);
    const maps='https://www.google.com/maps/search/'+encodeURIComponent(biz+' '+field);
    const upwork='https://www.upwork.com/nx/search/jobs/?q='+encodeURIComponent(biz);
    const khamsat='https://khamsat.com/search?q='+encodeURIComponent(biz);
    const mostaql='https://mostaql.com/projects?keyword='+encodeURIComponent(biz);
    return '<div class="rLinks"><a href="'+esc(insta)+'" target="_blank" rel="noopener">إنستقرام</a><a href="'+esc(maps)+'" target="_blank" rel="noopener">خرائط جوجل</a><a href="'+esc(khamsat)+'" target="_blank" rel="noopener">خمسات</a><a href="'+esc(mostaql)+'" target="_blank" rel="noopener">مستقل</a><a href="'+esc(upwork)+'" target="_blank" rel="noopener">Upwork</a></div>';
  }
  return '';
}

function robotCaseStrip(){
  const cs=robotCases().slice(0,3);
  if(!cs.length)return '';
  return '<div class="rCases">'+cs.map((c,i)=>'<a class="rCase" href="'+esc(c.url)+'" target="_blank" rel="noopener"><b>'+(i+1)+'. '+esc(c.title)+'</b><small>'+esc(c.who)+' — '+esc(c.result)+'</small><span>المصدر ↗</span></a>').join('')+'</div>';
}

function robotVerifyStrip(){
  const r=robotData();
  const cs=robotCases().slice(0,3).filter(c=>c.wiki);
  const ok=cs.filter(c=>r.verify&&r.verify[c.wiki]&&r.verify[c.wiki].ok).length;
  if(!ok)return '';
  return '<div class="rVerify">✅ تحقق آلي من '+ok+' من '+cs.length+' مصادر على ويكيبيديا</div>';
}

function robotBizExamplesHtml(){
  const cs=robotCases().slice(0,3);
  const biz=robotBusiness();
  const google='https://www.google.com/search?q='+encodeURIComponent(biz+' success story revenue');
  const youtube='https://www.youtube.com/results?search_query='+encodeURIComponent(biz+' business journey');
  return '<div class="rBizExamples"><div class="row"><h3 style="flex:1">📚 أمثلة حقيقية</h3><span class="badge">مصادر</span></div>'+
    (cs.length?'<div class="rCases">'+cs.map((c,i)=>'<a class="rCase" href="'+esc(c.url)+'" target="_blank" rel="noopener"><b>'+(i+1)+'. '+esc(c.title)+'</b><small>'+esc(c.who)+' — '+esc(c.result)+'</small><span>المصدر ↗</span></a>').join('')+'</div>':'<p class="sub">اكتب عملاً لعرض أمثلة قريبة.</p>')+
    '<div class="rLinks"><a href="'+esc(google)+'" target="_blank" rel="noopener">🔎 بحث قصص نجاح</a><a href="'+esc(youtube)+'" target="_blank" rel="noopener">▶️ YouTube</a></div>'+
    '<p class="hint">الأمثلة منشورة ومصادرها ظاهرة. تحقق منها قبل الاقتباس.</p></div>';
}

function renderRobotExamples(){
  const box=$('#robotExamples');
  if(box)box.innerHTML=robotBizExamplesHtml();
}

function robotGoalHint(){
  return Math.ceil(robotGoal()/robotPrice())+' عميل/طلب بسعر '+fmt(robotPrice())+' للوصول إلى '+fmt(robotGoal());
}

function updateRobotGoalHint(){
  const el=$('#robotGoalHint');
  if(el)el.textContent=robotGoalHint();
}

function robotDownload(name,content,type){
  const blob=new Blob([content],{type:type||'text/plain;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=name;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},600);
}

function robotDownloadCSV(){
  const rows=[['الاسم','القناة','الرابط','المشكلة','الرسالة','الحالة','تاريخ المتابعة']];
  for(let i=1;i<=30;i++){
    const ch=i<=10?'إنستقرام':i<=20?'خرائط جوجل':'منصة عمل';
    rows.push(['عميل '+i,ch,'','','','جديد','']);
  }
  const csv='\ufeff'+rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
  robotDownload('maksab-30-leads.csv',csv,'text/csv;charset=utf-8');
  toast('تم تحميل قالب 30 عميلاً');
}

function robotSummaryText(){
  return 'خطة '+robotBusiness()+' — هدف '+fmt(robotGoal())+'/شهر\n\n'+ROBOTS.map((b,i)=>b.icon+' '+b.name+'\n'+robotOutputText(i)).join('\n\n--------------------\n\n');
}

function robotHowHtml(){
  return '<h2>كيف يعمل الفريق؟</h2>'+
    '<p class="sub">خمسة روبوتات تعمل على أي عمل تكتبه. كل روبوت ينتج تقريراً، ثم تتوقف المهمة حتى توافق أنت.</p>'+
    '<div class="rHowGrid">'+ROBOTS.map((b,i)=>'<div class="rHow"><span>'+(i+1)+'</span><div><b>'+b.icon+' '+esc(b.name)+'</b><small>'+esc(b.role)+'</small></div></div>').join('')+'</div>'+
    '<div class="tip">دقة عالية: يتحقق الفريق من المصادر والحسابات، ويترك لك القرار. يعمل داخل المتصفح: يحسب، يرتب، وينتج الملفات. لا يرسل رسائل ولا يدفع، وأي خطوة خارجية تحتاج موافقتك.</div>';
}

function robotDoneHtml(){
  const r=robotData();
  const p=robotPrice();
  const g=robotGoal();
  const total=Math.ceil(g/p);
  return '<div class="row"><div style="flex:1;min-width:0"><h2>✅ الخطة الكاملة جاهزة</h2><p class="sub">5 تقارير عن '+esc(robotBusiness())+' + عرض + نماذج + 30 عميلاً + تسليم + خطة 7 أيام.</p></div><span class="badge green">100%</span></div>'+
    '<div class="rDoneStats"><div><b>'+fmt(g)+'</b><small>هدف الشهر</small></div><div><b>'+fmt(p)+'</b><small>سعر الخدمة</small></div><div><b>'+total+'</b><small>عميل/شهر</small></div><div><b>5</b><small>روبوتات</small></div></div>'+
    '<div class="rSummary">'+ROBOTS.map((b,i)=>'<div class="rSumRow"><span>'+b.icon+'</span><div><b>'+esc(b.name)+'</b><small>'+esc(String(r.outputs[i]||'').split('\n').slice(0,2).join(' — '))+'</small></div><button class="mini" data-robot="copyone" data-stage="'+i+'">نسخ</button></div>').join('')+'</div>'+
    '<div class="row"><button class="btn green" data-robot="copyall">📋 نسخ الخطة الكاملة</button><button class="btn ghost" data-robot="reset">🔄 مشروع جديد</button></div>';
}

function renderRobotHero(){
  const box=$('#robotHero');
  if(!box)return;
  const r=robotData();
  const bot=ROBOTS[r.stage];
  const ai=robotAIMode();
  if(!state.profile){
    box.innerHTML='<h2>🤖 فريق مِكسب</h2><p class="sub">أكمل ملفك أولاً ليعرف الفريق مهارتك وسعرك وهدفك.</p><button class="btn" data-go="home">أكمل ملفي</button>';
    return;
  }
  if(r.status==='done'){
    const total=Math.ceil(robotGoal()/robotPrice());
    box.innerHTML='<div class="rHeroTop"><div style="flex:1;min-width:0"><span class="badge green">اكتمل</span><h1>خطة '+fmt(robotGoal())+' شهرياً جاهزة</h1><p class="sub">5 روبوتات أنجزوا خطة '+esc(robotBusiness())+': البحث والعرض والنماذج والعملاء والتسليم. راجع الخطة ثم ابدأ التنفيذ.</p></div><div class="rPct"><b>100%</b><small>مكتمل</small></div></div>'+
      '<div class="rDoneStats"><div><b>'+fmt(robotGoal())+'</b><small>هدف الشهر</small></div><div><b>'+fmt(robotPrice())+'</b><small>سعر الخدمة</small></div><div><b>'+total+'</b><small>عميل/شهر</small></div><div><b>5</b><small>روبوتات</small></div></div>'+
      '<div class="row"><button class="btn green" data-robot="copyall">📋 نسخ الخطة الكاملة</button><button class="btn ghost" data-robot="reset">🔄 مشروع جديد</button><button class="mini" data-robot="settings">⚙️ الإعدادات</button></div>';
    return;
  }
  if(r.active){
    const pct=robotHeroPercent();
    box.innerHTML='<div class="rHeroTop"><div style="flex:1;min-width:0"><span class="badge">المرحلة '+(r.stage+1)+' من 5</span><h1>'+bot.icon+' '+esc(bot.name)+'</h1><p class="sub">'+esc(bot.role)+' — العمل: '+esc(robotBusiness())+'</p></div><div class="rPct"><b>'+pct+'%</b><small>تقدم المهمة</small></div></div>'+
      '<div class="progress"><i style="width:'+pct+'%"></i></div>'+
      '<div class="row"><span class="badge '+(r.status==='working'?'green':'')+'">'+robotStatusLabel(r.status)+'</span><span class="hint">الهدف '+fmt(robotGoal())+'/شهر</span><span class="hint">'+(ai?'AI سحابي':'محلي ذكي')+'</span><span class="spacer"></span><button class="mini" data-robot="stop">⏸️ إيقاف</button><button class="mini" data-robot="reset">↺ جديد</button></div>';
    return;
  }
  if(Object.keys(r.outputs||{}).length){
    box.innerHTML='<div class="rHeroTop"><div style="flex:1;min-width:0"><span class="badge">متوقف مؤقتاً</span><h1>فريق مِكسب</h1><p class="sub">توقفنا عند '+bot.icon+' '+esc(bot.name)+' — '+esc(robotBusiness())+'. يمكنك المتابعة من نفس المرحلة.</p></div><div class="rPct"><b>'+robotHeroPercent()+'%</b><small>تقدم</small></div></div>'+
      '<div class="row"><button class="btn green" data-robot="resume">▶️ أكمل من المرحلة '+(r.stage+1)+'</button><button class="btn ghost" data-robot="reset">↺ ابدأ من جديد</button><button class="mini" data-robot="settings">⚙️ الإعدادات</button></div>';
    return;
  }
  box.innerHTML='<div class="rHeroTop"><div style="flex:1;min-width:0"><span class="badge green">5 روبوتات</span><h1>فريق مِكسب</h1><p class="sub">خمسة روبوتات تعمل بالترتيب: يبحثون، يحسبون، يصنعون، يصطادون العملاء، ثم ينظمون التسليم. أنت توافق فقط بعد كل مرحلة.</p></div></div>'+
    '<div class="rBizBox"><label>أي عمل/خدمة تريد؟</label><input id="robotBusiness" type="text" value="'+esc(r.business||'')+'" placeholder="مثال: تنظيف سيارات، دروس رياضيات، متجر ملابس..."><div class="rBizRow"><div><label>سعر الطلب/الخدمة</label><div class="rGoalInput"><input id="robotPrice" type="number" min="1" step="5" value="'+robotPrice()+'"><span>$</span></div></div><div><label>هدف الشهر</label><div class="rGoalInput"><input id="robotGoal" type="number" min="50" step="50" value="'+robotGoal()+'"><span>$</span></div><small id="robotGoalHint">'+robotGoalHint()+'</small></div></div><small class="hint">اتركه فارغاً لاستخدام مهارتك: '+esc(robotSkill().service)+' — أو اكتب أي عمل آخر.</small></div>'+
    '<div class="rPitch"><span>🔭 بحث وأمثلة</span><span>📐 عرض وباقات</span><span>🎨 نماذج وأصول</span><span>🎯 30 عميلاً</span><span>📦 تسليم ودفع آمن</span></div>'+
    '<div class="row" style="margin-top:12px"><button class="btn green" data-robot="start" style="flex:1">🚀 شغّل الفريق على هذا العمل</button><button class="mini" data-robot="settings">⚙️ '+(ai?'AI سحابي':'إعداد AI')+'</button></div>'+
    '<p class="hint">دقة عالية: يتحقق من المصادر والحسابات، ولا يرسل رسالة أو يدفع دون موافقتك. يعمل محلياً بدون إنترنت، وAI اختياري.</p>'+
    '<div id="robotExamples">'+robotBizExamplesHtml()+'</div>';
}

function renderRobotRoster(){
  const box=$('#robotRoster');
  if(!box)return;
  const r=robotData();
  box.innerHTML=ROBOTS.map((b,i)=>{
    const pct=robotStepPercent(i);
    const st=r.approvals[i]?'done':i===r.stage&&r.active?(r.status==='working'?'working':r.status==='waiting'?'waiting':'idle'):(r.outputs[i]?'ready':'idle');
    const label=st==='done'?'معتمد':st==='working'?'يعمل':st==='waiting'?'بانتظارك':st==='ready'?'جاهز':'بانتظار الدور';
    const last=(r.logs[i]||[]).slice(-1)[0];
    return '<div class="robotCard '+st+'"><div class="rTop"><span class="rIcon" style="--c:'+b.color+'">'+b.icon+'</span><div><b>'+esc(b.name)+'</b><small>'+esc(b.role)+'</small></div><span class="rStatus '+st+'">'+label+'</span></div>'+
      '<div class="rBar"><i style="width:'+pct+'%"></i></div>'+
      '<div class="rLog">'+esc(last?last.msg:'بانتظار الدور')+'</div>'+
      '<div class="rFoot"><span>'+(i+1)+'/5</span><span>'+(r.approvals[i]?'✅ معتمد':r.outputs[i]?'جاهز':'—')+'</span></div></div>';
  }).join('');
}

function renderRobotStage(){
  const box=$('#robotStage');
  if(!box)return;
  const r=robotData();
  if(!state.profile){
    box.innerHTML='<h2>ابدأ من ملفك</h2><p class="sub">الفريق يحتاج مهارتك وسعرك وهدفك.</p><button class="btn" data-go="home">أكمل ملفي</button>';
    return;
  }
  if(r.status==='done'){
    box.innerHTML=robotDoneHtml();
    return;
  }
  if(!r.active&&!Object.keys(r.outputs||{}).length){
    box.innerHTML=robotHowHtml();
    return;
  }
  const bot=ROBOTS[r.stage];
  let html='<div class="row"><div style="flex:1;min-width:0"><h2>'+bot.icon+' '+esc(bot.name)+'</h2><p class="sub">'+esc(bot.role)+' — العمل: '+esc(robotBusiness())+'</p></div><span class="badge '+(r.status==='working'?'green':'')+'">'+robotStatusLabel(r.status)+'</span></div>';
  if(r.status==='working'){
    const logs=(r.logs[r.stage]||[]).slice(-6);
    html+='<div class="rWork"><span class="rPulse"><i></i><i></i><i></i></span><b>يعمل الآن…</b></div>';
    html+='<div class="rLive">'+(logs.map(l=>'<div><span>'+esc(l.ts)+'</span>'+esc(l.msg)+'</div>').join('')||'<div>يبدأ…</div>')+'</div>';
    html+='<div class="rIndeterminate"><i></i></div>';
  }else if(r.outputs[r.stage]){
    if(r.error)html+='<div class="warn">'+esc(r.error)+'</div>';
    if(r.stage===0)html+=robotVerifyStrip();
    html+='<div class="rOutput">'+robotLinkify(r.outputs[r.stage])+'</div>';
    if(r.stage===0)html+=robotCaseStrip();
    html+=robotSearchLinks(r.stage);
    if(r.notes[r.stage])html+='<div class="tip"><b>📝 تعديلك:</b> '+esc(r.notes[r.stage])+'</div>';
    if(r.editing)html+='<div class="autoEdit"><label>اكتب ما تريد تغييره</label><textarea id="robotEditInput" rows="3" placeholder="مثال: اجعل العرض أرخص، أو ركز على المطاعم، أو اختصر الرسائل">'+esc(r.notes[r.stage]||'')+'</textarea><div class="row" style="margin-top:7px"><button class="btn small" data-robot="apply">تطبيق وإعادة التشغيل</button><button class="mini" data-robot="cancel">إلغاء</button></div><p class="hint">'+(robotAIMode()?'سأعيد تشغيل هذا الروبوت بالذكاء السحابي مع ملاحظتك.':'سأعيد تشغيل المحرك المحلي مع ملاحظتك. لتحسين الصياغة أكثر فعّل AI من الإعدادات.')+'</p></div>';
    html+='<div class="row rActions"><button class="btn green" data-robot="approve">'+(r.stage===ROBOTS.length-1?'✅ موافق — أنهِ الخطة':'✅ موافق — شغّل الروبوت التالي')+'</button>';
    html+='<button class="btn ghost small" data-robot="edit">✏️ غيّر</button>';
    if(r.stage===3)html+='<button class="btn ghost small" data-robot="csv">⬇️ تحميل 30 عميلاً CSV</button>';
    html+='<button class="mini" data-robot="copy">📋 نسخ</button><button class="mini" data-robot="stop">⏸️ إيقاف</button></div>';
    html+='<p class="hint">أنت فقط تراجع وتوافق. لن يرسل الفريق رسالة أو يدفع أي مبلغ.</p>';
  }else{
    html+='<p class="sub">هذه المرحلة لم تبدأ بعد.</p><button class="btn green" data-robot="resume">▶️ أكمل</button>';
  }
  box.innerHTML=html;
}

function renderRobotFeed(){
  const box=$('#robotFeed');
  if(!box)return;
  const rows=[];
  ROBOTS.forEach((b,i)=>(robotData().logs[i]||[]).forEach(l=>rows.push({l:l,b:b})));
  rows.sort((a,b)=>b.l.at-a.l.at);
  const last=rows.slice(0,12);
  box.innerHTML='<div class="row"><h3 style="flex:1">📡 سجل العمليات</h3><span class="badge">'+rows.length+' حدث</span></div>'+
    (last.length?'<div class="rFeedList">'+last.map(x=>'<div class="rFeedRow"><span class="rFeedTs">'+esc(x.l.ts)+'</span><span class="rFeedIcon">'+x.b.icon+'</span><span>'+esc(x.l.msg)+'</span></div>').join('')+'</div>':'<p class="sub">سيظهر هنا كل ما يفعله الفريق لحظة بلحظة.</p>');
}

function renderRobots(){
  renderRobotHero();
  renderRobotRoster();
  renderRobotStage();
  renderRobotFeed();
}

function bindRobots(){
  const root=$('#view-robots');
  if(!root)return;
  root.addEventListener('click',e=>{
    const b=e.target.closest('[data-robot]');
    if(!b)return;
    const act=b.dataset.robot;
    if(act==='start')robotStart();
    else if(act==='resume')robotResume();
    else if(act==='approve')robotApprove();
    else if(act==='stop')robotStop();
    else if(act==='reset')robotReset();
    else if(act==='edit')robotEdit();
    else if(act==='cancel')robotCancelEdit();
    else if(act==='apply')robotApplyEdit();
    else if(act==='copy')copyText(robotOutputText(robotData().stage));
    else if(act==='copyone')copyText(robotOutputText(Number(b.dataset.stage)||0));
    else if(act==='copyall')copyText(robotSummaryText());
    else if(act==='csv')robotDownloadCSV();
    else if(act==='settings')openSettings();
  });
  root.addEventListener('change',e=>{
    const r=robotData();
    if(e.target.id==='robotGoal'){
      r.goal=Math.max(50,Math.round(Number(e.target.value)||500));
      save();
      updateRobotGoalHint();
      toast('هدف الشهر: '+fmt(r.goal));
    }else if(e.target.id==='robotPrice'){
      r.price=Math.max(1,Math.round(Number(e.target.value)||robotPrice()));
      save();
      updateRobotGoalHint();
      toast('سعر الطلب: '+fmt(r.price));
    }else if(e.target.id==='robotBusiness'){
      r.business=e.target.value.trim();
      save();
      renderRobotExamples();
      toast('العمل: '+robotBusiness());
    }
  });
  root.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)&&e.target.id==='robotEditInput'){
      e.preventDefault();
      robotApplyEdit();
    }
    if(e.key==='Enter'&&e.target.id==='robotBusiness'){
      e.preventDefault();
      robotStart();
    }
  });
}
