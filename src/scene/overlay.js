import * as THREE from 'three';
import {state,BDEF} from '../state.js';
import {overlay} from '../dom.js';
import {fk} from '../util.js';
import {S,SLAB,BASE} from './constants.js';
import {B,D,scene,camera} from './scene.js';
import {explode,SW,SH} from './view.js';
import {floorStat} from '../layout/plan.js';

const tmpV=new THREE.Vector3();
function toScreen(x,y,z){
  tmpV.set(x,y,z).project(camera);
  return {x:(tmpV.x*0.5+0.5)*SW,y:(-tmpV.y*0.5+0.5)*SH,ok:tmpV.z<1};
}
function screenBox(mesh){
  const m=mesh.matrixWorld;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(let i=0;i<8;i++){
    tmpV.set((i&1)?0.5:-0.5,(i&2)?0.5:-0.5,(i&4)?0.5:-0.5).applyMatrix4(m).project(camera);
    const px=(tmpV.x*0.5+0.5)*SW, py=(-tmpV.y*0.5+0.5)*SH;
    if(px<x0)x0=px; if(px>x1)x1=px; if(py<y0)y0=py; if(py>y1)y1=py;
  }
  return {x0:x0,y0:y0,x1:x1,y1:y1};
}
let floorTags=[];
export function rebuildFloorTags(){
  floorTags.forEach(t=>t.remove()); floorTags=[];
  const n=state.levels[state.sel].length;
  for(let f=0;f<n;f++){ const el=document.createElement('div'); el.className='ftag'; overlay.appendChild(el); floorTags.push(el); }
  updateFloorTagText();
}
export function updateFloorTagText(){
  floorTags.forEach((el,f)=>{
    const s=floorStat(state.sel,f);
    el.innerHTML='<b>L'+(f+1)+'</b>'+fk(s.total)+' / '+fk(s.plate);
    el.classList.toggle('over',s.over);
  });
}
export function updateOverlay(){
  scene.updateMatrixWorld(true);
  const mode=state.mode;
  for(const bid in B){
    const R=B[bid], def=R.def, tag=R.tag;
    if(mode!=='mass'||R.fade<0.5){ tag.style.display='none'; continue; }
    const n=state.levels[bid].length, fhU=def.fh*S, pitch=fhU*(1+explode);
    const p=toScreen(def.x*S,BASE+(n-1)*pitch+fhU+0.9,def.z*S);
    if(!p.ok){ tag.style.display='none'; continue; }
    tag.style.display='block';
    tag.style.transform='translate('+p.x.toFixed(1)+'px,'+p.y.toFixed(1)+'px) translate(-50%,-100%)';
  }
  const def=BDEF[state.sel], fhU=def.fh*S, pitch=fhU*(1+explode), W=def.w*S, Dp=def.d*S;
  floorTags.forEach((el,f)=>{
    if(mode==='mass'){ el.style.display='none'; return; }
    const p=toScreen(def.x*S-W/2,BASE+f*pitch+SLAB,def.z*S+Dp/2);
    if(!p.ok){ el.style.display='none'; return; }
    el.style.display='block';
    el.style.transform='translate('+(p.x-10).toFixed(1)+'px,'+p.y.toFixed(1)+'px) translate(-100%,-50%)';
  });
  for(const id in D){
    const d=D[id], lbl=d.lbl;
    if(d.b!==state.sel||!state.labels||d.dim<0.5){ lbl.style.display='none'; continue; }
    const bb=screenBox(d.mesh), bw=bb.x1-bb.x0, bh=bb.y1-bb.y0;
    if(bw<64||bh<22||bb.x1<0||bb.x0>SW||bb.y1<0||bb.y0>SH){ lbl.style.display='none'; continue; }
    lbl.style.display='block';
    const w=Math.min(bw-8,170);
    lbl.style.width=w.toFixed(0)+'px';
    lbl.style.transform='translate('+((bb.x0+bb.x1)/2).toFixed(1)+'px,'+((bb.y0+bb.y1)/2).toFixed(1)+'px) translate(-50%,-50%)';
    const one=bh<36;
    if(d.lh!==(one?1:0)){ d.lh=one?1:0; lbl.lastChild.style.display=one?'none':'block'; }
  }
}
