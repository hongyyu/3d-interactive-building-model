import {state,setHotIds} from '../state.js';
import {rightEl} from '../dom.js';
import {$} from '../util.js';
import {relayout} from '../layout/plan.js';
import {updateFloorTagText} from '../scene/overlay.js';
import {MAX_LEVELS} from '../scene/constants.js';
import {refreshUI} from './panels.js';
import {insertLevel,removeLevel,moveLevel} from './actions.js';
import {menuKeys} from './menu.js';

/* ---------- level rows in the right panel ----------
   Rows run from the top level down to Level 1. Each has a grip and a ⋯ menu. Dragging the grip moves
   the level: the other rows slide to make room, and the building follows live, because the level
   order in state.levels is rewritten whenever the drop slot changes. Dropping keeps the new order and
   Escape restores the old one. The arrow keys on a focused grip move its level one step. Hovering or
   dragging a row lights up that level's departments in the model. */
let ld=null;
function listY(clientY){ return clientY-ld.list.getBoundingClientRect().top; }
function startDrag(e,grip){
  const list=grip.closest('.lvls'), row=grip.closest('.lvl'), rows=[...list.querySelectorAll('.lvl')];
  const lv=state.levels[state.sel], s=rows.indexOf(row), gap=parseFloat(getComputedStyle(list).rowGap)||0;
  ld={list:list,row:row,rows:rows,lv:lv,orig:lv.slice(),s:s,t:s,grip:grip,id:e.pointerId,moved:false,raf:0,cy:e.clientY,
    mids:rows.map(r=>r.offsetTop+r.offsetHeight/2),step:row.offsetHeight+gap,y0:0};
  ld.y0=listY(e.clientY);
  grip.setPointerCapture(e.pointerId);
  setHotIds(lv[lv.length-1-s]);
}
function moveDrag(clientY){
  ld.cy=clientY;
  const dy=listY(clientY)-ld.y0;
  if(!ld.moved){
    if(Math.abs(dy)<4) return;
    ld.moved=true; ld.row.classList.add('lifting'); ld.list.classList.add('sorting');
    ld.raf=requestAnimationFrame(autoScroll);
  }
  ld.row.style.transform='translateY('+dy.toFixed(1)+'px)';
  const c=ld.mids[ld.s]+dy;
  let t=0; ld.mids.forEach((m,i)=>{ if(i!==ld.s&&m<c) t++; });
  if(t!==ld.t){ ld.t=t; applyOrder(); }
}
/* slides the other rows into their new slots, renumbers the rows and rewrites the level order;
   row i shows level n-1-i */
function applyOrder(){
  const n=ld.rows.length, order=ld.rows.map((r,i)=>i);
  order.splice(ld.s,1); order.splice(ld.t,0,ld.s);
  order.forEach((i,p)=>{
    const r=ld.rows[i];
    if(i!==ld.s) r.style.transform=p===i?'':'translateY('+(p>i?ld.step:-ld.step)+'px)';
    r.querySelector('.lh b').textContent='Level '+(n-p);
    ld.lv[n-1-p]=ld.orig[n-1-i];
  });
  relayout(false); updateFloorTagText();
}
/* keeps the list scrolling while the pointer rests near the panel's top or bottom edge */
function autoScroll(){
  if(!ld) return;
  const r=rightEl.getBoundingClientRect(), y=ld.cy;
  const v=y<r.top+40?(y-r.top-40)/4:y>r.bottom-40?(y-r.bottom+40)/4:0;
  if(v){ const top=rightEl.scrollTop; rightEl.scrollTop+=v; if(rightEl.scrollTop!==top) moveDrag(y); }
  ld.raf=requestAnimationFrame(autoScroll);
}
function endDrag(keep){
  const d=ld; ld=null;
  cancelAnimationFrame(d.raf);
  try{ d.grip.releasePointerCapture(d.id); }catch(_){}
  setHotIds(null);
  if(!d.moved) return;
  if(!keep){ d.orig.forEach((a,f)=>{ d.lv[f]=a; }); relayout(false); }
  d.rows.forEach(r=>{ r.style.transform=''; });
  d.row.classList.remove('lifting'); d.list.classList.remove('sorting');
  refreshUI();
}

/* ---------- the ⋯ menu of a level row: insert a level next to it, or remove it ---------- */
const menu=$('#levelMenu');
let mf=-1, mbtn=null;
function item(act){ return menu.querySelector('[data-act='+act+']'); }
function openMenu(btn,focusFirst){
  const lv=state.levels[state.sel], f=+btn.dataset.f, n=lv.length, k=lv[f].length;
  mf=f; mbtn=btn;
  item('lvl-above').setAttribute('aria-disabled',String(n>=MAX_LEVELS));
  item('lvl-below').setAttribute('aria-disabled',String(n>=MAX_LEVELS));
  item('lvl-remove').setAttribute('aria-disabled',String(n<=1));
  const label=item('lvl-remove').querySelector('span');
  label.firstChild.nodeValue='Remove Level '+(f+1);
  label.lastChild.textContent=k?k+(k>1?' departments move':' department moves')+' to Unassigned':'';
  menu.hidden=false; btn.setAttribute('aria-expanded','true');
  placeMenu();
  if(focusFirst) menu.querySelector('[role=menuitem]:not([aria-disabled=true])').focus();
}
/* below the button, right-aligned to it, or above it when there is no room below; closes once the
   button scrolls out of the panel */
function placeMenu(){
  const r=mbtn.getBoundingClientRect(), p=rightEl.getBoundingClientRect(), m=menu.getBoundingClientRect();
  if(r.bottom<p.top||r.top>p.bottom){ closeMenu(false); return; }
  let top=r.bottom+6; if(top+m.height>innerHeight-8) top=r.top-6-m.height;
  menu.style.top=Math.max(8,top)+'px'; menu.style.left=Math.max(8,r.right-m.width)+'px';
}
function closeMenu(refocus){
  if(menu.hidden) return;
  menu.hidden=true;
  if(mbtn){ mbtn.setAttribute('aria-expanded','false'); if(refocus&&mbtn.isConnected) mbtn.focus(); }
  mbtn=null;
}

export function bindLevels(){
  rightEl.addEventListener('pointerdown',e=>{
    const g=e.target.closest('.grip');
    if(g&&e.button===0&&!ld) startDrag(e,g);
  });
  rightEl.addEventListener('pointermove',e=>{ if(ld&&e.pointerId===ld.id) moveDrag(e.clientY); });
  rightEl.addEventListener('pointerup',e=>{ if(ld&&e.pointerId===ld.id) endDrag(true); });
  rightEl.addEventListener('pointercancel',e=>{ if(ld&&e.pointerId===ld.id) endDrag(false); });
  rightEl.addEventListener('keydown',e=>{
    const g=e.target.closest('.grip');
    if(!g||ld||(e.key!=='ArrowUp'&&e.key!=='ArrowDown')) return;
    e.preventDefault();
    const f=+g.dataset.f, to=f+(e.key==='ArrowUp'?1:-1);
    if(to<0||to>=state.levels[state.sel].length) return;
    moveLevel(state.sel,f,to);
    const ng=rightEl.querySelector('.grip[data-f="'+to+'"]'); if(ng) ng.focus();
  });
  // hovering a level row lights up its departments in the model
  rightEl.addEventListener('pointerover',e=>{
    if(ld) return;
    const r=e.target.closest('.lvl');
    setHotIds(r?state.levels[state.sel][+r.dataset.f]||null:null);
  });
  rightEl.addEventListener('pointerleave',()=>{ if(!ld) setHotIds(null); });

  rightEl.addEventListener('click',e=>{
    const b=e.target.closest('[data-act=lvlmenu]'); if(!b) return;
    if(mbtn===b&&!menu.hidden) closeMenu(false); else { closeMenu(false); openMenu(b,e.detail===0); }
  });
  menu.addEventListener('click',e=>{
    const it=e.target.closest('[role=menuitem]');
    if(!it||it.getAttribute('aria-disabled')==='true') return;
    const a=it.dataset.act, bid=state.sel, f=mf;
    closeMenu(false);
    if(a==='lvl-above') insertLevel(bid,f+1);
    else if(a==='lvl-below') insertLevel(bid,f);
    else if(a==='lvl-remove') removeLevel(bid,f);
  });
  menu.addEventListener('keydown',e=>{ if(!menuKeys(menu,e)&&e.key==='Tab') closeMenu(false); });
  document.addEventListener('pointerdown',e=>{ if(!menu.hidden&&!menu.contains(e.target)&&e.target.closest('[data-act=lvlmenu]')!==mbtn) closeMenu(false); });
  rightEl.addEventListener('scroll',()=>{ if(!menu.hidden) placeMenu(); });
  window.addEventListener('resize',()=>closeMenu(false));
  window.addEventListener('keydown',e=>{
    if(e.key!=='Escape') return;
    if(ld){ e.preventDefault(); endDrag(false); }
    else if(!menu.hidden){ e.preventDefault(); closeMenu(true); }
  });
}
