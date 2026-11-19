import {PROJECT,CATS,DEPTS,BUILDINGS,setProjectData} from '../data/project.js';
import {state,BDEF,INIT_LAYOUT,INIT_CAT_COLORS,INIT_DEPT_COLORS,initState,isOverview} from '../state.js';
import {hintEl} from '../dom.js';
import {$,clamp} from '../util.js';
import {B,D,setLabelHTML,clearScene,buildScene,fitSite,setLevelCount,paintDepts,addBuildingMeshes,removeBuildingMeshes,fitBuildingMeshes,addDeptMeshes,removeDeptMeshes} from '../scene/scene.js';
import {retarget,snapView,setViewRate} from '../scene/view.js';
import {rebuildFloorTags} from '../scene/overlay.js';
import {relayout,levelOf} from '../layout/plan.js';
import {freeSpot} from '../layout/site.js';
import {MAX_LEVELS,MAX_BUILDINGS} from '../scene/constants.js';
import {renderRight,refreshUI} from './panels.js';

export const HINTS={
  campus:'Drag to orbit · scroll to zoom · right-drag to pan · click a building to focus it',
  mass:'Drag to orbit · scroll to zoom · right-drag to pan · click a building to select · drag a department to move it',
  axon:'Drag to orbit · scroll to zoom · drag a department to another level or position',
  stack:'Drag a department up or down to change level, sideways to reorder · scroll to zoom'
};

/* the hint line at the bottom of the stage follows the view mode and the overview */
export function updateHint(){ hintEl.textContent=HINTS[isOverview()?'campus':state.mode]; }
export function selectBuilding(bid,focus){
  if(!B[bid])return;
  const changed=state.sel!==bid;
  state.sel=bid;
  if(focus&&state.mode==='mass') state.focus='building';
  if(changed){
    state.selDept=null; B[bid].fade=1;
    relayout(true);
    rebuildFloorTags();
  }
  refreshUI(); updateHint(); retarget(false); setViewRate(3.2);
}
/* selects a department; from the campus overview this also focuses its building (or, for a tray
   department, the building it would be placed in) */
export function selectDept(id){
  const loc=D[id]&&D[id].b;
  if(isOverview()||(loc&&loc!==state.sel)) selectBuilding(loc||state.sel,true);
  state.selDept=id; renderRight();
}
/* back to the campus overview, from any building or view mode */
export function showCampus(){
  state.focus='campus'; state.selDept=null;
  if(state.mode!=='mass') setMode('mass');
  else { retarget(false); setViewRate(3.2); }
  refreshUI(); updateHint();
}
/* Axon and Stacking always show one building, so they focus it; 3D Massing keeps the focus
   it had, so going back from Axon returns to that building rather than the overview */
export function setMode(m){
  const prev=state.mode;
  state.mode=m;
  if(m!=='mass') state.focus='building';
  document.querySelectorAll('#modes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));
  updateHint();
  retarget(false); setViewRate(3.2);
  if(prev!==m) refreshUI();
}
/* SF on the department labels, in every view mode alike */
export function toggleSF(){
  state.sf=!state.sf;
  $('#tools [data-act=sf]').setAttribute('aria-pressed',String(state.sf));
}
export function setArea(id,v){
  if(!id||!isFinite(v))return;
  DEPTS[id].a=clamp(Math.round(v),500,500000);
  setLabelHTML(D[id]); relayout(false); refreshUI();
}
/* ---------- departments ---------- */
/* where department id is: {bid, f, i} on level f of building bid, {bid: null, f: -1, i} in the tray,
   or null */
function findDept(id){
  for(const b of BUILDINGS){ const l=levelOf(b.id,id); if(l) return {bid:b.id,f:l.f,i:l.i}; }
  const t=state.unassigned.indexOf(id);
  return t>=0?{bid:null,f:-1,i:t}:null;
}
function takeDept(id){
  const p=findDept(id);
  if(p){ if(p.bid) state.levels[p.bid][p.f].splice(p.i,1); else state.unassigned.splice(p.i,1); }
  return p;
}
/* moves department id to level f of building bid, or to the tray with f = -1. Moved into another
   building than the selected one, it takes the view along and stays selected. */
export function moveDept(id,bid,f){
  const p=findDept(id); if(!p) return;
  if(f<0){ if(!p.bid) return; }
  else if(!state.levels[bid]||f>=state.levels[bid].length||(p.bid===bid&&p.f===f)) return;
  takeDept(id);
  if(f<0) state.unassigned.push(id); else state.levels[bid][f].push(id);
  if(f>=0&&bid!==state.sel){ selectBuilding(bid,true); state.selDept=id; renderRight(); return; }
  relayout(false); refreshUI();
}
/* a department id not used by a current department or by one of the loaded project, which Reset
   layout may bring back */
function newDeptId(){
  const used=JSON.parse(INIT_LAYOUT).depts;
  let k=1; while(DEPTS['d'+k]||used['d'+k]) k++;
  return 'd'+k;
}
/* adds a department {name, c (category key), a (SF)} on level f of building bid, or to the tray with
   f = -1, and selects it; it grows into place while the others on its level make room */
export function addDept(spec,bid,f){
  if(!CATS[spec.c]) return null;
  const id=newDeptId();
  DEPTS[id]={n:spec.name,c:spec.c,a:clamp(Math.round(spec.a),500,500000)};
  const d=addDeptMeshes(id);
  if(f>=0&&state.levels[bid]&&f<state.levels[bid].length) state.levels[bid][f].push(id); else state.unassigned.push(id);
  relayout(false);
  d.vw=0;
  state.selDept=id;
  refreshUI();
  return id;
}
/* takes department id out of the project */
export function deleteDept(id){
  if(!DEPTS[id]) return;
  takeDept(id);
  delete DEPTS[id]; removeDeptMeshes(id);
  if(state.selDept===id) state.selDept=null;
  relayout(false); refreshUI();
}
export function renameDept(id,name){
  if(!DEPTS[id]||!name) return;
  DEPTS[id].n=name; setLabelHTML(D[id]); refreshUI();
}
/* a department without its own colour takes the new category's colour */
export function setDeptCat(id,c){
  if(!DEPTS[id]||!CATS[c]) return;
  DEPTS[id].c=c; paintDepts(); refreshUI();
}
/* after a building's level count changes: rebuild its level meshes and floor tags, then reframe
   the camera so the new height fits; with drop, a level added on top drops into place */
function levelCountChanged(bid,drop){
  setLevelCount(bid,state.levels[bid].length,drop);
  relayout(false);
  if(bid===state.sel) rebuildFloorTags();
  refreshUI(); retarget(true); setViewRate(3.2);
}
/* inserts an empty level into building bid at level index f (0 makes it the new Level 1); the
   levels from f up move up one */
export function insertLevel(bid,f){
  const lv=state.levels[bid];
  if(!lv||lv.length>=MAX_LEVELS)return;
  f=clamp(f,0,lv.length);
  lv.splice(f,0,[]);
  levelCountChanged(bid,f===lv.length-1);
}
/* adds an empty level on top of building bid */
export function addLevel(bid){ if(state.levels[bid]) insertLevel(bid,state.levels[bid].length); }
/* removes level f of building bid; its departments go to the Unassigned tray and the levels
   above move down */
export function removeLevel(bid,f){
  const lv=state.levels[bid];
  if(!lv||lv.length<=1||f<0||f>=lv.length)return;
  lv.splice(f,1)[0].forEach(id=>state.unassigned.push(id));
  levelCountChanged(bid,false);
}
/* moves level `from` of building bid to index `to`; the levels between shift by one */
export function moveLevel(bid,from,to){
  const lv=state.levels[bid];
  if(!lv||from===to||to<0||to>=lv.length)return;
  lv.splice(to,0,lv.splice(from,1)[0]);
  relayout(false); refreshUI();
}
/* ---------- buildings ---------- */
/* a building id not used by a current building or by one of the loaded project, which Reset layout
   may bring back */
function newBuildingId(){
  const used=new Set(JSON.parse(INIT_LAYOUT).buildings.map(b=>b.id));
  let k=1; while(BDEF['b'+k]||used.has('b'+k)) k++;
  return 'b'+k;
}
/* takes building bid out of the project and the scene; its departments are not touched */
function dropBuilding(bid){
  BUILDINGS.splice(BUILDINGS.findIndex(b=>b.id===bid),1);
  delete BDEF[bid]; delete state.levels[bid];
  removeBuildingMeshes(bid);
}
/* after buildings were removed or brought back: refit the sun and grid, rebuild the floor tags and
   panels, and reframe (keeping the 3D Massing camera angles with keepAngles) */
function buildingsChanged(keepAngles){
  fitSite();
  relayout(false);
  rebuildFloorTags();
  refreshUI(); updateHint(); retarget(keepAngles); setViewRate(3.2);
}
/* adds a building with n empty levels and focuses it; spec is {name, w, d, fh, n}, sizes in ft. It
   goes on the nearest free spot of the site that the default 3D Massing view sees (freeSpot) and its
   levels drop into place. Returns its id, or null at MAX_BUILDINGS. */
export function addBuilding(spec){
  if(BUILDINGS.length>=MAX_BUILDINGS) return null;
  const n=clamp(Math.round(spec.n),1,MAX_LEVELS), id=newBuildingId(), p=freeSpot(spec.w,spec.d);
  const def={id,name:spec.name,w:spec.w,d:spec.d,fh:spec.fh,x:p.x,z:p.z,levels:Array.from({length:n},()=>[])};
  BUILDINGS.push(def); BDEF[id]=def;
  state.levels[id]=def.levels.map(()=>[]);
  addBuildingMeshes(def,true);
  fitSite();
  selectBuilding(id,true);
  return id;
}
/* renames or resizes building bid; spec is {name, w, d, fh}, sizes in ft. It keeps its site
   position (centre), levels and departments. */
export function editBuilding(bid,spec){
  const def=BDEF[bid]; if(!def) return;
  const sized=def.w!==spec.w||def.d!==spec.d||def.fh!==spec.fh;
  def.name=spec.name; def.w=spec.w; def.d=spec.d; def.fh=spec.fh;
  if(sized){ fitBuildingMeshes(bid); fitSite(); relayout(false); }
  refreshUI();
  if(sized){ retarget(true); setViewRate(3.2); }
}
/* deletes building bid; its departments go to the Unassigned tray, level by level. A project keeps
   at least one building. When bid was the selected building, 3D Massing goes back to the campus
   overview, and Axon and Stacking show the next building in the list. */
export function deleteBuilding(bid){
  const i=BUILDINGS.findIndex(b=>b.id===bid);
  if(i<0||BUILDINGS.length<=1) return;
  state.levels[bid].forEach(lv=>lv.forEach(id=>state.unassigned.push(id)));
  dropBuilding(bid);
  if(state.sel===bid){
    state.sel=BUILDINGS[Math.min(i,BUILDINGS.length-1)].id;
    state.selDept=null;
    if(state.mode==='mass') state.focus='campus';
  }
  buildingsChanged(false);
}
/* back to the loaded project's program and buildings: departments added in the app go, deleted ones
   come back, and every department gets its loaded name, category, area and place; added buildings
   go, deleted ones come back in their place in the list, and every building gets its loaded name,
   size and level count. Colours are left alone, except that a department that comes back has its
   loaded colour. */
export function resetLayout(){
  const init=JSON.parse(INIT_LAYOUT), loaded=new Set(init.buildings.map(b=>b.id));
  let sites=false, resized=false;
  for(const id in DEPTS) if(!init.depts[id]){ delete DEPTS[id]; removeDeptMeshes(id); }
  for(const id in init.depts){
    const s=init.depts[id], d=DEPTS[id];
    if(!d){ DEPTS[id]=s; addDeptMeshes(id); continue; }
    d.n=s.n; d.c=s.c; d.a=s.a;
    setLabelHTML(D[id]);
  }
  paintDepts();
  BUILDINGS.filter(b=>!loaded.has(b.id)).forEach(b=>{ dropBuilding(b.id); sites=true; });
  init.buildings.forEach((def,i)=>{
    const cur=BDEF[def.id];
    if(!cur){
      BUILDINGS.splice(i,0,def); BDEF[def.id]=def;
      addBuildingMeshes(def,true); sites=true;
      return;
    }
    cur.name=def.name;
    if(cur.w!==def.w||cur.d!==def.d||cur.fh!==def.fh){ cur.w=def.w; cur.d=def.d; cur.fh=def.fh; fitBuildingMeshes(def.id); sites=true; }
  });
  init.buildings.forEach(def=>{
    const bid=def.id, lv=def.levels.map(a=>a.slice());
    if(B[bid].shells.length!==lv.length){ resized=true; setLevelCount(bid,lv.length,true); }
    state.levels[bid]=lv;
  });
  state.unassigned=init.unassigned;
  state.selDept=null; state.isolate=null;
  if(sites){
    // the selected building was one that was added
    if(!BDEF[state.sel]){ state.sel=BUILDINGS[0].id; if(state.mode==='mass') state.focus='campus'; }
    buildingsChanged(true);
    return;
  }
  relayout(false);
  if(resized) rebuildFloorTags();
  refreshUI();
  if(resized){ retarget(true); setViewRate(3.2); }
}
/* The colour panel (ui/colorPanel.js) calls these on every change, so the model follows the drag */
const HEX=/^#[0-9a-f]{6}$/i;
export function setCatColor(k,v){
  if(!CATS[k]||!HEX.test(v))return;
  CATS[k].color=v.toLowerCase(); paintDepts(); refreshUI();
}
/* gives department id its own colour, which overrides its category colour */
export function setDeptColor(id,v){
  if(!DEPTS[id]||!HEX.test(v))return;
  DEPTS[id].color=v.toLowerCase(); paintDepts(); refreshUI();
}
/* drops department id's own colour, so it follows its category again */
export function useCatColor(id){
  if(!DEPTS[id])return;
  delete DEPTS[id].color; paintDepts(); refreshUI();
}
/* back to the colours of the loaded project; the layout is kept */
export function resetColors(){
  for(const k in INIT_CAT_COLORS) CATS[k].color=INIT_CAT_COLORS[k];
  for(const k in DEPTS){ if(INIT_DEPT_COLORS[k]) DEPTS[k].color=INIT_DEPT_COLORS[k]; else delete DEPTS[k].color; }
  paintDepts(); refreshUI();
}
/* replaces the whole project (demo or imported) and rebuilds the scene from it */
export function openProject(p){
  setProjectData(p);
  initState();
  clearScene(); buildScene(); fitSite();
  relayout(true);
  rebuildFloorTags();
  refreshUI();
  $('#ptitle').textContent=PROJECT.title; $('#psub').textContent=PROJECT.sub;
  updateHint(); retarget(false); snapView();
}
