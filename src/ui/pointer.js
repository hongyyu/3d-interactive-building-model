import * as THREE from 'three';
import {DEPTS} from '../data/project.js';
import {state,BDEF,drag,setDrag,setHoverId} from '../state.js';
import {canvas,statusEl} from '../dom.js';
import {clamp,fmt} from '../util.js';
import {S,SLAB,CLEAR,BASE} from '../scene/constants.js';
import {B,D,camera} from '../scene/scene.js';
import {view,viewT,explode,SH,setViewRate} from '../scene/view.js';
import {planFloor,levelOf,levelsWithOverride,relayout} from '../layout/plan.js';
import {selectBuilding,selectDept} from './actions.js';
import {renderRight,refreshUI} from './panels.js';

const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
const pts=new Map();
let gesture=null;
function setNdc(cx,cy){
  const r=canvas.getBoundingClientRect();
  ndc.set(((cx-r.left)/r.width)*2-1,-((cy-r.top)/r.height)*2+1);
}
function pick(cx,cy){
  setNdc(cx,cy); ray.setFromCamera(ndc,camera);
  const list=[];
  for(const id in D){ const d=D[id]; if(d.b===state.sel&&d.dim>0.5) list.push(d.mesh); }
  if(state.mode==='mass'){ for(const bid in B){ if(bid!==state.sel&&B[bid].fade>0.5) B[bid].shells.forEach(s=>list.push(s)); } }
  const hits=ray.intersectObjects(list,false);
  if(!hits.length) return null;
  const u=hits[0].object.userData;
  return u.t==='dept'?{type:'dept',id:u.id}:{type:'shell',id:u.b};
}
function updateStatus(){
  if(!drag){ statusEl.hidden=true; return; }
  const o=drag.ov, def=BDEF[o.b], ids=levelsWithOverride(o.b)[o.f];
  let tot=0; ids.forEach(i=>{tot+=DEPTS[i].a;});
  const plate=def.w*def.d; drag.over=tot>plate+0.5;
  statusEl.className='status'+(drag.over?' over':'');
  statusEl.textContent=DEPTS[o.id].n+' → Level '+(o.f+1)+' · '+fmt(tot)+' / '+fmt(plate)+' SF'+(drag.over?' · over by '+fmt(tot-plate):'');
  statusEl.hidden=false;
}
function startDrag(g){
  const d=D[g.id], c=d.mesh.position.clone();
  const n=new THREE.Vector3(camera.position.x-c.x,0,camera.position.z-c.z);
  if(n.lengthSq()<1e-6) n.set(0,0,1);
  n.normalize();
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(n,c);
  setNdc(g.sx,g.sy); ray.setFromCamera(ndc,camera);
  const p0=new THREE.Vector3();
  if(!ray.ray.intersectPlane(plane,p0)) p0.copy(c);
  const loc=levelOf(d.b,g.id);
  setDrag({id:g.id,plane:plane,off:c.clone().sub(p0),pos:c.clone(),ov:{b:d.b,id:g.id,f:loc.f,idx:loc.i},over:false});
  canvas.style.cursor='grabbing';
  relayout(false); updateStatus();
}
function moveDrag(cx,cy){
  setNdc(cx,cy); ray.setFromCamera(ndc,camera);
  const p=new THREE.Vector3();
  if(!ray.ray.intersectPlane(drag.plane,p)) return;
  drag.pos.copy(p).add(drag.off);
  const o=drag.ov, def=BDEF[o.b], fhU=def.fh*S, h=fhU-SLAB-CLEAR, pitch=fhU*(1+explode);
  const n=state.levels[o.b].length;
  const f=clamp(Math.round((drag.pos.y-BASE-SLAB-h/2)/pitch),0,n-1);
  const others=state.levels[o.b][f].filter(i=>i!==drag.id);
  const plan=planFloor(def,others);
  let idx=0; plan.items.forEach(it=>{ if((def.x+it.cx)*S<drag.pos.x) idx++; });
  if(f!==o.f||idx!==o.idx){ drag.ov={b:o.b,id:o.id,f:f,idx:idx}; relayout(false); updateStatus(); }
}
function commitDrag(){
  const o=drag.ov, d=D[o.id], def=BDEF[o.b], fhU=def.fh*S, h=fhU-SLAB-CLEAR, pitch=fhU*(1+explode);
  d.vx=drag.pos.x; d.vf=(drag.pos.y-BASE-SLAB-h/2)/pitch;
  const lv=state.levels[o.b];
  lv.forEach(a=>{const i=a.indexOf(o.id); if(i>=0)a.splice(i,1);});
  lv[o.f].splice(o.idx,0,o.id);
  setDrag(null); canvas.style.cursor='';
  relayout(false); updateStatus(); refreshUI();
}
function cancelDrag(){
  if(!drag)return;
  const d=D[drag.id]; d.vx=drag.pos.x;
  setDrag(null); canvas.style.cursor=''; relayout(false); updateStatus();
}
export function bindPointer(){
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button===1)return;
    try{canvas.setPointerCapture(e.pointerId);}catch(_){}
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    setViewRate(11);
    if(pts.size>=2){
      cancelDrag();
      const a=Array.from(pts.values());
      gesture={type:'pinch',d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1,s:viewT.s};
      return;
    }
    const hit=(e.button===0)?pick(e.clientX,e.clientY):null;
    if(hit&&hit.type==='dept'){ gesture={type:'dept',id:hit.id,sx:e.clientX,sy:e.clientY}; selectDept(hit.id); }
    else if(hit&&hit.type==='shell'){ gesture={type:'shell',id:hit.id,sx:e.clientX,sy:e.clientY}; }
    else gesture={type:(e.button===2||e.shiftKey||state.mode==='stack')?'pan':'orbit',lx:e.clientX,ly:e.clientY,moved:false};
  });
  canvas.addEventListener('pointermove',e=>{
    if(pts.has(e.pointerId)) pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    let g=gesture;
    if(!g){
      if(e.pointerType==='touch')return;
      const h=pick(e.clientX,e.clientY);
      setHoverId((h&&h.type==='dept')?h.id:null);
      canvas.style.cursor=h?(h.type==='dept'?'grab':'pointer'):'';
      return;
    }
    if(g.type==='pinch'){
      if(pts.size>=2){
        const a=Array.from(pts.values());
        const dd=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)||1;
        viewT.s=clamp(g.s*g.d/dd,6,160);
      }
      return;
    }
    if(g.type==='dept'){
      if(!drag&&Math.hypot(e.clientX-g.sx,e.clientY-g.sy)>5) startDrag(g);
      if(drag) moveDrag(e.clientX,e.clientY);
      return;
    }
    if(g.type==='shell'){
      if(Math.hypot(e.clientX-g.sx,e.clientY-g.sy)<=5) return;
      g=gesture={type:'orbit',lx:g.sx,ly:g.sy,moved:true};
    }
    const dx=e.clientX-g.lx, dy=e.clientY-g.ly;
    g.lx=e.clientX; g.ly=e.clientY;
    if(Math.abs(dx)+Math.abs(dy)>0) g.moved=true;
    if(g.type==='orbit'){
      viewT.az-=dx*0.0075; viewT.el=clamp(viewT.el+dy*0.0075,0.06,1.45);
    } else {
      const upp=Math.exp(view.ls)/SH;
      const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
      const up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
      viewT.t.addScaledVector(right,-dx*upp).addScaledVector(up,dy*upp);
    }
  });
  function endPointer(e){
    pts.delete(e.pointerId);
    const g=gesture;
    if(g){
      if(g.type==='pinch'){ if(pts.size<2) gesture=null; }
      else if(pts.size===0){
        if(g.type==='dept'){ if(drag) commitDrag(); }
        else if(g.type==='shell'){ selectBuilding(g.id,true); }
        else if(!g.moved&&state.selDept){ state.selDept=null; renderRight(); }
        gesture=null;
      }
    }
    try{canvas.releasePointerCapture(e.pointerId);}catch(_){}
  }
  canvas.addEventListener('pointerup',endPointer);
  canvas.addEventListener('pointercancel',e=>{ cancelDrag(); endPointer(e); });
  canvas.addEventListener('pointerleave',()=>{ if(!gesture){ setHoverId(null); } });
  canvas.addEventListener('wheel',e=>{
    e.preventDefault(); setViewRate(11);
    viewT.s=clamp(viewT.s*Math.exp(e.deltaY*0.0012),6,160);
  },{passive:false});
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&drag){ cancelDrag(); gesture=null; }
  });
}
