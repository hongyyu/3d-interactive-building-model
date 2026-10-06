import {DEPTS,BUILDINGS} from './data/demo.js';

export const BDEF={}; BUILDINGS.forEach(b=>{BDEF[b.id]=b;});
export const INIT_LEVELS=JSON.stringify(BUILDINGS.map(b=>b.levels));
export const INIT_AREAS={}; for(const k in DEPTS) INIT_AREAS[k]=DEPTS[k].a;
export const state={mode:'mass',focus:'campus',sel:'tower',selDept:null,labels:true,isolate:null,levels:{}};
BUILDINGS.forEach(b=>{state.levels[b.id]=b.levels.map(a=>a.slice());});

/* transient pointer state; only ui/pointer.js changes it */
export let drag=null, hoverId=null;
export function setDrag(d){ drag=d; }
export function setHoverId(id){ hoverId=id; }
