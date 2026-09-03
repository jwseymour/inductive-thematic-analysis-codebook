"use strict";
(function(){
const PALETTE=["#c8553d","#3d7d9e","#5b8c5a","#b0843b","#8d5b9e","#3f8f8a","#a85c7a","#6a76b8","#7d8a3c","#9a6b4f","#7a6f9c","#4c8b6b","#b5654d","#4f7bb0","#a06c8e","#6f9440"];
const LS_KEY="codebook-project-v1";
const LS_SEEN="codebook-seen-v1";
const LS_THEME="codebook-theme";

let state=null, viewingExample=false;

/* ---------- utils ---------- */
const uid=()=>Math.random().toString(36).slice(2,9);
const $=s=>document.querySelector(s);
const el=(t,a={},kids=[])=>{const e=document.createElement(t);for(const k in a){if(k==="class")e.className=a[k];else if(k==="html")e.innerHTML=a[k];else if(k==="text")e.textContent=a[k];else if(k.startsWith("on"))e.addEventListener(k.slice(2),a[k]);else e.setAttribute(k,a[k]);}for(const kd of [].concat(kids))if(kd!=null)e.append(kd.nodeType?kd:document.createTextNode(kd));return e;};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("on"),2200);}
const norm=s=>String(s).replace(/\s+/g," ").trim();
const cap=s=>String(s).charAt(0).toUpperCase()+String(s).slice(1);

function blankProject(name){
  return {version:2,name:name||"Untitled project",createdAt:Date.now(),updatedAt:Date.now(),
    analyst:"", note:"",
    sections:[], sources:[], codes:[], segments:[], themes:[],
    ui:{view:"data",section:"__all",openSrc:null}
  };
}
function save(){ if(viewingExample) return; state.updatedAt=Date.now(); try{localStorage.setItem(LS_KEY,JSON.stringify(state));}catch(e){} }
function load(){ try{const r=localStorage.getItem(LS_KEY); return r?JSON.parse(r):null;}catch(e){return null;} }

function codeById(id){return state.codes.find(c=>c.id===id);}
function themeById(id){return state.themes.find(t=>t.id===id);}
function srcById(id){return state.sources.find(s=>s.id===id);}
function nextColor(){const used=new Set(state.codes.map(c=>c.color));return PALETTE.find(c=>!used.has(c))||PALETTE[state.codes.length%PALETTE.length];}
function segsFor(srcId,pi){return state.segments.filter(s=>s.sourceId===srcId&&s.paraIndex===pi);}
function codeExtractCount(cid){return state.segments.filter(s=>s.codeIds.includes(cid)).length;}
function codeSections(cid){const set=new Set();state.segments.filter(s=>s.codeIds.includes(cid)).forEach(s=>{const src=srcById(s.sourceId);if(src&&src.section)set.add(src.section);});return [...set];}
function themeExtracts(t){const cset=new Set(t.codeIds);return state.segments.filter(s=>s.codeIds.some(c=>cset.has(c)));}
function activeSection(){return state.ui.section;}
function sectionMatch(sec){const a=activeSection();return a==="__all"||a===sec||!sec;}
function ensureSection(sec){if(sec&&!state.sections.includes(sec))state.sections.push(sec);}
function filteredCodes(){const a=activeSection();return state.codes.filter(c=>a==="__all"||codeSections(c.id).includes(a)||codeSections(c.id).length===0);}
function filteredThemes(){const a=activeSection();return state.themes.filter(t=>a==="__all"||(t.section||"")===a).slice().sort((x,y)=>(x.order||0)-(y.order||0));}
function bySecLabel(a,b){const sa=(codeSections(a.id)[0]||""),sb=(codeSections(b.id)[0]||"");return sa.localeCompare(sb)||a.label.toLowerCase().localeCompare(b.label.toLowerCase());}

/* ---------- rail ---------- */
function renderRail(){
  const rail=$("#rail");rail.innerHTML="";

  const wb=el("div");
  wb.append(el("h4",{text:"Workbench"}));
  const nl=el("div",{class:"navlinks"});
  [["data","Sources & coding",state.sources.length],
   ["codes","Codes",state.codes.length],
   ["themes","Themes",state.themes.length],
   ["export","Export",""]].forEach(([v,label,c])=>{
    const b=el("button",{class:"navlink"+(state.ui.view===v?" active":""),onclick:()=>setView(v)});
    b.append(el("span",{text:label}));
    if(c!=="")b.append(el("span",{class:"count",text:c}));
    nl.append(b);
  });
  wb.append(nl);
  rail.append(wb);

  const stat=el("div");
  stat.append(el("h4",{text:"Totals"}));
  const sg=el("div",{class:"railstats"});
  [["sources",state.sources.length],["extracts",state.segments.length],["codes",state.codes.length],["themes",state.themes.length]].forEach(([k,n])=>{
    sg.append(el("div",{class:"rs",html:'<span class="rn">'+n+'</span><span class="rk">'+k+'</span>'}));
  });
  stat.append(sg);
  rail.append(stat);

  const fs=el("div",{class:"files"});
  fs.append(el("h4",{text:"Project"}));
  const ra=el("div",{class:"rail-actions"});
  ra.append(el("button",{text:"New project",onclick:newProject}));
  ra.append(el("button",{text:"Load demo project",onclick:()=>confirmModal("Load the demo project?","Replaces the current project with a small synthetic example (made-up data). Export yours first if you want to keep it.",loadExample)}));
  ra.append(el("button",{text:"Import project (JSON)",onclick:importProject}));
  ra.append(el("button",{text:"Export project (JSON)",onclick:exportProject}));
  ra.append(el("button",{text:(document.documentElement.dataset.theme==="dark"?"Light theme":"Dark theme"),onclick:toggleTheme}));
  fs.append(ra);
  rail.append(fs);
}
function toggleTheme(){
  const cur=document.documentElement.dataset.theme;
  const next=cur==="dark"?"light":(cur==="light"?"dark":(matchMedia("(prefers-color-scheme:dark)").matches?"light":"dark"));
  document.documentElement.dataset.theme=next;
  try{localStorage.setItem(LS_THEME,next);}catch(e){}
  renderRail();
}
function renderSectionSel(){
  const sel=$("#sectionSel");sel.innerHTML="";
  sel.append(el("option",{value:"__all",text:"All data sets"}));
  state.sections.forEach(s=>sel.append(el("option",{value:s,text:s})));
  sel.value=state.ui.section;
}

/* ---------- views ---------- */
function setView(v){state.ui.view=v;save();render();}
function render(){
  $("#projName").textContent=state.name;
  renderRail();renderSectionSel();
  const m=$("#main");m.innerHTML="";
  ({data:renderData,codes:renderCodes,themes:renderThemes,export:renderExport}[state.ui.view]||renderData)(m);
}
function head(title,desc){
  const h=el("div",{class:"view-head"});
  h.append(el("h2",{text:title}));
  if(desc)h.append(el("p",{text:desc}));
  return h;
}
function exampleBanner(){
  if(!viewingExample)return null;
  const b=el("div",{class:"banner"});
  b.append(el("span",{html:"<strong>Demo project</strong> — synthetic data, just to show how it works. Have a poke around; nothing is saved. "}));
  b.append(el("button",{class:"btn sm",text:"Start my own →",onclick:newProject}));
  return b;
}
function emptyState(title,msg,cta){
  const e=el("div",{class:"empty"});
  e.append(el("h3",{text:title}));
  e.append(el("p",{text:msg}));
  if(cta)e.append(el("button",{class:"btn primary",text:"Add source",onclick:cta}));
  return e;
}

/* --- SOURCES & CODING --- */
function renderData(m){
  const v=el("div",{class:"view"});
  const bn=exampleBanner();if(bn)v.append(bn);
  v.append(head("Sources & coding","Add your transcripts and notes, then select any passage and code it. Coded passages are highlighted — click one to change or remove its codes."));

  const add=el("div",{class:"panel row"});
  add.append(el("button",{class:"btn primary",text:"Add source",onclick:addSourceModal}));
  add.append(el("button",{class:"btn",text:"Import .txt file",onclick:importTxt}));
  add.append(el("span",{class:"muted",style:"font-size:12px",text:"One source = one transcript / document. Give it a data-set label to keep separate analyses apart."}));
  v.append(add);

  const list=el("div",{style:"margin-top:14px"});
  const srcs=state.sources.filter(s=>sectionMatch(s.section));
  if(!srcs.length)list.append(emptyState("No sources yet","Add a transcript or document, or load the demo project from the Project menu.",addSourceModal));
  const groups={};
  srcs.forEach(s=>{(groups[s.section||"(unlabelled)"]=groups[s.section||"(unlabelled)"]||[]).push(s);});
  Object.keys(groups).sort().forEach(g=>{
    if(activeSection()==="__all")list.append(el("h4",{class:"group-h",text:g}));
    groups[g].forEach(s=>list.append(sourceItem(s)));
  });
  v.append(list);
  m.append(v);
}
function sourceItem(s){
  const open=state.ui.openSrc===s.id;
  const wrap=el("div",{class:"src-item"});
  const h=el("div",{class:"src-head",onclick:()=>{state.ui.openSrc=open?null:s.id;save();render();}});
  h.append(el("span",{class:"nm",text:s.name}));
  if(s.section)h.append(el("span",{class:"tag",text:s.section}));
  if(s.participant)h.append(el("span",{class:"tag",text:s.participant}));
  const nseg=state.segments.filter(x=>x.sourceId===s.id).length;
  h.append(el("span",{class:"cnt",text:nseg+" extract"+(nseg===1?"":"s")}));
  wrap.append(h);
  if(open){
    const b=el("div",{class:"src-body"});
    const tools=el("div",{class:"row",style:"margin-bottom:4px"});
    tools.append(el("button",{class:"btn sm ghost",text:"Edit source",onclick:()=>editSourceModal(s)}));
    tools.append(el("button",{class:"btn sm ghost danger",text:"Delete source",onclick:()=>confirmModal("Delete this source?","Its "+nseg+" coded extract(s) go too.",()=>{state.segments=state.segments.filter(x=>x.sourceId!==s.id);state.sources=state.sources.filter(x=>x.id!==s.id);save();render();})}));
    b.append(tools);
    if(s.note)b.append(el("div",{class:"src-note",text:s.note}));
    const rd=el("div",{class:"reader"});
    s.paragraphs.forEach((para,pi)=>{
      const p=el("p",{class:"para","data-src":s.id,"data-para":pi});
      p.innerHTML=renderParaHTML(s,pi,para);
      rd.append(p);
    });
    b.append(rd);
    wrap.append(b);
  }
  return wrap;
}
function renderParaHTML(s,pi,full){
  const mm=full.match(/^([A-Za-z0-9 .]{1,24}:)\s/);
  const segs=segsFor(s.id,pi).slice().sort((a,b)=>a.start-b.start||a.end-b.end);
  let body;
  if(!segs.length){ body=esc(full); }
  else{
    const pts=new Set([0,full.length]);
    segs.forEach(sg=>{pts.add(Math.max(0,Math.min(full.length,sg.start)));pts.add(Math.max(0,Math.min(full.length,sg.end)));});
    const sorted=[...pts].sort((a,b)=>a-b);
    body="";
    for(let i=0;i<sorted.length-1;i++){
      const a=sorted[i],bb=sorted[i+1];
      if(bb<=a)continue;
      const chunk=full.slice(a,bb);
      const cover=segs.filter(sg=>sg.start<=a&&sg.end>=bb);
      if(!cover.length){body+=esc(chunk);continue;}
      const top=cover[0];
      const cc=(top.codeIds[0]&&codeById(top.codeIds[0])||{}).color||"var(--accent)";
      const multi=cover.length>1||top.codeIds.length>1;
      body+='<span class="coded'+(multi?" multi":"")+'" data-segs="'+cover.map(c=>c.id).join(",")+'" style="--cc:'+cc+'">'+esc(chunk)+"</span>";
    }
  }
  if(mm)body=body.replace(/^([A-Za-z0-9 .]{1,24}:)/,'<span class="sp">$1</span>');
  return body;
}

/* selection -> code (unchanged engine) */
let curSel=null;
function textOffset(root,node,off){
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);
  let acc=0,n;
  while((n=w.nextNode())){ if(n===node)return acc+off; acc+=n.nodeValue.length; }
  return acc;
}
document.addEventListener("selectionchange",()=>{
  const tip=$("#seltip");
  const sel=window.getSelection();
  if(!sel.rangeCount||sel.isCollapsed){tip.style.display="none";curSel=null;return;}
  const r=sel.getRangeAt(0);
  const pA=r.startContainer.parentElement&&r.startContainer.parentElement.closest(".para");
  const pB=r.endContainer.parentElement&&r.endContainer.parentElement.closest(".para");
  if(!pA||pA!==pB){tip.style.display="none";curSel=null;return;}
  const src=srcById(pA.dataset.src),pi=+pA.dataset.para;
  const full=src.paragraphs[pi];
  let start=textOffset(pA,r.startContainer,r.startOffset);
  let end=textOffset(pA,r.endContainer,r.endOffset);
  if(start>end)[start,end]=[end,start];
  while(start<end&&/\s/.test(full[start]))start++;
  while(end>start&&/\s/.test(full[end-1]))end--;
  if(end-start<2){tip.style.display="none";curSel=null;return;}
  curSel={sourceId:src.id,paraIndex:pi,start,end,text:full.slice(start,end)};
  const rect=r.getBoundingClientRect();
  tip.style.display="flex";
  tip.style.left=Math.max(8,Math.min(window.innerWidth-160,rect.left+rect.width/2-70))+"px";
  tip.style.top=Math.max(8,rect.top-40)+"px";
});
$("#seltipCode").addEventListener("click",()=>{ if(curSel)openPicker(curSel); });

function openPicker(target,existingSegId){
  const pk=$("#picker");pk.innerHTML="";
  const inp=el("input",{class:"txt",placeholder:"filter or type a new code…"});
  pk.append(inp);
  const listWrap=el("div",{class:"plist"});
  pk.append(listWrap);
  function paint(){
    listWrap.innerHTML="";
    const q=inp.value.trim().toLowerCase();
    state.codes.filter(c=>c.label.toLowerCase().includes(q)).slice(0,40).forEach(c=>{
      const o=el("div",{class:"popt",onclick:()=>{applyCode(target,c.id,existingSegId);closePicker();}});
      o.append(el("span",{class:"dot",style:"background:"+c.color}));
      o.append(el("span",{text:c.label}));
      o.append(el("span",{style:"margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--ink-faint)",text:codeExtractCount(c.id)}));
      listWrap.append(o);
    });
    if(inp.value.trim()&&!state.codes.some(c=>c.label.toLowerCase()===q)){
      const o=el("div",{class:"popt mk",onclick:()=>{
        const nc={id:uid(),label:inp.value.trim(),color:nextColor(),memo:""};
        state.codes.push(nc);applyCode(target,nc.id,existingSegId);closePicker();
      }});
      o.append(el("span",{class:"dot",style:"background:"+nextColor()}));
      o.append(el("span",{text:'Create code “'+inp.value.trim()+'”'}));
      listWrap.append(o);
    }
  }
  inp.addEventListener("input",paint);
  paint();
  pk.style.display="block";
  const tr=$("#seltip").getBoundingClientRect();
  pk.style.left=Math.max(8,Math.min(window.innerWidth-296,tr.left))+"px";
  pk.style.top=Math.min(window.innerHeight-260,tr.bottom+6)+"px";
  setTimeout(()=>inp.focus(),0);
}
function closePicker(){$("#picker").style.display="none";}
function applyCode(target,codeId,existingSegId){
  if(existingSegId){
    const sg=state.segments.find(s=>s.id===existingSegId);
    if(sg&&!sg.codeIds.includes(codeId))sg.codeIds.push(codeId);
  }else{
    let sg=state.segments.find(s=>s.sourceId===target.sourceId&&s.paraIndex===target.paraIndex&&s.start===target.start&&s.end===target.end);
    if(!sg){sg={id:uid(),sourceId:target.sourceId,paraIndex:target.paraIndex,start:target.start,end:target.end,text:target.text,codeIds:[]};state.segments.push(sg);}
    if(!sg.codeIds.includes(codeId))sg.codeIds.push(codeId);
  }
  window.getSelection().removeAllRanges();
  $("#seltip").style.display="none";
  save();render();toast("Coded");
}
document.addEventListener("click",e=>{
  if(!e.target.closest("#picker")&&!e.target.closest("#seltip"))closePicker();
  const cs=e.target.closest(".coded");
  if(cs)inspectSegments(cs.dataset.segs.split(","));
});
function inspectSegments(ids){
  const segs=ids.map(i=>state.segments.find(s=>s.id===i)).filter(Boolean);
  if(!segs.length)return;
  const body=el("div");
  segs.forEach(sg=>{
    const block=el("div",{style:"padding:10px 0;border-bottom:1px solid var(--hairline)"});
    block.append(el("div",{style:"font-size:12.5px;font-style:italic;color:var(--ink-soft);margin-bottom:8px",text:'“'+sg.text+'”'}));
    const chips=el("div",{class:"row",style:"gap:6px"});
    sg.codeIds.forEach(cid=>{
      const c=codeById(cid);if(!c)return;
      const ch=el("span",{class:"chip",style:"--cc:"+c.color});
      ch.append(el("span",{class:"dot"}),document.createTextNode(c.label));
      ch.append(el("button",{text:"×",title:"remove code from this extract",onclick:()=>{sg.codeIds=sg.codeIds.filter(x=>x!==cid);if(!sg.codeIds.length)state.segments=state.segments.filter(x=>x.id!==sg.id);save();closeModal();render();}}));
      chips.append(ch);
    });
    block.append(chips);
    const acts=el("div",{class:"row",style:"gap:6px;margin-top:8px"});
    acts.append(el("button",{class:"btn sm",text:"Add code",onclick:()=>{closeModal();openPickerForSeg(sg);}}));
    acts.append(el("button",{class:"btn sm ghost danger",text:"Delete extract",onclick:()=>{state.segments=state.segments.filter(x=>x.id!==sg.id);save();closeModal();render();}}));
    block.append(acts);
    body.append(block);
  });
  showModal("Coded extract",body,[["Close",closeModal]]);
}
function openPickerForSeg(sg){
  const tip=$("#seltip");tip.style.display="flex";tip.style.left=(window.innerWidth/2-70)+"px";tip.style.top=(window.innerHeight/2-120)+"px";
  openPicker(null,sg.id);
  tip.style.display="none";
}

/* --- CODES --- */
function renderCodes(m){
  const v=el("div",{class:"view"});
  const bn=exampleBanner();if(bn)v.append(bn);
  v.append(head("Codes","Every code you've applied, and how many extracts carry it. Rename, recolour, merge duplicates, or write the one-line memo that becomes the codebook's last column."));
  const codes=filteredCodes();
  if(!codes.length){v.append(emptyState("No codes yet","Go to Sources & coding, select a passage, and create your first code."));m.append(v);return;}
  const pnl=el("div",{class:"panel"});
  codes.slice().sort((a,b)=>codeExtractCount(b.id)-codeExtractCount(a.id)).forEach(c=>{
    const r=el("div",{class:"code-row",style:"--cc:"+c.color});
    r.append(el("span",{class:"swatch"}));
    const cn=el("div");
    cn.append(el("div",{class:"cn",text:c.label}));
    if(c.memo)cn.append(el("div",{class:"muted",style:"font-size:11.5px;margin-top:2px",text:c.memo}));
    const secs=codeSections(c.id);
    if(secs.length)cn.append(el("div",{class:"meta",text:secs.join(" · ")}));
    r.append(cn);
    r.append(el("span",{class:"meta",text:codeExtractCount(c.id)+" ext"}));
    const acts=el("div",{class:"acts"});
    acts.append(el("button",{class:"btn sm ghost",text:"Edit",onclick:()=>editCodeModal(c)}));
    acts.append(el("button",{class:"btn sm ghost",text:"Merge",onclick:()=>mergeCodeModal(c)}));
    acts.append(el("button",{class:"btn sm ghost danger",text:"Delete",onclick:()=>confirmModal("Delete code “"+c.label+"”?","Removed from "+codeExtractCount(c.id)+" extract(s) and from any theme.",()=>deleteCode(c.id))}));
    r.append(acts);
    pnl.append(r);
  });
  v.append(pnl);
  m.append(v);
}
function deleteCode(id){
  state.segments.forEach(s=>s.codeIds=s.codeIds.filter(x=>x!==id));
  state.segments=state.segments.filter(s=>s.codeIds.length);
  state.themes.forEach(t=>t.codeIds=t.codeIds.filter(x=>x!==id));
  state.codes=state.codes.filter(c=>c.id!==id);
  save();render();
}
function editCodeModal(c){
  const body=el("div");
  body.append(el("label",{class:"fl",text:"Code label"}));
  const nm=el("input",{class:"txt"});nm.value=c.label;body.append(nm);
  body.append(el("label",{class:"fl",text:"Colour"}));
  const sw=el("div",{class:"row",style:"gap:6px"});
  PALETTE.forEach(col=>sw.append(el("button",{style:"width:22px;height:22px;border-radius:5px;background:"+col+";border:2px solid "+(c.color===col?"var(--ink)":"transparent"),onclick:()=>{c.color=col;save();closeModal();render();}})));
  body.append(sw);
  body.append(el("label",{class:"fl",text:"Memo — what this code captures (codebook column)"}));
  const mo=el("textarea",{class:"txt"});mo.value=c.memo||"";body.append(mo);
  showModal("Edit code",body,[["Cancel",closeModal],["Save",()=>{c.label=nm.value.trim()||c.label;c.memo=mo.value.trim();save();closeModal();render();},"primary"]]);
}
function mergeCodeModal(c){
  const body=el("div");
  body.append(el("p",{text:"Move all extracts from “"+c.label+"” onto another code, then delete “"+c.label+"”."}));
  const sel=el("select",{class:"sel"});
  state.codes.filter(x=>x.id!==c.id).forEach(x=>sel.append(el("option",{value:x.id,text:x.label})));
  body.append(sel);
  showModal("Merge code",body,[["Cancel",closeModal],["Merge",()=>{
    const tgt=sel.value;
    state.segments.forEach(s=>{if(s.codeIds.includes(c.id))s.codeIds=[...new Set(s.codeIds.map(x=>x===c.id?tgt:x))];});
    state.themes.forEach(t=>{if(t.codeIds.includes(c.id))t.codeIds=[...new Set(t.codeIds.map(x=>x===c.id?tgt:x))];});
    state.codes=state.codes.filter(x=>x.id!==c.id);
    save();closeModal();render();
  },"primary"]]);
}

/* --- THEMES --- */
function renderThemes(m){
  const v=el("div",{class:"view"});
  const bn=exampleBanner();if(bn)v.append(bn);
  v.append(head("Themes","Group codes into themes so the exports can collate extracts by theme. The interpreting happens in your write-up; this is just the grouping."));
  const bar=el("div",{class:"panel row"});
  bar.append(el("button",{class:"btn primary",text:"New theme",onclick:()=>newThemeModal()}));
  bar.append(el("span",{class:"muted",style:"font-size:12px",text:"Give a theme the same data-set label as its codes."}));
  v.append(bar);

  const themes=filteredThemes();
  themes.forEach(t=>v.append(themeCard(t)));

  const inThemes=new Set();state.themes.forEach(t=>t.codeIds.forEach(c=>inThemes.add(c)));
  const loose=filteredCodes().filter(c=>!inThemes.has(c.id));
  const u=el("div",{class:"unthemed",style:"margin-top:8px"});
  u.append(el("h4",{class:"group-h",text:"Codes not yet in a theme ("+loose.length+")"}));
  if(!loose.length)u.append(el("span",{class:"muted",style:"font-size:12px",text:"None — every code sits in at least one theme."}));
  const lc=el("div",{class:"row",style:"gap:6px"});
  loose.forEach(c=>{
    const ch=el("span",{class:"chip",style:"--cc:"+c.color});
    ch.append(el("span",{class:"dot"}),document.createTextNode(c.label+" ("+codeExtractCount(c.id)+")"));
    if(state.themes.length){
      const s=el("select",{class:"chip-sel"});
      s.append(el("option",{value:"",text:"+ theme"}));
      state.themes.slice().sort((a,b)=>(a.order||0)-(b.order||0)).forEach(t=>s.append(el("option",{value:t.id,text:t.name})));
      s.addEventListener("change",()=>{if(s.value){themeById(s.value).codeIds.push(c.id);save();render();}});
      ch.append(s);
    }
    lc.append(ch);
  });
  u.append(lc);
  v.append(u);
  m.append(v);
}
function themeCard(t){
  const card=el("div",{class:"theme-card"});
  const h=el("div",{class:"tc-head"});
  h.append(el("h3",{text:t.name}));
  if(t.section)h.append(el("span",{class:"tag",text:t.section}));
  h.append(el("span",{class:"tc-count",text:themeExtracts(t).length+" extracts · "+t.codeIds.length+" codes"}));
  card.append(h);
  if(t.definition)card.append(el("div",{class:"def",text:t.definition}));
  const chips=el("div",{class:"chips"});
  t.codeIds.forEach(cid=>{
    const c=codeById(cid);if(!c)return;
    const ch=el("span",{class:"chip",style:"--cc:"+c.color});
    ch.append(el("span",{class:"dot"}),document.createTextNode(c.label));
    ch.append(el("button",{text:"×",title:"remove from theme",onclick:()=>{t.codeIds=t.codeIds.filter(x=>x!==cid);save();render();}}));
    chips.append(ch);
  });
  card.append(chips);
  const tools=el("div",{class:"tc-tools"});
  tools.append(el("button",{class:"btn sm",text:"Add codes",onclick:()=>addCodesToThemeModal(t)}));
  tools.append(el("button",{class:"btn sm ghost",text:"Edit",onclick:()=>newThemeModal(t)}));
  tools.append(el("button",{class:"btn sm ghost",text:"↑",onclick:()=>reorderTheme(t,-1)}));
  tools.append(el("button",{class:"btn sm ghost",text:"↓",onclick:()=>reorderTheme(t,1)}));
  tools.append(el("button",{class:"btn sm ghost danger",text:"Delete",onclick:()=>confirmModal("Delete theme “"+t.name+"”?","The codes stay; they return to the unthemed pool.",()=>{state.themes=state.themes.filter(x=>x.id!==t.id);save();render();})}));
  card.append(tools);
  return card;
}
function reorderTheme(t,dir){
  const same=state.themes.filter(x=>x.section===t.section).sort((a,b)=>(a.order||0)-(b.order||0));
  const i=same.indexOf(t),j=i+dir;
  if(j<0||j>=same.length)return;
  const o1=same[i].order||0,o2=same[j].order||0;
  same[i].order=o2;same[j].order=o1;
  save();render();
}
function newThemeModal(t){
  const body=el("div");
  body.append(el("label",{class:"fl",text:"Theme name"}));
  const nm=el("input",{class:"txt",placeholder:"e.g. The grandparent reflex"});nm.value=t?t.name:"";body.append(nm);
  body.append(el("label",{class:"fl",text:"Data set"}));
  const sec=el("input",{class:"txt",placeholder:"drawing / names / ui …",list:"secdl"});sec.value=t?(t.section||""):(activeSection()==="__all"?"":activeSection());body.append(sec);
  const dl=el("datalist",{id:"secdl"});state.sections.forEach(s=>dl.append(el("option",{value:s})));body.append(dl);
  body.append(el("label",{class:"fl",text:"Definition (optional — appears in the themes export)"}));
  const df=el("textarea",{class:"txt"});df.value=t?(t.definition||""):"";body.append(df);
  showModal(t?"Edit theme":"New theme",body,[["Cancel",closeModal],[t?"Save":"Create",()=>{
    if(!nm.value.trim())return;
    ensureSection(sec.value.trim());
    if(t){t.name=nm.value.trim();t.section=sec.value.trim();t.definition=df.value.trim();}
    else state.themes.push({id:uid(),name:nm.value.trim(),section:sec.value.trim(),definition:df.value.trim(),codeIds:[],order:state.themes.length});
    save();closeModal();render();
  },"primary"]]);
}
function addCodesToThemeModal(t){
  const body=el("div");
  body.append(el("p",{text:"Tick codes to add to “"+t.name+"”."}));
  const box=el("div",{style:"max-height:340px;overflow:auto"});
  state.codes.filter(c=>!t.codeIds.includes(c.id)).sort((a,b)=>a.label.localeCompare(b.label)).forEach(c=>{
    const l=el("label",{style:"display:flex;gap:8px;align-items:center;padding:5px 2px;font-size:12.5px"});
    l.append(el("input",{type:"checkbox",value:c.id}),el("span",{class:"dot",style:"width:8px;height:8px;border-radius:50%;background:"+c.color}),el("span",{text:c.label+"  ("+codeExtractCount(c.id)+")"}));
    box.append(l);
  });
  body.append(box);
  showModal("Add codes to theme",body,[["Cancel",closeModal],["Add",()=>{
    box.querySelectorAll("input:checked").forEach(cb=>t.codeIds.push(cb.value));
    save();closeModal();render();
  },"primary"]]);
}

/* --- EXPORT --- */
function renderExport(m){
  const v=el("div",{class:"view"});
  const bn=exampleBanner();if(bn)v.append(bn);
  v.append(head("Export","Chunks to copy into your write-up. Everything here respects the data-set filter in the top bar — set it to one data set to export just that."));

  if(!state.segments.length){v.append(emptyState("Nothing to export yet","Code some passages first."));m.append(v);return;}

  const a=activeSection();
  v.append(exportPanel("Codebook — Markdown table",
    "Code, extract count, data set, theme(s), and the memo. Paste as an appendix.",
    expCodebookMD(), (state.name||"codebook")+".codebook.md"));
  v.append(exportPanel("Codebook — CSV",
    "Same columns, for a spreadsheet.",
    expCodebookCSV(), (state.name||"codebook")+".codebook.csv"));
  v.append(exportPanel("Coded extracts — grouped by theme",
    "Every coded passage under its theme, with participant and codes. This is the big appendix.",
    expExtractsByTheme(), (state.name||"extracts")+".by-theme.md"));
  v.append(exportPanel("Coded extracts — grouped by code",
    "Same passages, grouped by code instead. Handy when writing a specific code up.",
    expExtractsByCode(), (state.name||"extracts")+".by-code.md"));
  v.append(exportPanel("Themes + definitions",
    "The theme list with counts, codes and any definition you've written.",
    expThemes(), (state.name||"themes")+".themes.md"));
  v.append(exportPanel("Everything — one Markdown bundle",
    "Themes, then extracts by theme, then the codebook — a starting point you write around.",
    expBundle(), (state.name||"analysis")+".bundle.md"));
  m.append(v);
}
function exportPanel(title,desc,text,filename){
  const p=el("div",{class:"panel export-panel"});
  const hd=el("div",{class:"row",style:"justify-content:space-between;align-items:flex-start"});
  const l=el("div");
  l.append(el("h4",{style:"font-family:var(--serif);font-weight:500;font-size:16px",text:title}));
  l.append(el("div",{class:"muted",style:"font-size:12px;margin-top:2px;max-width:52ch",text:desc}));
  const acts=el("div",{class:"row",style:"gap:6px;flex:none"});
  acts.append(el("button",{class:"btn sm primary",text:"Copy",onclick:()=>copyText(text)}));
  acts.append(el("button",{class:"btn sm",text:"Download",onclick:()=>downloadText(text,filename)}));
  hd.append(l,acts);
  p.append(hd);
  const ta=el("textarea",{class:"export-out",readonly:"readonly"});ta.value=text;
  ta.addEventListener("focus",()=>ta.select());
  p.append(ta);
  return p;
}
function extractLabel(s){return s.codeIds.map(c=>(codeById(c)||{}).label).filter(Boolean).join(", ");}
function whoOf(s){const src=srcById(s.sourceId)||{};return src.participant||src.name||"?";}
function sectionsForExport(){
  const a=activeSection();
  if(a!=="__all")return [a];
  return state.sections.length?state.sections.slice():["(all)"];
}
function expCodebookMD(){
  const L=["| Code | Extracts | Data set | Theme(s) | What it captures |","|---|---|---|---|---|"];
  filteredCodes().slice().sort(bySecLabel).forEach(c=>{
    const th=state.themes.filter(t=>t.codeIds.includes(c.id)).map(t=>t.name).join("; ");
    L.push("| "+c.label+" | "+codeExtractCount(c.id)+" | "+(codeSections(c.id).join("; ")||"—")+" | "+(th||"—")+" | "+(c.memo||"").replace(/\|/g,"/")+" |");
  });
  return L.join("\n");
}
function expCodebookCSV(){
  const q=x=>'"'+String(x).replace(/"/g,'""')+'"';
  const L=["code,extracts,data_set,themes,what_it_captures"];
  filteredCodes().slice().sort(bySecLabel).forEach(c=>{
    const th=state.themes.filter(t=>t.codeIds.includes(c.id)).map(t=>t.name).join("; ");
    L.push([c.label,codeExtractCount(c.id),codeSections(c.id).join("; "),th,c.memo||""].map(q).join(","));
  });
  return L.join("\n");
}
function expExtractsByTheme(){
  const L=[];const all=activeSection()==="__all";
  sectionsForExport().forEach(sec=>{
    const th=state.themes.filter(t=>(t.section||"(all)")===sec).sort((a,b)=>(a.order||0)-(b.order||0));
    if(!th.length)return;
    if(all)L.push("## "+cap(sec),"");
    th.forEach(t=>{
      const ex=themeExtracts(t);
      L.push("**"+t.name+"** — "+ex.length+" extract"+(ex.length===1?"":"s"),"");
      ex.forEach(s=>L.push("- “"+norm(s.text)+"” — "+whoOf(s)+"  ["+extractLabel(s)+"]"));
      L.push("");
    });
  });
  return L.join("\n").trim();
}
function expExtractsByCode(){
  const L=[];
  filteredCodes().slice().sort(bySecLabel).forEach(c=>{
    const ex=state.segments.filter(s=>s.codeIds.includes(c.id));
    L.push("**"+c.label+"** — "+ex.length+(ex.length===1?" extract":" extracts"),"");
    ex.forEach(s=>L.push("- “"+norm(s.text)+"” — "+whoOf(s)));
    L.push("");
  });
  return L.join("\n").trim();
}
function expThemes(){
  const L=[];
  filteredThemes().forEach(t=>{
    L.push("**"+t.name+"**");
    L.push("_"+(t.section||"—")+" · "+themeExtracts(t).length+" extracts · codes: "+t.codeIds.map(c=>(codeById(c)||{}).label).filter(Boolean).join(", ")+"_");
    if(t.definition){L.push("");L.push(t.definition);}
    L.push("");
  });
  return L.join("\n").trim()||"(no themes)";
}
function expBundle(){
  const d=new Date().toISOString().slice(0,10);
  const scope=activeSection()==="__all"?"all data sets":activeSection();
  return ["# "+(state.name||"Analysis")+" — coding output",
    "",
    "_"+state.sources.length+" sources · "+state.segments.length+" coded extracts · "+state.codes.length+" codes · "+state.themes.length+" themes · scope: "+scope+" · "+d+"_",
    "","## Themes","",expThemes(),
    "","## Coded extracts by theme","",expExtractsByTheme(),
    "","## Codebook","",expCodebookMD()].join("\n");
}

/* ---------- source modals ---------- */
function addSourceModal(){editSourceModal(null);}
function editSourceModal(s){
  const body=el("div");
  body.append(el("label",{class:"fl",text:"Source name"}));
  const nm=el("input",{class:"txt",placeholder:"e.g. P1 — drawing"});nm.value=s?s.name:"";body.append(nm);
  const r=el("div",{class:"row"});
  const c1=el("div",{style:"flex:1"});c1.append(el("label",{class:"fl",text:"Data set label"}));
  const sec=el("input",{class:"txt",placeholder:"drawing / names / ui",list:"secdl2"});sec.value=s?(s.section||""):(activeSection()==="__all"?"":activeSection());c1.append(sec);
  const dl=el("datalist",{id:"secdl2"});state.sections.forEach(x=>dl.append(el("option",{value:x})));c1.append(dl);
  const c2=el("div",{style:"flex:1"});c2.append(el("label",{class:"fl",text:"Participant (optional)"}));
  const part=el("input",{class:"txt",placeholder:"P1"});part.value=s?(s.participant||""):"";c2.append(part);
  r.append(c1,c2);body.append(r);
  body.append(el("label",{class:"fl",text:"Note (optional)"}));
  const note=el("input",{class:"txt",placeholder:"e.g. excerpt from corrected transcript"});note.value=s?(s.note||""):"";body.append(note);
  body.append(el("label",{class:"fl",text:"Text — a blank line between paragraphs / speaker turns"}));
  const tx=el("textarea",{class:"txt",style:"min-height:220px"});tx.value=s?s.paragraphs.join("\n\n"):"";body.append(tx);
  showModal(s?"Edit source":"Add source",body,[["Cancel",closeModal],[s?"Save":"Add",()=>{
    const paras=tx.value.split(/\n\s*\n/).map(p=>norm(p)).filter(Boolean);
    if(!nm.value.trim()||!paras.length)return;
    ensureSection(sec.value.trim());
    if(s){
      s.name=nm.value.trim();s.section=sec.value.trim();s.participant=part.value.trim();s.note=note.value.trim();
      s.paragraphs=paras;
      state.segments=state.segments.filter(sg=>{
        if(sg.sourceId!==s.id)return true;
        const p=paras[sg.paraIndex];
        return p&&p.slice(sg.start,sg.end)===sg.text;
      });
    }else state.sources.push({id:uid(),name:nm.value.trim(),section:sec.value.trim(),participant:part.value.trim(),note:note.value.trim(),paragraphs:paras});
    save();closeModal();render();
  },"primary"]]);
}
function importTxt(){
  const inp=el("input",{type:"file",accept:".txt,text/plain"});
  inp.addEventListener("change",()=>{
    const f=inp.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{
      const paras=String(rd.result).split(/\n\s*\n/).map(p=>norm(p)).filter(Boolean);
      state.sources.push({id:uid(),name:f.name.replace(/\.txt$/i,""),section:activeSection()==="__all"?"":activeSection(),participant:"",note:"imported from "+f.name,paragraphs:paras});
      save();render();toast("Source added");
    };
    rd.readAsText(f);
  });
  inp.click();
}

/* ---------- project io ---------- */
function newProject(){
  confirmModal("Start a new project?","Clears the current workspace. Export first if you want to keep it.",()=>{
    state=blankProject();viewingExample=false;
    try{localStorage.setItem(LS_SEEN,"1");}catch(e){}
    save();render();toast("New project");
  });
}
function exportProject(){
  const json=JSON.stringify(state,null,2);
  const fname=(state.name||"project").replace(/\s+/g,"-").toLowerCase()+".codebook.json";
  const b=el("div");
  b.append(el("p",{text:"Your whole project as JSON — sources, codes, every coded extract, themes. Re-import from the Project menu. Copy always works; Download may be blocked when the page is hosted."}));
  const ta=el("textarea",{class:"txt",style:"min-height:220px;font-family:var(--mono);font-size:11px",readonly:"readonly"});ta.value=json;
  b.append(ta);
  showModal("Export project",b,[["Close",closeModal],["Download",()=>downloadText(json,fname)],["Copy",()=>copyText(json),"primary"]]);
}
function importProject(){
  const inp=el("input",{type:"file",accept:".json,application/json"});
  inp.addEventListener("change",()=>{
    const f=inp.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const obj=JSON.parse(rd.result);
        const isSpec=obj.phaseNotes||(Array.isArray(obj.segments)&&obj.segments.some(s=>s&&s.quote!==undefined));
        state=isSpec?buildFromSpec(obj):migrate(obj);
        viewingExample=false;
        try{localStorage.setItem(LS_SEEN,"1");}catch(e){}
        save();render();toast("Project imported");
      }catch(e){toast("Could not read that file");}
    };
    rd.readAsText(f);
  });
  inp.click();
}
function migrate(obj){
  const b=blankProject(obj.name);
  b.createdAt=obj.createdAt||b.createdAt;
  b.analyst=obj.analyst||(obj.meta&&obj.meta.analyst)||"";
  b.note=obj.note||"";
  b.sections=Array.isArray(obj.sections)?obj.sections.slice():[];
  b.sources=(obj.sources||[]).map(s=>({id:s.id||uid(),name:s.name||"source",section:s.section||"",participant:s.participant||"",note:s.note||"",paragraphs:(s.paragraphs||[]).slice()}));
  b.codes=(obj.codes||[]).map((c,i)=>({id:c.id||uid(),label:c.label||("code "+(i+1)),color:c.color||PALETTE[i%PALETTE.length],memo:c.memo||""}));
  b.segments=(obj.segments||[]).filter(s=>s&&s.sourceId&&s.text!==undefined).map(s=>({id:s.id||uid(),sourceId:s.sourceId,paraIndex:s.paraIndex|0,start:s.start|0,end:s.end|0,text:s.text,codeIds:(s.codeIds||[]).slice()}));
  b.themes=(obj.themes||[]).map((t,i)=>({id:t.id||uid(),name:t.name||("theme "+(i+1)),section:t.section||"",definition:t.definition||"",order:(t.order!=null?t.order:i),codeIds:(t.codeIds||[]).slice()}));
  return b;
}
function buildFromSpec(spec){
  const p=blankProject(spec.name);
  p.analyst=spec.analyst||"";
  p.note=spec.note||"";
  p.sections=(spec.sections||[]).slice();
  const srcIndex={};
  (spec.sources||[]).forEach(s=>{
    const id=uid();
    srcIndex[s.name]={id,paragraphs:s.paragraphs};
    p.sources.push({id,name:s.name,section:s.section||"",participant:s.participant||"",note:s.note||"",paragraphs:(s.paragraphs||[]).slice()});
  });
  const codeIndex={};
  (spec.codes||[]).forEach((c,i)=>{const id=uid();codeIndex[c.label]=id;p.codes.push({id,label:c.label,color:c.color||PALETTE[i%PALETTE.length],memo:c.memo||""});});
  function ensureCode(label){
    if(codeIndex[label])return codeIndex[label];
    const id=uid();codeIndex[label]=id;
    p.codes.push({id,label,color:PALETTE[p.codes.length%PALETTE.length],memo:""});
    return id;
  }
  let missed=0;
  (spec.segments||[]).forEach(sg=>{
    const si=srcIndex[sg.source];if(!si){missed++;return;}
    const quote=sg.quote;let pi=-1,start=-1;
    for(let i=0;i<si.paragraphs.length;i++){const idx=si.paragraphs[i].indexOf(quote);if(idx>=0){pi=i;start=idx;break;}}
    if(pi<0){
      const nq=norm(quote);
      for(let i=0;i<si.paragraphs.length;i++){const idx=norm(si.paragraphs[i]).indexOf(nq);if(idx>=0){pi=i;const r=si.paragraphs[i].toLowerCase().indexOf(quote.trim().slice(0,12).toLowerCase());start=r>=0?r:0;break;}}
    }
    if(pi<0){missed++;return;}
    p.segments.push({id:uid(),sourceId:si.id,paraIndex:pi,start,end:start+quote.length,text:si.paragraphs[pi].slice(start,start+quote.length),codeIds:(sg.codes||[]).map(ensureCode)});
  });
  (spec.themes||[]).forEach((t,i)=>p.themes.push({id:uid(),name:t.name,section:t.section||"",definition:t.definition||"",order:i,codeIds:(t.codes||[]).map(l=>codeIndex[l]).filter(Boolean)}));
  if(missed&&window.console)console.warn(missed+" example segment(s) skipped");
  return p;
}

/* ---------- demo ---------- */
function loadExample(){
  let spec;
  try{spec=JSON.parse($("#exampleData").textContent);}catch(e){toast("Example data missing");return;}
  state=(spec.phaseNotes||(spec.segments||[]).some(s=>s&&s.quote!==undefined))?buildFromSpec(spec):migrate(spec);
  viewingExample=true;
  state.ui={view:"data",section:"__all",openSrc:null};
  render();
  toast("Demo project loaded");
}

/* ---------- modal / confirm ---------- */
function showModal(title,bodyNode,actions){
  const mo=$("#modal");mo.innerHTML="";
  mo.append(el("h3",{text:title}));
  mo.append(bodyNode);
  const bar=el("div",{class:"m-acts"});
  actions.forEach(([label,fn,kind])=>bar.append(el("button",{class:"btn"+(kind?" "+kind:""),text:label,onclick:fn})));
  mo.append(bar);
  $("#modalWrap").classList.add("on");
}
function closeModal(){$("#modalWrap").classList.remove("on");}
function confirmModal(title,msg,onYes){
  const b=el("div");b.append(el("p",{text:msg}));
  showModal(title,b,[["Cancel",closeModal],["Continue",()=>{closeModal();onYes();},"primary"]]);
}
$("#modalWrap").addEventListener("click",e=>{if(e.target.id==="modalWrap")closeModal();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();closePicker();$("#seltip").style.display="none";}});

/* ---------- clipboard / download ---------- */
function copyText(t){
  if(navigator.clipboard&&navigator.clipboard.writeText)
    navigator.clipboard.writeText(t).then(()=>toast("Copied"),()=>toast("Copy blocked — select the text and copy manually"));
  else toast("Select the text and copy manually");
}
function downloadText(t,name){
  try{
    const a=el("a",{href:URL.createObjectURL(new Blob([t],{type:"text/plain"})),download:name});
    document.body.append(a);a.click();a.remove();toast("Download started");
  }catch(e){toast("Download blocked — use Copy");}
}

/* ---------- misc ---------- */
$("#projName").addEventListener("click",()=>{
  if(viewingExample){toast("This is the demo — start your own project to rename it");return;}
  const b=el("div");
  b.append(el("label",{class:"fl",text:"Project name"}));
  const i=el("input",{class:"txt"});i.value=state.name;b.append(i);
  b.append(el("label",{class:"fl",text:"Analyst (optional — for the codebook header)"}));
  const an=el("input",{class:"txt"});an.value=state.analyst||"";b.append(an);
  showModal("Project details",b,[["Cancel",closeModal],["Save",()=>{state.name=i.value.trim()||state.name;state.analyst=an.value.trim();save();closeModal();render();},"primary"]]);
});
$("#sectionSel").addEventListener("change",e=>{state.ui.section=e.target.value;save();render();});
$("#btnExport").addEventListener("click",()=>setView("export"));

/* ---------- boot ---------- */
(function boot(){
  try{const th=localStorage.getItem(LS_THEME);if(th)document.documentElement.dataset.theme=th;}catch(e){}
  const saved=load();
  let seen=false;try{seen=!!localStorage.getItem(LS_SEEN);}catch(e){}
  if(saved){ state=migrate(saved);viewingExample=false;render(); }
  else if(!seen){ state=blankProject();render();loadExample(); }
  else { state=blankProject();render(); }
})();
})();
