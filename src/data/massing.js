/* Reads building masses from a Rhino .3dm file. rhino3dm (McNeel's WebAssembly build of
   openNURBS, about 2.7 MB) is loaded on first use, and the file never leaves the browser.

   Every visible polysurface, extrusion, mesh, closed planar curve and block instance is a part.
   Parts whose footprints overlap make one building, so a building can be a single mass, floors
   modelled as stacked boxes, or a mass with floor plates in it. Each building becomes a
   rectangular floor plate (the bounding rectangle of its footprint) with a level count:
   - User Text on an object or its layer wins: levels (or floors, stories) and floor_to_floor (or fh);
   - otherwise stacked floor boxes or floor plates give one level each;
   - otherwise its height is divided by DEFAULT_FH.
   When the largest building is turned on the site, the whole model is turned so the buildings line
   up with the grid. Rhino's Y axis becomes -z, and lengths are converted to feet. */
import wasmUrl from 'rhino3dm/rhino3dm.wasm?url';
import {PROJECT,CATS,DEPTS} from './project.js';
import {MAX_LEVELS} from '../scene/constants.js';

export const DEFAULT_FH=15;
const FLAT=1, TOL=1.5, MIN_AREA=400, MIN_H=8, FAR=2000, MAX_DEPTH=8;
const FEET={Millimeters:1/304.8,Centimeters:1/30.48,Decimeters:1/3.048,Meters:1/0.3048,Kilometers:1000/0.3048,Inches:1/12,Feet:1,Yards:3,Miles:5280};
const UNIT_NAME={Millimeters:'millimetres',Centimeters:'centimetres',Decimeters:'decimetres',Meters:'metres',Kilometers:'kilometres',Inches:'inches',Feet:'feet',Yards:'yards',Miles:'miles'};
// layers that hold the surroundings rather than the project; their masses start unticked
const CONTEXT=/context|existing|neighbo|surround|site|landscape|topo|terrain|road|street|tree|parking|ground/i;
// layer names that say nothing about the building; masses on them are numbered instead
const GENERIC=/^(default|layer\s*\d*|0|mass(es|ing)?|buildings?|volumes?|blocks?)$/i;
const KEYS={levels:['levels','floors','stories','storeys'],fh:['floor_to_floor','floor-to-floor','floor to floor','floortofloor','fh','f2f']};

let rhinoP=null;
function loadRhino(){
  if(!rhinoP) rhinoP=import('rhino3dm/rhino3dm.module.js').then(m=>m.default({locateFile:()=>wasmUrl})).catch(e=>{ rhinoP=null; throw e; });
  return rhinoP;
}

/* ---------- plan geometry ---------- */
function hull(pts){
  const p=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  if(p.length<3) return p;
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[], hi=[];
  for(const q of p){ while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],q)<=0) lo.pop(); lo.push(q); }
  for(let i=p.length-1;i>=0;i--){ const q=p[i]; while(hi.length>1&&cross(hi[hi.length-2],hi[hi.length-1],q)<=0) hi.pop(); hi.push(q); }
  return lo.slice(0,-1).concat(hi.slice(0,-1));
}
function polyArea(h){
  let a=0;
  for(let i=0;i<h.length;i++){ const p=h[i], q=h[(i+1)%h.length]; a+=p[0]*q[1]-q[0]*p[1]; }
  return Math.abs(a)/2;
}
/* the smallest rectangle around a hull: its area and its angle, turned into (-45°, 45°] */
function minRect(h){
  let best={area:Infinity,angle:0};
  for(let i=0;i<h.length;i++){
    const p=h[i], q=h[(i+1)%h.length], a=Math.atan2(q[1]-p[1],q[0]-p[0]), c=Math.cos(a), s=Math.sin(a);
    let x0=Infinity, x1=-Infinity, y0=Infinity, y1=-Infinity;
    for(const r of h){ const x=r[0]*c+r[1]*s, y=r[1]*c-r[0]*s; x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y); }
    const area=(x1-x0)*(y1-y0);
    if(area<best.area) best={area,angle:a};
  }
  let a=best.angle%(Math.PI/2);
  if(a>Math.PI/4) a-=Math.PI/2; else if(a<=-Math.PI/4) a+=Math.PI/2;
  return {area:best.area,angle:a};
}
const boxArea=b=>Math.max(0,b[2]-b[0])*Math.max(0,b[3]-b[1]);
function overlap(a,b){ return Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1])); }
function median(v){ const s=v.slice().sort((a,b)=>a-b), m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; }
/* sorted values grouped when within tol of the previous one; returns each group's first value */
function cluster(v,tol){
  const s=v.slice().sort((a,b)=>a-b), out=[];
  s.forEach(x=>{ if(!out.length||x-out[out.length-1].last>tol) out.push({first:x,last:x}); else out[out.length-1].last=x; });
  return out.map(c=>c.first);
}
function userText(obj,into){
  if(!obj||!obj.getUserStrings) return;
  for(const [k,v] of obj.getUserStrings()){
    const key=Object.keys(KEYS).find(n=>KEYS[n].includes(String(k).trim().toLowerCase()));
    const x=parseFloat(v);
    if(key&&!(key in into)&&x>0) into[key]=x;
  }
}

/* ---------- reading the file ---------- */
/* returns {masses, units, notes, errors}; masses is null when nothing can be imported. Each mass:
   {name, unnamed, layer, w, d, h, x, z, levels, fh, src, on, notes} in feet. unnamed: the name is
   made up, as the file has none. src: where the level count came from ('text', 'floors', 'plates',
   or 'height' for an estimate at DEFAULT_FH) */
export async function readMassingFile(file){
  const rh=await loadRhino();
  const doc=rh.File3dm.fromByteArray(new Uint8Array(await file.arrayBuffer()));
  const errors=[], notes=[];
  if(!doc){ errors.push('This file could not be read as a Rhino model. Save it from Rhino 5 or later as a .3dm file.'); return {masses:null,errors,notes}; }
  try{ return readDoc(rh,doc,errors,notes); }
  finally{ doc.delete(); }
}

function readDoc(rh,doc,errors,notes){
  const unitKey=Object.keys(FEET).find(k=>rh.UnitSystem[k]===doc.settings().modelUnitSystem);
  const u=unitKey?FEET[unitKey]:1;
  if(!unitKey) notes.push('The model has no standard length unit, so it is read as feet.');
  const objs=doc.objects(), layers=doc.layers(), idefs=doc.instanceDefinitions();
  const isNil=id=>!id||/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(id);
  const visible=L=>{ for(let l=L,i=0;l&&i<50;i++){ if(!l.visible) return false; if(isNil(l.parentLayerId)) return true; l=layers.findId(l.parentLayerId); } return true; };

  const parts=[], skip={hidden:0,other:0,flat:0,small:0};
  const cache=[];
  // adds one geometry as a part, transformed into model space by the block transforms xfs (outermost first)
  function addGeometry(geo,attr,layer,xfs,blockName){
    const T=rh.ObjectType, t=geo.objectType;
    if(t===T.InstanceReference){
      const def=idefs.findId(geo.parentIdefId);
      if(!def||xfs.length>=MAX_DEPTH){ skip.other++; return; }
      for(const id of def.getObjectIds()){
        const o=objs.findId(id); if(!o) continue;
        addGeometry(o.geometry(),attr,layer,xfs.concat([geo.xform]),blockName||def.name);
      }
      return;
    }
    if(t!==T.Brep&&t!==T.Extrusion&&t!==T.Mesh&&t!==T.Curve){ skip.other++; return; }
    if(t===T.Curve&&!(geo.isClosed&&geo.isPlanar())){ skip.other++; return; }
    let g=geo;
    if(xfs.length){ g=geo.duplicate(); cache.push(g); for(let i=xfs.length-1;i>=0;i--) g.transform(xfs[i]); }
    // plan points: corners for polysurfaces and meshes, samples along a curve
    const pts=[];
    if(t===T.Curve){ const [a,b]=g.domain; for(let i=0;i<64;i++){ const p=g.pointAt(a+(b-a)*i/64); pts.push([p[0],p[1]]); } }
    else if(t===T.Mesh){ const v=g.vertices(), n=v.count, step=Math.max(1,Math.floor(n/4000)); for(let i=0;i<n;i+=step){ const p=v.get(i); pts.push([p[0],p[1]]); } }
    else {
      const br=t===T.Extrusion?g.toBrep(true):g, v=br.vertices();
      for(let i=0;i<v.count;i++){ const p=v.get(i).location; pts.push([p[0],p[1]]); }
      if(br!==g) cache.push(br);
    }
    const bb=g.getBoundingBox(true);
    if(!bb.isValid){ skip.other++; return; }
    const user={}; userText(attr,user); userText(layer,user);
    parts.push({g,pts,z0:bb.min[2],z1:bb.max[2],flat:(bb.max[2]-bb.min[2])*u<FLAT,name:(attr.name||'').trim(),block:blockName||'',layer,user});
  }
  for(let i=0;i<objs.count;i++){
    const o=objs.get(i), attr=o.attributes();
    if(attr.isInstanceDefinitionObject) continue;
    const layer=layers.findIndex(attr.layerIndex);
    if(!attr.visible||!visible(layer)){ skip.hidden++; continue; }
    addGeometry(o.geometry(),attr,layer,[],'');
  }

  // turn the model so the largest rectangular part lines up with the grid
  let angle=0;
  const ranked=parts.filter(p=>p.pts.length>2).map(p=>{ const h=hull(p.pts); return {p,h,area:polyArea(h)}; })
    .sort((a,b)=>(a.p.flat-b.p.flat)||(b.area-a.area));
  for(const r of ranked){
    const m=minRect(r.h);
    if(r.area>0&&r.area>=0.97*m.area){ angle=Math.abs(m.angle)<0.002?0:m.angle; break; }
  }
  const c=Math.cos(-angle), s=Math.sin(-angle);
  parts.forEach(p=>{
    let bb;
    if(angle){ const g=p.g.duplicate(); g.rotate(-angle,[0,0,1],[0,0,0]); bb=g.getBoundingBox(true); g.delete(); }
    else bb=p.g.getBoundingBox(true);
    p.box=[bb.min[0]*u,bb.min[1]*u,bb.max[0]*u,bb.max[1]*u];
    p.z0*=u; p.z1*=u;
    p.pts=p.pts.map(q=>[(q[0]*c-q[1]*s)*u,(q[0]*s+q[1]*c)*u]);
  });
  cache.forEach(g=>g.delete());

  // parts whose footprints overlap belong to one building
  const up=parts.map((p,i)=>i), root=i=>{ while(up[i]!==i) i=up[i]=up[up[i]]; return i; };
  for(let i=0;i<parts.length;i++) for(let j=i+1;j<parts.length;j++){
    const a=parts[i].box, b=parts[j].box, A=boxArea(a), B=boxArea(b), small=Math.min(A,B);
    if(small>0&&small>=0.2*Math.max(A,B)&&overlap(a,b)>=0.5*small) up[root(i)]=root(j);
  }
  const groups={};
  parts.forEach((p,i)=>{ (groups[root(i)]||(groups[root(i)]=[])).push(p); });

  let masses=[];
  for(const k in groups){
    const m=massOf(groups[k],u);
    if(m==='flat') skip.flat++; else if(m==='small') skip.small++; else masses.push(m);
  }
  if(!masses.length){
    errors.push('No building masses found. The model needs closed polysurfaces, extrusions or meshes, or a closed floor outline per level, on visible layers.');
    return {masses:null,errors,notes};
  }

  // a model far from the origin (site coordinates) is moved to it
  let x0=Infinity, x1=-Infinity, y0=Infinity, y1=-Infinity;
  masses.forEach(m=>{ x0=Math.min(x0,m.cx-m.w/2); x1=Math.max(x1,m.cx+m.w/2); y0=Math.min(y0,m.cy-m.d/2); y1=Math.max(y1,m.cy+m.d/2); });
  let ox=0, oy=0;
  if(Math.hypot((x0+x1)/2,(y0+y1)/2)>FAR){ ox=Math.round((x0+x1)/20)*10; oy=Math.round((y0+y1)/20)*10; notes.push('The model is far from the origin, so it is moved there.'); }
  const r1=v=>Math.round(v*10)/10;
  masses.forEach(m=>{ m.x=r1(m.cx-ox); m.z=r1(-(m.cy-oy)); delete m.cx; delete m.cy; });

  // names: an object or block name, else a telling layer name, else Building 1, 2…; duplicates numbered
  masses.sort((a,b)=>a.x-b.x||a.z-b.z);
  let n=0; const used={};
  masses.forEach(m=>{
    if(!m.name){ m.name='Building '+(++n); m.unnamed=true; }
    let name=m.name, i=1;
    while(used[name.toLowerCase()]) name=m.name+' '+(++i);
    used[name.toLowerCase()]=true; m.name=name;
  });

  if(unitKey&&unitKey!=='Feet') notes.unshift('Lengths are in '+UNIT_NAME[unitKey]+' and are converted to feet.');
  if(angle) notes.push('The model is turned '+Math.abs(angle*180/Math.PI).toFixed(1)+'° so its buildings line up with the grid.');
  if(skip.hidden) notes.push(skip.hidden+' hidden object'+(skip.hidden>1?'s are':' is')+' left out.');
  if(skip.flat) notes.push(skip.flat+(skip.flat>1?' flat objects that aren’t floor plates (site surfaces, outlines) are':' flat object that isn’t a floor plate (a site surface or outline) is')+' left out.');
  if(skip.small) notes.push(skip.small+' small object'+(skip.small>1?'s':'')+' (under '+MIN_AREA+' SF or '+MIN_H+' ft tall) '+(skip.small>1?'are':'is')+' left out.');
  if(skip.other) notes.push(skip.other+' other object'+(skip.other>1?'s':'')+' (open curves, points, text, SubDs…) '+(skip.other>1?'are':'is')+' left out.');
  return {masses,units:unitKey?UNIT_NAME[unitKey]:'feet (assumed)',notes,errors};
}

/* one building from its parts, or 'flat' / 'small' when it is not one */
function massOf(parts,u){
  const vol=parts.filter(p=>!p.flat), flat=parts.filter(p=>p.flat);
  const box=parts.reduce((b,p)=>[Math.min(b[0],p.box[0]),Math.min(b[1],p.box[1]),Math.max(b[2],p.box[2]),Math.max(b[3],p.box[3])],[Infinity,Infinity,-Infinity,-Infinity]);
  const w=box[2]-box[0], d=box[3]-box[1], m={notes:[]};
  let z0, h, levels, fh, src;
  if(!vol.length){
    // floor plates or outlines only: one level per elevation
    const el=cluster(flat.map(p=>(p.z0+p.z1)/2),FLAT);
    if(el.length<2) return 'flat';
    const gaps=el.slice(1).map((e,i)=>e-el[i]);
    fh=median(gaps); levels=el.length; z0=el[0]; h=levels*fh; src='plates';
  } else {
    z0=Math.min(...vol.map(p=>p.z0)); h=Math.max(...vol.map(p=>p.z1))-z0;
    const plates=cluster(flat.map(p=>(p.z0+p.z1)/2).filter(e=>e>=z0-TOL&&e<z0+h-TOL),FLAT);
    const bases=cluster(vol.map(p=>p.z0),FLAT);
    const tops=bases.map((b,i)=>Math.max(...vol.filter(p=>p.z0>=b-FLAT&&(i+1>=bases.length||p.z0<bases[i+1]-FLAT)).map(p=>p.z1)));
    const floors=bases.length>1&&bases.every((b,i)=>tops[i]-b<=30&&(i===0||Math.abs(b-tops[i-1])<=TOL));
    if(plates.length>=2){ levels=plates.length+(plates[0]>z0+TOL?1:0); fh=h/levels; src='plates'; }
    else if(floors){ levels=bases.length; fh=median(tops.map((t,i)=>t-bases[i])); src='floors'; }
    else { levels=Math.max(1,Math.round(h/DEFAULT_FH)); fh=h/levels; src='height'; }
  }
  if(w*d<MIN_AREA||h<MIN_H) return 'small';
  // User Text on any part or its layer (lengths in model units)
  const user={}; parts.forEach(p=>{ for(const k in p.user) if(!(k in user)) user[k]=p.user[k]; });
  if(user.levels){ levels=Math.round(user.levels); fh=h/levels; src='text'; }
  else if(user.fh){ fh=user.fh*u; levels=Math.max(1,Math.round(h/fh)); src='text'; }
  if(levels>MAX_LEVELS){ levels=MAX_LEVELS; fh=h/levels; m.notes.push('more than '+MAX_LEVELS+' levels, so it gets '+MAX_LEVELS); }
  // a plate that is much bigger than the footprint or the top floor gets a note
  const top=vol.length?vol.reduce((a,p)=>p.z1>a.z1?p:a):null;
  const hl=hull(parts.flatMap(p=>p.pts)), ha=polyArea(hl);
  if(ha>0&&ha<0.9*w*d) m.notes.push('not a rectangle in plan, so its plate is the bounding rectangle, '+Math.round((w*d/ha-1)*100)+'% larger than the footprint');
  else if(top&&vol.length>1&&boxArea(top.box)<0.7*w*d) m.notes.push('its upper floors are smaller than its footprint; every level uses the whole footprint');
  // name and layer from the largest part
  const main=(vol.length?vol:flat).slice().sort((a,b)=>boxArea(b.box)*(b.z1-b.z0)-boxArea(a.box)*(a.z1-a.z0))[0];
  const named=parts.find(p=>p.name), leaf=main.layer?main.layer.name:'';
  m.name=named?named.name:main.block||(leaf&&!GENERIC.test(leaf.trim())?leaf.trim():'');
  m.layer=main.layer?main.layer.fullPath:'';
  m.on=!parts.some(p=>p.layer&&CONTEXT.test(p.layer.fullPath));
  const r1=v=>Math.round(v*10)/10;
  Object.assign(m,{w:r1(w),d:r1(d),h:r1(h),cx:(box[0]+box[2])/2,cy:(box[1]+box[3])/2,levels,fh:Math.round(fh*100)/100,src});
  return m;
}

/* ---------- the new project ---------- */
/* The current program on the chosen masses ({name, w, d, x, z, levels, fh, from}): a mass that takes
   its departments from a current building (from = its id) gets them level by level, and the rest,
   with every department of the buildings no mass takes from, wait in the Unassigned tray. levels and
   unassigned are the live stacking (state.levels, state.unassigned).
   Without a program of the user's (PROJECT.program is empty: the demo's is loaded) the buildings
   come in empty, with no departments or categories, until a program is imported. */
export function massingProject(masses,levels,unassigned,fileName){
  const keep=!!PROJECT.program, tray=keep?unassigned.slice():[], used={};
  let over=0;
  const buildings=masses.map((m,i)=>{
    const lv=Array.from({length:m.levels},()=>[]);
    const src=keep&&m.from&&!used[m.from]&&levels[m.from];
    if(src){
      used[m.from]=true;
      src.forEach((ids,f)=>{ if(f<m.levels) lv[f].push(...ids); else { tray.push(...ids); over+=ids.length; } });
    }
    return {id:'b'+(i+1),name:m.name,w:m.w,d:m.d,fh:m.fh,x:m.x,z:m.z,levels:lv};
  });
  const cats={}, depts={};
  if(keep){
    for(const bid in levels) if(!used[bid]) levels[bid].forEach(ids=>tray.push(...ids));
    for(const k in CATS) cats[k]={...CATS[k]};
    for(const k in DEPTS) depts[k]={...DEPTS[k]};
  }
  const base=keep?String(PROJECT.sub||'').replace(/ · [^·]*\.3dm$/i,''):'';
  const project={title:PROJECT.title,sub:(base?base+' · ':'')+fileName,program:PROJECT.program,massing:fileName,cats,depts,buildings,unassigned:tray};
  return {project,placed:Object.keys(depts).length-tray.length,unassigned:tray.length,over};
}
