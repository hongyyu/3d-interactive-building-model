import * as THREE from 'three';
import {DEPTS,BUILDINGS,deptColor} from '../data/project.js';
import {canvas,overlay} from '../dom.js';
import {fmt,esc} from '../util.js';
import {S,SLAB,PAD} from './constants.js';
import {campusBounds} from '../layout/site.js';

/* renderer is null when WebGL is unavailable; main.js checks it before booting */
export let renderer=null;
try{ renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true}); }catch(err){ renderer=null; }
if(renderer){
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setClearColor(0xffffff,1);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
}

export const scene=new THREE.Scene();
scene.background=new THREE.Color(0xffffff);
scene.fog=new THREE.Fog(0xffffff,100,300);
export const camera=new THREE.PerspectiveCamera(30,1,0.5,1000);

scene.add(new THREE.AmbientLight(0xffffff,0.68));
const SUN_POS=new THREE.Vector3(-26,60,44), SUN_TARGET=new THREE.Vector3(6,0,2), SUN_HALF=60, GRID_HALF=120;
const sun=new THREE.DirectionalLight(0xffffff,0.55);
sun.position.copy(SUN_POS); sun.target.position.copy(SUN_TARGET);
sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-60; sun.shadow.camera.right=60; sun.shadow.camera.top=60; sun.shadow.camera.bottom=-60;
sun.shadow.camera.near=1; sun.shadow.camera.far=200;
sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03;
scene.add(sun); scene.add(sun.target);

const ground=new THREE.Mesh(new THREE.PlaneGeometry(800,800),new THREE.ShadowMaterial({opacity:0.12}));
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
export const grid=new THREE.GridHelper(240,48,0xe6e9ee,0xe6e9ee);
grid.position.y=0.002; grid.material.transparent=true; scene.add(grid);

const boxGeo=new THREE.BoxGeometry(1,1,1);
const edgeGeo=new THREE.EdgesGeometry(boxGeo);
export const edgeMat=new THREE.LineBasicMaterial({color:0x1b2230,transparent:true,opacity:0.3});
export const edgeSelMat=new THREE.LineBasicMaterial({color:0x10151d});
const slabEdgeMat=new THREE.LineBasicMaterial({color:0xaab3c0});
const voidEdgeMat=new THREE.LineBasicMaterial({color:0xb4bcc8,transparent:true,opacity:0.8});
export const dropInk=new THREE.LineBasicMaterial({color:0x141922});
export const dropAlert=new THREE.LineBasicMaterial({color:0xc8234b});

export const B={}, D={};
export let dropBox=null, slotBox=null;

/* ---------- scene objects ---------- */
function makeBuilding(def){
  const g=new THREE.Group(); scene.add(g);
  const R={def:def,g:g,fade:1,shells:[],slabs:[],slabMats:[],voids:[],voidT:[],voidV:[],plans:[],tag:null};
  const W=def.w*S, Dp=def.d*S, n=def.levels.length;
  R.shellMat=new THREE.MeshLambertMaterial({color:0xffffff});
  R.padMat=new THREE.MeshLambertMaterial({color:0xf1f3f6});
  R.shellEdge=new THREE.LineBasicMaterial({color:0xb7bfcb,transparent:true,opacity:0.9});
  R.padEdge=new THREE.LineBasicMaterial({color:0xdde1e7,transparent:true,opacity:1});
  const pad=new THREE.Mesh(boxGeo,R.padMat);
  pad.scale.set(W+3,PAD,Dp+3); pad.position.set(def.x*S,PAD/2,def.z*S); pad.receiveShadow=true;
  pad.add(new THREE.LineSegments(edgeGeo,R.padEdge)); g.add(pad);
  for(let f=0;f<n;f++){
    const sh=new THREE.Mesh(boxGeo,R.shellMat);
    sh.castShadow=true; sh.receiveShadow=true; sh.userData={t:'shell',b:def.id};
    sh.add(new THREE.LineSegments(edgeGeo,R.shellEdge)); g.add(sh); R.shells.push(sh);
    const sm=new THREE.MeshLambertMaterial({color:0xffffff});
    const sl=new THREE.Mesh(boxGeo,sm);
    sl.scale.set(W,SLAB,Dp); sl.castShadow=true; sl.receiveShadow=true;
    sl.add(new THREE.LineSegments(edgeGeo,slabEdgeMat)); g.add(sl); R.slabs.push(sl); R.slabMats.push(sm);
    const vm=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:0.28,depthWrite:false}));
    vm.add(new THREE.LineSegments(edgeGeo,voidEdgeMat)); g.add(vm); R.voids.push(vm);
  }
  const tag=document.createElement('button');
  tag.type='button'; tag.className='btag'; tag.dataset.b=def.id;
  overlay.appendChild(tag); R.tag=tag;
  return R;
}
function makeDept(id){
  const base=new THREE.Color(deptColor(id));
  const mat=new THREE.MeshLambertMaterial({color:base.clone()});
  const mesh=new THREE.Mesh(boxGeo,mat);
  mesh.castShadow=true; mesh.receiveShadow=true; mesh.userData={t:'dept',id:id};
  const ed=new THREE.LineSegments(edgeGeo,edgeMat); mesh.add(ed);
  scene.add(mesh);
  const lbl=document.createElement('div'); lbl.className='lbl'; overlay.appendChild(lbl);
  const d={id:id,mesh:mesh,ed:ed,mat:mat,base:base,lbl:lbl,vx:0,vf:0,vw:1,tx:0,tf:0,tw:1,b:null,f:0,dim:1,lw:-1,lh:-1};
  setLabelHTML(d);
  return d;
}
export function setLabelHTML(d){
  const dd=DEPTS[d.id];
  d.lbl.innerHTML='<b>'+esc(dd.n)+'</b><span>'+fmt(dd.a)+' SF</span>';
  d.lh=-1;
}
export function buildScene(){
  BUILDINGS.forEach(def=>{B[def.id]=makeBuilding(def);});
  for(const k in DEPTS) D[k]=makeDept(k);
  if(!dropBox){
    dropBox=new THREE.LineSegments(edgeGeo,dropInk); dropBox.visible=false; scene.add(dropBox);
    slotBox=new THREE.LineSegments(edgeGeo,dropInk); slotBox.visible=false; scene.add(slotBox);
  }
}
/* removes the current project's meshes, materials and overlay elements; shared geometry stays */
export function clearScene(){
  for(const bid in B){
    const R=B[bid];
    scene.remove(R.g); R.tag.remove();
    [R.shellMat,R.padMat,R.shellEdge,R.padEdge,...R.slabMats,...R.voids.map(v=>v.material)].forEach(m=>m.dispose());
    delete B[bid];
  }
  for(const id in D){
    const d=D[id];
    scene.remove(d.mesh); d.mat.dispose(); d.lbl.remove();
    delete D[id];
  }
}
/* The default sun and grid cover a site about 1200 ft across around the origin. A campus that
   extends past them gets a recentred, enlarged shadow box and grid. */
export function fitSite(){
  const c=campusBounds();
  let tx=SUN_TARGET.x, tz=SUN_TARGET.z, half=SUN_HALF, gx=0, gz=0, gs=1;
  if(Math.hypot(c.cx-tx,c.cz-tz)+c.r>SUN_HALF){ tx=c.cx; tz=c.cz; half=Math.ceil(c.r*1.15); }
  if(Math.max(Math.abs(c.cx),Math.abs(c.cz))+c.r>GRID_HALF){ gx=Math.round(c.cx/5)*5; gz=Math.round(c.cz/5)*5; gs=Math.ceil((c.r+20)/GRID_HALF); }
  sun.target.position.set(tx,0,tz);
  sun.position.set(tx+SUN_POS.x-SUN_TARGET.x,SUN_POS.y,tz+SUN_POS.z-SUN_TARGET.z);
  const sc=sun.shadow.camera;
  sc.left=-half; sc.right=half; sc.top=half; sc.bottom=-half; sc.updateProjectionMatrix();
  grid.position.set(gx,0.002,gz); grid.scale.setScalar(gs);
}
