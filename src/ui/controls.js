import {DEPTS} from '../data/project.js';
import {state} from '../state.js';
import {leftEl,rightEl,overlay} from '../dom.js';
import {$} from '../util.js';
import {retarget,setViewRate} from '../scene/view.js';
import {renderLeft,renderRight} from './panels.js';
import {selectBuilding,selectDept,setMode,setArea,moveDeptToLevel,resetLayout,addLevel,removeTopLevel,showCampus,resetColors} from './actions.js';
import {bindColorPanel,editCatColor,editDeptColor} from './colorPanel.js';
import {bindImport,chooseImportFile,loadDemo} from './importDialog.js';
import {toggleLaser} from './laser.js';
import {printReport} from './report.js';

/* panel, overlay and toolbar clicks */
export function bindControls(){
  bindImport();
  bindColorPanel();
  leftEl.addEventListener('click',e=>{
    const bc=e.target.closest('[data-b]'); if(bc){ selectBuilding(bc.dataset.b,true); return; }
    const sw=e.target.closest('[data-catcolor]'); if(sw){ editCatColor(sw.dataset.catcolor); return; }
    const cat=e.target.closest('[data-cat]'); if(cat){ state.isolate=(state.isolate===cat.dataset.cat)?null:cat.dataset.cat; renderLeft(); return; }
    if(e.target.closest('[data-act="campus"]')) showCampus();
    else if(e.target.closest('[data-act="demo"]')) loadDemo();
    else if(e.target.closest('[data-act="resetcolors"]')) resetColors();
  });
  rightEl.addEventListener('click',e=>{
    const dp=e.target.closest('[data-dept]'); if(dp){ selectDept(dp.dataset.dept); return; }
    if(e.target.closest('#dcol')&&state.selDept){ editDeptColor(state.selDept); return; }
    const bc=e.target.closest('[data-b]'); if(bc){ selectBuilding(bc.dataset.b,true); return; }
    const act=e.target.closest('[data-act]'); if(!act)return;
    const a=act.dataset.act, id=state.selDept;
    if(a==='desel'){ state.selDept=null; renderRight(); }
    else if(a==='inc'&&id) setArea(id,DEPTS[id].a+500);
    else if(a==='dec'&&id) setArea(id,DEPTS[id].a-500);
    else if(a==='addlevel') addLevel(state.sel);
    else if(a==='rmlevel') removeTopLevel(state.sel);
  });
  rightEl.addEventListener('change',e=>{
    if(e.target.id==='area') setArea(state.selDept,parseFloat(e.target.value));
    else if(e.target.id==='lvl') moveDeptToLevel(state.selDept,parseInt(e.target.value,10));
  });
  overlay.addEventListener('click',e=>{
    const t=e.target.closest('.btag'); if(t) selectBuilding(t.dataset.b,true);
  });
  $('#modes').addEventListener('click',e=>{
    const b=e.target.closest('button[data-mode]'); if(b) setMode(b.dataset.mode);
  });
  $('#tools').addEventListener('click',e=>{
    if(e.target.closest('a[download]')){ setMenu(false); return; }
    const b=e.target.closest('button[data-act]'); if(!b)return;
    const a=b.dataset.act;
    if(a==='menu'){ setMenu(menu.hidden,e.detail===0); return; }
    setMenu(false);
    if(a==='labels') toggleLabels();
    else if(a==='resetview') resetView();
    else if(a==='resetlayout') resetLayout();
    else if(a==='import') chooseImportFile();
    else if(a==='print') printReport();
    else if(a==='laser') toggleLaser();
    else if(a==='present') togglePresent();
  });
  bindToolbarUI();
}

function toggleLabels(){
  state.labels=!state.labels;
  $('#tools [data-act=labels]').setAttribute('aria-pressed',String(state.labels));
}
function resetView(){ retarget(false); setViewRate(3.2); }
function togglePresent(){
  const on=!$('#app').classList.contains('present');
  $('#app').classList.toggle('present',on);
  $('#tools [data-act=present]').setAttribute('aria-pressed',String(on));
}

/* ---------- toolbar: More actions menu, tooltips, shortcuts ---------- */
const menu=$('#toolMenu'), menuBtn=$('#tools [data-act=menu]');
/* opens or closes the menu; focus moves to its first item when opened from the keyboard */
function setMenu(open,focusFirst){
  if(open===!menu.hidden) return;
  menu.hidden=!open; menuBtn.setAttribute('aria-expanded',String(open));
  if(open&&focusFirst) menu.querySelector('[role=menuitem]').focus();
  else if(!open&&menu.contains(document.activeElement)) menuBtn.focus();
}
/* single-key shortcuts; L for the laser lives in ui/laser.js */
const KEYS={'1':()=>setMode('mass'),'2':()=>setMode('axon'),'3':()=>setMode('stack'),t:toggleLabels,p:togglePresent,f:resetView};
function bindToolbarUI(){
  // a clicked tool hides its tooltip until the pointer leaves it
  document.querySelectorAll('.top .tool').forEach(t=>{
    t.addEventListener('pointerdown',()=>t.classList.add('tipoff'));
    t.addEventListener('pointerleave',()=>t.classList.remove('tipoff'));
  });
  document.addEventListener('pointerdown',e=>{ if(!menu.hidden&&!e.target.closest('.menuwrap')) setMenu(false); });
  menuBtn.addEventListener('keydown',e=>{ if(e.key==='ArrowDown'){ e.preventDefault(); setMenu(true,true); } });
  menu.addEventListener('keydown',e=>{
    const items=[...menu.querySelectorAll('[role=menuitem]')], i=items.indexOf(document.activeElement);
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); items[(i+(e.key==='ArrowDown'?1:items.length-1))%items.length].focus(); }
    else if(e.key==='Home'||e.key==='End'){ e.preventDefault(); items[e.key==='Home'?0:items.length-1].focus(); }
    else if(e.key==='Tab') setMenu(false);
  });
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!menu.hidden){ e.preventDefault(); setMenu(false); menuBtn.focus(); return; }
    if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||$('#app').inert||document.querySelector('dialog[open]')) return;
    const t=e.target;
    if(t&&(t.isContentEditable||/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))) return;
    const fn=KEYS[e.key.toLowerCase()];
    if(fn){ e.preventDefault(); fn(); }
  });
}
