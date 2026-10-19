import {PROJECT,CATS,DEPTS,BUILDINGS,setProjectData} from '../data/project.js';
import {state,INIT_LEVELS,INIT_AREAS,INIT_CAT_COLORS,INIT_DEPT_COLORS,initState,isOverview} from '../state.js';
import {hintEl} from '../dom.js';
import {$,clamp} from '../util.js';
import {B,D,setLabelHTML,clearScene,buildScene,fitSite,setLevelCount,paintDepts} from '../scene/scene.js';
import {retarget,snapView,setViewRate} from '../scene/view.js';
import {rebuildFloorTags} from '../scene/overlay.js';
import {relayout,levelOf} from '../layout/plan.js';
import {MAX_LEVELS} from '../scene/constants.js';
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
/* f is a level of the selected building, or -1 for the Unassigned tray */
export function moveDeptToLevel(id,f){
  const lv=state.levels[state.sel], loc=levelOf(state.sel,id), t=state.unassigned.indexOf(id);
  if(loc){ if(loc.f===f)return; lv[loc.f].splice(loc.i,1); }
  else if(t>=0){ if(f<0)return; state.unassigned.splice(t,1); }
  else return;
  if(f<0) state.unassigned.push(id); else lv[f].push(id);
  relayout(false); refreshUI();
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
export function resetLayout(){
  const init=JSON.parse(INIT_LEVELS);
  let resized=false;
  init.levels.forEach((lv,i)=>{
    const bid=BUILDINGS[i].id;
    if(state.levels[bid].length!==lv.length){ resized=true; setLevelCount(bid,lv.length,true); }
    state.levels[bid]=lv;
  });
  state.unassigned=init.unassigned;
  for(const k in INIT_AREAS){ DEPTS[k].a=INIT_AREAS[k]; setLabelHTML(D[k]); }
  state.selDept=null; state.isolate=null;
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
  for(const k in INIT_DEPT_COLORS){ if(INIT_DEPT_COLORS[k]) DEPTS[k].color=INIT_DEPT_COLORS[k]; else delete DEPTS[k].color; }
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
