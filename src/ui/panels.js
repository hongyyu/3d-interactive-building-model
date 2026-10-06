import {CATS,DEPTS,BUILDINGS} from '../data/demo.js';
import {state,BDEF} from '../state.js';
import {leftEl,rightEl} from '../dom.js';
import {esc,fmt,fk} from '../util.js';
import {B} from '../scene/scene.js';
import {updateFloorTagText} from '../scene/overlay.js';
import {floorStat,levelOf} from '../layout/plan.js';

export function renderLeft(){
  let h='<section class="blk"><h2 class="h">Buildings</h2><div class="blist">';
  BUILDINGS.forEach(def=>{
    const lv=state.levels[def.id], plate=def.w*def.d, gsf=plate*lv.length;
    let prog=0; lv.forEach(a=>a.forEach(i=>{prog+=DEPTS[i].a;}));
    const pct=Math.min(100,Math.round(prog/gsf*100));
    h+='<button type="button" class="bcard'+(def.id===state.sel?' on':'')+'" data-b="'+def.id+'"><span class="bn">'+esc(def.name)+'</span>'+
       '<span class="bm">'+lv.length+' levels · '+fmt(gsf)+' GSF</span><span class="meter"><i style="width:'+pct+'%"></i></span></button>';
  });
  h+='</div><button type="button" class="link" data-act="campus">Show full campus</button></section>';
  h+='<section class="blk"><h2 class="h">Program by category</h2><div class="lgl">';
  for(const k in CATS){
    let a=0; state.levels[state.sel].forEach(lv=>lv.forEach(id=>{ if(DEPTS[id].c===k)a+=DEPTS[id].a; }));
    h+='<button type="button" class="lg'+(state.isolate===k?' on':'')+(a?'':' zero')+'" data-cat="'+k+'"><i style="background:'+CATS[k].color+'"></i><span>'+esc(CATS[k].name)+'</span><em>'+(a?fk(a):'–')+'</em></button>';
  }
  h+='</div></section>';
  leftEl.innerHTML=h;
}
export function renderRight(){
  const bid=state.sel, def=BDEF[bid], lv=state.levels[bid], n=lv.length, plate=def.w*def.d;
  let prog=0; lv.forEach(a=>a.forEach(i=>{prog+=DEPTS[i].a;}));
  const gsf=plate*n, pct=Math.round(prog/gsf*100);
  let h='<section class="blk"><p class="eyebrow">Selected building</p><h2 class="title">'+esc(def.name)+'</h2>'+
    '<dl class="kv"><div><dt>Levels</dt><dd>'+n+'</dd></div><div><dt>Floor plate</dt><dd>'+fmt(plate)+' SF</dd></div>'+
    '<div><dt>Gross area</dt><dd>'+fmt(gsf)+' SF</dd></div><div><dt>Program</dt><dd>'+fmt(prog)+' SF · '+pct+'%</dd></div></dl></section>';
  const sd=state.selDept, loc=sd?levelOf(bid,sd):null;
  if(sd&&loc){
    const dd=DEPTS[sd], cat=CATS[dd.c];
    let opts=''; for(let f=n-1;f>=0;f--) opts+='<option value="'+f+'"'+(f===loc.f?' selected':'')+'>Level '+(f+1)+'</option>';
    h+='<section class="dcard"><div class="dhead"><i style="background:'+cat.color+'"></i><div><h3>'+esc(dd.n)+'</h3><p>'+esc(cat.name)+' · Level '+(loc.f+1)+'</p></div>'+
       '<button type="button" class="x" data-act="desel" aria-label="Clear selection">×</button></div>'+
       '<label for="area">Area (SF)</label><div class="step"><button type="button" data-act="dec" aria-label="Decrease area">−</button>'+
       '<input id="area" type="number" step="500" min="500" max="80000" value="'+dd.a+'"><button type="button" data-act="inc" aria-label="Increase area">+</button></div>'+
       '<label for="lvl">Level</label><select id="lvl">'+opts+'</select>'+
       '<p class="note">'+Math.round(dd.a/plate*100)+'% of a '+fmt(plate)+' SF floor plate</p></section>';
  } else {
    h+='<p class="note">Select a department in the model or the list below to edit its area or level. Drag it to move it.</p>';
  }
  h+='<section class="blk"><h2 class="h">Levels</h2><div class="lvls">';
  for(let f=n-1;f>=0;f--){
    const st=floorStat(bid,f), den=Math.max(st.plate,st.total);
    let bar='', chips='';
    st.ids.forEach(id=>{
      const dd=DEPTS[id], c=CATS[dd.c].color, on=sd===id;
      bar+='<button type="button" class="bseg'+(on?' on':'')+'" data-dept="'+id+'" style="width:'+(dd.a/den*100).toFixed(2)+'%;background:'+c+'" title="'+esc(dd.n)+'" aria-label="'+esc(dd.n)+'"></button>';
      chips+='<button type="button" class="chip'+(on?' on':'')+'" data-dept="'+id+'"><i style="background:'+c+'"></i>'+esc(dd.n)+'<em>'+fk(dd.a)+'</em></button>';
    });
    h+='<div class="lvl'+(st.over?' over':'')+'"><div class="lh"><b>Level '+(f+1)+'</b><span>'+fmt(st.total)+' / '+fmt(st.plate)+' SF'+(st.over?' · over':'')+'</span></div>'+
       '<div class="bar">'+bar+'</div><div class="chips">'+chips+'</div></div>';
  }
  h+='</div></section>';
  rightEl.innerHTML=h;
}
export function refreshUI(){ renderLeft(); renderRight(); updateFloorTagText(); updateTags(); }
function updateTags(){
  for(const bid in B){
    const def=BDEF[bid], lv=state.levels[bid], gsf=def.w*def.d*lv.length, tag=B[bid].tag;
    tag.innerHTML=esc(def.name)+'<small>'+lv.length+' levels · '+fk(gsf)+' GSF</small>';
    tag.classList.toggle('on',bid===state.sel);
  }
}
