import {DEPTS} from '../data/project.js';
import {state,BDEF,drag,hoverId} from '../state.js';
import {S,SLAB,CLEAR,BASE,GAP} from './constants.js';
import {B,D,grid,edgeMat,edgeSelMat,dropBox,slotBox,dropInk,dropAlert} from './scene.js';
import {explode,gridT} from './view.js';

export function updateScene(k){
  const selId=state.sel, mode=state.mode;
  grid.material.opacity+=(gridT-grid.material.opacity)*k;
  grid.visible=grid.material.opacity>0.02;
  for(const bid in B){
    const R=B[bid], def=R.def, sel=bid===selId;
    const W=def.w*S, Dp=def.d*S, fhU=def.fh*S, pitch=fhU*(1+explode), n=def.levels.length;
    const tf=sel?1:(mode==='mass'?1:0);
    R.fade+=(tf-R.fade)*k; if(Math.abs(tf-R.fade)<0.01)R.fade=tf;
    R.g.visible=sel||R.fade>0.01;
    if(!R.g.visible) continue;
    const op=sel?1:R.fade, tr=op<0.99;
    [R.shellMat,R.padMat].forEach(m=>{ if(m.transparent!==tr){m.transparent=tr;m.needsUpdate=true;} m.opacity=op; m.depthWrite=!tr; });
    R.shellEdge.opacity=0.9*op; R.padEdge.opacity=op;
    for(let f=0;f<n;f++){
      const y0=BASE+f*pitch;
      const sh=R.shells[f]; sh.visible=!sel;
      sh.position.set(def.x*S,y0+(fhU-0.05)/2,def.z*S); sh.scale.set(W,fhU-0.05,Dp);
      const sl=R.slabs[f]; sl.visible=sel;
      sl.position.set(def.x*S,y0+SLAB/2,def.z*S);
      const vm=R.voids[f];
      if(sel){
        const st=R.plans[f], over=st.total>st.plate+0.5;
        R.slabMats[f].color.setHex(over?0xf3c9d3:0xffffff);
        const v=R.voidV[f], t=R.voidT[f];
        v.cx+=(t.cx-v.cx)*k; v.w+=(t.w-v.w)*k;
        const h=fhU-SLAB-CLEAR, vis=v.w>0.12;
        vm.visible=vis;
        if(vis){ vm.position.set(v.cx,y0+SLAB+h/2,def.z*S); vm.scale.set(Math.max(0.01,v.w-GAP),h,Dp); }
      } else vm.visible=false;
    }
  }
  for(const id in D){
    const d=D[id], sel=d.b===selId;
    d.mesh.visible=sel;
    if(!sel) continue;
    const def=BDEF[d.b], fhU=def.fh*S, h=fhU-SLAB-CLEAR, pitch=fhU*(1+explode);
    const isDrag=drag&&drag.id===id;
    d.vw+=(d.tw-d.vw)*k;
    if(!isDrag){ d.vx+=(d.tx-d.vx)*k; d.vf+=(d.tf-d.vf)*k; }
    if(isDrag) d.mesh.position.copy(drag.pos);
    else d.mesh.position.set(d.vx,BASE+d.vf*pitch+SLAB+h/2,def.z*S);
    d.mesh.scale.set(Math.max(0.02,d.vw-GAP),h,def.d*S);
    d.mesh.renderOrder=isDrag?5:0;
    const want=(!state.isolate||DEPTS[id].c===state.isolate)?1:0.1;
    d.dim+=(want-d.dim)*k;
    const tr=d.dim<0.99;
    if(tr!==d.mat.transparent){d.mat.transparent=tr;d.mat.needsUpdate=true;}
    d.mat.opacity=d.dim; d.mat.depthWrite=!tr;
    d.ed.visible=d.dim>0.5;
    const isSel=state.selDept===id;
    const em=isSel?0.22:(hoverId===id||isDrag?0.12:0);
    d.mat.emissive.copy(d.base).multiplyScalar(em);
    const em2=isSel?edgeSelMat:edgeMat;
    if(d.ed.material!==em2) d.ed.material=em2;
  }
  if(drag){
    const o=drag.ov, def=BDEF[o.b], fhU=def.fh*S, h=fhU-SLAB-CLEAR, pitch=fhU*(1+explode);
    const W=def.w*S, Dp=def.d*S, d=D[drag.id];
    dropBox.visible=true; dropBox.material=drag.over?dropAlert:dropInk;
    dropBox.position.set(def.x*S,BASE+o.f*pitch+fhU/2,def.z*S); dropBox.scale.set(W+0.3,fhU,Dp+0.3);
    slotBox.visible=true; slotBox.material=drag.over?dropAlert:dropInk;
    slotBox.position.set(d.tx,BASE+o.f*pitch+SLAB+h/2,def.z*S); slotBox.scale.set(Math.max(0.02,d.tw-GAP),h,Dp);
  } else { dropBox.visible=false; slotBox.visible=false; }
}
