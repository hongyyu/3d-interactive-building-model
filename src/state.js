import {DEPTS,BUILDINGS,UNASSIGNED} from './data/project.js';

/* state.levels[bid] and state.unassigned are the live stacking; INIT_* snapshot the loaded project for "Reset layout" */
export const BDEF={}, INIT_AREAS={};
export let INIT_LEVELS='';
export const state={mode:'mass',focus:'campus',sel:null,selDept:null,labels:true,isolate:null,levels:{},unassigned:[]};

/* resets selection and stacking to the freshly loaded project; the view mode and labels are kept */
export function initState(){
  for(const k in BDEF) delete BDEF[k];
  for(const k in INIT_AREAS) delete INIT_AREAS[k];
  BUILDINGS.forEach(b=>{BDEF[b.id]=b;});
  INIT_LEVELS=JSON.stringify({levels:BUILDINGS.map(b=>b.levels),unassigned:UNASSIGNED});
  for(const k in DEPTS) INIT_AREAS[k]=DEPTS[k].a;
  state.sel=BUILDINGS[0].id; state.focus=state.mode==='mass'?'campus':'building';
  state.selDept=null; state.isolate=null;
  state.levels={}; BUILDINGS.forEach(b=>{state.levels[b.id]=b.levels.map(a=>a.slice());});
  state.unassigned=UNASSIGNED.slice();
}

/* transient pointer state; only ui/pointer.js changes it */
export let drag=null, hoverId=null;
export function setDrag(d){ drag=d; }
export function setHoverId(id){ hoverId=id; }
