import {BUILDINGS} from '../data/project.js';
import {state,BDEF,buildingNameTaken} from '../state.js';
import {leftEl,rightEl} from '../dom.js';
import {$,fmt} from '../util.js';
import {MAX_LEVELS,MAX_BUILDINGS} from '../scene/constants.js';
import {overlapsAt} from '../layout/site.js';
import {addBuilding,editBuilding,deleteBuilding} from './actions.js';
import {menuKeys,placeMenu} from './menu.js';

/* ---------- Add / Edit building dialog ----------
   "+ Add building" in the left panel opens it to add a building: name, floor plate, floor-to-floor
   height and level count. The sizes are remembered for the next building. addBuilding() places the
   building on the site and focuses it. "Edit building…" in the building menu opens it for the
   selected building, without the level count (the level rows handle that); editBuilding() keeps the
   building's centre, so the summary warns when the new plate would overlap a neighbour. */
let dlg, form, fName, fW, fD, fFh, fN, sum, editing=null;
let last={w:180,d:120,fh:15,n:4};

function defaultName(){
  let k=BUILDINGS.length+1;
  while(buildingNameTaken('Building '+k)) k++;
  return 'Building '+k;
}
function values(){
  return {name:fName.value.trim().replace(/\s+/g,' '),w:fW.valueAsNumber,d:fD.valueAsNumber,fh:fFh.valueAsNumber,
    n:editing?state.levels[editing].length:fN.valueAsNumber};
}
/* the name must be new; the summary line shows the plate and gross area as the fields change */
function check(){
  const v=values();
  fName.setCustomValidity(!v.name?'Enter a name for the building.':buildingNameTaken(v.name,editing)?'Another building already has this name.':'');
  if(![fW,fD,fFh,fN].every(f=>f.disabled||f.validity.valid)){ sum.textContent=''; return; }
  let t=fmt(v.w*v.d)+' SF floor plate · '+v.n+(v.n>1?' levels':' level')+' · '+fmt(v.w*v.d*v.n)+' GSF.';
  if(!editing) t+=' It goes on a free spot of the site.';
  else { const o=overlapsAt(editing,v.w,v.d); if(o.length) t+=' It would overlap '+o.join(', ')+'.'; }
  sum.textContent=t;
}
function openDialog(bid){
  editing=bid;
  const def=bid?BDEF[bid]:last;
  $('#bdKind').textContent=bid?'Selected building':'Campus';
  $('#bdTitle').textContent=bid?'Edit building':'Add a building';
  $('#bdOk').textContent=bid?'Save':'Add building';
  $('#bdNWrap').hidden=!!bid; fN.disabled=!!bid;
  fName.value=bid?def.name:defaultName();
  fW.value=def.w; fD.value=def.d; fFh.value=def.fh; fN.value=last.n;
  check();
  dlg.showModal();
  fName.select();
}
export function openAddBuilding(){ if(BUILDINGS.length<MAX_BUILDINGS&&!dlg.open) openDialog(null); }
export function openEditBuilding(bid){ if(BDEF[bid]&&!dlg.open) openDialog(bid); }

/* ---------- the ⋯ menu in the right panel's title row: delete the selected building ---------- */
let menu, mbtn=null;
function openMenu(btn,focusFirst){
  const bid=state.sel, def=BDEF[bid], k=state.levels[bid].reduce((s,lv)=>s+lv.length,0), only=BUILDINGS.length<=1;
  const it=menu.querySelector('[data-act=bld-delete]'), label=it.querySelector('span');
  it.setAttribute('aria-disabled',String(only));
  label.firstChild.nodeValue='Delete '+def.name;
  label.lastChild.textContent=only?'A project needs at least one building':k?k+(k>1?' departments move':' department moves')+' to Unassigned':'';
  mbtn=btn; menu.hidden=false; btn.setAttribute('aria-expanded','true');
  place();
  if(focusFirst) menu.querySelector('[role=menuitem]').focus();
}
function place(){ if(!placeMenu(menu,mbtn,rightEl)) closeMenu(false); }
function closeMenu(refocus){
  if(menu.hidden) return;
  menu.hidden=true;
  if(mbtn){ mbtn.setAttribute('aria-expanded','false'); if(refocus&&mbtn.isConnected) mbtn.focus(); }
  mbtn=null;
}

export function bindBuildings(){
  dlg=$('#buildingDlg'); form=$('#buildingForm'); sum=$('#bdSum');
  fName=$('#bdName'); fW=$('#bdW'); fD=$('#bdD'); fFh=$('#bdFh'); fN=$('#bdN');
  fN.max=MAX_LEVELS;
  form.addEventListener('input',check);
  // Cancel skips validation (formnovalidate); "Add building" and "Save" only submit valid fields
  let done=null;
  form.addEventListener('submit',e=>{
    if(!e.submitter||e.submitter.value!=='ok') return;
    const v=values();
    if(editing){ editBuilding(editing,v); done='[data-act=bldmenu]'; return; }
    last={w:v.w,d:v.d,fh:v.fh,n:v.n};
    if(addBuilding(v)!=null) done='[data-act=addbuilding]';
  });
  // the button that opened the dialog was rebuilt with its panel, so focus goes to the new one
  dlg.addEventListener('close',()=>{
    if(!done) return;
    const b=document.querySelector('#left '+done+',#right '+done); done=null;
    if(b) b.focus();
  });

  menu=$('#buildingMenu');
  rightEl.addEventListener('click',e=>{
    const b=e.target.closest('[data-act=bldmenu]'); if(!b) return;
    if(mbtn===b&&!menu.hidden) closeMenu(false); else { closeMenu(false); openMenu(b,e.detail===0); }
  });
  menu.addEventListener('click',e=>{
    const it=e.target.closest('[role=menuitem]');
    if(!it||it.getAttribute('aria-disabled')==='true') return;
    closeMenu(false);
    if(it.dataset.act==='bld-edit') openEditBuilding(state.sel);
    else if(it.dataset.act==='bld-delete') deleteBuilding(state.sel);
  });
  menu.addEventListener('keydown',e=>{ if(!menuKeys(menu,e)&&e.key==='Tab') closeMenu(false); });
  document.addEventListener('pointerdown',e=>{ if(!menu.hidden&&!menu.contains(e.target)&&e.target.closest('[data-act=bldmenu]')!==mbtn) closeMenu(false); });
  rightEl.addEventListener('scroll',()=>{ if(!menu.hidden) place(); });
  window.addEventListener('resize',()=>closeMenu(false));
  window.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!menu.hidden){ e.preventDefault(); closeMenu(true); } });
}
