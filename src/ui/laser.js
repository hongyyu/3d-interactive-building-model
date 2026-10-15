import {$} from '../util.js';
import {drag} from '../state.js';
import {stage} from '../dom.js';

/* Presenter laser, after Excalidraw's. While it is on, the stage shows a laser-pen cursor, and a
   left drag on the stage draws a solid red line instead of moving the model. The line tapers to a
   point behind the pen and shrinks away within a second, tail first. Right-drag still pans, the
   wheel still zooms, and the panels and toolbar keep working. The line is drawn on a full-window
   canvas with pointer-events:none. */
const RED='rgb(230,32,50)';
const HEAD=2;       // half width of the line at the pen tip, px
const TAIL=360;     // the line tapers to nothing this far behind the tip, px
const FADE=1000;    // each point of the line shrinks away over this many ms
// pen cursor: the red tip at (4,4) is the hotspot, the dark body points away to the lower right
const PEN='<path d="M9.5 9.5 20 20" stroke="#fff" stroke-width="7" stroke-linecap="round"/>'+
  '<path d="M9.5 9.5 20 20" stroke="#141922" stroke-width="4.2" stroke-linecap="round"/>'+
  '<path d="M13 13l1.6 1.6" stroke="#e62032" stroke-width="1.6" stroke-linecap="round"/>'+
  '<circle cx="4" cy="4" r="3.4" fill="#fff"/><circle cx="4" cy="4" r="2.4" fill="#e62032"/>';
const penURL=px=>'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+px+'" height="'+px+'" viewBox="0 0 24 24">'+PEN+'</svg>')+'")';
const cv=$('#laser'), ctx=cv.getContext('2d');
let on=false, raf=0, dpr=1;
let trails=[];      // lines on screen {id, pts:[{x,y,t}]}
let cur=null;       // the line being drawn
let tip=null;       // pointer position while drawing
let swallowClick=false;

const ease=k=>{ k=Math.min(1,Math.max(0,k)); return 1-Math.pow(1-k,4); };
// Chaikin corner cutting, so a fast drag draws a curve rather than a polyline
function smooth(p){
  if(p.length<3) return p;
  const o=[p[0]];
  for(let i=0;i<p.length-1;i++){
    const a=p[i], b=p[i+1];
    o.push({x:a.x*.75+b.x*.25,y:a.y*.75+b.y*.25,t:a.t*.75+b.t*.25},{x:a.x*.25+b.x*.75,y:a.y*.25+b.y*.75,t:a.t*.25+b.t*.75});
  }
  o.push(p[p.length-1]);
  return o;
}

function size(){
  dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=Math.round(innerWidth*dpr); cv.height=Math.round(innerHeight*dpr);
  kick();
}
function kick(){ if(on&&!raf) raf=requestAnimationFrame(draw); }

// one filled outline per line, so it stays solid with no seams where segments meet
function drawTrail(tr,now){
  tr.pts=tr.pts.filter(q=>now-q.t<FADE);
  let p=tr.pts;
  if(tr===cur) p=p.concat({x:tip.x,y:tip.y,t:now});   // the tip keeps its full width while held
  if(!p.length) return false;
  p=smooth(smooth(p));
  const n=p.length, w=new Array(n);
  for(let i=n-1,d=0;i>=0;i--){
    if(i<n-1) d+=Math.hypot(p[i+1].x-p[i].x,p[i+1].y-p[i].y);
    w[i]=HEAD*Math.min(ease(1-(now-p[i].t)/FADE),ease(1-d/TAIL));
  }
  const edge=(i,s)=>{
    const a=p[Math.max(0,i-1)], b=p[Math.min(n-1,i+1)], dx=b.x-a.x, dy=b.y-a.y, l=Math.hypot(dx,dy)||1;
    ctx.lineTo(p[i].x-dy/l*w[i]*s,p[i].y+dx/l*w[i]*s);
  };
  ctx.beginPath();
  for(let i=0;i<n;i++) edge(i,1);
  for(let i=n-1;i>=0;i--) edge(i,-1);
  ctx.fill();
  ctx.beginPath(); ctx.arc(p[n-1].x,p[n-1].y,w[n-1],0,Math.PI*2); ctx.fill();
  return true;
}
function draw(){
  raf=0;
  const now=performance.now();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,innerWidth,innerHeight);
  ctx.fillStyle=RED;
  trails=trails.filter(tr=>drawTrail(tr,now)||tr===cur);
  if(trails.length) kick();
}

function onDown(e){
  if(!on||!stage.contains(e.target)||(e.pointerType==='mouse'&&e.button!==0)) return;
  // the 3D gesture never sees this press, so the model stays still; no text selection either
  e.stopPropagation(); e.preventDefault();
  if(cur) return;
  tip={x:e.clientX,y:e.clientY};
  cur={id:e.pointerId,pts:[{x:tip.x,y:tip.y,t:performance.now()}]};
  trails.push(cur);
  kick();
}
function onMove(e){
  if(!cur||e.pointerId!==cur.id) return;
  const t=performance.now(), evs=e.getCoalescedEvents?e.getCoalescedEvents():[];
  (evs.length?evs:[e]).forEach(ev=>{
    const l=cur.pts[cur.pts.length-1];
    if(!l||Math.hypot(ev.clientX-l.x,ev.clientY-l.y)>1) cur.pts.push({x:ev.clientX,y:ev.clientY,t:t});
  });
  tip={x:e.clientX,y:e.clientY};
  e.stopPropagation();
  kick();
}
function onUp(e){
  if(!cur||e.pointerId!==cur.id) return;
  cur=null; e.stopPropagation();
  // a line that ends on a building tag must not select it
  swallowClick=true; setTimeout(()=>{ swallowClick=false; },0);
  kick();
}

export function setLaser(v){
  on=v; cv.hidden=!v;
  stage.classList.toggle('lasering',v);
  const b=$('#tools [data-act=laser]'); if(b) b.setAttribute('aria-pressed',String(v));
  trails=[]; cur=null;
  if(v) size();
  else { if(raf){ cancelAnimationFrame(raf); raf=0; } ctx.clearRect(0,0,cv.width,cv.height); }
}
export function toggleLaser(){ setLaser(!on); }

export function bindLaser(){
  // a sharper cursor on high-density screens where the browser takes image-set() for cursors
  const one=penURL(24)+' 4 4, crosshair', two='image-set('+penURL(24)+' 1x, '+penURL(48)+' 2x) 4 4, crosshair';
  stage.style.setProperty('--laser-cursor',window.CSS&&CSS.supports('cursor',two)?two:one);
  window.addEventListener('pointerdown',onDown,true);
  window.addEventListener('pointermove',onMove,true);
  window.addEventListener('pointerup',onUp,true);
  window.addEventListener('pointercancel',onUp,true);
  window.addEventListener('click',e=>{ if(swallowClick){ swallowClick=false; e.stopPropagation(); e.preventDefault(); } },true);
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
