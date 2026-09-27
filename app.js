"use strict";
/* db.js を先に読み込んでいる前提 */

/* ══════════════════════════════════════════════════════════
   定数
   ══════════════════════════════════════════════════════════ */
const GRINDERS_BUILTIN = {
  "fellow_opus":    {name:"Fellow Opus",       min:1, max:11, step:0.25, default:5},
  "timemore_xlite": {name:"Timemore X Lite",   min:3, max:24, step:0.5,  default:14},
  "comandante_c40": {name:"Comandante C40",    min:0, max:45, step:1,    default:25},
  "1zpresso_jxpro": {name:"1Zpresso JX-Pro",   min:0, max:40, step:1,    default:15},
  "niche_zero":     {name:"Niche Zero",        min:0, max:50, step:1,    default:15},
  "eureka_mignon":  {name:"Eureka Mignon",     min:0, max:18, step:0.5,  default:5}
};
function getGRINDERS(){
  const custom = db.getCustomGrinders();
  const obj = {...GRINDERS_BUILTIN};
  custom.forEach(g=>{obj["custom_"+g.id]={name:g.name,min:g.min,max:g.max,step:g.step||1,default:Math.round((g.min+g.max)/2),custom:true,id:g.id};});
  obj["other"] = {name:"その他",min:1,max:40,step:1,default:15};
  return obj;
}

const MACH_DEF = ["Flair 58","Flair Pro 2","La Pavoni","Gaggia Classic Pro","Breville Barista Express","Rancilio Silvia","De'Longhi Dedica","Cafelat Robot","9Barista","Decent DE1"];
const TAMP_DEF = ["Spring Tamper（定圧）","Manual","Normcore V4","Force Tamper"];
const MILK_T = ["牛乳","低脂肪乳","オーツミルク","ソイミルク","アーモンドミルク","その他"];
const ART_T  = ["Heart","Rosetta","Tulip","Leaf","Swan","Free Pour","Layered","その他"];

const PROCS = ["Washed","Natural","Honey","Anaerobic","Carbonic Maceration","Wet Hulled","Other"];
const ROAST_LEVELS = ["浅煎り","中煎り","中深煎り","深煎り"];
const FLAGS = {"エチオピア":"🇪🇹","ケニア":"🇰🇪","コロンビア":"🇨🇴","ブラジル":"🇧🇷","グアテマラ":"🇬🇹","コスタリカ":"🇨🇷","パナマ":"🇵🇦","インドネシア":"🇮🇩","ルワンダ":"🇷🇼","タンザニア":"🇹🇿","ホンジュラス":"🇭🇳","ペルー":"🇵🇪","メキシコ":"🇲🇽","イエメン":"🇾🇪","ニカラグア":"🇳🇮","ボリビア":"🇧🇴","エルサルバドル":"🇸🇻","中国":"🇨🇳","インド":"🇮🇳","ベトナム":"🇻🇳"};

/* エスプレッソは 5 軸（酸味・甘味・苦味・ボディ・後味） */
const TASTE = [
  {k:"acidity",    l:"酸味",   e:"🍋"},
  {k:"sweetness",  l:"甘味",   e:"🍯"},
  {k:"bitterness", l:"苦味",   e:"🫘"},
  {k:"body",       l:"ボディ", e:"☕"},
  {k:"aftertaste", l:"後味",   e:"✨"}
];
const RADAR = [{k:"overall",l:"おいしさ"}, ...TASTE.map(t=>({k:t.k,l:t.l}))];

/* フレーバーカテゴリ（BrewLog と共通の設計） */
const FLAVORS = [
  {cat:"フルーティ",   tags:["ベリー","柑橘","りんご","ドライフルーツ","トロピカル"]},
  {cat:"甘味",         tags:["チョコレート","キャラメル","蜂蜜","ブラウンシュガー"]},
  {cat:"ナッツ・穀物", tags:["ナッツ","アーモンド","シリアル"]},
  {cat:"花・ハーブ",   tags:["フローラル","ジャスミン","紅茶"]},
  {cat:"スパイス",     tags:["シナモン","スパイシー"]},
  {cat:"その他",       tags:["ワイン","スモーキー","アーシー"]}
];

/* 選択肢リスト */
const DOSES     = Array.from({length:17},(_,i)=>+(14+i*0.5).toFixed(1));  /* 14.0〜22.0g */
const YIELDS    = Array.from({length:41},(_,i)=>20+i);                    /* 20〜60g */
const PRESSURES = Array.from({length:19},(_,i)=>+(3+i*0.5).toFixed(1));   /* 3.0〜12.0bar */
const TIMES     = Array.from({length:36},(_,i)=>15+i);                    /* 15〜50秒 */
const TAMP_P    = Array.from({length:21},(_,i)=>10+i);                    /* 10〜30kg */
const ESP_ML    = Array.from({length:41},(_,i)=>20+i);                    /* 20〜60ml */
const MILK_ML   = [50,60,70,80,90,100,110,120,130,140,150,160,170,180,200,220,240,260,280,300,350,400];

/* ══════════════════════════════════════════════════════════
   ヘルパー
   ══════════════════════════════════════════════════════════ */
function beanName(b){const p=[];if(b.country)p.push(b.country);if(b.name?.trim()){p.push(b.name);return p.join(" / ");}if(b.farm)p.push(b.farm);if(b.process)p.push(`(${b.process})`);return p.length?p.join(" / "):"（名称未設定）";}
function beanFlag(b){return FLAGS[b.country]||(b.country?"🌍":"");}
function fmtDate(iso){const d=new Date(iso);return`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function h(tag,props,...ch){const el=document.createElement(tag);if(props)Object.entries(props).forEach(([k,v])=>{if(k==="style"&&typeof v==="object")Object.assign(el.style,v);else if(k.startsWith("on"))el.addEventListener(k.slice(2).toLowerCase(),v);else if(k==="className")el.className=v;else if(k==="innerHTML")el.innerHTML=v;else el.setAttribute(k,v);});ch.flat(9).forEach(c=>{if(c==null||c===false)return;el.appendChild(typeof c==="string"||typeof c==="number"?document.createTextNode(c):c);});return el;}
function sel(opts,val,onChange,cls="sel"){const w=h("div",{className:"sel-wrap"},h("select",{className:cls,value:val,onChange:e=>onChange(e.target.value)},...opts.map(o=>Object.assign(h("option",{value:o},o===""?"—":o),{selected:String(o)===String(val)}))),h("span",{className:"sel-arr"},"▼"));return w;}

/* 星（汎用・サイズ指定可） */
function starsSVG(v,size=22){const r=Math.round(v*2)/2;const d="M10 1 L12.6 7.3 L19.5 7.8 L14.2 12.3 L15.8 19 L10 15.3 L4.2 19 L5.8 12.3 L0.5 7.8 L7.4 7.3 Z";let s="";for(let i=1;i<=5;i++){if(r>=i)s+=`<svg width="${size}" height="${size}" viewBox="0 0 20 20"><path d="${d}" fill="#c8956c"/></svg>`;else if(r>=i-0.5)s+=`<svg width="${size}" height="${size}" viewBox="0 0 20 20"><defs><linearGradient id="hg${i}_${size}"><stop offset="50%" stop-color="#c8956c"/><stop offset="50%" stop-color="rgba(200,149,108,0.2)"/></linearGradient></defs><path d="${d}" fill="url(#hg${i}_${size})"/></svg>`;else s+=`<svg width="${size}" height="${size}" viewBox="0 0 20 20"><path d="${d}" fill="rgba(200,149,108,0.2)"/></svg>`;}return s;}

/* レーダー */
function radarSVG(data,size=180){const cx=size/2,cy=size/2,r=size/2-28,lv=5,n=RADAR.length,st=2*Math.PI/n,sa=-Math.PI/2;const pt=(i,v)=>{const a=sa+i*st,d=v/lv*r;return[cx+d*Math.cos(a),cy+d*Math.sin(a)];};let svg=`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;for(let l=1;l<=lv;l++){const ps=Array.from({length:n},(_,i)=>pt(i,l));svg+=`<path d="${ps.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' ')} Z" fill="none" stroke="rgba(200,149,108,0.12)" stroke-width="${l===lv?1:0.5}"/>`;}for(let i=0;i<n;i++){const p=pt(i,lv);svg+=`<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="rgba(200,149,108,0.1)" stroke-width="0.5"/>`;}const dp=RADAR.map((a,i)=>pt(i,data[a.k]||0));svg+=`<path d="${dp.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' ')} Z" fill="rgba(200,149,108,0.2)" stroke="#c8956c" stroke-width="1.5"/>`;dp.forEach(p=>{svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#c8956c"/>`;});RADAR.forEach((a,i)=>{const an=sa+i*st,d=r+18;svg+=`<text x="${cx+d*Math.cos(an)}" y="${cy+d*Math.sin(an)}" text-anchor="middle" dominant-baseline="middle" style="font-size:10px;fill:#8a7b6e">${a.l}</text>`;});svg+=`</svg>`;return svg;}

/* 音声入力 */
function startVoice(cb){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert("音声入力非対応");return null;}const r=new SR();r.lang="ja-JP";r.continuous=false;r.interimResults=false;r.onresult=e=>{cb(e.results[0][0].transcript);};return r;}

/* 写真圧縮（長辺800px, JPEG 0.72） */
function compressPhoto(file){return new Promise(res=>{const fr=new FileReader();fr.onload=e=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas");let w=img.width,ht=img.height;if(w>800){ht=ht*800/w;w=800;}c.width=w;c.height=ht;c.getContext("2d").drawImage(img,0,0,w,ht);res(c.toDataURL("image/jpeg",0.72));};img.src=e.target.result;};fr.readAsDataURL(file);});}

/* AI パーサー（日本語日付・標高ハイフン範囲対応） */
function parseAI(text){const res={name:"",country:"",farm:"",altitude:"",process:"",shop:"",roast:"",roastDate:""};const PM=PROCS,RL=ROAST_LEVELS;text.split("\n").map(l=>l.replace(/^[・\-*•]\s*/,"").trim()).filter(Boolean).forEach(line=>{const lo=line.toLowerCase(),val=line.replace(/^[^:：]+[:：]\s*/,"").trim();if(!val||"—-不明なしN/A".includes(val))return;if(lo.match(/豆の名前|豆名|名前|name/))res.name=val;else if(lo.match(/生産国|国|country|origin/))res.country=val;else if(lo.match(/農園|ファーム|farm|estate|農協|ステーション/))res.farm=val;else if(lo.match(/標高|altitude|elevation|masl/)){const rng=val.match(/(\d{3,5})\s*[-~〜]\s*\d{3,5}/);if(rng){res.altitude=rng[1];}else{const n=val.match(/\d{3,5}/);if(n)res.altitude=n[0];}}else if(lo.match(/精製|プロセス|process|processing/)){const m=PM.find(p=>val.toLowerCase().includes(p.toLowerCase()));res.process=m||val;}else if(lo.match(/購入店|販売元|店|ロースター|roaster|shop/))res.shop=val;else if(lo.match(/焙煎度|roast level|roast degree/)){const m=RL.find(r=>val.includes(r));res.roast=m||val;}else if(lo.match(/焙煎日|roast date/)){const jp=val.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);if(jp){res.roastDate=`${jp[1]}-${jp[2].padStart(2,"0")}-${jp[3].padStart(2,"0")}`;return;}const dm=val.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);if(dm)res.roastDate=`${dm[1]}-${dm[2].padStart(2,"0")}-${dm[3].padStart(2,"0")}`;}});return res;}

/* ══════════════════════════════════════════════════════════
   State
   ══════════════════════════════════════════════════════════ */
const FONT_SIZES={S:{label:"小",base:13},M:{label:"中",base:15},L:{label:"大",base:17}};
let state={
  /* 永続データ */
  records: db.getRecords(),
  beans: db.getBeans(),
  equip: db.getEquip(),
  machines: db.getMachines(),
  tampers: db.getTampers(),
  fontSize: db.getFontSize(),
  /* UI状態 */
  view:"list", brew:null,
  showTaste:false, showFlavors:false,
  addingBean:false, addingGrinder:false, addingMachine:false, addingTamper:false,
  showBeanList:false, showBeanDetail:false, showBeanName:false,
  viewingBean:null, editingBean:null,
  aiOpen:false, aiCopied:null, aiPaste:"", aiResult:null,
  expandedCard:null, trendBeanId:null, trendTooltip:null, trendOpen:false,
  photoData:null, _editSave:null,
  _newGrinder:null, _newMachine:"", _newTamper:"", _newBean:null
};
function initBrew(){
  const e=state.equip;const G=getGRINDERS();
  let gid=e.grinderId;if(!G[gid])gid="fellow_opus";const g=G[gid];
  return{beanId:"",grinderId:gid,machine:e.machine||"",tamper:e.tamper||"",grind:g.default,tampPressure:15,
    dose:18,yield:36,pressure:9,timeSec:28,
    milkType:"牛乳",espressoMl:30,milkMl:180,
    artType:"",artOther:"",artScore:3,
    overall:3,acidity:0,sweetness:0,bitterness:0,body:0,aftertaste:0,
    flavors:[],flavorNote:"",note:""};
}
state.brew=initBrew();
function save(){db.saveRecords(state.records);db.saveBeans(state.beans);db.saveEquip(state.equip);db.saveMachines(state.machines);db.saveTampers(state.tampers);}

/* ══════════════════════════════════════════════════════════
   ルートレンダー
   ══════════════════════════════════════════════════════════ */
function render(){
  const app=document.getElementById("app");app.innerHTML="";
  const fs=FONT_SIZES[state.fontSize]||FONT_SIZES.M;app.style.fontSize=fs.base+"px";
  /* Header */
  const header=h("div",{className:"header"});
  header.appendChild(h("h1",null,"EspressoLog"));
  header.appendChild(h("p",null,"ESPRESSO & LATTE JOURNAL"));
  const sizeToggle=h("div",{style:{display:"flex",justifyContent:"center",gap:4,marginTop:"8px"}});
  Object.keys(FONT_SIZES).forEach(k=>{sizeToggle.appendChild(h("button",{style:{background:state.fontSize===k?"rgba(200,149,108,0.25)":"rgba(200,149,108,0.08)",border:`1px solid ${state.fontSize===k?"rgba(200,149,108,0.4)":"rgba(200,149,108,0.1)"}`,borderRadius:6,padding:"3px 10px",color:state.fontSize===k?"#ede4da":"#6b5a4e",fontSize:"12px",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{state.fontSize=k;db.saveFontSize(k);render();}},FONT_SIZES[k].label));});
  header.appendChild(sizeToggle);
  app.appendChild(header);
  /* Tabs */
  const tabs=h("div",{className:"tabs"},
    h("button",{className:"tab"+(state.view==="list"?" active":""),onClick:()=>{state.view="list";render();}},"履歴"),
    h("button",{className:"tab"+(state.view==="add"?" active":""),onClick:()=>{state.view="add";render();}},"＋ 記録する"));
  app.appendChild(tabs);
  state.view==="add"?renderForm(app):renderList(app);
}

/* ══════════════════════════════════════════════════════════
   挽き目スライダー（グラインダー変更時に部分差し替え）
   ══════════════════════════════════════════════════════════ */
function buildGrindSlider(G,b){
  const g=G[b.grinderId]||G["fellow_opus"];
  const wrap=h("div",{id:"grind-area",style:{display:"flex",flexDirection:"column",gap:4}});
  wrap.appendChild(h("span",{className:"lbl"},`挽き目（${g.name}）`));
  const row=h("div",{style:{display:"flex",alignItems:"center",gap:12}});
  const dv=g.step<1?b.grind.toFixed(g.step===0.25?2:1):b.grind.toString();
  const numEl=h("span",{style:{fontSize:"22px",fontWeight:700,color:"#c8956c",minWidth:"48px",textAlign:"center",fontFamily:"'Cormorant Garamond',Georgia,serif"}},dv);
  row.appendChild(numEl);
  const slW=h("div",{style:{flex:1,position:"relative",padding:"8px 0"}});
  slW.appendChild(h("div",{style:{position:"absolute",top:"50%",left:0,right:0,height:"4px",background:"rgba(200,149,108,0.15)",borderRadius:"2px",transform:"translateY(-50%)"}}));
  const fill=h("div",{style:{position:"absolute",top:"50%",left:0,width:((b.grind-g.min)/(g.max-g.min)*100)+"%",height:"4px",background:"linear-gradient(90deg,#c8956c,#a07050)",borderRadius:"2px",transform:"translateY(-50%)"}});
  slW.appendChild(fill);
  slW.appendChild(h("input",{type:"range",min:g.min,max:g.max,step:g.step,value:b.grind,style:{width:"100%",position:"relative",zIndex:2},onInput:e=>{const v=parseFloat(e.target.value);b.grind=v;numEl.textContent=g.step<1?v.toFixed(g.step===0.25?2:1):v.toString();fill.style.width=((v-g.min)/(g.max-g.min)*100)+"%";}}));
  row.appendChild(slW);wrap.appendChild(row);
  wrap.appendChild(h("div",{style:{display:"flex",justifyContent:"space-between",fontSize:"10px",color:"#6b5a4e",padding:"0 4px"}},h("span",null,`細 ← ${g.min}`),h("span",null,`${g.max} → 粗`)));
  return wrap;
}

/* レシオのリアルタイム更新（render を呼ばず DOM 直接更新） */
function updateRatios(){
  const b=state.brew;
  const e1=document.getElementById("brew-ratio-val");if(e1)e1.textContent=b.dose&&b.yield?`1 : ${(b.yield/b.dose).toFixed(2)}`:"—";
  const e2=document.getElementById("latte-ratio-val");if(e2)e2.textContent=b.espressoMl&&b.milkMl?`1 : ${(b.milkMl/b.espressoMl).toFixed(1)}`:"—";
}

/* ══════════════════════════════════════════════════════════
   フォーム
   ══════════════════════════════════════════════════════════ */
function renderForm(app){
  const G=getGRINDERS();const b=state.brew;const isEdit=!!state._editSave;
  const form=h("div",{className:"form"});

  /* 豆セレクタ */
  form.appendChild(renderBeanSelector());

  /* マシン */
  const mDiv=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});
  mDiv.appendChild(h("span",{className:"lbl"},"マシン"));
  const mC=h("div",{style:{display:"flex",flexWrap:"wrap",gap:4}});
  state.machines.forEach(m=>mC.appendChild(h("button",{type:"button",className:"chip"+(b.machine===m?" on":""),"data-val":m,onClick:()=>{b.machine=m;state.equip.machine=m;save();mC.querySelectorAll(".chip").forEach(c=>c.classList.toggle("on",c.dataset.val===m));}},m)));
  if(!state.addingMachine)mC.appendChild(h("button",{type:"button",className:"chip",style:{borderStyle:"dashed",borderColor:"rgba(200,149,108,0.25)",color:"#6b5a4e"},onClick:()=>{state.addingMachine=true;state._newMachine="";render();}},"＋ 追加"));
  mDiv.appendChild(mC);
  if(state.addingMachine){
    const row=h("div",{style:{display:"flex",gap:6,marginTop:4}});
    row.appendChild(h("input",{className:"inp",placeholder:"マシン名",onInput:e=>state._newMachine=e.target.value}));
    row.appendChild(h("button",{type:"button",style:{background:"rgba(200,149,108,0.2)",border:"none",borderRadius:8,padding:"8px 14px",color:"#ede4da",fontSize:"0.87em",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"},onClick:()=>{if(state._newMachine?.trim()){state.machines.push(state._newMachine.trim());b.machine=state._newMachine.trim();state.equip.machine=b.machine;save();}state.addingMachine=false;render();}},"追加"));
    row.appendChild(h("button",{type:"button",style:{background:"none",border:"1px solid rgba(200,149,108,0.15)",borderRadius:8,padding:"8px 12px",color:"#8a7b6e",fontSize:"0.87em",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{state.addingMachine=false;render();}},"✕"));
    mDiv.appendChild(row);
  }
  form.appendChild(mDiv);

  /* グラインダー */
  const gDiv=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});
  gDiv.appendChild(h("span",{className:"lbl"},"グラインダー"));
  const gC=h("div",{style:{display:"flex",flexWrap:"wrap",gap:4}});
  Object.keys(G).forEach(k=>{
    const gi=G[k];const isOn=b.grinderId===k;
    const pick=()=>{const prev=b.grinderId;b.grinderId=k;b.grind=gi.default;state.equip.grinderId=k;save();if(prev!==k){gC.querySelectorAll(".chip").forEach(c=>c.classList.toggle("on",c.dataset.val===k));const ga=document.getElementById("grind-area");if(ga)ga.parentNode.replaceChild(buildGrindSlider(G,b),ga);}};
    if(gi.custom){
      const w=h("div",{style:{display:"flex"}});
      w.appendChild(h("button",{type:"button",className:"chip"+(isOn?" on":""),style:{borderRadius:"8px 0 0 8px"},"data-val":k,onClick:pick},gi.name));
      w.appendChild(h("button",{type:"button",style:{background:isOn?"rgba(200,149,108,0.2)":"rgba(200,149,108,0.06)",border:"1px solid rgba(200,149,108,0.12)",borderLeft:"none",borderRadius:"0 8px 8px 0",padding:"6px 8px",color:"#8a7b6e",fontSize:"10px",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{if(!confirm("「"+gi.name+"」を削除？"))return;db.deleteCustomGrinder(gi.id);if(b.grinderId===k){b.grinderId="fellow_opus";b.grind=GRINDERS_BUILTIN.fellow_opus.default;state.equip.grinderId="fellow_opus";}save();render();}},"✕"));
      gC.appendChild(w);
    }else{
      gC.appendChild(h("button",{type:"button",className:"chip"+(isOn?" on":""),"data-val":k,onClick:pick},gi.name));
    }
  });
  if(!state.addingGrinder)gC.appendChild(h("button",{type:"button",className:"chip",style:{borderStyle:"dashed",borderColor:"rgba(200,149,108,0.25)",color:"#6b5a4e"},onClick:()=>{state.addingGrinder=true;state._newGrinder={name:"",min:1,max:40,step:1};render();}},"＋ 追加"));
  gDiv.appendChild(gC);
  if(state.addingGrinder){
    const ng=state._newGrinder;
    const agD=h("div",{style:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(200,149,108,0.2)",borderRadius:"10px",padding:"12px",display:"flex",flexDirection:"column",gap:8,animation:"fadeIn 0.2s ease"}});
    agD.appendChild(h("span",{style:{fontSize:"0.73em",color:"#c8956c",fontWeight:600}},"カスタムグラインダーを追加"));
    agD.appendChild(h("input",{className:"inp",placeholder:"名前（例: Kinu M47）",value:ng.name,onInput:e=>ng.name=e.target.value}));
    const g3=h("div",{className:"grid3"});
    [["最小値","min"],["最大値","max"],["刻み","step"]].forEach(([l,k])=>{const fd=h("div",{style:{display:"flex",flexDirection:"column",gap:3}});fd.appendChild(h("span",{style:{fontSize:"0.67em",color:"#6b5a4e"}},l));const i=h("input",{className:"inp",type:"number",inputMode:"decimal",style:{textAlign:"center"},onInput:e=>{const v=parseFloat(e.target.value);ng[k]=isNaN(v)?(k==="step"?1:0):v;}});i.value=String(ng[k]);fd.appendChild(i);g3.appendChild(fd);});
    agD.appendChild(g3);
    const bt=h("div",{style:{display:"flex",gap:6}});
    bt.appendChild(h("button",{type:"button",style:{flex:1,background:"rgba(200,149,108,0.2)",border:"none",borderRadius:8,padding:"8px",color:"#ede4da",fontSize:"0.87em",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{if(!ng.name.trim())return;if(ng.max<=ng.min){alert("最大値は最小値より大きくしてください");return;}if(ng.step<=0){alert("刻みは0より大きい値にしてください");return;}const id=Date.now().toString();db.addCustomGrinder({id,name:ng.name.trim(),min:ng.min,max:ng.max,step:ng.step});state.addingGrinder=false;b.grinderId="custom_"+id;b.grind=Math.round((ng.min+ng.max)/2);state.equip.grinderId=b.grinderId;save();render();}},"追加"));
    bt.appendChild(h("button",{type:"button",style:{background:"none",border:"1px solid rgba(200,149,108,0.15)",borderRadius:8,padding:"8px 12px",color:"#8a7b6e",fontSize:"0.87em",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{state.addingGrinder=false;render();}},"キャンセル"));
    agD.appendChild(bt);gDiv.appendChild(agD);
  }
  form.appendChild(gDiv);
  form.appendChild(buildGrindSlider(G,b));

  /* タンパー */
  const tDiv=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});
  tDiv.appendChild(h("span",{className:"lbl"},"タンパー"));
  const tC=h("div",{style:{display:"flex",flexWrap:"wrap",gap:4}});
  state.tampers.forEach(t=>tC.appendChild(h("button",{type:"button",className:"chip"+(b.tamper===t?" on":""),"data-val":t,onClick:()=>{b.tamper=t;state.equip.tamper=t;save();tC.querySelectorAll(".chip").forEach(c=>c.classList.toggle("on",c.dataset.val===t));}},t)));
  if(!state.addingTamper)tC.appendChild(h("button",{type:"button",className:"chip",style:{borderStyle:"dashed",borderColor:"rgba(200,149,108,0.25)",color:"#6b5a4e"},onClick:()=>{state.addingTamper=true;state._newTamper="";render();}},"＋ 追加"));
  tDiv.appendChild(tC);
  if(state.addingTamper){
    const row=h("div",{style:{display:"flex",gap:6,marginTop:4}});
    row.appendChild(h("input",{className:"inp",placeholder:"タンパー名",onInput:e=>state._newTamper=e.target.value}));
    row.appendChild(h("button",{type:"button",style:{background:"rgba(200,149,108,0.2)",border:"none",borderRadius:8,padding:"8px 14px",color:"#ede4da",fontSize:"0.87em",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"},onClick:()=>{if(state._newTamper?.trim()){state.tampers.push(state._newTamper.trim());b.tamper=state._newTamper.trim();state.equip.tamper=b.tamper;save();}state.addingTamper=false;render();}},"追加"));
    row.appendChild(h("button",{type:"button",style:{background:"none",border:"1px solid rgba(200,149,108,0.15)",borderRadius:8,padding:"8px 12px",color:"#8a7b6e",fontSize:"0.87em",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{state.addingTamper=false;render();}},"✕"));
    tDiv.appendChild(row);
  }
  form.appendChild(tDiv);

  /* タンピング圧 */
  const tpDiv=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});
  tpDiv.appendChild(h("span",{className:"lbl"},"タンピング圧"));
  tpDiv.appendChild(sel(TAMP_P.map(v=>v+"kg"),b.tampPressure+"kg",v=>{b.tampPressure=parseInt(v);}));
  form.appendChild(tpDiv);

  /* ── 抽出パラメータ ── */
  form.appendChild(h("div",{className:"sec-lbl"},"☕ 抽出パラメータ"));
  const exItem=(label,opts,val,onChange)=>{const d=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});d.appendChild(h("span",{className:"slbl"},label));d.appendChild(sel(opts,val,onChange));return d;};
  const exG=h("div",{className:"grid2"});
  exG.appendChild(exItem("粉量 (g)",DOSES.map(v=>v.toFixed(1)+"g"),b.dose.toFixed(1)+"g",v=>{b.dose=parseFloat(v);updateRatios();}));
  exG.appendChild(exItem("抽出量 (g)",YIELDS.map(v=>v+"g"),b.yield+"g",v=>{b.yield=parseFloat(v);updateRatios();}));
  exG.appendChild(exItem("抽出圧力 (bar)",PRESSURES.map(v=>v.toFixed(1)+"bar"),b.pressure.toFixed(1)+"bar",v=>{b.pressure=parseFloat(v);}));
  exG.appendChild(exItem("抽出時間 (秒)",TIMES.map(v=>v+"秒"),b.timeSec+"秒",v=>{b.timeSec=parseInt(v);}));
  form.appendChild(exG);
  const brDiv=h("div",{className:"ratio-box"});brDiv.appendChild(h("span",{style:{fontSize:"12px",color:"#8a7b6e"}},"抽出レシオ"));brDiv.appendChild(h("span",{className:"ratio-val",id:"brew-ratio-val"},b.dose&&b.yield?`1 : ${(b.yield/b.dose).toFixed(2)}`:"—"));form.appendChild(brDiv);

  /* ── ラテ構成 ── */
  form.appendChild(h("div",{className:"sec-lbl"},"🥛 ラテ構成"));
  const milkDiv=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});
  milkDiv.appendChild(h("span",{className:"slbl"},"ミルクの種類"));
  const mkC=h("div",{style:{display:"flex",flexWrap:"wrap",gap:4}});
  MILK_T.forEach(m=>mkC.appendChild(h("button",{type:"button",className:"chip"+(b.milkType===m?" on":""),"data-val":m,onClick:()=>{b.milkType=m;mkC.querySelectorAll(".chip").forEach(c=>c.classList.toggle("on",c.dataset.val===m));}},m)));
  milkDiv.appendChild(mkC);form.appendChild(milkDiv);
  const ltG=h("div",{className:"grid2"});
  ltG.appendChild(exItem("エスプレッソ (ml)",ESP_ML.map(v=>v+"ml"),b.espressoMl+"ml",v=>{b.espressoMl=parseInt(v);updateRatios();}));
  ltG.appendChild(exItem("ミルク (ml)",MILK_ML.map(v=>v+"ml"),b.milkMl+"ml",v=>{b.milkMl=parseInt(v);updateRatios();}));
  form.appendChild(ltG);
  const lrDiv=h("div",{className:"ratio-box"});lrDiv.appendChild(h("span",{style:{fontSize:"12px",color:"#8a7b6e"}},"ラテレシオ"));lrDiv.appendChild(h("span",{className:"ratio-val",id:"latte-ratio-val"},b.espressoMl&&b.milkMl?`1 : ${(b.milkMl/b.espressoMl).toFixed(1)}`:"—"));form.appendChild(lrDiv);

  /* ── ラテアート ── */
  form.appendChild(h("div",{className:"sec-lbl"},"🎨 ラテアート"));
  const artDiv=h("div",{style:{display:"flex",flexDirection:"column",gap:8}});
  const artC=h("div",{style:{display:"flex",flexWrap:"wrap",gap:4}});
  ART_T.forEach(t=>artC.appendChild(h("button",{type:"button",className:"chip"+(b.artType===t?" on":""),"data-val":t,onClick:()=>{const was=b.artType===t;b.artType=was?"":t;artC.querySelectorAll(".chip").forEach(c=>c.classList.toggle("on",!was&&c.dataset.val===t));const sb=document.getElementById("art-score-blk");if(sb)sb.style.display=b.artType?"flex":"none";const ob=document.getElementById("art-other-blk");if(ob)ob.style.display=b.artType==="その他"?"block":"none";}},t)));
  artDiv.appendChild(artC);
  const aoBlk=h("div",{id:"art-other-blk",style:{display:b.artType==="その他"?"block":"none"}});aoBlk.appendChild(h("input",{className:"inp",placeholder:"アート名",value:b.artOther||"",onInput:e=>b.artOther=e.target.value}));artDiv.appendChild(aoBlk);
  /* アート達成度 */
  const asBlk=h("div",{id:"art-score-blk",style:{display:b.artType?"flex":"none",flexDirection:"column",gap:4}});
  asBlk.appendChild(h("span",{className:"slbl"},"アート達成度"));
  const asSt=h("div",{style:{display:"flex",gap:2,justifyContent:"center",marginBottom:4},innerHTML:starsSVG(b.artScore||3)});asBlk.appendChild(asSt);
  const asRow=h("div",{style:{display:"flex",alignItems:"center",gap:12}});const asV=h("span",{style:{fontSize:"1.4em",fontWeight:700,color:"#c8956c",minWidth:"40px",textAlign:"center",fontFamily:"'Cormorant Garamond',Georgia,serif"}},(b.artScore||3).toFixed(1));asRow.appendChild(asV);
  const asSlW=h("div",{style:{flex:1,position:"relative",padding:"8px 0"}});asSlW.appendChild(h("div",{style:{position:"absolute",top:"50%",left:0,right:0,height:"4px",background:"rgba(200,149,108,0.15)",borderRadius:"2px",transform:"translateY(-50%)"}}));const asF=h("div",{style:{position:"absolute",top:"50%",left:0,width:((b.artScore||3)/5*100)+"%",height:"4px",background:"linear-gradient(90deg,#c8956c,#a07050)",borderRadius:"2px",transform:"translateY(-50%)"}});asSlW.appendChild(asF);asSlW.appendChild(h("input",{type:"range",min:0,max:5,step:0.1,value:b.artScore||3,style:{width:"100%",position:"relative",zIndex:2},onInput:e=>{const v=parseFloat(e.target.value);b.artScore=v;asV.textContent=v.toFixed(1);asF.style.width=(v/5*100)+"%";asSt.innerHTML=starsSVG(v);}}));asRow.appendChild(asSlW);asBlk.appendChild(asRow);artDiv.appendChild(asBlk);
  /* 写真 */
  const pa=h("div",{id:"photo-area",className:"photo-area"+(state.photoData?" has-photo":""),onClick:()=>{if(!state.photoData)document.getElementById("photo-input").click();}});
  if(state.photoData){pa.appendChild(h("img",{src:state.photoData}));pa.appendChild(h("button",{type:"button",className:"photo-remove",onClick:e=>{e.stopPropagation();state.photoData=null;pa.className="photo-area";pa.innerHTML="";pa.appendChild(h("div",{style:{color:"#6b5a4e",fontSize:"13px"}},"📸 タップして写真を追加"));}},"✕"));}else{pa.appendChild(h("div",{style:{color:"#6b5a4e",fontSize:"13px"}},"📸 タップして写真を追加"));}
  artDiv.appendChild(pa);form.appendChild(artDiv);

  /* ── おいしさ ── */
  const oDiv=h("div",{style:{display:"flex",flexDirection:"column",gap:6}});
  oDiv.appendChild(h("span",{className:"lbl"},"おいしさ"));
  const oSt=h("div",{style:{display:"flex",gap:2,justifyContent:"center",marginBottom:4},innerHTML:starsSVG(b.overall||3,26)});oDiv.appendChild(oSt);
  const oRow=h("div",{style:{display:"flex",alignItems:"center",gap:12}});const oV=h("span",{style:{fontSize:"1.6em",fontWeight:700,color:"#c8956c",minWidth:"56px",textAlign:"center",fontFamily:"'Cormorant Garamond',Georgia,serif"}},(b.overall||3).toFixed(1));oRow.appendChild(oV);
  const oSlW=h("div",{style:{flex:1,position:"relative",padding:"8px 0"}});oSlW.appendChild(h("div",{style:{position:"absolute",top:"50%",left:0,right:0,height:"4px",background:"rgba(200,149,108,0.15)",borderRadius:"2px",transform:"translateY(-50%)"}}));const oF=h("div",{style:{position:"absolute",top:"50%",left:0,width:((b.overall||3)/5*100)+"%",height:"4px",background:"linear-gradient(90deg,#c8956c,#a07050)",borderRadius:"2px",transform:"translateY(-50%)"}});oSlW.appendChild(oF);oSlW.appendChild(h("input",{type:"range",min:0,max:5,step:0.1,value:b.overall||3,style:{width:"100%",position:"relative",zIndex:2},onInput:e=>{const v=parseFloat(e.target.value);b.overall=v;oV.textContent=v.toFixed(1);oF.style.width=(v/5*100)+"%";oSt.innerHTML=starsSVG(v,26);}}));oRow.appendChild(oSlW);oDiv.appendChild(oRow);
  form.appendChild(oDiv);

  /* 味の詳細 */
  form.appendChild(h("button",{type:"button",className:"btn-toggle",onClick:()=>{state.showTaste=!state.showTaste;render();}},state.showTaste?"▾ 味の詳細を閉じる":"▸ 味の詳細を記録する（任意）"));
  if(state.showTaste){
    const tD=h("div",{style:{display:"flex",flexDirection:"column",gap:10,animation:"fadeIn 0.2s ease"}});
    TASTE.forEach(t=>{const row=h("div",{className:"taste-row"});row.appendChild(h("span",{className:"taste-lbl"},`${t.e} ${t.l}`));const btns=h("div",{style:{display:"flex",gap:3,flex:1}});const bld=()=>{btns.innerHTML="";for(let v=1;v<=5;v++)btns.appendChild(h("button",{type:"button",className:"taste-btn",style:{background:v<=b[t.k]?"#c8956c":"rgba(200,149,108,0.15)",color:v<=b[t.k]?"#1a1410":"#6b5a4e",fontWeight:v<=b[t.k]?700:400},onClick:()=>{b[t.k]=b[t.k]===v?0:v;bld();}},v));};bld();row.appendChild(btns);tD.appendChild(row);});
    form.appendChild(tD);
  }

  /* フレーバー */
  form.appendChild(h("button",{type:"button",className:"btn-toggle",onClick:()=>{state.showFlavors=!state.showFlavors;render();}},state.showFlavors?"▾ 感じたフレーバーを閉じる":"▸ 感じたフレーバーを記録する（任意）"));
  if(state.showFlavors){
    const flDiv=h("div",{style:{display:"flex",flexDirection:"column",gap:6,animation:"fadeIn 0.2s ease"}});
    flDiv.appendChild(renderFlavorSection(b.flavors,b.flavorNote,(tag,on)=>{const cur=state.brew.flavors||[];state.brew.flavors=on?[...cur,tag]:cur.filter(t=>t!==tag);},(val)=>{state.brew.flavorNote=val;}));
    form.appendChild(flDiv);
  }

  /* メモ */
  const nDiv=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});
  nDiv.appendChild(h("span",{className:"lbl"},"メモ"));
  const nRow=h("div",{style:{display:"flex",gap:6}});
  const ta=h("textarea",{rows:3,placeholder:"気づいたこと、次回試したいこと…",style:{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(200,149,108,0.2)",borderRadius:"10px",padding:"10px 12px",color:"#ede4da",fontSize:"14px",outline:"none",resize:"vertical",fontFamily:"inherit",lineHeight:1.6},onInput:e=>b.note=e.target.value});ta.value=b.note||"";nRow.appendChild(ta);
  nRow.appendChild(h("button",{type:"button",className:"voice-btn",onClick:()=>{const r=startVoice(t=>{b.note=b.note?b.note+" "+t:t;render();});if(r)r.start();}},"🎙"));
  nDiv.appendChild(nRow);form.appendChild(nDiv);

  /* 保存 */
  const sv=h("button",{type:"button",className:"btn-save"},isEdit?"更新":"保存");
  sv.addEventListener("click",async()=>{
    if(!b.beanId){alert("豆を選択してください");return;}
    const id=state._editSave||genId();
    const existing=state._editSave?state.records.find(r=>r.id===id):null;
    const rec={id,createdAt:existing?existing.createdAt:new Date().toISOString(),
      beanId:b.beanId,machine:b.machine,grinderId:b.grinderId,grind:b.grind,tamper:b.tamper,tampPressure:b.tampPressure,
      dose:b.dose,yield:b.yield,pressure:b.pressure,timeSec:b.timeSec,
      milkType:b.milkType,espressoMl:b.espressoMl,milkMl:b.milkMl,
      artType:b.artType,artOther:b.artOther,artScore:b.artScore,
      overall:b.overall,acidity:b.acidity,sweetness:b.sweetness,bitterness:b.bitterness,body:b.body,aftertaste:b.aftertaste,
      flavors:b.flavors||[],flavorNote:b.flavorNote||"",note:b.note,hasPhoto:!!state.photoData};
    if(state.photoData)await db.savePhoto(id,state.photoData);else if(state._editSave)await db.deletePhoto(id);
    if(state._editSave){const idx=state.records.findIndex(r=>r.id===id);if(idx>=0)state.records[idx]=rec;}else{state.records.unshift(rec);}
    save();state.photoData=null;state._editSave=null;state.brew=initBrew();state.showTaste=false;state.showFlavors=false;state.expandedCard=id;state.view="list";render();
  });
  form.appendChild(sv);
  app.appendChild(form);
}

/* ══════════════════════════════════════════════════════════
   フレーバー UI
   ══════════════════════════════════════════════════════════ */
function renderFlavorSection(flavors,flavorNote,onToggle,onNoteChange){
  const selected=[...flavors];
  const wrap=h("div",{className:"flavor-section"});
  const summary=h("div",{style:{minHeight:"32px",display:"flex",flexWrap:"wrap",gap:"5px",padding:"8px 10px",background:"rgba(200,149,108,0.06)",border:"1px solid rgba(200,149,108,0.12)",borderRadius:"10px",marginBottom:"8px",alignItems:"center"}});
  const emptyHint=h("span",{style:{fontSize:"0.75em",color:"#6b5a4e"}},"タグを選ぶと表示されます");
  const updateSummary=()=>{summary.innerHTML="";if(selected.length===0){summary.appendChild(emptyHint);}else{selected.forEach(tag=>summary.appendChild(h("span",{className:"flavor-badge"},tag)));}};
  updateSummary();wrap.appendChild(summary);
  FLAVORS.forEach(cat=>{
    wrap.appendChild(h("div",{className:"flavor-cat-label"},cat.cat));
    const row=h("div",{className:"flavor-chips-row"});
    cat.tags.forEach(tag=>{
      const isOn=selected.includes(tag);
      const btn=h("button",{type:"button",className:"flavor-chip"+(isOn?" on":"")},tag);
      btn.addEventListener("click",()=>{const nowOn=btn.classList.contains("on");btn.classList.toggle("on",!nowOn);if(nowOn){const i=selected.indexOf(tag);if(i>=0)selected.splice(i,1);}else{selected.push(tag);}updateSummary();onToggle(tag,!nowOn);});
      row.appendChild(btn);
    });
    wrap.appendChild(row);
  });
  const noteWrap=h("div",{style:{marginTop:"6px",display:"flex",flexDirection:"column",gap:3}});
  noteWrap.appendChild(h("span",{className:"flavor-cat-label"},"補足メモ（任意）"));
  const ta=h("textarea",{placeholder:"例：後味にほんのりバニラ感",rows:2,style:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(200,149,108,0.15)",borderRadius:"8px",padding:"8px 10px",color:"#ede4da",fontSize:"0.87em",outline:"none",resize:"vertical",fontFamily:"inherit",lineHeight:1.5},onInput:e=>onNoteChange(e.target.value)});
  ta.value=flavorNote||"";noteWrap.appendChild(ta);wrap.appendChild(noteWrap);
  return wrap;
}

/* ══════════════════════════════════════════════════════════
   豆セレクタ
   ══════════════════════════════════════════════════════════ */
function renderBeanSelector(){
  const b=state.brew;
  const lastUsed={};
  state.records.forEach(r=>{if(!lastUsed[r.beanId]||r.createdAt>lastUsed[r.beanId])lastUsed[r.beanId]=r.createdAt;});
  const beans=[...state.beans].sort((a,bx)=>{const ta=lastUsed[a.id]||"";const tb=lastUsed[bx.id]||"";return tb.localeCompare(ta);});
  const wrap=h("div",{style:{display:"flex",flexDirection:"column",gap:8}});
  wrap.appendChild(h("span",{className:"lbl"},"豆"));

  const selBean=beans.find(x=>x.id===b.beanId);
  if(selBean&&!state.addingBean){
    const info=h("div",{style:{background:"rgba(200,149,108,0.08)",borderRadius:"10px",padding:"10px 14px",border:"1px solid rgba(200,149,108,0.15)"}});
    info.appendChild(h("div",{style:{display:"flex",alignItems:"center",gap:6}},h("span",{style:{fontSize:"14px"}},beanFlag(selBean)),h("span",{style:{fontSize:"15px",fontWeight:600,color:"#ede4da"}},beanName(selBean))));
    const meta=[];if(selBean.roast)meta.push(selBean.roast);if(selBean.shop)meta.push(selBean.shop);if(selBean.altitude)meta.push(selBean.altitude+"m");if(selBean.roastDate){const days=Math.floor((Date.now()-new Date(selBean.roastDate).getTime())/(1000*60*60*24));if(days>=0)meta.push(`焙煎${days}日目`);}
    if(meta.length)info.appendChild(h("div",{style:{fontSize:"12px",color:"#8a7b6e",marginTop:"2px"}},meta.join(" · ")));
    wrap.appendChild(info);
  }else if(!state.addingBean){
    wrap.appendChild(h("div",{style:{fontSize:"13px",color:"#6b5a4e",padding:"8px 0"}},"豆を選択してください"));
  }

  if(!state.addingBean){
    if(beans.length>0){
      wrap.appendChild(h("button",{type:"button",className:"btn-toggle",onClick:()=>{state.showBeanList=!state.showBeanList;render();}},state.showBeanList?`▾ これまで淹れた豆（${beans.length}）`:`▸ これまで淹れた豆（${beans.length}）`));
      if(state.showBeanList){
        const ld=h("div",{style:{display:"flex",flexDirection:"column",gap:6,animation:"fadeIn 0.2s ease"}});
        const chips=h("div",{style:{display:"flex",flexWrap:"wrap",gap:6}});
        beans.forEach(bn=>{
          const bw=h("div",{style:{display:"flex",gap:0}});
          bw.appendChild(h("button",{type:"button",style:{background:b.beanId===bn.id?"rgba(200,149,108,0.3)":"rgba(200,149,108,0.1)",border:`1px solid ${b.beanId===bn.id?"rgba(200,149,108,0.5)":"rgba(200,149,108,0.15)"}`,borderRadius:"10px 0 0 10px",padding:"8px 10px 8px 14px",color:b.beanId===bn.id?"#ede4da":"#b8a590",fontSize:"14px",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{b.beanId=bn.id;state.showBeanList=false;render();}},`${beanFlag(bn)} ${beanName(bn)}`));
          bw.appendChild(h("button",{type:"button",style:{background:b.beanId===bn.id?"rgba(200,149,108,0.2)":"rgba(200,149,108,0.06)",border:`1px solid ${b.beanId===bn.id?"rgba(200,149,108,0.5)":"rgba(200,149,108,0.15)"}`,borderLeft:"none",borderRadius:"0 10px 10px 0",padding:"8px 10px",color:"#8a7b6e",fontSize:"11px",cursor:"pointer",fontFamily:"inherit"},onClick:e=>{e.stopPropagation();state.viewingBean=state.viewingBean?.id===bn.id?null:bn;render();}},"ℹ"));
          chips.appendChild(bw);
        });
        ld.appendChild(chips);
        if(state.viewingBean&&!state.editingBean)ld.appendChild(renderBeanDetail(state.viewingBean));
        if(state.editingBean)ld.appendChild(renderBeanEdit(state.editingBean));
        wrap.appendChild(ld);
      }
    }
    wrap.appendChild(h("button",{type:"button",className:"btn-add",onClick:()=>{state.addingBean=true;state.showBeanList=false;state._newBean={country:"",farm:"",process:"",altitude:"",name:"",shop:"",roast:"",roastDate:""};render();}},"＋ 新しい豆を追加"));
  }else{
    wrap.appendChild(renderBeanAddForm());
  }
  return wrap;
}

function renderBeanDetail(vb){
  const vD=h("div",{style:{background:"rgba(30,24,18,0.95)",borderRadius:"12px",padding:"16px",border:"1px solid rgba(200,149,108,0.2)",animation:"fadeIn 0.2s ease"}});
  const vh=h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}});
  vh.appendChild(h("span",{style:{fontSize:"16px",fontWeight:600,color:"#ede4da"}},`${beanFlag(vb)} ${beanName(vb)}`));
  vh.appendChild(h("button",{type:"button",style:{background:"none",border:"none",color:"#8a7b6e",fontSize:"18px",cursor:"pointer"},onClick:()=>{state.viewingBean=null;render();}},"✕"));
  vD.appendChild(vh);
  const det=h("div",{style:{display:"flex",flexDirection:"column",gap:"6px",fontSize:"13px",color:"#b8a590"}});
  if(vb.country)det.appendChild(h("div",null,"🌍 国: "+vb.country));
  if(vb.farm)det.appendChild(h("div",null,"🏔 農園: "+vb.farm));
  if(vb.altitude)det.appendChild(h("div",null,"📐 標高: "+vb.altitude+"m"));
  if(vb.process)det.appendChild(h("div",null,"⚙️ 精製: "+vb.process));
  if(vb.shop)det.appendChild(h("div",null,"🏪 店: "+vb.shop));
  if(vb.roast)det.appendChild(h("div",null,"🔥 焙煎度: "+vb.roast));
  if(vb.roastDate)det.appendChild(h("div",null,"📅 焙煎日: "+vb.roastDate));
  if(vb.name)det.appendChild(h("div",null,"📝 カスタム名: "+vb.name));
  vD.appendChild(det);
  const ab=h("div",{style:{display:"flex",gap:8,marginTop:"12px"}});
  ab.appendChild(h("button",{type:"button",style:{flex:1,background:"rgba(200,149,108,0.15)",border:"1px solid rgba(200,149,108,0.25)",borderRadius:8,padding:"8px",color:"#ede4da",fontSize:"0.8em",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{state.editingBean={...vb};render();}},"✏️ 編集"));
  ab.appendChild(h("button",{type:"button",style:{flex:1,background:"none",border:"1px solid rgba(200,100,100,0.3)",borderRadius:8,padding:"8px",color:"#c87070",fontSize:"0.8em",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{if(!confirm(`「${beanName(vb)}」を削除？\nこの豆に紐づく抽出記録は残ります。`))return;state.beans=state.beans.filter(x=>x.id!==vb.id);if(state.brew.beanId===vb.id)state.brew.beanId="";state.viewingBean=null;save();render();}},"🗑 削除"));
  vD.appendChild(ab);return vD;
}

function renderBeanEdit(eb){
  const eD=h("div",{style:{background:"rgba(30,24,18,0.95)",borderRadius:"12px",padding:"16px",border:"1px solid rgba(200,149,108,0.35)",animation:"fadeIn 0.2s ease"}});
  eD.appendChild(h("div",{style:{fontSize:"0.8em",color:"#c8956c",fontWeight:600,marginBottom:"10px"}},"豆を編集"));
  [{key:"country",label:"国"},{key:"farm",label:"農園"},{key:"shop",label:"購入店"},{key:"altitude",label:"標高（m）",inputMode:"numeric"},{key:"name",label:"カスタム名"},{key:"roastDate",label:"焙煎日",type:"date"}].forEach(f=>{const fd=h("div",{style:{display:"flex",flexDirection:"column",gap:3,marginBottom:8}});fd.appendChild(h("span",{style:{fontSize:"0.73em",color:"#6b5a4e"}},f.label));const inp=h("input",{className:"inp",type:f.type||"text",inputMode:f.inputMode,value:eb[f.key]||"",onInput:e=>eb[f.key]=e.target.value});if(f.type==="date")inp.style.colorScheme="dark";fd.appendChild(inp);eD.appendChild(fd);});
  const pD=h("div",{style:{display:"flex",flexDirection:"column",gap:3,marginBottom:8}});pD.appendChild(h("span",{style:{fontSize:"0.73em",color:"#6b5a4e"}},"精製方法"));const pC=h("div",{style:{display:"flex",flexWrap:"wrap",gap:4}});PROCS.forEach(p=>pC.appendChild(h("button",{type:"button",className:"chip"+(eb.process===p?" on":""),onClick:()=>{eb.process=eb.process===p?"":p;render();}},p)));pD.appendChild(pC);eD.appendChild(pD);
  const rD=h("div",{style:{display:"flex",flexDirection:"column",gap:3,marginBottom:8}});rD.appendChild(h("span",{style:{fontSize:"0.73em",color:"#6b5a4e"}},"焙煎度"));const rC=h("div",{style:{display:"flex",flexWrap:"wrap",gap:4}});ROAST_LEVELS.forEach(r=>rC.appendChild(h("button",{type:"button",className:"chip"+(eb.roast===r?" on":""),onClick:()=>{eb.roast=eb.roast===r?"":r;render();}},r)));rD.appendChild(rC);eD.appendChild(rD);
  const bt=h("div",{style:{display:"flex",gap:8,marginTop:4}});
  bt.appendChild(h("button",{type:"button",style:{flex:1,background:"rgba(200,149,108,0.2)",border:"none",borderRadius:8,padding:"8px",color:"#ede4da",fontSize:"0.87em",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{const idx=state.beans.findIndex(x=>x.id===eb.id);if(idx>=0){state.beans[idx]={...eb};save();}state.editingBean=null;state.viewingBean=eb;render();}},"保存"));
  bt.appendChild(h("button",{type:"button",style:{background:"none",border:"1px solid rgba(200,149,108,0.15)",borderRadius:8,padding:"8px 12px",color:"#8a7b6e",fontSize:"0.87em",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{state.editingBean=null;render();}},"キャンセル"));
  eD.appendChild(bt);return eD;
}

function renderBeanAddForm(){
  const nb=state._newBean;
  const panel=h("div",{className:"bean-panel"});
  panel.appendChild(h("div",{style:{fontSize:"0.8em",color:"#c8956c",fontWeight:600}},"新しい豆を登録"));
  const field=(label,key,ph,inputMode)=>{const d=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});d.appendChild(h("span",{className:"slbl"},label));d.appendChild(h("input",{className:"inp",placeholder:ph||"",inputMode,value:nb[key]||"",onInput:e=>{nb[key]=e.target.value;updateBeanPreview();}}));return d;};
  panel.appendChild(field("国","country","例: エチオピア"));
  panel.appendChild(field("農園","farm","例: Aricha"));
  panel.appendChild(field("購入店","shop","例: Onibus Coffee"));
  /* 精製方法 */
  const pD=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});pD.appendChild(h("span",{className:"slbl"},"精製方法"));const pC=h("div",{style:{display:"flex",flexWrap:"wrap",gap:4}});PROCS.forEach(p=>pC.appendChild(h("button",{type:"button",className:"chip"+(nb.process===p?" on":""),onClick:()=>{nb.process=nb.process===p?"":p;render();}},p)));pD.appendChild(pC);panel.appendChild(pD);
  /* 焙煎度 */
  const rlD=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});rlD.appendChild(h("span",{className:"slbl"},"焙煎度"));const rlC=h("div",{style:{display:"flex",flexWrap:"wrap",gap:4}});ROAST_LEVELS.forEach(r=>rlC.appendChild(h("button",{type:"button",className:"chip"+(nb.roast===r?" on":""),onClick:()=>{nb.roast=nb.roast===r?"":r;render();}},r)));rlD.appendChild(rlC);panel.appendChild(rlD);
  /* 焙煎日 */
  const rdD=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});rdD.appendChild(h("span",{className:"slbl"},"焙煎日"));const rdi=h("input",{type:"date",className:"inp",value:nb.roastDate||"",onInput:e=>nb.roastDate=e.target.value});rdi.style.colorScheme="dark";rdD.appendChild(rdi);panel.appendChild(rdD);
  /* 標高トグル */
  panel.appendChild(h("button",{type:"button",style:{background:"none",border:"none",padding:0,color:"#6b5a4e",fontSize:"12px",cursor:"pointer",textAlign:"left",fontFamily:"inherit"},onClick:()=>{state.showBeanDetail=!state.showBeanDetail;render();}},state.showBeanDetail?"▾ 標高を閉じる":"▸ 標高を追加（任意）"));
  if(state.showBeanDetail){const aD=h("div",{style:{display:"flex",flexDirection:"column",gap:4}});aD.appendChild(h("span",{className:"slbl"},"標高（m）"));aD.appendChild(h("input",{className:"inp",placeholder:"例: 1800",inputMode:"numeric",value:nb.altitude,onInput:e=>nb.altitude=e.target.value}));panel.appendChild(aD);}
  /* カスタム名トグル */
  panel.appendChild(h("button",{type:"button",style:{background:"none",border:"none",padding:0,color:"#6b5a4e",fontSize:"12px",cursor:"pointer",textAlign:"left",fontFamily:"inherit"},onClick:()=>{state.showBeanName=!state.showBeanName;render();}},state.showBeanName?"▾ カスタム名を閉じる":"▸ カスタム名をつける（任意）"));
  if(state.showBeanName){const nRow=h("div",{style:{display:"flex",gap:6}});nRow.appendChild(h("input",{className:"inp",placeholder:"例: いつものエチオピア",value:nb.name,onInput:e=>{nb.name=e.target.value;updateBeanPreview();}}));nRow.appendChild(h("button",{type:"button",className:"voice-btn",style:{width:"38px",height:"38px"},onClick:()=>{const r=startVoice(t=>{nb.name+=t;render();});if(r)r.start();}},"🎙"));panel.appendChild(nRow);}
  /* プレビュー */
  const prev=h("div",{className:"preview-box",id:"bean-preview"});prev.appendChild(h("span",{style:{fontSize:"10px",color:"#6b5a4e"}},"表示名:"));prev.appendChild(h("span",{style:{fontSize:"13px",color:"#b8a590",fontWeight:600}},`${beanFlag(nb)} ${beanName(nb)}`));panel.appendChild(prev);
  /* AIヘルパー */
  panel.appendChild(renderAIHelper(nb));
  /* ボタン */
  const bt=h("div",{style:{display:"flex",gap:6}});
  bt.appendChild(h("button",{type:"button",style:{flex:1,background:"rgba(200,149,108,0.2)",border:"none",borderRadius:"10px",padding:"8px",color:"#ede4da",fontSize:"14px",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{if(!nb.country.trim()&&!nb.name.trim())return;const bean={id:genId(),...nb};state.beans.push(bean);state.brew.beanId=bean.id;state.addingBean=false;state.showBeanDetail=false;state.showBeanName=false;save();render();}},"追加"));
  bt.appendChild(h("button",{type:"button",style:{background:"none",border:"1px solid rgba(200,149,108,0.15)",borderRadius:"10px",padding:"8px 14px",color:"#8a7b6e",fontSize:"14px",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{state.addingBean=false;state.showBeanDetail=false;state.showBeanName=false;render();}},"キャンセル"));
  panel.appendChild(bt);return panel;
}

function updateBeanPreview(){const p=document.getElementById("bean-preview");if(p){const nb=state._newBean;p.innerHTML="";p.appendChild(h("span",{style:{fontSize:"10px",color:"#6b5a4e"}},"表示名:"));p.appendChild(h("span",{style:{fontSize:"13px",color:"#b8a590",fontWeight:600}},`${beanFlag(nb)} ${beanName(nb)}`));}}

/* ══════════════════════════════════════════════════════════
   AI ヘルパー（豆情報の取り込み補助）
   ══════════════════════════════════════════════════════════ */
function renderAIHelper(nb){
  const wrap=h("div",{style:{display:"flex",flexDirection:"column",gap:6}});
  const prompts=[
    {id:"photo",label:"📸 パッケージ写真から",text:"この画像はコーヒー豆のパッケージです。以下の情報を読み取って、それぞれ改行して教えてください。\n\n・豆の名前\n・生産国\n・農園名\n・標高\n・精製方法（Washed / Natural / Honey / Anaerobic / Carbonic Maceration / Wet Hulled / Other）\n・購入店（販売元やロースター名）\n・焙煎度（浅煎り / 中煎り / 中深煎り / 深煎り）\n・焙煎日（記載があれば）"},
    {id:"url",label:"🔗 商品URLから",text:"以下のURLのコーヒー豆の情報を読み取って、それぞれ改行して教えてください。\n\nURL: （ここにURLを貼る）\n\n・豆の名前\n・生産国\n・農園名\n・標高\n・精製方法（Washed / Natural / Honey / Anaerobic / Carbonic Maceration / Wet Hulled / Other）\n・購入店（販売元やロースター名）\n・焙煎度（浅煎り / 中煎り / 中深煎り / 深煎り）"},
    {id:"name",label:"☕ 豆の名前から",text:"以下のコーヒー豆について、わかる範囲で情報を教えてください。\n\n豆の名前: （ここに豆の名前を入力）\n\n・生産国\n・農園名\n・標高\n・精製方法（Washed / Natural / Honey / Anaerobic / Carbonic Maceration / Wet Hulled / Other）\n・焙煎度（浅煎り / 中煎り / 中深煎り / 深煎り）"}
  ];
  wrap.appendChild(h("button",{type:"button",className:"ai-btn",onClick:()=>{state.aiOpen=!state.aiOpen;render();}},h("span",{style:{fontSize:"14px"}},"✨"),state.aiOpen?"AIで入力を楽にする ▾":"AIで入力を楽にする ▸"));
  if(state.aiOpen){
    const box=h("div",{className:"ai-box"});
    box.appendChild(h("p",{style:{fontSize:"12px",color:"#8a9bc0",margin:0,fontWeight:600}},"① プロンプトをコピー"));
    prompts.forEach(p=>box.appendChild(h("button",{type:"button",className:"ai-prompt"+(state.aiCopied===p.id?" copied":""),onClick:async()=>{try{await navigator.clipboard.writeText(p.text);}catch{const t=document.createElement("textarea");t.value=p.text;document.body.appendChild(t);t.select();document.execCommand("copy");document.body.removeChild(t);}state.aiCopied=p.id;render();setTimeout(()=>{state.aiCopied=null;render();},2000);}},h("span",null,p.label),h("span",{style:{fontSize:"11px",opacity:0.7}},state.aiCopied===p.id?"✓ コピー済":"コピー"))));
    const pasteDiv=h("div",{style:{display:"flex",flexDirection:"column",gap:6,borderTop:"1px solid rgba(120,140,200,0.1)",paddingTop:"10px"}});
    pasteDiv.appendChild(h("p",{style:{fontSize:"12px",color:"#8a9bc0",margin:0,fontWeight:600}},"② AIの回答を貼り付け"));
    const ta=h("textarea",{placeholder:"AIの回答をそのまま貼り付け",rows:4,style:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(120,140,200,0.2)",borderRadius:"8px",padding:"10px 12px",color:"#ede4da",fontSize:"13px",outline:"none",resize:"vertical",fontFamily:"inherit",lineHeight:1.6},onInput:e=>{state.aiPaste=e.target.value;state.aiResult=null;const btn=document.getElementById("ai-parse-btn");if(btn)btn.style.display=e.target.value.trim()?"block":"none";}});
    ta.value=state.aiPaste;pasteDiv.appendChild(ta);
    pasteDiv.appendChild(h("button",{id:"ai-parse-btn",type:"button",style:{background:"rgba(120,140,200,0.15)",border:"1px solid rgba(120,140,200,0.3)",borderRadius:"8px",padding:"8px 14px",color:"#a0b0d0",fontSize:"13px",cursor:"pointer",fontFamily:"inherit",display:state.aiPaste.trim()&&!state.aiResult?"block":"none"},onClick:()=>{state.aiResult=parseAI(state.aiPaste);render();}},"読み取る"));
    box.appendChild(pasteDiv);
    if(state.aiResult){
      const r=state.aiResult;
      const rDiv=h("div",{style:{display:"flex",flexDirection:"column",gap:6,borderTop:"1px solid rgba(120,140,200,0.1)",paddingTop:"10px",animation:"fadeIn 0.2s ease"}});
      rDiv.appendChild(h("p",{style:{fontSize:"12px",color:"#8a9bc0",margin:0,fontWeight:600}},"③ 確認して反映"));
      const rBox=h("div",{style:{background:"rgba(200,149,108,0.06)",borderRadius:"8px",padding:"10px 12px",display:"flex",flexDirection:"column",gap:"4px"}});
      const rowItem=(emoji,label,val)=>{if(val)rBox.appendChild(h("div",{style:{fontSize:"13px",color:"#b8a590"},innerHTML:`${emoji} ${label}: <span style="color:#ede4da">${val}</span>`}));};
      rowItem("📝","名前",r.name);rowItem("🌍","国",r.country);rowItem("🏔","農園",r.farm);rowItem("📐","標高",r.altitude?r.altitude+"m":"");rowItem("⚙️","精製",r.process);rowItem("🏪","店",r.shop);rowItem("🔥","焙煎度",r.roast);rowItem("📅","焙煎日",r.roastDate);
      rDiv.appendChild(rBox);
      const rBtns=h("div",{style:{display:"flex",gap:6}});
      rBtns.appendChild(h("button",{type:"button",style:{flex:1,background:"rgba(100,180,120,0.2)",border:"1px solid rgba(100,180,120,0.3)",borderRadius:"8px",padding:"8px",color:"#8ac090",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{if(r.name){nb.name=r.name;state.showBeanName=true;}if(r.country)nb.country=r.country;if(r.farm)nb.farm=r.farm;if(r.altitude){nb.altitude=r.altitude;state.showBeanDetail=true;}if(r.process)nb.process=r.process;if(r.shop)nb.shop=r.shop;if(r.roast)nb.roast=r.roast;if(r.roastDate)nb.roastDate=r.roastDate;state.aiPaste="";state.aiResult=null;render();}},"フォームに反映"));
      rBtns.appendChild(h("button",{type:"button",style:{background:"none",border:"1px solid rgba(120,140,200,0.15)",borderRadius:"8px",padding:"8px 12px",color:"#7a8aaa",fontSize:"13px",cursor:"pointer",fontFamily:"inherit"},onClick:()=>{state.aiResult=null;state.aiPaste="";render();}},"やり直す"));
      rDiv.appendChild(rBtns);box.appendChild(rDiv);
    }
    wrap.appendChild(box);
  }
  return wrap;
}

/* ══════════════════════════════════════════════════════════
   推移グラフ（同じ豆の抽出結果の推移）
   ══════════════════════════════════════════════════════════ */
const TREND_LINES=[
  {k:"overall",    l:"おいしさ", color:"#c8956c"},
  {k:"acidity",    l:"酸味",     color:"#e8d44d"},
  {k:"sweetness",  l:"甘味",     color:"#e8a0b4"},
  {k:"bitterness", l:"苦味",     color:"#8ec4a0"},
  {k:"body",       l:"ボディ",   color:"#7a5c3c"},
  {k:"aftertaste", l:"後味",     color:"#9b8cd4"}
];

function trendSVG(recs,tooltipIdx){
  const W=320,H=180,PL=28,PR=12,PT=16,PB=28;
  const iW=W-PL-PR,iH=H-PT-PB;
  const n=recs.length;
  const xPos=i=>n===1?PL+iW/2:PL+i*(iW/(n-1));
  const yPos=v=>PT+iH-(v/5)*iH;
  let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;overflow:visible">`;
  for(let v=0;v<=5;v++){const y=yPos(v);svg+=`<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="rgba(200,149,108,0.1)" stroke-width="0.5"/>`;if(v>0&&v<5)svg+=`<text x="${PL-4}" y="${y}" text-anchor="end" dominant-baseline="middle" style="font-size:8px;fill:#6b5a4e">${v}</text>`;}
  recs.forEach((_,i)=>{svg+=`<text x="${xPos(i)}" y="${H-PB+12}" text-anchor="middle" style="font-size:8px;fill:#6b5a4e">${i+1}</text>`;});
  const drawOrder=[...TREND_LINES.filter(t=>t.k!=="overall"),TREND_LINES.find(t=>t.k==="overall")];
  drawOrder.forEach(({k,color})=>{
    const isOverall=k==="overall";
    const pts=recs.map((r,i)=>({x:xPos(i),y:yPos(r[k]||0),v:r[k]||0}));
    if(!pts.some(p=>p.v>0))return;
    if(pts.length>1){const d=pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");svg+=`<path d="${d}" fill="none" stroke="${color}" stroke-width="${isOverall?2:1.5}" stroke-linejoin="round" stroke-linecap="round" opacity="${isOverall?1:0.75}"/>`;}
    pts.forEach((p,i)=>{const isActive=tooltipIdx===i;const r=isOverall?(isActive?6:5):(isActive?3.5:3);svg+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${color}" stroke="${isActive?"#ede4da":"#1a1410"}" stroke-width="${isActive?1.5:1}"/>`;});
  });
  svg+="</svg>";return svg;
}

function renderTrendSection(){
  const beanCounts={};
  state.records.forEach(r=>{if(r.beanId)beanCounts[r.beanId]=(beanCounts[r.beanId]||0)+1;});
  const eligibleBeans=state.beans.filter(b=>beanCounts[b.id]>=2);
  if(eligibleBeans.length===0)return h("div",{});
  const isOpen=state.trendOpen;
  const wrap=h("div",{style:{marginBottom:"8px",display:"flex",flexDirection:"column",gap:0}});
  wrap.appendChild(h("button",{type:"button",className:"btn-toggle",style:{marginBottom:isOpen?"8px":"0"},onClick:()=>{state.trendOpen=!state.trendOpen;state.trendBeanId=null;state.trendTooltip=null;render();}},isOpen?"▾ 同じ豆の抽出結果の推移":"▸ 同じ豆の抽出結果の推移"));
  if(!isOpen)return wrap;
  const chipRow=h("div",{style:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:"8px"}});
  eligibleBeans.forEach(b=>{const isOn=state.trendBeanId===b.id;chipRow.appendChild(h("button",{type:"button",className:"chip"+(isOn?" on":""),style:{fontSize:"0.8em"},onClick:()=>{state.trendBeanId=isOn?null:b.id;state.trendTooltip=null;render();}},`${beanFlag(b)} ${beanName(b)}`));});
  wrap.appendChild(chipRow);
  if(!state.trendBeanId)return wrap;
  const beanRecs=[...state.records.filter(r=>r.beanId===state.trendBeanId)].reverse();
  const G=getGRINDERS();
  const graphWrap=h("div",{style:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(200,149,108,0.12)",borderRadius:"12px",padding:"12px",display:"flex",flexDirection:"column",gap:8}});
  /* 凡例 */
  const legend=h("div",{style:{display:"flex",flexWrap:"wrap",gap:"6px 12px"}});
  TREND_LINES.forEach(({l,color})=>legend.appendChild(h("div",{style:{display:"flex",alignItems:"center",gap:4}},h("div",{style:{width:"14px",height:"2px",background:color,borderRadius:"1px",flexShrink:0}}),h("span",{style:{fontSize:"10px",color:"#8a7b6e"}},l))));
  graphWrap.appendChild(legend);
  /* グラフ＋タップ領域 */
  const graphContainer=h("div",{style:{position:"relative",width:"100%"}});
  const svgEl=h("div",{innerHTML:trendSVG(beanRecs,state.trendTooltip),style:{pointerEvents:"none"}});
  graphContainer.appendChild(svgEl);
  const hitLayer=h("div",{style:{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"stretch"}});
  const PAD_L=(28/320*100).toFixed(2)+"%",PAD_R=(12/320*100).toFixed(2)+"%";
  hitLayer.appendChild(h("div",{style:{width:PAD_L,flexShrink:0}}));
  const hitInner=h("div",{style:{flex:1,display:"flex"}});
  beanRecs.forEach((_,i)=>{const hit=h("div",{style:{flex:1,cursor:"pointer",WebkitTapHighlightColor:"transparent"}});hit.addEventListener("click",()=>{state.trendTooltip=state.trendTooltip===i?null:i;svgEl.innerHTML=trendSVG(beanRecs,state.trendTooltip);updateTooltip();});hitInner.appendChild(hit);});
  hitLayer.appendChild(hitInner);
  hitLayer.appendChild(h("div",{style:{width:PAD_R,flexShrink:0}}));
  graphContainer.appendChild(hitLayer);
  graphWrap.appendChild(graphContainer);
  /* ツールチップ（エスプレッソ用に強化） */
  const tooltipEl=h("div",{});
  const updateTooltip=()=>{
    tooltipEl.innerHTML="";
    if(state.trendTooltip==null)return;
    const rec=beanRecs[state.trendTooltip];if(!rec)return;
    const gr=G[rec.grinderId];const gn=gr?gr.name:rec.grinderId;
    const inner=h("div",{style:{background:"rgba(30,24,18,0.95)",border:"1px solid rgba(200,149,108,0.25)",borderRadius:"8px",padding:"8px 12px",display:"flex",flexDirection:"column",gap:4,animation:"fadeIn 0.15s ease"}});
    inner.appendChild(h("div",{style:{fontSize:"11px",color:"#8a7b6e"}},`${state.trendTooltip+1}杯目 · ${fmtDate(rec.createdAt)}`));
    /* 抽出パラメータ行 */
    const params=[];
    if(rec.grind!=null&&gr)params.push(`${gn} ${gr.step<1?rec.grind.toFixed(gr.step===0.25?2:1):rec.grind}`);
    if(rec.dose&&rec.yield)params.push(`1:${(rec.yield/rec.dose).toFixed(2)}`);
    if(rec.pressure)params.push(`${rec.pressure}bar`);
    if(rec.timeSec)params.push(`${rec.timeSec}秒`);
    if(params.length)inner.appendChild(h("div",{style:{fontSize:"12px",color:"#ede4da"}},params.join(" · ")));
    /* スコア */
    const scores=TREND_LINES.filter(t=>(rec[t.k]||0)>0);
    if(scores.length){const scoreRow=h("div",{style:{display:"flex",flexWrap:"wrap",gap:"4px 10px",marginTop:"2px"}});scores.forEach(t=>scoreRow.appendChild(h("span",{style:{fontSize:"11px",color:t.color}},`${t.l} ${rec[t.k]}`)));inner.appendChild(scoreRow);}
    tooltipEl.appendChild(inner);
  };
  updateTooltip();
  graphWrap.appendChild(tooltipEl);
  wrap.appendChild(graphWrap);
  return wrap;
}

/* ══════════════════════════════════════════════════════════
   履歴リスト
   ══════════════════════════════════════════════════════════ */
function renderList(app){
  const list=h("div",{style:{animation:"fadeIn 0.3s ease"}});
  if(state.records.length===0){
    list.appendChild(h("div",{className:"empty"},h("div",{style:{fontSize:"48px",marginBottom:"16px"}},"☕"),h("p",{style:{fontSize:"14px",lineHeight:1.8}},"まだ記録がありません。"),h("p",{style:{fontSize:"14px",lineHeight:1.8}},"「＋ 記録する」から最初の一杯を記録しましょう。")));
    _appendDataManagement(list);app.appendChild(list);return;
  }
  list.appendChild(renderTrendSection());
  list.appendChild(h("div",{style:{fontSize:"12px",color:"#6b5a4e",marginBottom:"4px",marginTop:"16px"}},`${state.records.length} 件の記録`));
  state.records.forEach(rec=>list.appendChild(renderCard(rec)));
  _appendDataManagement(list);
  app.appendChild(list);
}

function _appendDataManagement(list){
  const dataDiv=h("div",{style:{marginTop:"24px",paddingTop:"16px",borderTop:"1px solid rgba(200,149,108,0.08)",display:"flex",flexDirection:"column",gap:8}});
  dataDiv.appendChild(h("span",{style:{fontSize:"11px",color:"#6b5a4e"}},"データ管理"));
  const btns=h("div",{style:{display:"flex",gap:8}});
  btns.appendChild(h("button",{type:"button",style:{flex:1,background:"none",border:"1px solid rgba(200,149,108,0.15)",borderRadius:8,padding:"8px",color:"#8a7b6e",fontSize:12,cursor:"pointer",fontFamily:"inherit"},onClick:async()=>{
    const data=db.exportAll();data.photos={};
    for(const rec of data.records){if(rec.hasPhoto){const p=await db.getPhoto(rec.id);if(p)data.photos[rec.id]=p;}}
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`espressolog_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);
  }},"📤 エクスポート"));
  btns.appendChild(h("button",{type:"button",style:{flex:1,background:"none",border:"1px solid rgba(200,149,108,0.15)",borderRadius:8,padding:"8px",color:"#8a7b6e",fontSize:12,cursor:"pointer",fontFamily:"inherit"},onClick:()=>document.getElementById("import-input").click()},"📥 インポート"));
  dataDiv.appendChild(btns);list.appendChild(dataDiv);
}

/* ══════════════════════════════════════════════════════════
   記録カード（表示専用。編集はフォームへ遷移）
   ══════════════════════════════════════════════════════════ */
function renderCard(rec){
  const G=getGRINDERS();
  const bean=state.beans.find(b=>b.id===rec.beanId);
  const gr=G[rec.grinderId];const gn=gr?gr.name:rec.grinderId;
  const exp=state.expandedCard===rec.id;
  const card=h("div",{className:"card",style:{marginBottom:"10px"},onClick:()=>{state.expandedCard=exp?null:rec.id;render();}});
  const hd=h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}});
  const hl=h("div");
  hl.appendChild(h("div",{style:{fontSize:"11px",color:"#6b5a4e"}},fmtDate(rec.createdAt)));
  hl.appendChild(h("div",{style:{fontWeight:600,marginTop:2}},bean?`${beanFlag(bean)} ${beanName(bean)}`:"（豆未選択）"));
  hd.appendChild(hl);
  if(rec.hasPhoto){const tw=h("div",{style:{width:40,height:40,borderRadius:8,overflow:"hidden",flexShrink:0}});db.getPhoto(rec.id).then(p=>{if(p)tw.appendChild(h("img",{src:p,style:{width:"100%",height:"100%",objectFit:"cover"}}));});hd.appendChild(tw);}
  card.appendChild(hd);
  const rv=rec.overall||0;
  card.appendChild(h("div",{style:{fontSize:"0.93em",color:"#c8956c",marginTop:"6px",display:"flex",alignItems:"center",gap:"8px"}},h("span",{style:{fontFamily:"'Cormorant Garamond',Georgia,serif",fontWeight:700,fontSize:"1.1em"}},rv.toFixed(1)),h("span",{innerHTML:starsSVG(rv,16)})));
  const ps=h("div",{style:{display:"flex",gap:10,flexWrap:"wrap",marginTop:6,fontSize:"12px",color:"#8a7b6e"}});
  if(rec.dose)ps.appendChild(h("span",null,`${rec.dose}g→${rec.yield||"?"}g`));
  if(rec.dose&&rec.yield)ps.appendChild(h("span",{style:{color:"#c8956c",fontWeight:600}},`1:${(rec.yield/rec.dose).toFixed(2)}`));
  if(rec.timeSec)ps.appendChild(h("span",null,`${rec.timeSec}秒`));
  if(rec.pressure)ps.appendChild(h("span",null,`${rec.pressure}bar`));
  if(rec.artType)ps.appendChild(h("span",null,`🎨${rec.artType==="その他"?rec.artOther||"Art":rec.artType}`));
  card.appendChild(ps);
  if(!exp&&rec.flavors&&rec.flavors.length>0){const fr=h("div",{className:"flavor-display",style:{marginTop:"6px"}});rec.flavors.forEach(t=>fr.appendChild(h("span",{className:"flavor-badge"},t)));card.appendChild(fr);}

  if(exp){
    const det=h("div",{style:{marginTop:"12px",paddingTop:"12px",borderTop:"1px solid rgba(200,149,108,0.1)"}});
    const info=h("div",{style:{fontSize:"12px",color:"#8a7b6e",display:"flex",flexDirection:"column",gap:"4px",marginBottom:"8px"}});
    if(rec.machine)info.appendChild(h("div",null,"マシン: "+rec.machine));
    if(gr)info.appendChild(h("div",null,`グラインダー: ${gn} / 挽き目: ${rec.grind}`));
    if(rec.tamper)info.appendChild(h("div",null,"タンパー: "+rec.tamper+(rec.tampPressure?" ("+rec.tampPressure+"kg)":"")));
    if(rec.dose&&rec.yield)info.appendChild(h("div",null,`粉量→抽出量: ${rec.dose}g → ${rec.yield}g（レシオ 1:${(rec.yield/rec.dose).toFixed(2)}）`));
    if(rec.pressure)info.appendChild(h("div",null,"抽出圧力: "+rec.pressure+"bar"));
    if(rec.timeSec)info.appendChild(h("div",null,"抽出時間: "+rec.timeSec+"秒"));
    if(rec.milkType)info.appendChild(h("div",null,"ミルク: "+rec.milkType));
    if(rec.espressoMl&&rec.milkMl)info.appendChild(h("div",null,`ラテ: ${rec.espressoMl}ml + ${rec.milkMl}ml（1:${(rec.milkMl/rec.espressoMl).toFixed(1)}）`));
    if(rec.artType){const an=rec.artType==="その他"?rec.artOther||"Art":rec.artType;info.appendChild(h("div",null,`ラテアート: ${an} ${rec.artScore?.toFixed(1)||"?"}/5`));}
    if(bean?.country)info.appendChild(h("div",null,"国: "+bean.country));
    if(bean?.farm)info.appendChild(h("div",null,"農園: "+bean.farm));
    if(bean?.roast)info.appendChild(h("div",null,"焙煎度: "+bean.roast));
    if(bean?.roastDate){const days=Math.floor((new Date(rec.createdAt).getTime()-new Date(bean.roastDate).getTime())/(1000*60*60*24));if(days>=0)info.appendChild(h("div",null,"焙煎日: "+bean.roastDate+"（"+days+"日目）"));}
    det.appendChild(info);
    if(rec.hasPhoto){const pd=h("div",{style:{marginBottom:8}});db.getPhoto(rec.id).then(p=>{if(p)pd.appendChild(h("img",{src:p,style:{width:"100%",borderRadius:"10px"}}));});det.appendChild(pd);}
    if(TASTE.some(t=>rec[t.k]>0)||rec.overall>0)det.appendChild(h("div",{innerHTML:radarSVG(rec),style:{textAlign:"center"}}));
    if(rec.flavors&&rec.flavors.length>0){const fd=h("div",{style:{marginBottom:"8px"}});fd.appendChild(h("div",{style:{fontSize:"11px",color:"#6b5a4e",marginBottom:"6px"}},"フレーバー"));const fb=h("div",{className:"flavor-display"});rec.flavors.forEach(t=>fb.appendChild(h("span",{className:"flavor-badge"},t)));fd.appendChild(fb);if(rec.flavorNote)fd.appendChild(h("p",{style:{fontSize:"12px",color:"#9a8b7e",marginTop:"4px",lineHeight:1.5}},rec.flavorNote));det.appendChild(fd);}
    if(rec.note)det.appendChild(h("p",{style:{fontSize:"13px",color:"#9a8b7e",lineHeight:1.5,margin:0}},rec.note));
    const ab=h("div",{style:{display:"flex",gap:8,marginTop:"10px"}});
    ab.appendChild(h("button",{type:"button",style:{flex:1,background:"rgba(200,149,108,0.15)",border:"1px solid rgba(200,149,108,0.25)",borderRadius:8,padding:"8px",color:"#ede4da",fontSize:"0.8em",cursor:"pointer",fontFamily:"inherit"},onClick:e=>{e.stopPropagation();state._editSave=rec.id;state.brew={...initBrew(),...rec,flavors:rec.flavors?[...rec.flavors]:[]};db.getPhoto(rec.id).then(p=>{state.photoData=p;state.view="add";render();});}},"✏️ 編集"));
    ab.appendChild(h("button",{type:"button",style:{flex:1,background:"none",border:"1px solid rgba(200,100,100,0.3)",borderRadius:8,padding:"8px",color:"#c87070",fontSize:"0.8em",cursor:"pointer",fontFamily:"inherit"},onClick:e=>{e.stopPropagation();if(!confirm("この記録を削除しますか？"))return;state.records=state.records.filter(r=>r.id!==rec.id);db.deletePhoto(rec.id);save();render();}},"🗑 削除"));
    det.appendChild(ab);card.appendChild(det);
  }
  return card;
}

/* ══════════════════════════════════════════════════════════
   写真・インポート ハンドラ
   ══════════════════════════════════════════════════════════ */
document.getElementById("photo-input").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  state.photoData=await compressPhoto(file);e.target.value="";
  const pa=document.getElementById("photo-area");if(!pa)return;
  pa.className="photo-area has-photo";pa.innerHTML="";
  pa.appendChild(h("img",{src:state.photoData}));
  pa.appendChild(h("button",{type:"button",className:"photo-remove",onClick:ev=>{ev.stopPropagation();state.photoData=null;pa.className="photo-area";pa.innerHTML="";pa.appendChild(h("div",{style:{color:"#6b5a4e",fontSize:"13px"}},"📸 タップして写真を追加"));}},"✕"));
});

document.getElementById("import-input").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(!data.records||!data.beans){alert("無効なバックアップファイルです");e.target.value="";return;}
    if(!confirm(`${data.records.length}件の記録と${data.beans.length}件の豆データをインポートします。現在のデータは上書きされます。よろしいですか？`)){e.target.value="";return;}
    db.importAll(data);
    if(data.photos){for(const[id,p]of Object.entries(data.photos))await db.savePhoto(id,p);}
    state.records=db.getRecords();state.beans=db.getBeans();state.equip=db.getEquip();state.machines=db.getMachines();state.tampers=db.getTampers();
    render();alert("インポート完了！");
  }catch(err){alert("インポートエラー: "+err.message);}
  e.target.value="";
});

/* ══════════════════════════════════════════════════════════
   Init
   ══════════════════════════════════════════════════════════ */
render();
if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(()=>{});}
