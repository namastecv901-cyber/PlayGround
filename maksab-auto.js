const AUTO_STEPS=[
  {key:'research',icon:'🔎',title:'أمثلة حقيقية وتأكيد الخدمة',desc:'أجلب لك أمثلة منشورة لأشخاص قدّموا خدمة مشابهة، ثم نثبّت خدمتك.',cta:'ابدأ بهذه الخدمة'},
  {key:'offer',icon:'💵',title:'العرض والسعر والباقات',desc:'أجهّز عرضاً واضحاً و3 باقات وأسعاراً منطقية.',cta:'اعتمد العرض'},
  {key:'portfolio',icon:'🖼️',title:'نماذج الأعمال',desc:'أجهّز خطة 3 نماذج سريعة تثبت أنك تستطيع التنفيذ.',cta:'اعتمد النماذج'},
  {key:'leads',icon:'🎯',title:'قائمة 30 عميلاً',desc:'أحدد لك من تستهدف، وأين تجدهم، وكيف تسجلهم.',cta:'اعتمد القائمة'},
  {key:'outreach',icon:'✉️',title:'رسائل التواصل',desc:'أكتب لك 3 رسائل: أول تواصل، متابعة، وإغلاق مهذب.',cta:'اعتمد الرسائل'},
  {key:'delivery',icon:'📦',title:'التنفيذ والتسليم',desc:'أجهّز أسئلة العميل، خطوات التسليم، ورسالة التسليم.',cta:'اعتمد خطة التنفيذ'},
  {key:'payment',icon:'🔒',title:'بوابة الدفع والأمان',desc:'نتوقف هنا قبل أي دفع. أراجع معك الشروط وأي مبلغ.',cta:'فهمت، لا دفع الآن'},
  {key:'followup',icon:'🔁',title:'المتابعة والترقية',desc:'أجهّز متابعة بعد التسليم، طلب تقييم، وعرض ترقية.',cta:'اعتمد المتابعة'},
  {key:'daily',icon:'🗓️',title:'خطة 7 أيام',desc:'أحوّل كل شيء إلى مهام يومية واضحة لمدة أسبوع.',cta:'بدأت التنفيذ'},
  {key:'done',icon:'✅',title:'اكتمال المشروع',desc:'لديك خطة كاملة جاهزة. راجع الملخص وابدأ.',cta:'مشروع جديد'}
];

const AUTO_AUDIENCE={
  design:'متاجر صغيرة وحسابات إنستقرام',
  photo:'متاجر إلكترونية ومطاعم محلية',
  writing:'متاجر إلكترونية وأصحاب مشاريع',
  dev:'شركات صغيرة وأصحاب مواقع',
  marketing:'أصحاب مشاريع ومتاجر محلية',
  support:'متاجر تطلب ردوداً ومتابعة',
  none:'أصحاب مشاريع صغيرة'
};

const AUTO_BENEFIT={
  design:'منشورات أوضح تزيد الثقة والتفاعل',
  photo:'صور منتجات أنظف ترفع النقر والبيع',
  writing:'نصوص تبيع الفائدة بدل المواصفات',
  dev:'صفحة أسرع وأوضح تحول الزائر إلى عميل',
  marketing:'محتوى منتظم ومتابعة أقرب للعميل',
  support:'ردود أسرع ومتابعة لا تضيع الطلبات',
  none:'خدمات صغيرة جاهزة توفر وقت العميل'
};

const AUTO_DAYS={design:2,photo:1,writing:2,dev:5,marketing:3,support:1,none:1};

function autoDefault(){
  return {active:false,step:0,service:'',price:0,caseIndex:0,editing:false,notes:{},tasks:{}};
}

function autoData(){
  if(!state.auto||typeof state.auto!=='object')state.auto=autoDefault();
  const a=state.auto;
  const d=autoDefault();
  Object.keys(d).forEach(k=>{if(a[k]===undefined)a[k]=d[k];});
  if(!a.notes||typeof a.notes!=='object')a.notes={};
  if(!a.tasks||typeof a.tasks!=='object')a.tasks={};
  return a;
}

function autoSkillKey(){
  return (state.profile&&state.profile.skill)||'none';
}

function autoSkill(){
  return SKILLS[autoSkillKey()]||SKILLS.none;
}

function autoService(){
  return autoData().service||autoSkill().service;
}

function autoPrice(){
  const a=autoData();
  return Math.max(1,Math.round(Number(a.price)||Number((state.pricing&&state.pricing.price))||autoSkill().price));
}

function autoAudience(){
  return AUTO_AUDIENCE[autoSkillKey()]||AUTO_AUDIENCE.none;
}

function autoBenefit(){
  return AUTO_BENEFIT[autoSkillKey()]||AUTO_BENEFIT.none;
}

function autoDeliveryDays(){
  return AUTO_DAYS[autoSkillKey()]||2;
}

function autoDaysText(n){
  n=Math.max(1,Math.round(Number(n)||1));
  if(n===1)return 'يوم واحد';
  if(n===2)return 'يومين';
  return n+' أيام';
}

function autoChannels(){
  return autoSkill().channels||[];
}

function autoCases(){
  return (typeof CASES!=='undefined'&&CASES[autoSkillKey()])||(typeof CASES!=='undefined'&&CASES.none)||[];
}

function autoCase(){
  const cs=autoCases();
  if(!cs.length)return null;
  const a=autoData();
  return cs[Math.abs(Number(a.caseIndex)||0)%cs.length];
}

function autoCaseIndex(){
  const cs=autoCases();
  if(!cs.length)return 0;
  return Math.abs(Number(autoData().caseIndex)||0)%cs.length;
}

function autoPacks(){
  const p=autoPrice();
  return [
    {name:'الأساسية',price:p,desc:'خدمة واحدة + مراجعتان + تسليم '+autoDaysText(autoDeliveryDays())},
    {name:'الوسطى',price:Math.round(p*1.8),desc:'3 نماذج + 3 مراجعات + تسليم أسرع + ملفات المصدر'},
    {name:'العليا',price:Math.round(p*3),desc:'5 نماذج + أولوية تسليم + حقوق استخدام + متابعة شهر'}
  ];
}

function autoOfferText(){
  const p=autoPrice();
  const packs=autoPacks();
  const name=(state.profile&&state.profile.name)||'[اسمك]';
  return 'عرض خدمة: '+autoService()+'\n\n'+
    'من أنا: '+name+'، أساعد '+autoAudience()+' على '+autoBenefit()+'.\n\n'+
    'ما تحصل عليه:\n'+
    '• '+autoService()+' بجودة ثابتة وبسيطة.\n'+
    '• تسليم خلال '+autoDaysText(autoDeliveryDays())+' عمل.\n'+
    '• مراجعتان مشمولتان.\n'+
    '• ملفات جاهزة للنشر أو الاستخدام.\n\n'+
    'الباقات:\n'+
    '• الأساسية: '+fmt(packs[0].price)+' — '+packs[0].desc+'\n'+
    '• الوسطى: '+fmt(packs[1].price)+' — '+packs[1].desc+'\n'+
    '• العليا: '+fmt(packs[2].price)+' — '+packs[2].desc+'\n\n'+
    'الدفع: 50% مقدماً و50% عند التسليم.\n'+
    'للتأكيد: أرسل تفاصيل المشروع وسأبدأ خلال 24 ساعة.\n'+
    'الأسعار قابلة للتعديل حسب حجم العمل.';
}

function autoPortfolioText(){
  return 'خطة 3 نماذج في 90 دقيقة:\n\n'+
    '1) نموذج قبل/بعد\n'+
    '• اعمل على صورة/منشور/نص واحد وأظهر الفرق.\n'+
    '• الكابشن: «الفرق ليس في الأداة، بل في الوضوح الذي يبيعه». \n'+
    '• أرفق النتيجة فقط، بلا شرح طويل.\n\n'+
    '2) نموذج عرض/إعلان\n'+
    '• حوّل الخدمة إلى إعلان قصير: المشكلة، الحل، السعر، الخطوة التالية.\n'+
    '• الكابشن: «هذا ما ستحصل عليه خلال '+autoDaysText(autoDeliveryDays())+'». \n'+
    '• اذكر السعر بوضوح لتصفية العملاء غير الجادين.\n\n'+
    '3) نموذج كواليس/ثقة\n'+
    '• صوّر خطوة واحدة من عملك (قبل، أثناء، بعد).\n'+
    '• الكابشن: «هكذا أضمن أن كل عميل يحصل على نفس الجودة». \n'+
    '• الثقة تبيع أكثر من الكمال.\n\n'+
    'طريقة العرض: انشر النماذج الثلاثة في حساب واحد أو ملف PDF بسيط، وضع الرابط في كل رسالة.';
}

function autoLeadsText(){
  const s=autoService();
  const ch=autoChannels();
  return 'هدف: 30 عميلاً محتملاً في 3 قوائم.\n\n'+
    '1) 10 متاجر صغيرة على إنستقرام\n'+
    '• ابحث عن حسابات تبيع منتجات بصور ضعيفة أو غير منتظمة.\n'+
    '• ابدأ بمنتج واحد فقط، واذكر مشكلة محددة رأيتها.\n\n'+
    '2) 10 شركات/مشاريع محلية\n'+
    '• استخدم خرائط جوجل: «'+s+'» + اسم مدينتك.\n'+
    '• تحقق من الموقع/الحساب: هل الصور واضحة؟ هل الردود سريعة؟\n\n'+
    '3) 10 أفراد/منصات\n'+
    '• خمسات، مستقل، Upwork، مجموعات فيسبوك وواتساب.\n'+
    '• ابحث عن طلبات فيها كلمات: «مطلوب '+s+'» أو «أبحث عن '+s+'».\n\n'+
    'عبارات بحث جاهزة:\n'+
    '• Google: '+s+' '+autoAudience()+' [مدينتك]\n'+
    '• Instagram: '+s+' [مدينتك]\n'+
    '• LinkedIn: owner '+autoAudience()+' [مدينتك]\n'+
    '• منصات العمل: مطلوب '+s+'\n\n'+
    'القنوات المقترحة: '+ch.join('، ')+'\n\n'+
    'لكل عميل سجّل: الاسم، القناة، المشكلة، الرسالة، الحالة، تاريخ المتابعة.\n'+
    'معيار التأهيل: يحتاج الخدمة الآن + يستطيع الدفع + يمكن الوصول لصاحب القرار.\n'+
    'القاعدة: لا ترسل أكثر من 3 رسائل لنفس الشخص، ولا تكرر نفس النص حرفياً.';
}

function autoOutreachText(){
  const s=autoService();
  const name=(state.profile&&state.profile.name)||'[اسمك]';
  return 'رسالة 1 — أول تواصل:\n'+
    'مرحباً [الاسم]، لاحظت [تفصيل محدد] في [الحساب/المتجر]. أنا '+name+' وأساعد '+autoAudience()+' على '+autoBenefit()+'. جهّزت لك [عينة/فكرة] مجانية لـ '+s+'. تحب أرسلها؟\n\n'+
    'رسالة 2 — متابعة بعد 48 ساعة:\n'+
    'مرحباً [الاسم]، أتابع فقط: هل وصلتك الفكرة؟ إن كان الوقت غير مناسب، أخبرني وأتوقف. وإن أردت، أرسل لك عينة قصيرة بدون التزام.\n\n'+
    'رسالة 3 — إغلاق مهذب:\n'+
    'مرحباً [الاسم]، سأغلق الموضوع حتى لا أزعجك. إن احتجت '+s+' لاحقاً، هذا رابط عملي: [الرابط]. بالتوفيق في [المشروع].\n\n'+
    'قواعد التنفيذ:\n'+
    '• 15 رسالة مخصصة يومياً كحد أقصى.\n'+
    '• لا تنسخ نفس الرسالة للجميع؛ غيّر التفصيل الأول.\n'+
    '• تابع مرة واحدة بعد 48 ساعة، ثم أغلق.\n'+
    '• لا ترسل مرفقات ثقيلة في أول رسالة.';
}

function autoDeliveryText(){
  const s=autoService();
  return 'أسئلة قبل البدء:\n'+
    '1. ما الهدف من العمل؟ (بيع، ثقة، إطلاق، تحديث)\n'+
    '2. من الجمهور المستهدف؟\n'+
    '3. ما الملفات/المعلومات التي سترسلها؟\n'+
    '4. ما الموعد النهائي الحقيقي؟\n'+
    '5. من صاحب القرار ومن يراجع؟\n\n'+
    'خطوات التسليم:\n'+
    '1. استلم الملفات وسمّها بتاريخ واسم العميل.\n'+
    '2. أنجز نسخة أولى سريعة وأرسل معاينة.\n'+
    '3. اجمع الملاحظات في رسالة واحدة.\n'+
    '4. نفّذ مراجعتين كحد أقصى ثم أي تعديل إضافي بسعر واضح.\n'+
    '5. سلّم الملفات النهائية + نسخة خفيفة للمعاينة.\n'+
    '6. اكتب ما تم إنجازه وما لم يُنجز.\n'+
    '7. احتفظ بنسخة احتياطية 30 يوماً.\n\n'+
    'رسالة التسليم:\n'+
    'مرحباً [الاسم]، هذا تسليم '+s+'. تجد الملفات في [الرابط]. راجعت [ما راجعته] وتأكدت من [ما تأكدت منه]. إن كان هناك تعديل ضمن المراجعتين، أرسله في رسالة واحدة وسأنفذه. شكراً لثقتك.';
}

function autoPaymentText(){
  return 'بوابة الأمان — توقف قبل أي دفع:\n'+
    '• لن أطلب منك دفع أي مبلغ الآن.\n'+
    '• لا تدفع لأي جهة تضمن لك أرباحاً.\n'+
    '• لا تشترِ كورساً أو أداة قبل أن تربح أول 50$ من نفس المجال.\n'+
    '• أي دفع أو شراء يحتاج موافقتك الصريحة أولاً.\n\n'+
    'شروط الدفع المقترحة:\n'+
    '• 50% مقدماً للعملاء الجدد، و50% عند التسليم.\n'+
    '• استخدم منصة وسيطة (خمسات/مستقل/Upwork) أو فاتورة موثقة.\n'+
    '• لا تشارك بيانات بنكية حساسة في رسائل عادية.\n'+
    '• حدد ما يشمله السعر وما يحتاج دفعة إضافية.\n'+
    '• سياسة الإلغاء: قبل البدء يُسترد المقدم، بعد البدء يُحتسب العمل المنفذ.\n\n'+
    'قالب فاتورة:\n'+
    'العميل: [الاسم]\n'+
    'الخدمة: '+autoService()+'\n'+
    'السعر: '+fmt(autoPrice())+'\n'+
    'المدفوع: 50% = '+fmt(Math.round(autoPrice()/2))+'\n'+
    'المتبقي: '+fmt(autoPrice()-Math.round(autoPrice()/2))+' عند التسليم\n'+
    'التسليم: '+autoDaysText(autoDeliveryDays())+' عمل\n'+
    'ملاحظة: أي عمل خارج النطاق يُسعّر قبل التنفيذ.';
}

function autoFollowupText(){
  return 'بعد التسليم بيوم:\n'+
    'مرحباً [الاسم]، أطمئن فقط: هل وصلت الملفات وفتحت بشكل سليم؟ إن احتجت أي تعديل ضمن المراجعتين، أخبرني.\n\n'+
    'بعد 3 أيام — طلب تقييم:\n'+
    'مرحباً [الاسم]، سعيد بإنجاز '+autoService()+' معك. إن كانت التجربة جيدة، هل تكتب لي سطرين كتقييم؟ هذا يساعدني على الوصول لعملاء جدد.\n\n'+
    'بعد 14 يوم — عرض ترقية:\n'+
    'مرحباً [الاسم]، هل تحتاج دفعة جديدة من '+autoService()+' هذا الشهر؟ لعميل سابق، أستطيع تجهيز [باقة] بسعر [السعر] وتسليم أسرع.\n\n'+
    'طلب إحالة:\n'+
    'هل تعرف شخصاً واحداً يحتاج نفس الخدمة؟ أرسل لي اسمه فقط، وأتولى الباقي بأدب.\n\n'+
    'قاعدة: لا تطلب التقييم قبل التسليم، ولا تعرض ترقية قبل أن يرى النتيجة.';
}

function autoDailyText(){
  return 'خطة 7 أيام:\n\n'+
    'اليوم 1: ثبّت الخدمة والسعر، وافتح طريقة دفع.\n'+
    'اليوم 2: أنجز 3 نماذج أعمال وانشرها.\n'+
    'اليوم 3: اكتب قائمة 30 عميلاً محتملاً.\n'+
    'اليوم 4: أرسل 15 رسالة مخصصة أولى.\n'+
    'اليوم 5: أرسل 15 رسالة جديدة + تابع من لم يرد.\n'+
    'اليوم 6: أرسل 15 رسالة + انشر نموذجاً أو مقارنة.\n'+
    'اليوم 7: راجع الأرقام: من رد؟ من طلب سعراً؟ عدّل الرسالة والسعر.\n\n'+
    'مهام اليوم الثلاث:\n'+
    '1. جهّز/حدّث عرضك في 3 أسطر.\n'+
    '2. أرسل 5 رسائل مخصصة.\n'+
    '3. سجّل كل رد في قسم العملاء.\n\n'+
    'القاعدة: 15 تواصلاً يومياً أفضل من 100 رسالة مرة واحدة. التحويل الواقعي في البداية 5–15%.';
}

function autoDoneText(){
  const packs=autoPacks();
  return 'ملخص مشروعك:\n\n'+
    '• الخدمة: '+autoService()+'\n'+
    '• السعر الأساسي: '+fmt(autoPrice())+'\n'+
    '• الباقات: '+fmt(packs[0].price)+' / '+fmt(packs[1].price)+' / '+fmt(packs[2].price)+'\n'+
    '• الجمهور: '+autoAudience()+'\n'+
    '• القنوات: '+autoChannels().join('، ')+'\n'+
    '• 30 عميلاً محتملاً + 3 رسائل تواصل.\n'+
    '• خطة تسليم + بوابة دفع آمنة.\n'+
    '• متابعة وتقييم وعرض ترقية.\n'+
    '• خطة تنفيذ 7 أيام.\n\n'+
    'تذكير: لا يوجد ضمان للربح. النتيجة تعتمد على التنفيذ والسوق. ابدأ بأول 5 رسائل اليوم، وعدّل بناءً على الردود.';
}

function autoText(){
  const key=AUTO_STEPS[autoData().step].key;
  if(key==='research'){
    const c=autoCase();
    const cs=autoCases();
    if(!c)return 'لا توجد أمثلة محفوظة لهذه المهارة. ابدأ بالخدمة المقترحة: '+autoService();
    return 'مثال '+(autoCaseIndex()+1)+' من '+cs.length+': '+c.title+'\n'+
      c.who+' — '+c.service+'\n\n'+
      'النتيجة المعلنة: '+c.result+'\n\n'+
      'كيف فعلها:\n'+c.steps.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n\n'+
      'الدرس: '+c.lesson+'\n\n'+
      'المصدر: '+c.url+'\n\n'+
      'الخدمة المقترحة لك: '+autoService()+' بسعر '+fmt(autoPrice())+'.';
  }
  if(key==='offer')return autoOfferText();
  if(key==='portfolio')return autoPortfolioText();
  if(key==='leads')return autoLeadsText();
  if(key==='outreach')return autoOutreachText();
  if(key==='delivery')return autoDeliveryText();
  if(key==='payment')return autoPaymentText();
  if(key==='followup')return autoFollowupText();
  if(key==='daily')return autoDailyText();
  return autoDoneText();
}

function autoResearchHtml(){
  const c=autoCase();
  const cs=autoCases();
  const idx=autoCaseIndex();
  const service=esc(autoService());
  const search='https://www.google.com/search?q='+encodeURIComponent(autoService()+' case study freelancer');
  return '<div class="autoService"><span>الخدمة المقترحة</span><b>'+service+'</b><em>'+fmt(autoPrice())+'</em></div>'+
    (c?'<div class="autoCase"><div class="row"><span class="badge">مثال '+(idx+1)+' من '+cs.length+'</span><a class="mini" target="_blank" rel="noopener" href="'+esc(c.url)+'">المصدر ↗</a></div>'+
      '<h3>'+esc(c.title)+'</h3><p class="sub">'+esc(c.who)+' — '+esc(c.service)+'</p>'+
      '<div class="autoResult">'+esc(c.result)+'</div>'+
      '<ol>'+c.steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol>'+
      '<div class="tip"><b>الدرس:</b> '+esc(c.lesson)+'</div></div>':'')+
    '<div class="row" style="margin-top:8px"><a class="mini" target="_blank" rel="noopener" href="'+search+'">🔎 ابحث عن أمثلة أحدث</a></div>'+
    '<p class="hint">أمثلة منشورة علناً، ونتائجها كما ذكرها أصحابها. ليست وعداً بنفس النتيجة لك.</p>';
}

function autoActions(){
  const a=autoData();
  const st=AUTO_STEPS[a.step];
  const isDone=st.key==='done';
  let html='<div class="row autoActions">';
  html+='<button class="btn green" data-auto="'+(isDone?'reset':'next')+'">'+(isDone?'🔄 مشروع جديد':'✅ نعم — '+st.cta)+'</button>';
  if(!isDone)html+='<button class="btn ghost small" data-auto="no">❌ لا</button>';
  if(!isDone)html+='<button class="btn ghost small" data-auto="edit">✏️ غيّر</button>';
  if(st.key==='research')html+='<button class="btn ghost small" data-auto="case">🔁 مثال آخر</button>';
  html+='<button class="mini" data-auto="copy">نسخ</button>';
  if(isDone)html+='<button class="mini" data-go="home">🎯 لوحة المسار</button>';
  if(a.step>0&&!isDone)html+='<button class="mini" data-auto="prev">← السابق</button>';
  html+='<button class="mini" data-auto="stop">إيقاف</button>';
  html+='</div>';
  return html;
}

function autoEditHtml(){
  const a=autoData();
  const st=AUTO_STEPS[a.step];
  return '<div class="autoEdit"><label>اكتب التعديل</label>'+
    '<input id="autoEditInput" placeholder="مثال: السعر 40، أو الخدمة تحسين صور مطاعم، أو اجعل الرسالة أقصر">'+
    '<div class="row" style="margin-top:7px"><button class="btn small" data-auto="apply">تطبيق التعديل</button><button class="mini" data-auto="cancel">إلغاء</button></div>'+
    '<p class="hint">'+(st.key==='offer'?'إذا كتبت رقماً سأعتبره السعر الجديد، وأحفظ نص ملاحظتك.':'سأحفظ ملاحظتك مع هذه المرحلة وأعرضها لك.')+'</p></div>';
}

function autoNoteHtml(){
  const n=autoData().notes[AUTO_STEPS[autoData().step].key];
  return n?'<div class="tip" style="margin-top:8px"><b>📝 تعديلك:</b> '+esc(n)+'</div>':'';
}

function renderAuto(){
  const box=$('#autoCard');
  if(!box)return;
  const a=autoData();
  if(!a.active){
    const resume=a.step>0;
    box.innerHTML='<div class="row"><div style="flex:1;min-width:0"><h2>🚀 المرشد التلقائي</h2>'+
      '<p class="sub">أجهّز لك الخدمة والعرض والنماذج وقائمة العملاء والرسائل وخطة التنفيذ. أنت تقول فقط: نعم / لا / غيّر.</p></div>'+
      '<span class="badge green">جاهز</span></div>'+
      '<div class="autoPitch"><span>🔎 أمثلة حقيقية</span><span>💵 عرض وباقات</span><span>🎯 30 عميلاً</span><span>✉️ رسائل جاهزة</span><span>🔒 يتوقف قبل الدفع</span></div>'+
      '<button class="btn wide green" data-auto="start" style="margin-top:10px">'+(resume?'▶️ أكمل من المرحلة '+(a.step+1):'🚀 ابدأ مشروعي الآن')+'</button>'+
      (resume?'<button class="btn ghost wide" data-auto="reset" style="margin-top:7px">↺ ابدأ من جديد</button>':'')+
      '<p class="hint">لن أرسل رسائل أو أدفع نيابة عنك. سأجهّز كل شيء، وأتوقف قبل أي مبلغ أو قرار حساس لموافقتك.</p>';
    return;
  }
  const st=AUTO_STEPS[a.step];
  const pct=Math.round(((a.step+1)/AUTO_STEPS.length)*100);
  box.innerHTML='<div class="row"><div style="flex:1;min-width:0"><h2>'+st.icon+' '+st.title+'</h2>'+
    '<p class="sub">المرحلة '+(a.step+1)+' من '+AUTO_STEPS.length+' — '+esc(st.desc)+'</p></div>'+
    '<span class="badge">'+pct+'%</span></div>'+
    '<div class="progress"><i style="width:'+pct+'%"></i></div>'+
    '<div class="autoSteps">'+AUTO_STEPS.map((s,i)=>'<span class="'+(i<a.step?'done':i===a.step?'now':'')+'" title="'+esc(s.title)+'">'+s.icon+'</span>').join('')+'</div>'+
    (st.key==='research'?autoResearchHtml():'<div class="resultbox">'+esc(autoText())+'</div>')+
    autoNoteHtml()+
    (st.key==='payment'?'<div class="warn" style="margin-top:8px"><b>لن أدفع أي مبلغ الآن.</b> أي دفع أو شراء يحتاج موافقتك الصريحة أولاً.</div>':'')+
    (a.editing?autoEditHtml():'')+
    autoActions()+
    '<p class="hint">أنت توافق فقط. «نعم» يتابع، «لا» يعرض بديلاً أو يفتح التعديل، «غيّر» يعدّل هذه المرحلة. أي دفع أو إرسال مبلغ يتوقف حتى تأذن.</p>';
}

function autoScroll(){
  const el=$('#autoCard');
  if(!el)return;
  const head=document.querySelector('header');
  const offset=(head?head.offsetHeight:110)+8;
  window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-offset,behavior:'smooth'});
}

function autoStart(){
  const a=autoData();
  if(!a.active&&a.step===0){
    if(!a.service)a.service=autoService();
    if(!a.price)a.price=autoPrice();
  }
  a.active=true;
  save();
  switchView('mentor');
  renderAuto();
  setTimeout(autoScroll,60);
  toast('بدأ المرشد التلقائي');
}

function autoNext(){
  const a=autoData();
  if(a.step<AUTO_STEPS.length-1){
    a.step++;
    a.editing=false;
    save();
    renderAuto();
    setTimeout(autoScroll,40);
  }
}

function autoPrev(){
  const a=autoData();
  if(a.step>0){a.step--;a.editing=false;save();renderAuto();}
}

function autoNextCase(){
  const a=autoData();
  a.caseIndex=(Number(a.caseIndex)||0)+1;
  a.editing=false;
  save();
  renderAuto();
}

function autoEdit(){
  const a=autoData();
  a.editing=true;
  save();
  renderAuto();
  setTimeout(()=>{const el=$('#autoEditInput');if(el)el.focus();},40);
}

function autoCancelEdit(){
  autoData().editing=false;
  save();
  renderAuto();
}

function autoReject(){
  const a=autoData();
  if(AUTO_STEPS[a.step].key==='research'&&autoCases().length>1){autoNextCase();toast('هذا مثال آخر');return;}
  a.editing=true;
  save();
  renderAuto();
  setTimeout(()=>{const el=$('#autoEditInput');if(el){el.placeholder='اكتب ما لا يعجبك أو البديل الذي تريده';el.focus();}},40);
  toast('اكتب البديل وسأحفظه مع هذه المرحلة');
}

function autoApplyEdit(){
  const el=$('#autoEditInput');
  const text=el?el.value.trim():'';
  const a=autoData();
  const key=AUTO_STEPS[a.step].key;
  if(text){
    const num=text.match(/(\d+)/);
    if(key==='research')a.service=text;
    else if(key==='offer'&&num){
      a.price=Math.max(1,Number(num[1]));
      const note=text.replace(/[0-9٠-٩$]/g,'').replace(/السعر|سعر|بسعر|دولار|ريال|درهم|إلى|الى/g,'').trim();
      if(note)a.notes.offer=text;else delete a.notes.offer;
    }
    else a.notes[key]=text;
  }
  a.editing=false;
  save();
  renderAuto();
  toast(text?'تم تطبيق التعديل':'لم يتم تغيير شيء');
}

function autoCopy(){
  copyText(autoText());
}

function autoStop(){
  autoData().active=false;
  save();
  renderAuto();
  toast('أوقفنا مؤقتاً — يمكنك المتابعة من نفس المرحلة');
}

function autoReset(){
  state.auto=autoDefault();
  save();
  renderAuto();
  toast('بدأنا من جديد');
}

function bindAuto(){
  const box=$('#autoCard');
  if(!box)return;
  box.addEventListener('click',e=>{
    const b=e.target.closest('[data-auto]');
    if(!b)return;
    const act=b.dataset.auto;
    if(act==='start')autoStart();
    else if(act==='next')autoNext();
    else if(act==='prev')autoPrev();
    else if(act==='case')autoNextCase();
    else if(act==='no')autoReject();
    else if(act==='edit')autoEdit();
    else if(act==='cancel')autoCancelEdit();
    else if(act==='apply')autoApplyEdit();
    else if(act==='copy')autoCopy();
    else if(act==='stop')autoStop();
    else if(act==='reset')autoReset();
  });
  box.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&e.target.id==='autoEditInput'){e.preventDefault();autoApplyEdit();}
  });
}
