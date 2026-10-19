import {CATS,DEPTS} from '../data/project.js';
import {state,hoverId,setHotCat} from '../state.js';
import {leftEl} from '../dom.js';
import {fk} from '../util.js';

/* "Program by category" donut in the left panel. One slice per category with program in scope, in
   CATS order clockwise from 12 o'clock. A category is "hot" while its slice or legend row is hovered
   or focused, or while a department of it is hovered in the model: its slice lifts, the others fade,
   and the centre shows its name, SF and share. A hot slice or row also makes the category's
   departments glow in the model (hotCat). The isolated category (state.isolate) stays lit otherwise. */
const R=50, r=37, GAP=1.5;   // viewBox units (the donut is 100 across); GAP is the surface gap between slices
let cur={by:{},total:0};      // what the last render drew
let panelCat=null;            // the category hovered or focused in the left panel
let shown;                    // the category paintPie() last lit, so repeated calls with no change are cheap

const P=(rad,a)=>(50+rad*Math.cos(a)).toFixed(2)+' '+(50+rad*Math.sin(a)).toFixed(2);
/* one slice from angle a0 to a1, inset so neighbours are GAP apart along their whole edge */
function arc(a0,a1){
  const o0=a0+GAP/2/R, o1=a1-GAP/2/R;
  if(o1<=o0) return '';
  let i0=a0+GAP/2/r, i1=a1-GAP/2/r;
  if(i1<i0) i0=i1=(a0+a1)/2;
  return 'M'+P(R,o0)+'A'+R+' '+R+' 0 '+(o1-o0>Math.PI?1:0)+' 1 '+P(R,o1)+
    'L'+P(r,i1)+'A'+r+' '+r+' 0 '+(i1-i0>Math.PI?1:0)+' 0 '+P(r,i0)+'Z';
}
const RING='M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0ZM50 13A37 37 0 1 0 50 87A37 37 0 1 0 50 13Z';

/* the donut's markup for program SF by category key; the legend rows stay the exact readout */
export function pieHTML(by){
  let total=0; for(const k in CATS) total+=by[k]||0;
  cur={by:by,total:total}; shown=undefined;
  const ks=Object.keys(CATS).filter(k=>by[k]>0);
  let svg='';
  if(!ks.length) svg='<path class="track" d="'+RING+'" fill-rule="evenodd"/>';
  else if(ks.length===1) svg='<path data-slice="'+ks[0]+'" d="'+RING+'" fill-rule="evenodd" fill="'+CATS[ks[0]].color+'"/>';
  else {
    let a=-Math.PI/2;
    ks.forEach(k=>{
      const b=a+by[k]/total*2*Math.PI, d=arc(a,b); a=b;
      if(d) svg+='<path data-slice="'+k+'"'+(state.isolate===k?' class="on"':'')+' d="'+d+'" fill="'+CATS[k].color+'"/>';
    });
  }
  return '<div class="pie'+(state.isolate&&by[state.isolate]?' iso':'')+'"><svg viewBox="0 0 100 100" aria-hidden="true">'+svg+'</svg>'+
    '<p class="pmid" aria-hidden="true"><b></b><small></small></p></div>';
}

/* lights the hot category (or the isolated one) on the donut and the legend, and fills the centre */
export function paintPie(){
  let hot=panelCat||(hoverId&&DEPTS[hoverId]?DEPTS[hoverId].c:null);
  if(!CATS[hot]) hot=null;   // a key left over from the project loaded before
  if(hot===shown) return;
  shown=hot;
  const pie=leftEl.querySelector('.pie'); if(!pie) return;
  pie.classList.toggle('lit',!!hot);
  pie.querySelectorAll('[data-slice]').forEach(p=>p.classList.toggle('hot',p.dataset.slice===hot));
  leftEl.querySelectorAll('.lg').forEach(row=>row.classList.toggle('hot',row.querySelector('[data-cat]').dataset.cat===hot));
  const k=hot||(state.isolate&&cur.by[state.isolate]?state.isolate:null), a=k?cur.by[k]||0:0;
  const mid=pie.querySelector('.pmid');
  mid.classList.toggle('cat',!!k);
  mid.querySelector('b').textContent=k?CATS[k].name:fk(cur.total)+' SF';
  mid.querySelector('small').textContent=k?(a?fk(a)+' SF · '+(a/cur.total<0.005?'<1':Math.round(a/cur.total*100))+'%':'None here'):'Program';
}

/* the category of a slice or legend row under el, or null */
function catAt(el){
  const s=el.closest('[data-slice]'); if(s) return s.dataset.slice;
  const row=el.closest('.lg'); return row?row.querySelector('[data-cat]').dataset.cat:null;
}
/* the pointer wins over focus. Only keyboard focus on a row's isolate button counts, so a button
   focused by a click, or a swatch the colour panel hands focus back to, leaves nothing lit. */
let overCat=null, focusCat=null;
function update(){
  const k=overCat||focusCat;
  if(k===panelCat) return;
  panelCat=k; setHotCat(k); paintPie();
}
export function bindPie(){
  leftEl.addEventListener('pointerover',e=>{ overCat=catAt(e.target); update(); });
  leftEl.addEventListener('pointerleave',()=>{ overCat=null; update(); });
  leftEl.addEventListener('focusin',e=>{ focusCat=e.target.matches('[data-cat]:focus-visible')?e.target.dataset.cat:null; update(); });
  leftEl.addEventListener('focusout',()=>{ focusCat=null; update(); });
}
