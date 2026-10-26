const studio={img:null,name:'',preset:'product',settings:{},auto:{wb:true,levels:true},compare:55,busy:false,timer:null,detectTimer:null};

const WORK_HINTS=[
  {preset:'product',words:['منتج','منتجات','متجر','كريم','عطر','ساعه','ساعة','حقيبه','حقيبة','طعام','قهوه','قهوة','ملابس','product','ecommerce','packshot','shop']},
  {preset:'portrait',words:['شخص','شخصي','بورتريه','سيلفي','وجه','بروفايل','بورترية','portrait','selfie','profile','avatar']},
  {preset:'social',words:['انستقرام','إنستقرام','تيك','تويتر','منشور','ستوري','سوشيال','اعلان','إعلان','social','instagram','tiktok','post','story']},
  {preset:'print',words:['لوجو','شعار','طباعه','طباعة','بروشور','بوستر','ملصق','كارته','print','logo','banner','flyer','poster']},
  {preset:'restore',words:['قديم','ترميم','تالف','ممسوح','باهت','restore','old','scan']}
];

function normalizeAr(s){
  return String(s||'').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/[ىي]/g,'ي').replace(/[\u064B-\u0652]/g,'');
}

function studioDetect(text){
  const n=normalizeAr(text);
  if(!n.trim())return null;
  for(const h of WORK_HINTS){
    for(const w of h.words){
      if(n.includes(normalizeAr(w)))return h.preset;
    }
  }
  return null;
}

function studioRenderPresets(){
  const el=$('#stPresets');if(!el)return;
  el.innerHTML=Object.entries(PRESETS).map(([k,p])=>`<button type="button" class="preset ${studio.preset===k?'active':''}" data-preset="${k}">${p.icon} ${p.label}</button>`).join('');
}

function studioSyncControls(){
  const s=studio.settings;
  const set=(id,val,out)=>{const el=$('#'+id);if(el)el.value=val;const o=$('#'+out);if(o)o.textContent=val;};
  set('stSharpen',s.sharpen,'stSharpenOut');
  set('stDenoise',s.denoise,'stDenoiseOut');
  set('stBrightness',s.brightness,'stBrightnessOut');
  set('stContrast',s.contrast,'stContrastOut');
  set('stSaturation',s.saturation,'stSaturationOut');
  set('stWarmth',s.warmth,'stWarmthOut');
  const sc=$('#stScale');if(sc)sc.value=String(s.scale);
  const p=PRESETS[studio.preset];
  const info=$('#stPresetInfo');
  if(info)info.textContent=p.icon+' '+p.label;
  const tip=$('#stTip');if(tip)tip.textContent=p.tip;
  studioRenderPresets();
}

function studioReadControls(){
  const num=id=>Number($('#'+id)?.value)||0;
  const s=studio.settings;
  s.sharpen=num('stSharpen');
  s.denoise=num('stDenoise');
  s.brightness=num('stBrightness');
  s.contrast=num('stContrast');
  s.saturation=num('stSaturation');
  s.warmth=num('stWarmth');
  s.scale=Number($('#stScale')?.value)||1;
  ['stSharpen','stDenoise','stBrightness','stContrast','stSaturation','stWarmth'].forEach(id=>{
    const o=$('#'+id+'Out');if(o)o.textContent=$('#'+id).value;
  });
  const q=$('#stQuality');if(q){const qo=$('#stQualityOut');if(qo)qo.textContent=q.value;}
}

function studioApplyPreset(key,opts){
  const p=PRESETS[key]||PRESETS.product;
  studio.preset=key;
  studio.settings={sharpen:p.sharpen,denoise:p.denoise,brightness:p.brightness,contrast:p.contrast,saturation:p.saturation,warmth:p.warmth,scale:p.scale};
  studio.auto={wb:!!p.wb,levels:!!p.levels};
  studioSyncControls();
  if(studio.img){
    studioRender();
    if(opts&&opts.announce)toast('تم اختيار إعداد: '+p.label);
  }
}

function studioSchedule(){
  clearTimeout(studio.timer);
  studio.timer=setTimeout(()=>studioRender(),150);
}

function grayWorld(d,w,h){
  let sr=0,sg=0,sb=0,n=0;
  const step=Math.max(1,Math.floor((w*h)/40000));
  for(let i=0;i<w*h;i+=step){
    const o=i*4;sr+=d[o];sg+=d[o+1];sb+=d[o+2];n++;
  }
  if(!n)return;
  const mr=sr/n,mg=sg/n,mb=sb/n,avg=(mr+mg+mb)/3;
  if(avg<1)return;
  const fr=clamp(avg/Math.max(1,mr),0.75,1.35);
  const fg=clamp(avg/Math.max(1,mg),0.75,1.35);
  const fb=clamp(avg/Math.max(1,mb),0.75,1.35);
  for(let i=0;i<d.length;i+=4){d[i]*=fr;d[i+1]*=fg;d[i+2]*=fb;}
}

function autoLevels(d,w,h){
  const hist=new Uint32Array(256);
  const n=w*h;
  for(let i=0;i<n;i++){
    const o=i*4;
    const l=(d[o]*0.299+d[o+1]*0.587+d[o+2]*0.114)|0;
    hist[l<0?0:l>255?255:l]++;
  }
  const low=n*0.01,high=n*0.99;
  let acc=0,lo=0,hi=255;
  for(let i=0;i<256;i++){acc+=hist[i];if(acc>=low){lo=i;break;}}
  acc=0;
  for(let i=255;i>=0;i--){acc+=hist[i];if(acc>=n-high){hi=i;break;}}
  if(hi-lo<12)return;
  const lut=new Uint8Array(256);
  const scale=255/(hi-lo);
  const off=-lo*scale;
  let mean=0;
  for(let i=0;i<256;i++){
    lut[i]=clamp(i*scale+off,0,255);
    mean+=i*hist[i];
  }
  mean/=n;
  let projected=0;
  for(let i=0;i<256;i++)projected+=lut[i]*hist[i];
  projected/=n;
  const target=clamp(mean*1.06+6,0,250);
  if(projected>2&&projected<253){
    const gamma=Math.log(target/255)/Math.log(clamp(projected/255,0.02,0.98));
    if(isFinite(gamma)&&gamma>0.2&&gamma<5){
      for(let i=0;i<256;i++)lut[i]=clamp(255*Math.pow(lut[i]/255,gamma),0,255);
    }
  }
  for(let i=0;i<d.length;i+=4){
    d[i]=lut[d[i]];
    d[i+1]=lut[d[i+1]];
    d[i+2]=lut[d[i+2]];
  }
}

function applyTone(d,st){
  const bright=(Number(st.brightness)||0)*2.2;
  const contrast=(Number(st.contrast)||100)/100;
  const sat=(Number(st.saturation)||100)/100;
  const warm=(Number(st.warmth)||0)*0.9;
  for(let i=0;i<d.length;i+=4){
    let r=(d[i]-128)*contrast+128+bright+warm;
    let g=(d[i+1]-128)*contrast+128+bright;
    let b=(d[i+2]-128)*contrast+128+bright-warm;
    const lum=0.299*r+0.587*g+0.114*b;
    r=lum+(r-lum)*sat;
    g=lum+(g-lum)*sat;
    b=lum+(b-lum)*sat;
    d[i]=r;d[i+1]=g;d[i+2]=b;
  }
}

function boxBlur(data,w,h,r){
  if(r<1)return new Uint8ClampedArray(data);
  const tmp=new Uint8ClampedArray(data.length);
  const out=new Uint8ClampedArray(data.length);
  const win=2*r+1;
  for(let y=0;y<h;y++){
    const row=y*w*4;
    let sr=0,sg=0,sb=0;
    for(let k=-r;k<=r;k++){
      const x=Math.min(w-1,Math.max(0,k))*4+row;
      sr+=data[x];sg+=data[x+1];sb+=data[x+2];
    }
    for(let x=0;x<w;x++){
      const o=row+x*4;
      tmp[o]=sr/win;tmp[o+1]=sg/win;tmp[o+2]=sb/win;tmp[o+3]=data[o+3];
      const xo=Math.min(w-1,Math.max(0,x-r))*4+row;
      const xi=Math.min(w-1,Math.max(0,x+r+1))*4+row;
      sr+=data[xi]-data[xo];sg+=data[xi+1]-data[xo+1];sb+=data[xi+2]-data[xo+2];
    }
  }
  for(let x=0;x<w;x++){
    const col=x*4;
    let sr=0,sg=0,sb=0;
    for(let k=-r;k<=r;k++){
      const y=Math.min(h-1,Math.max(0,k));
      const i=y*w*4+col;
      sr+=tmp[i];sg+=tmp[i+1];sb+=tmp[i+2];
    }
    for(let y=0;y<h;y++){
      const o=y*w*4+col;
      out[o]=sr/win;out[o+1]=sg/win;out[o+2]=sb/win;out[o+3]=tmp[o+3];
      const yo=Math.min(h-1,Math.max(0,y-r))*w*4+col;
      const yi=Math.min(h-1,Math.max(0,y+r+1))*w*4+col;
      sr+=tmp[yi]-tmp[yo];sg+=tmp[yi+1]-tmp[yo+1];sb+=tmp[yi+2]-tmp[yo+2];
    }
  }
  return out;
}

function blendWith(d,src,amount){
  const a=clamp(amount,0,1);
  if(a<=0)return;
  for(let i=0;i<d.length;i+=4){
    d[i]=d[i]*(1-a)+src[i]*a;
    d[i+1]=d[i+1]*(1-a)+src[i+1]*a;
    d[i+2]=d[i+2]*(1-a)+src[i+2]*a;
  }
}

function unsharp(d,blur,amount){
  const a=amount;
  for(let i=0;i<d.length;i+=4){
    d[i]=d[i]+(d[i]-blur[i])*a;
    d[i+1]=d[i+1]+(d[i+1]-blur[i+1])*a;
    d[i+2]=d[i+2]+(d[i+2]-blur[i+2])*a;
  }
}

function studioEnhance(imgData,w,h,st,auto){
  const d=imgData.data;
  if(auto.wb)grayWorld(d,w,h);
  if(auto.levels)autoLevels(d,w,h);
  applyTone(d,st);
  const den=Number(st.denoise)||0;
  if(den>0){
    const r=clamp(Math.round(den/35),1,3);
    const blur=boxBlur(d,w,h,r);
    blendWith(d,blur,Math.min(0.9,den/100*0.9));
  }
  const sh=Number(st.sharpen)||0;
  if(sh>0){
    const blur=boxBlur(d,w,h,1);
    unsharp(d,blur,sh/100*1.5);
  }
}

function studioCrop(){
  const src=studio.img;
  let sx=0,sy=0,sw=src.naturalWidth,sh=src.naturalHeight;
  if(studio.preset==='social'){
    const side=Math.min(sw,sh);
    sx=(sw-side)/2;sy=(sh-side)/2;sw=side;sh=side;
  }
  return {sx,sy,sw,sh};
}

function studioProcess(maxDim){
  const src=studio.img;
  if(!src)return null;
  const st=studio.settings;
  const crop=studioCrop();
  let tw=Math.round(crop.sw*(st.scale||1));
  let th=Math.round(crop.sh*(st.scale||1));
  const cap=Math.min(1,maxDim/Math.max(tw,th));
  tw=Math.max(1,Math.round(tw*cap));
  th=Math.max(1,Math.round(th*cap));
  const cv=document.createElement('canvas');
  cv.width=tw;cv.height=th;
  const ctx=cv.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(src,crop.sx,crop.sy,crop.sw,crop.sh,0,0,tw,th);
  const data=ctx.getImageData(0,0,tw,th);
  studioEnhance(data,tw,th,st,studio.auto);
  ctx.putImageData(data,0,0);
  return cv;
}

function studioRender(){
  if(!studio.img)return;
  const cv=$('#stCanvas'),before=$('#stBefore');
  if(!cv||!before)return;
  const out=studioProcess(1500);
  cv.width=out.width;cv.height=out.height;
  cv.getContext('2d').drawImage(out,0,0);
  const crop=studioCrop();
  before.width=out.width;before.height=out.height;
  const bctx=before.getContext('2d');
  bctx.imageSmoothingEnabled=true;
  bctx.imageSmoothingQuality='high';
  bctx.drawImage(studio.img,crop.sx,crop.sy,crop.sw,crop.sh,0,0,out.width,out.height);
  const pct=studio.compare;
  $('#stBeforeWrap').style.clipPath='inset(0 '+(100-pct)+'% 0 0)';
  $('#stCompareOut').textContent=pct+'%';
  $('#stEmpty').classList.add('hidden');
  $('#stCompareWrap').classList.remove('hidden');
  const exportCap=4096;
  const src=studio.img;
  const fullW=Math.round(crop.sw*(studio.settings.scale||1));
  const fullH=Math.round(crop.sh*(studio.settings.scale||1));
  const cap=Math.min(1,exportCap/Math.max(fullW,fullH));
  $('#stSourceInfo').textContent=`الأصل: ${src.naturalWidth}×${src.naturalHeight} · المعاينة: ${out.width}×${out.height} · التصدير: ${Math.round(fullW*cap)}×${Math.round(fullH*cap)}`;
}

function studioLoadImage(img,name){
  studio.img=img;
  studio.name=name||'image';
  const detected=studioDetect(name);
  const work=$('#stWork');
  const typed=work?work.value.trim():'';
  const typedPreset=typed?studioDetect(typed):null;
  if(!typed&&detected&&work)work.value=PRESETS[detected].label;
  studioApplyPreset(typedPreset||detected||studio.preset);
  studioRender();
}

function studioLoadFile(file){
  if(!file)return;
  if(file.type&&!file.type.startsWith('image/')){toast('هذا الملف ليس صورة');return;}
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);studioLoadImage(img,file.name||'image');};
  img.onerror=()=>{URL.revokeObjectURL(url);toast('تعذر قراءة الصورة');};
  img.src=url;
}

function studioLoadDataURL(src,name){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{studioLoadImage(img,name||'image');resolve({w:img.naturalWidth,h:img.naturalHeight});};
    img.onerror=()=>reject(new Error('bad image'));
    img.src=src;
  });
}

async function studioDownload(){
  if(!studio.img){toast('حمّل صورة أولاً');return;}
  const btn=$('#stDownload');
  const old=btn.textContent;
  btn.disabled=true;btn.textContent='⏳ جارٍ المعالجة…';
  await new Promise(r=>setTimeout(r,30));
  try{
    let out=studioProcess(4096);
    const fmt=$('#stFormat').value;
    const q=Number($('#stQuality').value)/100;
    if(fmt==='image/jpeg'){
      const flat=document.createElement('canvas');
      flat.width=out.width;flat.height=out.height;
      const fx=flat.getContext('2d');
      fx.fillStyle='#ffffff';
      fx.fillRect(0,0,flat.width,flat.height);
      fx.drawImage(out,0,0);
      out=flat;
    }
    const blob=await new Promise(res=>out.toBlob(res,fmt,q));
    if(!blob)throw new Error('blob');
    const ext=fmt==='image/png'?'png':fmt==='image/webp'?'webp':'jpg';
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='maksab-'+studio.preset+'-'+out.width+'x'+out.height+'.'+ext;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),8000);
    toast('تم التصدير '+out.width+'×'+out.height);
  }catch(e){
    toast('تعذر التصدير — جرّب صورة أصغر أو صيغة أخرى');
  }finally{
    btn.disabled=false;btn.textContent=old;
  }
}

function bindStudio(){
  studioApplyPreset('product');
  studioRenderPresets();
  const drop=$('#stDrop'),file=$('#stFile');
  drop.addEventListener('click',()=>file.click());
  file.addEventListener('change',e=>{studioLoadFile(e.target.files&&e.target.files[0]);file.value='';});
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
  drop.addEventListener('drop',e=>{
    const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
    if(f)studioLoadFile(f);
  });
  document.addEventListener('paste',e=>{
    if(!$('#view-studio').classList.contains('active'))return;
    const items=e.clipboardData&&e.clipboardData.items;
    if(!items)return;
    for(const it of items){
      if(it.type&&it.type.startsWith('image/')){studioLoadFile(it.getAsFile());break;}
    }
  });
  $('#stPresets').addEventListener('click',e=>{
    const b=e.target.closest('[data-preset]');
    if(b)studioApplyPreset(b.dataset.preset,{announce:true});
  });
  $('#stDetect').addEventListener('click',()=>{
    const text=($('#stWork').value||'')+' '+(studio.name||'');
    const key=studioDetect(text);
    if(!key){toast('لم أتعرف على النوع — اختر إعداداً يدوياً');return;}
    studioApplyPreset(key,{announce:true});
    if(!$('#stWork').value.trim())$('#stWork').value=PRESETS[key].label;
  });
  $('#stWork').addEventListener('input',()=>{
    clearTimeout(studio.detectTimer);
    studio.detectTimer=setTimeout(()=>{
      const key=studioDetect($('#stWork').value);
      if(key&&key!==studio.preset)studioApplyPreset(key);
    },350);
  });
  ['stSharpen','stDenoise','stBrightness','stContrast','stSaturation','stWarmth','stQuality'].forEach(id=>{
    $('#'+id).addEventListener('input',()=>{studioReadControls();studioSchedule();});
  });
  $('#stScale').addEventListener('change',()=>{studioReadControls();studioRender();});
  $('#stCompare').addEventListener('input',e=>{
    studio.compare=Number(e.target.value);
    $('#stBeforeWrap').style.clipPath='inset(0 '+(100-studio.compare)+'% 0 0)';
    $('#stCompareOut').textContent=studio.compare+'%';
  });
  $('#stAuto').addEventListener('click',()=>{
    studio.auto={wb:true,levels:true};
    studioApplyPreset(studio.preset);
    studioRender();
    toast('تحسين تلقائي: توازن أبيض + مستويات');
  });
  $('#stReset').addEventListener('click',()=>{
    studioApplyPreset(studio.preset);
    studioRender();
    toast('أُعيد ضبط إعدادات '+PRESETS[studio.preset].label);
  });
  $('#stDownload').addEventListener('click',studioDownload);
  studio.settings={sharpen:55,denoise:12,brightness:2,contrast:108,saturation:112,warmth:2,scale:2};
  studioSyncControls();
  window.maksabStudio={loadDataURL:studioLoadDataURL,process:studioProcess,state:studio,detect:studioDetect,download:studioDownload};
}
