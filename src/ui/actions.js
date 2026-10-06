import {DEPTS,BUILDINGS} from '../data/demo.js';
import {state,INIT_LEVELS,INIT_AREAS} from '../state.js';
import {hintEl} from '../dom.js';
import {clamp} from '../util.js';
import {B,D,setLabelHTML} from '../scene/scene.js';
import {retarget,setViewRate} from '../scene/view.js';
import {rebuildFloorTags,updateFloorTagText} from '../scene/overlay.js';
import {relayout,levelOf} from '../layout/plan.js';
import {renderRight,refreshUI} from './panels.js';

export const HINTS={
  mass:'Drag to orbit · scroll to zoom · right-drag to pan · click a building to select · drag a department to move it',
  axon:'Drag to orbit · scroll to zoom · drag a department to another level or position',
  stack:'Drag a department up or down to change level, sideways to reorder · scroll to zoom'
};

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
  refreshUI(); retarget(false); setViewRate(3.2);
}
export function selectDept(id){
  const loc=D[id]&&D[id].b;
  if(loc&&loc!==state.sel){ selectBuilding(loc,false); }
  state.selDept=id; renderRight();
}
export function setMode(m){
  const prev=state.mode;
  state.mode=m;
  state.focus=(m==='mass')?'campus':'building';
  document.querySelectorAll('#modes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));
  hintEl.textContent=HINTS[m];
  retarget(false); setViewRate(3.2);
  if(prev!==m) updateFloorTagText();
}
export function setArea(id,v){
  if(!id||!isFinite(v))return;
  DEPTS[id].a=clamp(Math.round(v),500,80000);
  setLabelHTML(D[id]); relayout(false); refreshUI();
}
export function moveDeptToLevel(id,f){
  const loc=levelOf(state.sel,id); if(!loc||loc.f===f)return;
  const lv=state.levels[state.sel];
  lv[loc.f].splice(loc.i,1); lv[f].push(id);
  relayout(false); refreshUI();
}
export function resetLayout(){
  JSON.parse(INIT_LEVELS).forEach((lv,i)=>{state.levels[BUILDINGS[i].id]=lv;});
  for(const k in INIT_AREAS){ DEPTS[k].a=INIT_AREAS[k]; setLabelHTML(D[k]); }
  state.selDept=null; state.isolate=null;
  relayout(false); refreshUI();
}
