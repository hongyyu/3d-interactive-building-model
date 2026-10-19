import * as THREE from 'three';
import {DEPTS} from '../data/project.js';
import {state,BDEF,drag,hoverId,isOverview} from '../state.js';
import {overlay} from '../dom.js';
import {fk} from '../util.js';
import {S,BASE,SLAB,CLEAR} from './constants.js';
import {B,D,scene,camera} from './scene.js';
import {explode,SW,SH,panelRects,insetL,insetR,textScale,reframes} from './view.js';
import {floorStat} from '../layout/plan.js';

const tmpV=new THREE.Vector3();
function toScreen(x,y,z){
  tmpV.set(x,y,z).project(camera);
  return {x:(tmpV.x*0.5+0.5)*SW,y:(-tmpV.y*0.5+0.5)*SH,ok:tmpV.z<1};
}
function project(x,y,z,o){
  tmpV.set(x,y,z).project(camera);
  o.x=(tmpV.x*0.5+0.5)*SW; o.y=(-tmpV.y*0.5+0.5)*SH;
  return tmpV.z<1;
}
let floorTags=[], ftSize=[];
export function rebuildFloorTags(){
  floorTags.forEach(t=>t.remove()); floorTags=[]; ftSize=[];
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
/* ---------- department labels ----------
   In 3D Massing and Stacking a label sits on the part of its department the camera can see: the face
   toward the camera plus the strip of top face that the level above leaves uncovered. The top level
   counts the same strip, as if a level sat above it, so every label sits on its own floor's facade
   band and they line up; only a top-level department with no facade in view (seen end-on) is
   labelled on its roof. Axon pulls the levels apart, so there a label is centred on one face instead
   of straddling the edge between two: the side face, on every level alike (the uncovered top is
   partly in the shadow of the level above), then the top, the end face, and only then the band
   across side and top. A label is
   sheared to run along the floor edges, like lettering on the facade, so it fits the slanted band
   of its own floor. Labels are placed in priority order (dragged, selected, hovered, then larger SF
   first) and never cover each other, a building tag or a floor tag. Where SF is on (state.sf, for
   every view mode) a label has the name and the SF on two lines; on a face too thin for them its text
   shrinks to fit, down to MIN_FIT. One that still does not fit, or would collide, drops the SF line.
   Then it hides. The selected and hovered departments always show theirs, as an upright chip when it
   does not fit; the dragged one always shows as a chip, since it is
   lifted off its floor. In the campus overview only the hovered or selected department is labelled. */
const LBL_MAX=170, LBL_MIN=56, MAX_SLOPE=0.6, EDGE=8, LBL_GAP=3, CHIP_MAX=220, CHIP_PAD=16, MIN_FIT=0.75;
const ctx2d=document.createElement('canvas').getContext('2d');
let lineH=null;
if(document.fonts) document.fonts.addEventListener('loadingdone',()=>{ for(const id in D) D[id].nw=-1; });
/* natural widths of the name and SF lines at text scale 1 (the overlay's --tz) and the label's own
   scale 1 (its --ls, d.ls), measured once per text change */
let tz=1;
function measureLabel(d){
  const b=getComputedStyle(d.lbl.firstChild), a=getComputedStyle(d.lbl.lastChild), k=tz*(d.ls||1);
  if(!lineH) lineH=[(parseFloat(b.lineHeight)||13*k)/k,(parseFloat(a.lineHeight)||12*k)/k];
  ctx2d.font=b.fontWeight+' '+parseFloat(b.fontSize)/k+'px '+b.fontFamily;
  d.nw=Math.ceil(ctx2d.measureText(d.lbl.firstChild.textContent).width)+1;
  ctx2d.font=a.fontWeight+' '+parseFloat(a.fontSize)/k+'px '+a.fontFamily;
  d.aw=Math.ceil(ctx2d.measureText(d.lbl.lastChild.textContent).width)+1;
}
/* Screen region of the visible part of a department, as a band whose long edges run along the floor:
   centre, vertical thickness t, slope m of the long edges (screen dy/dx), horizontal span, and the
   3D centre c. The band is the side face toward the camera plus the strip of top face it can see
   past the level above; `ceil` is the underside of that level (or where it would be), or Infinity for
   the whole top face. `part` limits it to the side face (1) or the top strip (2).
   alongX: the side face is the long one (normal along z), otherwise the end one (normal along x).
   An end face is only visible on the first or last department of a level, `inset` from the plate
   edge (a void box may sit between); `inset` is Infinity for the others. */
function labelRegion(d,ceil,alongX,inset,o,part){
  const p=d.mesh.position, s=d.mesh.scale, cam=camera.position;
  const pa=alongX?p.x:p.z, sa=alongX?s.x:s.z, pb=alongX?p.z:p.x, sb=alongX?s.z:s.x, cb=alongX?cam.z:cam.x;
  const a0=pa-sa/2, a1=pa+sa/2, yb=p.y-s.y/2, yt=p.y+s.y/2;
  const sg=cb<pb?-1:1, fb=pb+sg*sb/2, ahead=(cb-fb)*sg, front=part!==2&&ahead>0&&inset<Infinity;
  let vis=0;
  if(part!==1&&cam.y>yt) vis=ceil===Infinity?sb:Math.min(sb,(ceil-yt)*Math.max(0,ahead)/(cam.y-yt)-inset);
  if(!front&&!(vis>0)) return null;
  const y0=front?yb:yt, bv=fb-sg*Math.max(0,vis);
  const pt=(a,y,b,q)=>alongX?project(a,y,b,q):project(b,y,a,q);
  if(!pt(a0,y0,fb,pA)||!pt(a1,y0,fb,pB)||!pt(a0,yt,bv,pC)||!pt(a1,yt,bv,pE)) return null;
  const dx=(pB.x-pA.x+pE.x-pC.x)/2, dy=(pB.y-pA.y+pE.y-pC.y)/2;
  if(Math.abs(dx)<1) return null;
  const m=dy/dx, x1m=(pA.x+pB.x)/2, y1m=(pA.y+pB.y)/2, x2m=(pC.x+pE.x)/2, y2m=(pC.y+pE.y)/2;
  o.x=(x1m+x2m)/2; o.y=(y1m+y2m)/2;
  o.t=(y1m-y2m)-m*(x1m-x2m); o.m=m; o.span=Math.abs(dx);
  if(o.t<=0||Math.abs(m)>MAX_SLOPE) return null;
  const cy=(y0+yt)/2, cbv=(fb+bv)/2;
  if(alongX) o.c.set(pa,cy,cbv); else o.c.set(cbv,cy,pa);
  return o;
}
const reg=()=>({x:0,y:0,t:0,m:0,span:0,c:new THREE.Vector3()});
const regZ=reg(), regX=reg(), regTop=reg(), regSide=reg();
const pA={x:0,y:0}, pB={x:0,y:0}, pC={x:0,y:0}, pE={x:0,y:0};
/* x extent of each level's departments in each building, for finding the ones whose end face shows */
const lvLo={}, lvHi={};
function levelExtents(skip){
  for(const bid in B){
    const n=state.levels[bid].length, lo=lvLo[bid]||(lvLo[bid]=[]), hi=lvHi[bid]||(lvHi[bid]=[]);
    lo.length=hi.length=n; lo.fill(Infinity); hi.fill(-Infinity);
  }
  for(const id in D){
    const d=D[id];
    if(d.b==null||id===skip) continue;
    const p=d.mesh.position, s=d.mesh.scale;
    if(p.x-s.x/2<lvLo[d.b][d.f]) lvLo[d.b][d.f]=p.x-s.x/2;
    if(p.x+s.x/2>lvHi[d.b][d.f]) lvHi[d.b][d.f]=p.x+s.x/2;
  }
}
/* the department's bands in order of preference (null where not visible). 3D Massing and Stacking:
   the long face first, so labels on a building read the same way, then the end face; a top-level
   department with neither in view (seen end-on, only its roof shows) falls back to its roof. Axon:
   one face, centred (see above). */
const cands=[null,null,null,null];
function labelRegions(d,ceil,def,top){
  const p=d.mesh.position, s=d.mesh.scale, W=def.w*S, cx=def.x*S;
  let inset=Infinity;
  if(camera.position.x<p.x){ if(p.x-s.x/2<=lvLo[d.b][d.f]+1e-3) inset=p.x-s.x/2-(cx-W/2); }
  else if(p.x+s.x/2>=lvHi[d.b][d.f]-1e-3) inset=cx+W/2-(p.x+s.x/2);
  if(state.mode==='axon'){
    cands[0]=labelRegion(d,ceil,true,0,regSide,1); cands[1]=labelRegion(d,top?Infinity:ceil,true,0,regTop,2);
    cands[2]=labelRegion(d,ceil,false,inset,regX,1); cands[3]=labelRegion(d,ceil,true,0,regZ);
    return cands;
  }
  cands[2]=cands[3]=null;
  cands[0]=labelRegion(d,ceil,true,0,regZ); cands[1]=labelRegion(d,ceil,false,inset,regX);
  if(top&&!cands[0]&&!cands[1]){ cands[0]=labelRegion(d,Infinity,false,Infinity,regX); cands[1]=labelRegion(d,Infinity,true,Infinity,regZ); }
  return cands;
}
/* Placed labels and tags, as screen quads of 8 numbers (4 corners in order). A label is a
   w x h box centred on x,y and sheared so its top and bottom run at slope m. */
const placed=[], quad=new Array(8);
function setQuad(x,y,w,h,m,pad){
  const hw=w/2+pad, hh=h/2+pad;
  quad[0]=x-hw; quad[1]=y-hh-m*hw; quad[2]=x+hw; quad[3]=y-hh+m*hw;
  quad[4]=x+hw; quad[5]=y+hh+m*hw; quad[6]=x-hw; quad[7]=y+hh-m*hw;
}
/* separating-axis test between quad and the placed quad at offset o */
function separated(P,po,Q,qo){
  for(let i=0;i<4;i++){
    const j=(i+1)%4, ax=P[po+j*2+1]-P[po+i*2+1], ay=P[po+i*2]-P[po+j*2];
    let a0=Infinity, a1=-Infinity, b0=Infinity, b1=-Infinity;
    for(let k=0;k<4;k++){
      const u=P[po+k*2]*ax+P[po+k*2+1]*ay, v=Q[qo+k*2]*ax+Q[qo+k*2+1]*ay;
      if(u<a0)a0=u; if(u>a1)a1=u; if(v<b0)b0=v; if(v>b1)b1=v;
    }
    if(a1<=b0||b1<=a0) return true;
  }
  return false;
}
function collides(){
  for(let o=0;o<placed.length;o+=8) if(!separated(quad,0,placed,o)&&!separated(placed,o,quad,0)) return true;
  return false;
}
/* true when something in `list` other than building `own`'s shells stands between the camera and c */
const ray=new THREE.Raycaster(), rayDir=new THREE.Vector3(), blockers=[], hits=[];
function hidden(c,list,own){
  if(!list.length) return false;
  rayDir.subVectors(c,camera.position);
  const dist=rayDir.length();
  ray.set(camera.position,rayDir.divideScalar(dist)); ray.far=dist;
  hits.length=0;
  ray.intersectObjects(list,false,hits);
  for(const h of hits) if(h.object.userData.b!==own) return true;
  return false;
}
function rank(id){ return drag&&drag.id===id?0:id===state.selDept?1:id===hoverId?2:3; }
function byPriority(a,b){ return rank(a)-rank(b)||DEPTS[b].a-DEPTS[a].a||(a<b?-1:1); }
function hideLabel(d){ d.lbl.style.display='none'; d.on=0; }
/* kind: 1 name only, 2 name and SF, 3 chip with SF, 4 chip with the name only; a band label on a
   dark department (d.dark) is white. ls: the label's own text scale (--ls), below 1 when shrunk to fit */
function showLabel(d,kind,x,y,w,m,ls){
  const lbl=d.lbl;
  if(d.lm!==kind){ d.lm=kind; lbl.className=kind>=3?'lbl chip':d.dark?'lbl inv':'lbl'; lbl.lastChild.style.display=kind===1||kind===4?'none':''; }
  if(d.ls!==ls){ d.ls=ls; lbl.style.setProperty('--ls',ls); }
  lbl.style.display='block';
  lbl.style.width=w.toFixed(0)+'px';
  lbl.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) skewY('+Math.atan(m).toFixed(4)+'rad) translate(-50%,-50%)';
  d.on=kind;
}
/* Tries a w x h label on band r: slid along the band to stay on screen, then checked against the
   placed labels unless forced. Sets lx/ly and returns true when it fits. */
let lx=0, ly=0;
function tryBand(r,w,h,tol,pad,forced){
  if(w>r.span-8+tol||h>r.t-2+tol) return false;
  const lim=Math.max(0,(r.span-8-w)/2);
  lx=r.x;
  if(lx-w/2<EDGE) lx=Math.min(EDGE+w/2,r.x+lim);
  if(lx+w/2>SW-EDGE) lx=Math.max(SW-EDGE-w/2,r.x-lim);
  ly=r.y+r.m*(lx-r.x);
  const dy=h/2+Math.abs(r.m)*w/2;
  if(lx-w/2<0||lx+w/2>SW||ly-dy<0||ly+dy>SH) return false;
  setQuad(lx,ly,w,h,r.m,pad);
  return forced||!collides();
}
/* A shown label keeps its kind and spot within a few pixels of tolerance (d.on), so it doesn't flicker
   while the camera moves. A reframe drops that, so the labels after it don't depend on the frames
   before it (the panels resize after a mode change, which reframes a moment later). */
let seenReframes=-1;
function placeLabels(){
  const ids=[], ov=isOverview();
  if(reframes!==seenReframes){ seenReframes=reframes; for(const id in D) D[id].on=0; }
  for(const id in D){
    const d=D[id];
    // the overview shows every building, so only the hovered or selected department is labelled
    if(d.b==null||!(ov||d.b===state.sel)||!state.labels||d.dim<0.5||(ov&&rank(id)===3)) hideLabel(d);
    else ids.push(id);
  }
  ids.sort(byPriority);
  blockers.length=0;
  if(state.mode==='mass') for(const bid in B){ if((ov||bid!==state.sel)&&B[bid].fade>0.5) blockers.push(...B[bid].shells); }
  levelExtents(drag&&drag.id);
  const sf=state.sf;
  for(const id of ids){
    const d=D[id], forced=rank(id)<3, lifted=rank(id)===0;
    const def=BDEF[d.b], n=state.levels[d.b].length, pitch=def.fh*S*(1+explode);
    if(d.nw<0) measureLabel(d);
    // sizes at the current text scale
    const nw=Math.ceil(d.nw*tz), aw=Math.ceil(d.aw*tz), l0=lineH[0]*tz, l1=lineH[1]*tz;
    let kind=0, w=0, h=0, m=0, r=null, ls=1;
    if(!lifted) for(const c of labelRegions(d,BASE+(d.f+1)*pitch,def,d.f===n-1)){
      if(!c||hidden(c.c,blockers,d.b)) continue;
      if(!r) r=c;
      const pad=d.on?LBL_GAP:LBL_GAP+3, room=c.span-8;
      const full=Math.min(LBL_MAX*tz,Math.max(nw,aw),room), name=Math.min(LBL_MAX*tz,nw,room), min=Math.min(nw,LBL_MIN*tz);
      m=c.m;
      // the tolerance keeps a full-size label from flickering; a shrunk one follows the face's height
      if(sf&&full>=aw&&full>=min&&tryBand(c,full,l0+l1,d.on===2&&(d.ls||1)===1?4:0,pad,forced)){ kind=2; w=full; h=l0+l1; }
      else if(sf){
        // both lines, shrunk to the face's height in 5% steps
        const f=Math.floor((c.t-2)/(l0+l1)*20)/20;
        if(f>=MIN_FIT&&f<1){
          const nf=Math.ceil(d.nw*tz*f), af=Math.ceil(d.aw*tz*f), wf=Math.min(LBL_MAX*tz*f,Math.max(nf,af),room);
          if(wf>=af&&wf>=Math.min(nf,LBL_MIN*tz*f)&&tryBand(c,wf,(l0+l1)*f,0,pad,forced)){ kind=2; w=wf; h=(l0+l1)*f; ls=f; }
        }
      }
      if(!kind&&name>=min&&tryBand(c,name,l0,d.on===1?4:0,pad,forced)){ kind=1; w=name; h=l0; }
      if(kind) break;
    }
    if(!kind&&forced){
      const c=r||toScreen(d.mesh.position.x,d.mesh.position.y,d.mesh.position.z);
      if(r||c.ok){ kind=sf?3:4; lx=c.x; ly=c.y; m=0; w=Math.min(CHIP_MAX*tz,sf?Math.max(nw,aw):nw)+CHIP_PAD; h=l0+(sf?l1:0)+CHIP_PAD/2; }
    }
    if(!kind||lx+w/2<0||lx-w/2>SW||ly+h/2<0||ly-h/2>SH){ hideLabel(d); continue; }
    setQuad(lx,ly,w,h,m,0);
    placed.push(...quad);
    showLabel(d,kind,lx,ly,w,m,ls);
  }
}

/* ---------- building tags ----------
   Outside the campus overview the selected building's tag always shows and is placed before the
   department labels. The other tags (all of them in the overview) come after the labels, nearest
   building first. Each one hides when the point above its roof
   is behind another building; otherwise it tries centred over that point, then shifted left or right,
   and hides if it would still cover a tag or label already placed. A hidden tag keeps its layout
   (visibility, not display) so its size can still be measured. */
const tagV=new THREE.Vector3(), others=[], tagBlockers=[];
const TAG_SHIFT=[0,-0.4,0.4], TAG_LIFT=8, tq={x:0,y:0};
function placeTag(R,forced){
  let ok=forced, dx=0;
  // the selected building's tag stays in the free area, pinned to its top edge when the building's
  // top is out of view
  if(forced&&R.tw){
    R.ax=Math.min(Math.max(R.ax,insetL+EDGE+R.tw/2),SW-insetR-EDGE-R.tw/2);
    R.ay=Math.max(R.ay,EDGE+R.th);
  }
  if(!forced&&R.tw){
    tagV.set(R.def.x*S,R.ay3,R.def.z*S);
    if(!hidden(tagV,tagBlockers,R.def.id)) for(const k of TAG_SHIFT){
      dx=k*R.tw;
      setQuad(R.ax+dx,R.ay-R.th/2,R.tw,R.th,0,R.shown&&k===R.sk?LBL_GAP:LBL_GAP+3);
      if(!collides()){ ok=true; R.sk=k; break; }
    }
  }
  if(!ok) dx=0;
  R.tag.style.transform='translate('+(R.ax+dx).toFixed(1)+'px,'+R.ay.toFixed(1)+'px) translate(-50%,-100%)';
  if(ok&&R.tw){ setQuad(R.ax+dx,R.ay-R.th/2,R.tw,R.th,0,0); placed.push(...quad); }
  if(R.shown!==ok){ R.shown=ok; R.tag.classList.toggle('off',!ok); }
}

export function updateOverlay(){
  scene.updateMatrixWorld(true);
  const mode=state.mode;
  // text scale in steps of 2%, so the overlay's text is laid out again only when it changes
  const z=Math.round(textScale()*50)/50;
  if(z!==tz){ tz=z; overlay.style.setProperty('--tz',z); }
  // tag sizes from the last frame's layout, read before this frame writes any styles
  for(const bid in B){ const t=B[bid].tag; if(t.style.display==='block'){ B[bid].tw=t.offsetWidth; B[bid].th=t.offsetHeight; } }
  floorTags.forEach((el,f)=>{ if(el.style.display==='block'){ ftSize[f*2]=el.offsetWidth; ftSize[f*2+1]=el.offsetHeight; } });
  placed.length=0; others.length=0;
  // the floating side panels are obstacles for labels and tags
  for(const r of panelRects){ setQuad((r.x0+r.x1)/2,(r.y0+r.y1)/2,r.x1-r.x0,r.y1-r.y0,0,0); placed.push(...quad); }
  const ov=isOverview();
  for(const bid in B){
    const R=B[bid], def=R.def, tag=R.tag;
    if(mode!=='mass'||R.fade<0.5){ tag.style.display='none'; continue; }
    const n=state.levels[bid].length, fhU=def.fh*S, pitch=fhU*(1+explode);
    const top=BASE+(n-1)*pitch+fhU, cx=def.x*S, cz=def.z*S, hw=def.w*S/2, hd=def.d*S/2;
    // the tag sits just above the building's outline on screen (its highest roof corner), centred
    // over the roof, so it never covers the building itself
    const p=toScreen(cx,top,cz);
    let ok=p.ok, y=p.y;
    for(let i=0;i<4;i++){ ok=project(cx+(i&1?hw:-hw),top,cz+(i&2?hd:-hd),tq)&&ok; if(tq.y<y) y=tq.y; }
    if(!ok){ tag.style.display='none'; continue; }
    tag.style.display='block';
    R.ax=p.x; R.ay=y-TAG_LIFT; R.ay3=top+0.9;
    if(bid===state.sel&&!ov) placeTag(R,true);
    else { R.dist=tagV.set(def.x*S,R.ay3,def.z*S).distanceToSquared(camera.position); others.push(R); }
  }
  const def=BDEF[state.sel], fhU=def.fh*S, pitch=fhU*(1+explode), W=def.w*S, Dp=def.d*S;
  // A floor tag sits beside its floor, centred on its height, left of the plate corner furthest left
  // on screen: the back-left one in Axon, so the tags stay clear of the building, and the front-left
  // one in Stacking. The corner is picked once for the whole column, at its middle.
  const ty=SLAB+(fhU-SLAB-CLEAR)/2;
  let ftx=def.x*S-W/2, ftz=def.z*S+Dp/2;
  if(mode!=='mass'&&floorTags.length){
    const ym=BASE+(floorTags.length-1)/2*pitch+ty;
    let best=Infinity;
    for(let i=0;i<4;i++){
      const x=def.x*S+(i&1?W/2:-W/2), z=def.z*S+(i&2?-Dp/2:Dp/2);
      if(project(x,ym,z,tq)&&tq.x<best-0.5){ best=tq.x; ftx=x; ftz=z; }
    }
  }
  // zoomed in, a tag that would slide under the left panel pins to the free area's left edge, on a
  // white chip (class pin) since it then sits over the model
  floorTags.forEach((el,f)=>{
    const p=mode==='mass'?null:toScreen(ftx,BASE+f*pitch+ty,ftz);
    if(!p||!p.ok){ el.style.display='none'; el.classList.remove('pin'); return; }
    el.style.display='block';
    const w=ftSize[f*2], pin=!!w&&p.x-10-w<insetL+EDGE, x=pin?insetL+EDGE+w:p.x-10;
    if(el.classList.contains('pin')!==pin) el.classList.toggle('pin',pin);
    el.style.transform='translate('+x.toFixed(1)+'px,'+p.y.toFixed(1)+'px) translate(-100%,-50%)';
    if(w){ setQuad(x-w/2,p.y,w,ftSize[f*2+1],0,0); placed.push(...quad); }
  });
  placeLabels();
  if(!others.length) return;
  tagBlockers.length=0; tagBlockers.push(...blockers);
  if(!ov){
    tagBlockers.push(...B[state.sel].slabs);
    for(const id in D){ const d=D[id]; if(d.b===state.sel&&d.dim>0.5) tagBlockers.push(d.mesh); }
  }
  others.sort((a,b)=>a.dist-b.dist);
  others.forEach(R=>placeTag(R,false));
}
