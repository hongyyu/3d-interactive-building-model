import {CATS,DEPTS,deptColor} from '../data/project.js';
import {state} from '../state.js';
import {$,clamp,esc,hexColor} from '../util.js';
import {setCatColor,setDeptColor,useCatColor} from './actions.js';

/* The colour panel: a non-modal dialog beside the swatch that opened it, with a saturation and
   brightness area, a hue slider, a hex field, a palette and the project's own colours. Every change
   applies at once, so the model and panels follow the drag. It lives outside the side panels, so
   their rebuilds leave it open; the swatch is found again by its selector (cur.sel). While it is
   open the app's single-key shortcuts are off, because they skip keys while a dialog is open. */

/* rows from light to dark; columns red, orange, amber, green, teal, sky, blue, violet, pink, grey */
const PALETTE=[
  '#f6c1bd','#f9cfa8','#f8e0a6','#c4e5cd','#ace0dc','#bcdff3','#c4d1f5','#dccbf1','#f4c6da','#e2e6ec',
  '#ec8f88','#f3a86d','#f2c66e','#8fcba4','#69c2bc','#80c2e9','#91a9ec','#c2a2e4','#e996bb','#b9c0cc',
  '#e0554e','#e8822f','#eeab3d','#5fb27f','#26a5a0','#3d9dd6','#5b7fe0','#a478d4','#d9628f','#8d96a6',
  '#a8322c','#a95a1d','#b07a1c','#3a7d53','#17716d','#22679a','#3451a8','#6f4a9e','#9c3a62','#4b5565'
];
const COLS=10;

const panel=$('#colorPanel'), sv=$('#cpSV'), thumb=sv.firstElementChild, hue=$('#cpHue'), hexIn=$('#cpHex'), resetBtn=$('#cpReset');
/* cur: {key, sel, kind, title, hex, onPick(hex), reset?: {color, on(), fn()}}; H, S, V: the colour as the user steers it */
let cur=null, H=0, S=0, V=0;

function hsvToHex(h,s,v){
  const f=n=>{ const k=(n+h/60)%6; return Math.round(255*(v-v*s*Math.max(0,Math.min(k,4-k,1)))); };
  return '#'+((1<<24)|(f(5)<<16)|(f(3)<<8)|f(1)).toString(16).slice(1);
}
function hexToHsv(hex){
  const n=parseInt(hex.slice(1),16), r=(n>>16&255)/255, g=(n>>8&255)/255, b=(n&255)/255;
  const mx=Math.max(r,g,b), d=mx-Math.min(r,g,b);
  const h=!d?0:60*(mx===r?((g-b)/d+6)%6:mx===g?(b-r)/d+2:(r-g)/d+4);
  return [h,mx?d/mx:0,mx];
}

function swatches(list){
  return list.map((c,i)=>'<button type="button" data-hex="'+c[0]+'" style="background:'+c[0]+'" title="'+esc(c[1])+'" aria-label="'+esc(c[1])+'" tabindex="'+(i?-1:0)+'"></button>').join('');
}
/* the colours in use: categories first, then departments with their own colour */
function projectColors(){
  const seen=new Map();
  const add=(c,n)=>{ if(!seen.has(c)) seen.set(c,n); };
  for(const k in CATS) add(CATS[k].color,CATS[k].name);
  for(const k in DEPTS) if(DEPTS[k].color) add(DEPTS[k].color,DEPTS[k].n);
  return [...seen];
}

/* shows hex in the panel; keepHsv when the user is steering H/S/V, so rounding to hex doesn't move them */
function show(hex,keepHsv){
  cur.hex=hex;
  if(!keepHsv){ const [h,s,v]=hexToHsv(hex); if(s&&v) H=h; if(v) S=s; V=v; }  // greys and black keep the hue and saturation
  panel.style.setProperty('--hue',H.toFixed(1));
  panel.style.setProperty('--cur',hex);
  thumb.style.left=(S*100).toFixed(2)+'%'; thumb.style.top=((1-V)*100).toFixed(2)+'%';
  sv.setAttribute('aria-valuenow',Math.round(S*100));
  sv.setAttribute('aria-valuetext','Saturation '+Math.round(S*100)+'%, brightness '+Math.round(V*100)+'%');
  hue.value=Math.round(H);
  if(document.activeElement!==hexIn) hexIn.value=hex.toUpperCase();
  panel.querySelectorAll('[data-hex]').forEach(b=>b.classList.toggle('on',b.dataset.hex===hex));
  resetBtn.hidden=!(cur.reset&&cur.reset.on());
}
function pick(hex,keepHsv){
  if(!cur)return;
  cur.onPick(hex);
  show(hex,keepHsv);
}

/* beside the side panel that holds the swatch; under or over the swatch when the panels are stacked */
function place(){
  const a=document.querySelector(cur.sel);
  if(!a||!a.getClientRects().length){ closeColorPanel(); return; }
  const r=a.getBoundingClientRect(), side=(a.closest('.side')||a).getBoundingClientRect();
  const w=panel.offsetWidth, h=panel.offsetHeight, vw=innerWidth, vh=innerHeight, M=8;
  let x, y=r.top-14;
  if(side.right+M+w<=vw-M) x=side.right+M;
  else if(side.left-M-w>=M) x=side.left-M-w;
  else { x=r.left; y=r.bottom+6+h<=vh-M?r.bottom+6:r.top-6-h; }
  panel.style.left=clamp(x,M,Math.max(M,vw-w-M))+'px';
  panel.style.top=clamp(y,M,Math.max(M,vh-h-M))+'px';
}

/* opens the panel for o (see cur); opening it again from the same swatch closes it */
function openColorPanel(o){
  const again=cur&&cur.key===o.key;
  closeColorPanel();
  if(again)return;
  cur=o; state.picking=o.key;
  $('#cpKind').textContent=o.kind; $('#cpTitle').textContent=o.title;
  $('#cpProject').innerHTML=swatches(projectColors());
  if(o.reset) resetBtn.firstElementChild.style.background=o.reset.color;
  show(o.value);
  panel.show(); place(); panel.focus();
  const a=document.querySelector(o.sel); if(a) a.setAttribute('aria-expanded','true');
}
export function closeColorPanel(refocus){
  if(!cur)return;
  const a=document.querySelector(cur.sel);
  cur=null; state.picking=null; panel.close();
  if(a){ a.setAttribute('aria-expanded','false'); if(refocus) a.focus(); }
}

export function editCatColor(k){
  openColorPanel({key:'cat:'+k, sel:'[data-catcolor="'+k+'"]', kind:'Category colour', title:CATS[k].name, value:CATS[k].color,
    onPick:h=>setCatColor(k,h)});
}
export function editDeptColor(id){
  const d=DEPTS[id], c=CATS[d.c];
  openColorPanel({key:'dept:'+id, sel:'#dcol', kind:'Department colour', title:d.n, value:deptColor(id),
    onPick:h=>setDeptColor(id,h),
    reset:{color:c.color, on:()=>!!DEPTS[id].color, fn:()=>useCatColor(id)}});
}

export function bindColorPanel(){
  $('#cpPalette').innerHTML=swatches(PALETTE.map(c=>[c,c.toUpperCase()]));
  // saturation and brightness: drag anywhere in the area, or arrow keys (Shift for bigger steps)
  const svAt=e=>{
    const r=sv.getBoundingClientRect();
    S=clamp((e.clientX-r.left)/r.width,0,1); V=1-clamp((e.clientY-r.top)/r.height,0,1);
    pick(hsvToHex(H,S,V),true);
  };
  sv.addEventListener('pointerdown',e=>{ e.preventDefault(); sv.focus({preventScroll:true}); sv.setPointerCapture(e.pointerId); svAt(e); });
  sv.addEventListener('pointermove',e=>{ if(sv.hasPointerCapture(e.pointerId)) svAt(e); });
  sv.addEventListener('keydown',e=>{
    const st=e.shiftKey?0.1:0.01, d={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,st],ArrowDown:[0,-st]}[e.key];
    if(!d)return;
    e.preventDefault(); S=clamp(S+d[0],0,1); V=clamp(V+d[1],0,1); pick(hsvToHex(H,S,V),true);
  });
  hue.addEventListener('input',()=>{ H=+hue.value; pick(hsvToHex(H,S,V),true); });
  // a full six-digit code applies while typing; Enter or leaving the field also takes #abc
  hexIn.addEventListener('input',()=>{ const h=/^#?[0-9a-f]{6}$/i.test(hexIn.value.trim())&&hexColor(hexIn.value); if(h&&h!==cur.hex) pick(h); });
  hexIn.addEventListener('change',()=>{ if(!cur)return; const h=hexColor(hexIn.value); if(h&&h!==cur.hex) pick(h); hexIn.value=cur.hex.toUpperCase(); });
  hexIn.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); hexIn.dispatchEvent(new Event('change')); } });
  panel.addEventListener('click',e=>{
    const b=e.target.closest('[data-hex]');
    if(b) pick(b.dataset.hex);
    else if(e.target.closest('[data-cp=close]')) closeColorPanel(true);
    else if(e.target.closest('#cpReset')&&cur.reset){ cur.reset.fn(); show(cur.reset.color); panel.focus(); }  // the button hides itself
  });
  // arrow keys move through a swatch grid, which is a single tab stop
  panel.addEventListener('keydown',e=>{
    const g=e.target.closest('.cpgrid'); if(!g||!e.target.dataset.hex)return;
    const st={ArrowLeft:-1,ArrowRight:1,ArrowUp:-COLS,ArrowDown:COLS}[e.key]; if(!st)return;
    const all=[...g.children], to=all[all.indexOf(e.target)+st]; if(!to)return;
    e.preventDefault(); e.target.tabIndex=-1; to.tabIndex=0; to.focus();
  });
  // a press outside closes it; the swatch that opened it toggles it in its click handler instead
  document.addEventListener('pointerdown',e=>{ if(cur&&!panel.contains(e.target)&&!e.target.closest(cur.sel)) closeColorPanel(); },true);
  // registered before the laser's capture-phase listener, so Escape closes only this panel
  window.addEventListener('keydown',e=>{ if(cur&&e.key==='Escape'){ e.preventDefault(); e.stopImmediatePropagation(); closeColorPanel(true); } },true);
  window.addEventListener('scroll',()=>{ if(cur) place(); },true);
  window.addEventListener('resize',()=>{ if(cur) place(); });
}
