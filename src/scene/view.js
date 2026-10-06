import * as THREE from 'three';
import {state,BDEF} from '../state.js';
import {stage} from '../dom.js';
import {RM} from '../util.js';
import {S,BASE,EXPLODE,GRIDOP} from './constants.js';
import {renderer,scene,camera} from './scene.js';
import {campusBounds} from '../layout/site.js';

export const view={az:-0.62,el:0.5,lf:Math.log(30),ls:Math.log(50),t:new THREE.Vector3(6.5,3,1.8)};
export const viewT={az:-0.62,el:0.5,fov:30,s:50,t:new THREE.Vector3(6.5,3,1.8)};
export let explode=0, explodeT=0, gridT=1, viewRate=10;
export let SW=800, SH=600;
export function setViewRate(r){ viewRate=r; }
function fit(rxz,h,el,asp,m){
  const sH=(2*rxz*Math.sin(el)+h*Math.cos(el))*m;
  const sW=2*rxz*m/asp;
  return Math.max(sH,sW);
}
function targetView(){
  const def=BDEF[state.sel], W=def.w*S, Dp=def.d*S, fhU=def.fh*S, n=state.levels[def.id].length;
  const asp=SW/SH, cx=def.x*S, cz=def.z*S;
  if(state.mode==='mass'){
    if(state.focus==='campus'){
      // centre snapped to 1 ft, extent rounded up to 10 ft; aim at a fifth of the tallest height
      const c=campusBounds();
      return {az:-0.62,el:0.5,fov:30,s:fit(Math.ceil(c.r),Math.ceil(c.h),0.5,asp,1.1),
        t:new THREE.Vector3(Math.round(c.cx*10)/10,Math.round(c.h*0.2),Math.round(c.cz*10)/10)};
    }
    const H=n*fhU, rxz=Math.max(Math.hypot(W,Dp)/2*2.1,16);
    return {az:-0.62,el:0.5,fov:30,s:fit(rxz,H,0.5,asp,1.1),t:new THREE.Vector3(cx,H/2,cz)};
  }
  const pitchE=fhU*(1+EXPLODE[state.mode]), H=(n-1)*pitchE+fhU;
  if(state.mode==='axon'){
    return {az:-0.7,el:0.52,fov:4,s:fit(Math.hypot(W,Dp)/2,H,0.52,asp,1.2),t:new THREE.Vector3(cx,BASE+H/2,cz)};
  }
  const s=Math.max(H*1.3,W*1.6/asp);
  return {az:0,el:0,fov:3.2,s:s,t:new THREE.Vector3(cx-0.06*s*asp,BASE+H/2,cz)};
}
export function retarget(keepAngles){
  const v=targetView();
  if(keepAngles&&state.mode==='mass'){ viewT.fov=v.fov; viewT.s=v.s; viewT.t.copy(v.t); }
  else { viewT.az=v.az; viewT.el=v.el; viewT.fov=v.fov; viewT.s=v.s; viewT.t.copy(v.t); }
  explodeT=EXPLODE[state.mode]; gridT=GRIDOP[state.mode];
}
export function snapView(){
  view.az=viewT.az; view.el=viewT.el; view.lf=Math.log(viewT.fov); view.ls=Math.log(viewT.s); view.t.copy(viewT.t);
  explode=explodeT;
}
export function updateCamera(){
  const fov=Math.exp(view.lf), s=Math.exp(view.ls);
  const dist=s/(2*Math.tan(THREE.MathUtils.degToRad(fov)/2));
  const ce=Math.cos(view.el);
  camera.position.set(view.t.x+dist*Math.sin(view.az)*ce,view.t.y+dist*Math.sin(view.el),view.t.z+dist*Math.cos(view.az)*ce);
  camera.fov=fov; camera.aspect=SW/SH;
  camera.near=Math.max(0.5,dist-130); camera.far=dist+170;
  camera.updateProjectionMatrix();
  camera.lookAt(view.t);
  camera.updateMatrixWorld();
  scene.fog.near=dist+22; scene.fog.far=dist+120;
}
export function resize(){
  SW=Math.max(1,stage.clientWidth); SH=Math.max(1,stage.clientHeight);
  renderer.setSize(SW,SH,false);
}
/* eases the camera and explode factor toward their targets; called once per frame */
export function stepView(dt){
  const kv=RM?1:1-Math.exp(-dt*viewRate);
  view.az+=(viewT.az-view.az)*kv; view.el+=(viewT.el-view.el)*kv;
  view.lf+=(Math.log(viewT.fov)-view.lf)*kv; view.ls+=(Math.log(viewT.s)-view.ls)*kv;
  view.t.lerp(viewT.t,kv);
  explode+=(explodeT-explode)*kv;
  viewRate+=(10-viewRate)*Math.min(1,dt*0.8);
}
