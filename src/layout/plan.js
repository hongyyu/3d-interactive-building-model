import {DEPTS} from '../data/demo.js';
import {state,BDEF,drag} from '../state.js';
import {S} from '../scene/constants.js';
import {B,D} from '../scene/scene.js';

export function planFloor(def,ids){
  const plate=def.w*def.d;
  let total=0; ids.forEach(i=>{total+=DEPTS[i].a;});
  const den=Math.max(plate,total);
  let x=-def.w/2; const items=[];
  ids.forEach(id=>{ const w=def.w*DEPTS[id].a/den; items.push({id:id,cx:x+w/2,w:w}); x+=w; });
  return {items:items,total:total,plate:plate,used:x+def.w/2};
}
export function floorStat(bid,f){
  const def=BDEF[bid], ids=state.levels[bid][f];
  let total=0; ids.forEach(i=>{total+=DEPTS[i].a;});
  const plate=def.w*def.d;
  return {ids:ids,total:total,plate:plate,over:total>plate+0.5};
}
export function levelsWithOverride(bid){
  const lv=state.levels[bid].map(a=>a.slice());
  const o=drag?drag.ov:null;
  if(o&&o.b===bid){
    lv.forEach(a=>{const i=a.indexOf(o.id); if(i>=0)a.splice(i,1);});
    lv[o.f].splice(o.idx,0,o.id);
  }
  return lv;
}
export function relayout(snap){
  for(const bid in B){
    const R=B[bid], def=R.def, lv=levelsWithOverride(bid);
    lv.forEach((ids,f)=>{
      const p=planFloor(def,ids);
      p.items.forEach(it=>{
        const d=D[it.id]; d.b=bid; d.f=f; d.tf=f; d.tx=(def.x+it.cx)*S; d.tw=it.w*S;
        if(snap||d.lw<0){d.vx=d.tx;d.vf=d.tf;d.vw=d.tw;d.lw=0;}
      });
      R.plans[f]=p;
      const free=Math.max(0,def.w-p.used);
      R.voidT[f]={cx:(def.x-def.w/2+p.used+free/2)*S,w:free*S};
      if(!R.voidV[f]||snap) R.voidV[f]={cx:R.voidT[f].cx,w:R.voidT[f].w};
    });
  }
}
export function levelOf(bid,id){
  const lv=state.levels[bid];
  for(let f=0;f<lv.length;f++){ const i=lv[f].indexOf(id); if(i>=0)return {f:f,i:i}; }
  return null;
}
