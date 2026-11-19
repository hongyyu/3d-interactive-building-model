import {BUILDINGS} from '../data/project.js';
import {state} from '../state.js';
import {S,MASS_AZ,MASS_EL} from '../scene/constants.js';

/* campus extent in scene units: footprint centre, half-diagonal of the footprint, tallest building
   (using the live level count, which changes when levels are added or removed) */
export function campusBounds(){
  let x0=Infinity, x1=-Infinity, z0=Infinity, z1=-Infinity, h=0;
  BUILDINGS.forEach(b=>{
    x0=Math.min(x0,b.x-b.w/2); x1=Math.max(x1,b.x+b.w/2);
    z0=Math.min(z0,b.z-b.d/2); z1=Math.max(z1,b.z+b.d/2);
    h=Math.max(h,state.levels[b.id].length*b.fh);
  });
  return {cx:(x0+x1)/2*S, cz:(z0+z1)/2*S, r:Math.hypot(x1-x0,z1-z0)/2*S, h:h*S};
}

/* Where a new w x d ft building goes: the spot nearest the middle of the campus footprint that keeps
   SITE_GAP ft clear of every building and that the default 3D Massing camera (azimuth MASS_AZ,
   elevation MASS_EL) sees whole, on a SITE_STEP ft grid. Seen whole means the sight lines from the
   foot of the new building, at its middle and at four points near its corners, pass over or beside
   every building between it and the camera, so no other building stands in front of it. Rings of grid
   points are searched outward from the middle until no closer spot can turn up. Returns its centre
   {x, z} in ft. */
const SITE_GAP=40, SITE_STEP=10;
export function freeSpot(w,d){
  if(!BUILDINGS.length) return {x:0,z:0};
  let x0=Infinity, x1=-Infinity, z0=Infinity, z1=-Infinity;
  const bs=BUILDINGS.map(b=>{
    x0=Math.min(x0,b.x-b.w/2); x1=Math.max(x1,b.x+b.w/2);
    z0=Math.min(z0,b.z-b.d/2); z1=Math.max(z1,b.z+b.d/2);
    return {x:b.x,z:b.z,w:b.w,d:b.d,h:state.levels[b.id].length*b.fh};
  });
  const cx=Math.round((x0+x1)/2/SITE_STEP)*SITE_STEP, cz=Math.round((z0+z1)/2/SITE_STEP)*SITE_STEP;
  const ux=Math.sin(MASS_AZ), uz=Math.cos(MASS_AZ), climb=Math.tan(MASS_EL);
  const free=(x,z)=>bs.every(b=>Math.abs(x-b.x)>=(w+b.w)/2+SITE_GAP||Math.abs(z-b.z)>=(d+b.d)/2+SITE_GAP);
  // walks the sight line toward the camera until it is higher than building b
  const clear=(x,z,b)=>{
    for(let t=0;t*climb<b.h;t+=SITE_STEP){ if(Math.abs(x+ux*t-b.x)<=b.w/2&&Math.abs(z+uz*t-b.z)<=b.d/2) return false; }
    return true;
  };
  const seen=(x,z)=>[[0,0],[-1,-1],[-1,1],[1,-1],[1,1]].every(([i,j])=>bs.every(b=>clear(x+i*w*0.4,z+j*d*0.4,b)));
  let best=null, bd=Infinity;
  const tryAt=(i,j)=>{
    const x=cx+i*SITE_STEP, z=cz+j*SITE_STEP, r=Math.hypot(i,j)*SITE_STEP;
    if(r<bd&&free(x,z)&&seen(x,z)){ best={x,z}; bd=r; }
  };
  // a ring k steps out is at least k steps away, so the search stops once that passes the best spot;
  // far enough out toward the camera every spot is free and seen, so it always ends
  for(let k=0;k*SITE_STEP<=bd;k++){
    if(!k){ tryAt(0,0); continue; }
    for(let i=-k;i<=k;i++){ tryAt(i,-k); tryAt(i,k); }
    for(let j=-k+1;j<k;j++){ tryAt(-k,j); tryAt(k,j); }
  }
  return best;
}

/* names of the buildings, other than bid, whose footprint a w x d ft footprint centred on building
   bid would overlap */
export function overlapsAt(bid,w,d){
  const c=BUILDINGS.find(b=>b.id===bid);
  return BUILDINGS.filter(b=>b.id!==bid&&Math.abs(c.x-b.x)<(w+b.w)/2&&Math.abs(c.z-b.z)<(d+b.d)/2).map(b=>b.name);
}
