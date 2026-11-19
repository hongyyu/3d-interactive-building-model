import {CATS,DEPTS,BUILDINGS,UNASSIGNED} from './data/project.js';

/* state.levels[bid] and state.unassigned are the live stacking; INIT_* snapshot the loaded project
   for "Reset layout" and "Reset colours" (a department without its own colour is stored as '').
   INIT_LAYOUT is JSON of the loaded buildings (with their loaded levels), departments and tray, so
   Reset layout can also bring back deleted buildings and departments, drop added ones and undo
   renames and resizes. */
export const BDEF={}, INIT_CAT_COLORS={}, INIT_DEPT_COLORS={};
export let INIT_LAYOUT='';
export const state={mode:'mass',focus:'campus',sel:null,selDept:null,labels:true,sf:true,isolate:null,levels:{},unassigned:[],panelOpen:true,buildingsOpen:true,picking:null};

/* state.labels / state.sf: whether department labels show, and whether they show their SF line, in
   every view mode alike
   state.panelOpen: whether the right panel shows more than its title row
   state.buildingsOpen: whether the left panel's Buildings section shows its cards
   state.picking: what the open colour panel edits ('cat:<key>' or 'dept:<id>'), or null */

/* Campus overview: 3D Massing with no building focused. Every building shows its departments and
   none is highlighted; state.sel still names the building Axon, Stacking and the tray use. */
export function isOverview(){ return state.mode==='mass'&&state.focus==='campus'; }

/* resets selection and stacking to the freshly loaded project; the view mode and label settings are kept */
export function initState(){
  for(const k in BDEF) delete BDEF[k];
  [INIT_CAT_COLORS,INIT_DEPT_COLORS].forEach(o=>{ for(const k in o) delete o[k]; });
  BUILDINGS.forEach(b=>{BDEF[b.id]=b;});
  INIT_LAYOUT=JSON.stringify({buildings:BUILDINGS,depts:DEPTS,unassigned:UNASSIGNED});
  for(const k in DEPTS) INIT_DEPT_COLORS[k]=DEPTS[k].color||'';
  for(const k in CATS) INIT_CAT_COLORS[k]=CATS[k].color;
  state.sel=BUILDINGS[0].id; state.focus=state.mode==='mass'?'campus':'building';
  state.selDept=null; state.isolate=null;
  state.levels={}; BUILDINGS.forEach(b=>{state.levels[b.id]=b.levels.map(a=>a.slice());});
  state.unassigned=UNASSIGNED.slice();
}

/* true when a category or department colour differs from the loaded project; a department added in
   the app counts as edited only once it has its own colour */
export function colorsEdited(){
  for(const k in CATS) if(CATS[k].color!==INIT_CAT_COLORS[k]) return true;
  for(const k in DEPTS) if((DEPTS[k].color||'')!==(INIT_DEPT_COLORS[k]||'')) return true;
  return false;
}
/* true when another department than except already has this name (ignoring case) */
export function deptNameTaken(name,except){
  const n=name.toLowerCase();
  for(const k in DEPTS) if(k!==except&&DEPTS[k].n.toLowerCase()===n) return true;
  return false;
}
/* true when another building than except already has this name (ignoring case) */
export function buildingNameTaken(name,except){
  const n=name.toLowerCase();
  return BUILDINGS.some(b=>b.id!==except&&b.name.toLowerCase()===n);
}

/* transient pointer state; only ui/pointer.js changes it */
export let drag=null, hoverId=null;
export function setDrag(d){ drag=d; }
export function setHoverId(id){ hoverId=id; }
/* departments glowing in the model because their level row is hovered or dragged in the right
   panel; only ui/levels.js changes it */
export let hotIds=null;
export function setHotIds(ids){ hotIds=ids; }
