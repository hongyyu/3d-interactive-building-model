import {PROJECT,CATS,DEPTS,BUILDINGS,deptColor} from '../data/project.js';
import {state,BDEF,isOverview} from '../state.js';
import {canvas} from '../dom.js';
import {$,esc,fmt} from '../util.js';
import {renderer,scene,camera} from '../scene/scene.js';
import {SW,insetL,insetR} from '../scene/view.js';
import {floorStat} from '../layout/plan.js';
import {welcomeOpen} from './welcome.js';

/* Printed report: the whole live project on printable pages. A summary page (totals, a picture of
   the current view, buildings and categories, the Unassigned tray) is followed by one page per
   building with its stacking diagram and every department, level by level. It is rebuilt on each
   print, from the ☰ menu or the browser's own Ctrl+P / ⌘P, and the print stylesheet then shows only
   #report. The browser's print dialog saves it as a PDF; nothing leaves the browser. */
const MODES={mass:'3D Massing',axon:'Axon',stack:'Section Stack'};
const report=$('#report'), root=document.documentElement;
let savedTitle=null;

const pct=(a,b)=>b?Math.round(a/b*100)+'%':'–';
const sf=n=>fmt(n)+' SF';
const sw=c=>'<i class="r-sw" style="background:'+c+'"></i>';
const kv=items=>'<dl class="r-kv">'+items.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('')+'</dl>';
const over=n=>n?'<span class="r-over">'+n+' level'+(n>1?'s':'')+'</span>':'None';

/* the 3D view as it is on screen, cropped to the free area between the side panels and rendered at
   2x or more so it stays sharp on paper; the HTML labels are not part of it */
function snapshot(){
  const pr=renderer.getPixelRatio(), hi=Math.max(pr,2);
  if(hi!==pr) renderer.setPixelRatio(hi);
  renderer.render(scene,camera);
  const k=canvas.width/SW, x=Math.round(insetL*k), w=Math.max(1,canvas.width-x-Math.round(insetR*k)), h=canvas.height;
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  c.getContext('2d').drawImage(canvas,x,0,w,h,0,0,w,h);
  // back to the screen resolution, redrawn at once so the model doesn't blank behind the print dialog
  if(hi!==pr){ renderer.setPixelRatio(pr); renderer.render(scene,camera); }
  return trim(c);
}
/* crops the white background and the faint ground grid (#e6e9ee) around the model, keeping a margin */
function trim(c){
  const w=c.width, h=c.height, px=c.getContext('2d').getImageData(0,0,w,h).data;
  let x0=w, y0=h, x1=-1, y1=-1;
  for(let y=0,i=0;y<h;y++) for(let x=0;x<w;x++,i+=4){
    if(px[i]<228||px[i+1]<228||px[i+2]<228){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  }
  if(x1<0) return c;
  const m=Math.round(Math.max(x1-x0,y1-y0)*0.06);
  x0=Math.max(0,x0-m); y0=Math.max(0,y0-m); x1=Math.min(w-1,x1+m); y1=Math.min(h-1,y1+m);
  const t=document.createElement('canvas'); t.width=x1-x0+1; t.height=y1-y0+1;
  t.getContext('2d').drawImage(c,x0,y0,t.width,t.height,0,0,t.width,t.height);
  return t;
}

function buildingStats(def){
  const n=state.levels[def.id].length, plate=def.w*def.d, floors=[];
  let prog=0, depts=0, nover=0;
  for(let f=0;f<n;f++){ const s=floorStat(def.id,f); floors.push(s); prog+=s.total; depts+=s.ids.length; if(s.over) nover++; }
  return {def,n,plate,gsf:plate*n,prog,depts,over:nover,floors};
}

function summary(stats){
  let n=0, gsf=0, prog=0, placed=0, nover=0;
  stats.forEach(s=>{ n+=s.n; gsf+=s.gsf; prog+=s.prog; placed+=s.depts; nover+=s.over; });
  const un=state.unassigned.length;
  const view='Current view · '+MODES[state.mode]+' · '+(isOverview()?'Full campus':esc(BDEF[state.sel].name))+
    (state.isolate?' · '+esc(CATS[state.isolate].name)+' highlighted':'');
  let h='<section class="r-sec">'+kv([
    ['Buildings',BUILDINGS.length],['Levels',n],['Gross area',sf(gsf)],
    ['Program',sf(prog)+' · '+pct(prog,gsf)],['Departments',placed+(un?' placed · '+un+' unassigned':'')],['Over capacity',over(nover)]
  ])+'<figure class="r-fig"><figcaption>'+view+'</figcaption></figure></section>';

  h+='<section class="r-sec"><h2 class="r-h">Buildings</h2><table class="r-tbl"><thead><tr><th>Building</th><th>Floor plate</th><th class="num">Floor-to-floor</th>'+
     '<th class="num">Levels</th><th class="num">Gross SF</th><th class="num">Program SF</th><th class="num">Fill</th><th class="num">Over capacity</th></tr></thead><tbody>';
  stats.forEach(s=>{
    h+='<tr><td>'+esc(s.def.name)+'</td><td>'+fmt(s.def.w)+' × '+fmt(s.def.d)+' ft</td><td class="num">'+fmt(s.def.fh)+' ft</td><td class="num">'+s.n+'</td>'+
       '<td class="num">'+fmt(s.gsf)+'</td><td class="num">'+fmt(s.prog)+'</td><td class="num">'+pct(s.prog,s.gsf)+'</td><td class="num">'+(s.over?over(s.over):'–')+'</td></tr>';
  });
  h+='</tbody><tfoot><tr><th colspan="3">Campus</th><td class="num">'+n+'</td><td class="num">'+fmt(gsf)+'</td><td class="num">'+fmt(prog)+'</td>'+
     '<td class="num">'+pct(prog,gsf)+'</td><td class="num">'+(nover?over(nover):'–')+'</td></tr></tfoot></table></section>';

  // placed program only, like "Program by category" in the left panel; the tray is listed below
  const by={}, cnt={};
  stats.forEach(s=>s.floors.forEach(fl=>fl.ids.forEach(id=>{ const c=DEPTS[id].c; by[c]=(by[c]||0)+DEPTS[id].a; cnt[c]=(cnt[c]||0)+1; })));
  h+='<section class="r-sec"><h2 class="r-h">Program by category</h2><table class="r-tbl"><thead><tr><th>Category</th><th class="num">Departments</th>'+
     '<th class="num">Program SF</th><th class="num">Share</th></tr></thead><tbody>';
  for(const k in CATS){
    h+='<tr><td>'+sw(CATS[k].color)+esc(CATS[k].name)+'</td><td class="num">'+(cnt[k]||'–')+'</td><td class="num">'+(by[k]?fmt(by[k]):'–')+'</td>'+
       '<td class="num">'+(by[k]?pct(by[k],prog):'–')+'</td></tr>';
  }
  h+='</tbody><tfoot><tr><th>Total</th><td class="num">'+placed+'</td><td class="num">'+fmt(prog)+'</td><td class="num">'+(prog?'100%':'–')+'</td></tr></tfoot></table></section>';
  return h;
}

function unassigned(notes){
  const ids=state.unassigned;
  if(!ids.length) return '';
  let total=0, rows='';
  ids.forEach(id=>{
    const d=DEPTS[id]; total+=d.a;
    rows+='<tr><td>'+sw(deptColor(id))+esc(d.n)+'</td><td>'+esc(CATS[d.c].name)+'</td><td class="num">'+fmt(d.a)+'</td>'+(notes?'<td>'+esc(d.notes||'')+'</td>':'')+'</tr>';
  });
  return '<section class="r-sec"><h2 class="r-h">Unassigned · '+ids.length+'</h2><p class="r-note">Departments in the tray, not placed on any level.</p>'+
    '<table class="r-tbl"><thead><tr><th>Department</th><th>Category</th><th class="num">SF</th>'+(notes?'<th>Notes</th>':'')+'</tr></thead>'+
    '<tbody>'+rows+'</tbody><tfoot><tr><th colspan="2">Total</th><td class="num">'+fmt(total)+'</td>'+(notes?'<td></td>':'')+'</tr></tfoot></table></section>';
}

/* one building: key figures, a stacking diagram (top level first, like the Levels list) and a table
   of every department grouped by level */
function building(s,i,count,notes){
  const def=s.def, cols=notes?5:4;
  let stack='', body='';
  for(let f=s.n-1;f>=0;f--){
    const fl=s.floors[f], den=Math.max(fl.plate,fl.total);
    let segs='', rows='';
    fl.ids.forEach(id=>{
      const d=DEPTS[id], c=deptColor(id);
      segs+='<span style="width:'+(d.a/den*100).toFixed(2)+'%;background:'+c+'"><b>'+esc(d.n)+'</b><i>'+fmt(d.a)+'</i></span>';
      rows+='<tr><td>'+sw(c)+esc(d.n)+'</td><td>'+esc(CATS[d.c].name)+'</td><td class="num">'+fmt(d.a)+'</td><td class="num">'+pct(d.a,fl.plate)+'</td>'+
            (notes?'<td>'+esc(d.notes||'')+'</td>':'')+'</tr>';
    });
    stack+='<div class="r-lv'+(fl.over?' over':'')+'"><b>L'+(f+1)+'</b><div class="r-bar">'+segs+'</div><em>'+fmt(fl.total)+' / '+fmt(fl.plate)+'</em></div>';
    const st=fl.over?'Over by '+sf(fl.total-fl.plate):fl.ids.length?'':'Empty level';
    body+='<tbody><tr class="r-lvrow'+(fl.over?' r-over':'')+'"><th colspan="2">Level '+(f+1)+(st?'<span>'+st+'</span>':'')+'</th>'+
          '<td class="num">'+fmt(fl.total)+'</td><td class="num">'+pct(fl.total,fl.plate)+'</td>'+(notes?'<td></td>':'')+'</tr>'+rows+'</tbody>';
  }
  return '<section class="r-sec r-bldg"><p class="r-eyebrow">Building '+(i+1)+' of '+count+'</p><h2 class="r-title">'+esc(def.name)+'</h2>'+kv([
    ['Floor plate',fmt(def.w)+' × '+fmt(def.d)+' ft · '+sf(s.plate)],['Floor-to-floor',fmt(def.fh)+' ft'],['Levels',s.n],
    ['Gross area',sf(s.gsf)],['Program',sf(s.prog)+' · '+pct(s.prog,s.gsf)],['Over capacity',over(s.over)]
  ])+'<div class="r-stack">'+stack+'</div>'+
  '<table class="r-tbl"><thead><tr><th>Department</th><th>Category</th><th class="num">SF</th><th class="num">% of plate</th>'+(notes?'<th>Notes</th>':'')+'</tr></thead>'+
  body+'<tfoot><tr><th colspan="2">Program total<span>'+pct(s.prog,s.gsf)+' of gross area</span></th><td class="num">'+fmt(s.prog)+'</td>'+
  '<td colspan="'+(cols-3)+'"></td></tr></tfoot></table></section>';
}

export function renderReport(){
  const stats=BUILDINGS.map(buildingStats);
  const notes=Object.keys(DEPTS).some(id=>DEPTS[id].notes);
  const date=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  report.innerHTML='<header class="r-head"><div><p class="r-eyebrow">Program &amp; stacking report</p><h1>'+esc(PROJECT.title)+'</h1>'+
    '<p class="r-sub">'+esc(PROJECT.sub)+'</p></div><p class="r-sub">'+date+'</p></header>'+
    summary(stats)+unassigned(notes)+stats.map((s,i)=>building(s,i,stats.length,notes)).join('')+
    '<p class="r-foot">Areas are departmental SF. A floor plate is width × depth, and a level is over capacity when its program exceeds it. '+
    'Generated in the browser by 3D Interactive Building Model © 2026 Hongyu Li and Zining Cheng; nothing was uploaded.</p>';
  report.querySelector('.r-fig').prepend(snapshot());
}

/* the menu item; the beforeprint listener below builds the report, as it does for Ctrl+P / ⌘P */
export function printReport(){ window.print(); }

export function bindReport(){
  if(/Mac|iPhone|iPad/.test(navigator.platform)) $('#printKey').textContent='⌘P';
  window.addEventListener('beforeprint',()=>{
    // from the start screen the browser prints the page as it is
    const on=!welcomeOpen();
    root.classList.toggle('print-report',on);
    if(!on) return;
    renderReport();
    // the default file name in "Save as PDF"
    if(savedTitle==null) savedTitle=document.title;
    document.title=PROJECT.title+' – Program report';
  });
  window.addEventListener('afterprint',()=>{
    if(savedTitle!=null){ document.title=savedTitle; savedTitle=null; }
  });
}
