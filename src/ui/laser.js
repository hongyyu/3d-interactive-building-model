import {$} from '../util.js';
import {drag} from '../state.js';

/* Presenter laser. While it is on, a red halo rings the mouse and a short red trail follows it,
   and each click sends out a ripple. Alt-drag draws a red stroke that lingers for a few seconds
   and does not move the model. Everything is drawn on a full-window canvas with
   pointer-events:none, so the app underneath keeps working: orbiting, zooming and dragging a
   department leave a visible trail for the audience. */
const RED='230,32,50';
const TRAIL_MS=500, INK_MS=2600, RIPPLE_MS=600, MAX_TRAIL=120;
const cv=$('#laser'), ctx=cv.getContext('2d');
let on=false, raf=0, dpr=1;
let last=null;      // last pointer position, tracked even while off so the halo appears at once
let at=null;        // halo position; null when the pointer has left the window
let trail=[];       // recent positions {x,y,t}
let strokes=[];     // Alt-drag drawings {pts:[{x,y}], end}; end is 0 while drawing
let ripples=[];     // click ripples {x,y,t}
let ink=null;       // the stroke being drawn
let swallowClick=false;

const rgba=a=>'rgba('+RED+','+Math.max(0,a).toFixed(3)+')';

function size(){
  dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=Math.round(innerWidth*dpr); cv.height=Math.round(innerHeight*dpr);
  kick();
}
function kick(){ if(on&&!raf) raf=requestAnimationFrame(draw); }

function draw(){
  raf=0;
  const now=performance.now();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,innerWidth,innerHeight);
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.shadowColor=rgba(0.55); ctx.shadowBlur=8;
  // trail: tapered segments, newest widest and most opaque
  trail=trail.filter(p=>now-p.t<TRAIL_MS);
  for(let i=1;i<trail.length;i++){
    const a=1-(now-trail[i].t)/TRAIL_MS;
    ctx.strokeStyle=rgba(a*0.85); ctx.lineWidth=1+5*a;
    ctx.beginPath(); ctx.moveTo(trail[i-1].x,trail[i-1].y); ctx.lineTo(trail[i].x,trail[i].y); ctx.stroke();
  }
  // Alt-drag strokes hold for the first part of INK_MS, then fade
  strokes=strokes.filter(s=>!s.end||now-s.end<INK_MS);
  strokes.forEach(s=>{
    ctx.strokeStyle=rgba(s.end?Math.min(1,(1-(now-s.end)/INK_MS)*1.8)*0.9:0.9); ctx.lineWidth=4;
    ctx.beginPath(); s.pts.forEach((p,i)=>{ if(i) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); });
    if(s.pts.length===1) ctx.lineTo(s.pts[0].x+0.1,s.pts[0].y);
    ctx.stroke();
  });
  ctx.shadowBlur=0;
  ripples=ripples.filter(r=>now-r.t<RIPPLE_MS);
  ripples.forEach(r=>{
    const f=(now-r.t)/RIPPLE_MS;
    ctx.strokeStyle=rgba((1-f)*0.8); ctx.lineWidth=2.5*(1-f)+0.5;
    ctx.beginPath(); ctx.arc(r.x,r.y,10+28*f,0,Math.PI*2); ctx.stroke();
  });
  if(at){
    const g=ctx.createRadialGradient(at.x,at.y,0,at.x,at.y,28);
    g.addColorStop(0,rgba(0.42)); g.addColorStop(0.5,rgba(0.16)); g.addColorStop(1,rgba(0));
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(at.x,at.y,28,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=rgba(0.9); ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(at.x,at.y,12,0,Math.PI*2); ctx.stroke();
  }
  if(trail.length||strokes.length||ripples.length) kick();
}

function onMove(e){
  last={x:e.clientX,y:e.clientY};
  if(!on) return;
  const t=performance.now();
  const evs=e.getCoalescedEvents?e.getCoalescedEvents():[];
  (evs.length?evs:[e]).forEach(ev=>{
    trail.push({x:ev.clientX,y:ev.clientY,t:t});
    if(ink) ink.pts.push({x:ev.clientX,y:ev.clientY});
  });
  if(trail.length>MAX_TRAIL) trail.splice(0,trail.length-MAX_TRAIL);
  at=last;
  if(ink) e.stopPropagation();
  kick();
}
function onDown(e){
  last={x:e.clientX,y:e.clientY};
  if(!on) return;
  at=last;
  ripples.push({x:at.x,y:at.y,t:performance.now()});
  if(e.altKey&&e.button===0){
    // keep the model still and avoid selecting text while drawing
    ink={pts:[{x:at.x,y:at.y}],end:0}; strokes.push(ink);
    e.stopPropagation(); e.preventDefault();
  }
  kick();
}
function onUp(e){
  if(!on) return;
  if(ink){
    ink.end=performance.now(); ink=null; e.stopPropagation();
    // a stroke that starts and ends on a button must not press it
    swallowClick=true; setTimeout(()=>{ swallowClick=false; },0);
  }
  if(e.pointerType==='touch') at=null;
  kick();
}

export function setLaser(v){
  on=v; cv.hidden=!v;
  const b=$('#tools [data-act=laser]'); if(b) b.setAttribute('aria-pressed',String(v));
  trail=[]; strokes=[]; ripples=[]; ink=null;
  if(v){ at=last; size(); }
  else { at=null; if(raf){ cancelAnimationFrame(raf); raf=0; } ctx.clearRect(0,0,cv.width,cv.height); }
}
export function toggleLaser(){ setLaser(!on); }

export function bindLaser(){
  window.addEventListener('pointermove',onMove,true);
  window.addEventListener('pointerdown',onDown,true);
  window.addEventListener('pointerup',onUp,true);
  window.addEventListener('pointercancel',onUp,true);
  window.addEventListener('click',e=>{ if(swallowClick){ swallowClick=false; e.stopPropagation(); e.preventDefault(); } },true);
  document.addEventListener('mouseout',e=>{ if(!e.relatedTarget){ at=null; kick(); } });
  window.addEventListener('resize',()=>{ if(on) size(); });
  // capture phase, so Escape during a department drag cancels only the drag (ui/pointer.js)
  window.addEventListener('keydown',e=>{
    const t=e.target;
    if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||document.querySelector('dialog[open]')) return;
    if(t&&(t.isContentEditable||/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))) return;
    if(e.key==='l'||e.key==='L') toggleLaser();
    else if(e.key==='Escape'&&on&&!drag) setLaser(false);
  },true);
}
