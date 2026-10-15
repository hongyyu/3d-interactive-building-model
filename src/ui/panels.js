import {PROJECT,CATS,DEPTS,BUILDINGS,deptColor} from '../data/project.js';
import {state,BDEF,isOverview,colorsEdited} from '../state.js';
import {leftEl,rightEl} from '../dom.js';
import {esc,fmt,fk} from '../util.js';
import {B} from '../scene/scene.js';
import {updateFloorTagText} from '../scene/overlay.js';
import {floorStat,levelOf} from '../layout/plan.js';
import {MAX_LEVELS} from '../scene/constants.js';

/* program SF of building bid by category key */
function programByCat(bid){
  const by={}; let total=0;
  state.levels[bid].forEach(lv=>lv.forEach(id=>{ const d=DEPTS[id]; by[d.c]=(by[d.c]||0)+d.a; total+=d.a; }));
  return {by:by,total:total};
}
const CAMPUS_ICON='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.6 16.8h14.8M4 16.8V7.2l4-2v11.6M8 8.4l4.2-1.8v10.2M12.2 10.4l3.8 1.4v5"/></svg>';
export function renderLeft(){
  const ov=isOverview();
  let all=0; BUILDINGS.forEach(def=>{ all+=def.w*def.d*state.levels[def.id].length; });
  let h='<section class="blk"><h2 class="h">Buildings</h2><div class="blist">'+
    '<button type="button" class="bcard campus'+(ov?' on':'')+'" data-act="campus" aria-pressed="'+ov+'">'+CAMPUS_ICON+
    '<span><span class="bn">Full campus</span><span class="bm">'+BUILDINGS.length+' buildings · '+fk(all)+' GSF</span></span></button>';
  BUILDINGS.forEach(def=>{
    const lv=state.levels[def.id], plate=def.w*def.d, gsf=plate*lv.length;
    let prog=0; lv.forEach(a=>a.forEach(i=>{prog+=DEPTS[i].a;}));
    const pct=Math.min(100,Math.round(prog/gsf*100));
    h+='<button type="button" class="bcard'+(!ov&&def.id===state.sel?' on':'')+'" data-b="'+def.id+'"><span class="bn">'+esc(def.name)+'</span>'+
       '<span class="bm">'+lv.length+' levels · '+fmt(gsf)+' GSF</span><span class="meter"><i style="width:'+pct+'%"></i></span></button>';
  });
  h+='</div>'+(PROJECT.demo?'':'<button type="button" class="link" data-act="demo">Load demo project</button>')+'</section>';
  // the whole campus in the overview, otherwise the focused building
  const scope=ov?BUILDINGS.map(b=>b.id):[state.sel], by={};
  scope.forEach(bid=>{ const p=programByCat(bid).by; for(const k in p) by[k]=(by[k]||0)+p[k]; });
  h+='<section class="blk"><h2 class="h">Program by category</h2><p class="scope">'+(ov?'Whole campus':esc(BDEF[state.sel].name))+'</p><div class="lgl">';
  // each row: the swatch, which opens the colour panel, then the button that isolates the category
  for(const k in CATS){
    const a=by[k]||0, c=CATS[k];
    h+='<div class="lg'+(state.isolate===k?' on':'')+(a?'':' zero')+'">'+
       '<button type="button" class="sw" data-catcolor="'+k+'" aria-haspopup="dialog" aria-expanded="'+(state.picking==='cat:'+k)+'" title="Change colour" aria-label="'+esc(c.name)+' colour"><i style="background:'+c.color+'"></i></button>'+
       '<button type="button" data-cat="'+k+'"><span>'+esc(c.name)+'</span><em>'+(a?fk(a):'–')+'</em></button></div>';
  }
  h+='</div><button type="button" class="link" data-act="resetcolors"'+(colorsEdited()?'':' hidden')+' title="Go back to the colours of the loaded program">Reset colours</button></section>';
  leftEl.innerHTML=h;
}
const FOLD='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 12.2 10 7.8l4.5 4.4"/></svg>';
const GRIP='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7.5" cy="5.5" r="1.3"/><circle cx="12.5" cy="5.5" r="1.3"/><circle cx="7.5" cy="10" r="1.3"/><circle cx="12.5" cy="10" r="1.3"/><circle cx="7.5" cy="14.5" r="1.3"/><circle cx="12.5" cy="14.5" r="1.3"/></svg>';
const MORE='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="5" cy="10" r="1.4"/><circle cx="10" cy="10" r="1.4"/><circle cx="15" cy="10" r="1.4"/></svg>';
/* the right panel's title row, with the button that hides everything below it (state.panelOpen) */
function panelHead(eyebrow,title){
  const open=state.panelOpen, tip=open?'Hide details':'Show details';
  return '<div class="phead"><div><p class="eyebrow">'+eyebrow+'</p><h2 class="title">'+title+'</h2></div>'+
    '<button type="button" class="pfold" data-act="fold" aria-expanded="'+open+'" aria-label="'+tip+'" title="'+tip+'">'+FOLD+'</button></div>';
}
/* the right panel in the campus overview: totals, the tray, and each building's program mix */
function renderCampus(){
  let gsf=0, prog=0, nl=0, rows='';
  BUILDINGS.forEach(def=>{
    const n=state.levels[def.id].length, g=def.w*def.d*n, p=programByCat(def.id);
    gsf+=g; prog+=p.total; nl+=n;
    let bar='';
    for(const k in CATS){ const a=p.by[k]; if(a) bar+='<i style="width:'+(a/Math.max(g,p.total)*100).toFixed(2)+'%;background:'+CATS[k].color+'" title="'+esc(CATS[k].name)+' · '+fmt(a)+' SF"></i>'; }
    rows+='<button type="button" class="pb" data-b="'+def.id+'"><span class="lh"><b>'+esc(def.name)+'</b><span>'+fmt(p.total)+' / '+fmt(g)+' SF</span></span><span class="bar">'+bar+'</span></button>';
  });
  if(!state.panelOpen){ rightEl.innerHTML='<section class="blk">'+panelHead('Campus overview','All buildings')+'</section>'; return; }
  let h='<section class="blk">'+panelHead('Campus overview','All buildings')+
    '<dl class="kv"><div><dt>Buildings</dt><dd>'+BUILDINGS.length+'</dd></div><div><dt>Levels</dt><dd>'+nl+'</dd></div>'+
    '<div><dt>Gross area</dt><dd>'+fmt(gsf)+' SF</dd></div><div><dt>Program</dt><dd>'+fmt(prog)+' SF · '+Math.round(prog/gsf*100)+'%</dd></div></dl></section>'+
    '<p class="note">Click a building in the model or the list to focus it and edit its stacking.</p>';
  if(state.unassigned.length){
    h+='<section class="blk"><h2 class="h">Unassigned · '+state.unassigned.length+'</h2>'+
       '<p class="note">Select a department to place it in '+esc(BDEF[state.sel].name)+', or focus another building first.</p>'+
       '<div class="chips">'+state.unassigned.map(id=>chip(id,false)).join('')+'</div></section>';
  }
  h+='<section class="blk"><h2 class="h">Program by building</h2><div class="pbl">'+rows+'</div></section>';
  rightEl.innerHTML=h;
}
export function renderRight(){
  if(isOverview()){ renderCampus(); return; }
  const bid=state.sel, def=BDEF[bid], lv=state.levels[bid], n=lv.length, plate=def.w*def.d;
  let prog=0; lv.forEach(a=>a.forEach(i=>{prog+=DEPTS[i].a;}));
  const gsf=plate*n, pct=Math.round(prog/gsf*100);
  if(!state.panelOpen){ rightEl.innerHTML='<section class="blk">'+panelHead('Selected building',esc(def.name))+'</section>'; return; }
  let h='<section class="blk">'+panelHead('Selected building',esc(def.name))+
    '<dl class="kv"><div><dt>Levels</dt><dd>'+n+'</dd></div><div><dt>Floor plate</dt><dd>'+fmt(plate)+' SF</dd></div>'+
    '<div><dt>Gross area</dt><dd>'+fmt(gsf)+' SF</dd></div><div><dt>Program</dt><dd>'+fmt(prog)+' SF · '+pct+'%</dd></div></dl></section>';
  const sd=state.selDept, loc=sd?levelOf(bid,sd):null, tray=sd!=null&&state.unassigned.includes(sd);
  if(sd&&(loc||tray)){
    const dd=DEPTS[sd], cat=CATS[dd.c];
    let opts=''; for(let f=n-1;f>=0;f--) opts+='<option value="'+f+'"'+(loc&&f===loc.f?' selected':'')+'>Level '+(f+1)+'</option>';
    opts+='<option value="-1"'+(tray?' selected':'')+'>Unassigned</option>';
    h+='<section class="dcard"><div class="dhead"><i style="background:'+deptColor(sd)+'"></i><div><h3>'+esc(dd.n)+'</h3><p>'+esc(cat.name)+' · '+(tray?'Unassigned':'Level '+(loc.f+1))+'</p></div>'+
       '<button type="button" class="x" data-act="desel" aria-label="Clear selection">×</button></div>'+
       '<label for="area">Area (SF)</label><div class="step"><button type="button" data-act="dec" aria-label="Decrease area">−</button>'+
       '<input id="area" type="number" step="500" min="500" max="500000" value="'+dd.a+'"><button type="button" data-act="inc" aria-label="Increase area">+</button></div>'+
       '<label for="lvl">'+(tray?'Place in '+esc(def.name):'Level')+'</label><select id="lvl">'+opts+'</select>'+
       '<label for="dcol">Colour</label><button type="button" class="cfield" id="dcol" aria-haspopup="dialog" aria-expanded="'+(state.picking==='dept:'+sd)+'">'+
       '<i style="background:'+deptColor(sd)+'"></i><span>'+deptColor(sd).toUpperCase()+'</span><em>'+(dd.color?'Custom':'Category colour')+'</em></button>'+
       (dd.notes?'<p class="dnotes">'+esc(dd.notes)+'</p>':'')+
       '<p class="note">'+Math.round(dd.a/plate*100)+'% of a '+fmt(plate)+' SF floor plate</p></section>';
  } else {
    h+='<p class="note">Select a department in the model or the list below to edit its area or level. Drag it to move it.</p>';
  }
  if(state.unassigned.length){
    h+='<section class="blk"><h2 class="h">Unassigned · '+state.unassigned.length+'</h2>'+
       '<p class="note">Select a department, then pick a level to place it in '+esc(def.name)+'.</p>'+
       '<div class="chips">'+state.unassigned.map(id=>chip(id,sd===id)).join('')+'</div></section>';
  }
  // each level row: a grip to drag it to another level, and a menu to insert a level next to it or remove it
  h+='<section class="blk"><div class="lvhead"><h2 class="h">Levels</h2>'+
     '<button type="button" class="mini" data-act="addlevel"'+(n<MAX_LEVELS?'':' disabled')+' title="Add an empty Level '+(n+1)+' on top of '+esc(def.name)+'">+ Add level</button>'+
     '</div><div class="lvls">';
  for(let f=n-1;f>=0;f--){
    const st=floorStat(bid,f), den=Math.max(st.plate,st.total);
    let bar='', chips='';
    st.ids.forEach(id=>{
      const dd=DEPTS[id], c=deptColor(id), on=sd===id;
      bar+='<button type="button" class="bseg'+(on?' on':'')+'" data-dept="'+id+'" style="width:'+(dd.a/den*100).toFixed(2)+'%;background:'+c+'" title="'+esc(dd.n)+'" aria-label="'+esc(dd.n)+'"></button>';
      chips+=chip(id,on);
    });
    h+='<div class="lvl'+(st.over?' over':'')+'" data-f="'+f+'"><div class="lh">'+
       '<button type="button" class="grip" data-f="'+f+'" aria-label="Move Level '+(f+1)+'" title="Drag to move this level, or use the arrow keys">'+GRIP+'</button>'+
       '<b>Level '+(f+1)+'</b><span>'+fmt(st.total)+' / '+fmt(st.plate)+' SF'+(st.over?' · over':'')+'</span>'+
       '<button type="button" class="lvmore" data-act="lvlmenu" data-f="'+f+'" aria-label="Level '+(f+1)+' actions" aria-haspopup="menu" aria-expanded="false" aria-controls="levelMenu">'+MORE+'</button></div>'+
       '<div class="bar">'+bar+'</div>'+(chips?'<div class="chips">'+chips+'</div>':'<p class="note lvempty">Empty level</p>')+'</div>';
  }
  h+='</div></section>';
  rightEl.innerHTML=h;
}
function chip(id,on){
  const dd=DEPTS[id];
  return '<button type="button" class="chip'+(on?' on':'')+'" data-dept="'+id+'"><i style="background:'+deptColor(id)+'"></i>'+esc(dd.n)+'<em>'+fk(dd.a)+'</em></button>';
}
export function refreshUI(){ renderLeft(); renderRight(); updateFloorTagText(); updateTags(); }
function updateTags(){
  for(const bid in B){
    const def=BDEF[bid], lv=state.levels[bid], gsf=def.w*def.d*lv.length, tag=B[bid].tag;
    tag.innerHTML=esc(def.name)+'<small>'+lv.length+' levels · '+fk(gsf)+' GSF</small>';
    tag.classList.toggle('on',bid===state.sel&&!isOverview());
  }
}
