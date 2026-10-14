import {DEMO} from '../data/demo.js';
import {PROJECT} from '../data/project.js';
import {$,RM} from '../util.js';
import {openProject} from './actions.js';
import {chooseImportFile} from './importDialog.js';

/* Start screen shown on load: what the tool does, an animated stacking illustration and the two
   ways in, the demo campus or an imported Excel program. #app is inert while it is open, and
   main.js skips rendering the 3D scene behind it. */
const el=$('#welcome'), app=$('#app'), back=$('#welcomeBack');
let open=!el.hidden;
let visited=false;   // the user has been in the app, so "Back to the model" is offered

export function welcomeOpen(){ return open; }

export function showWelcome(){
  open=true; app.inert=true;
  back.hidden=!visited;
  el.hidden=false; el.classList.remove('leaving','play');
  void el.offsetWidth; el.classList.add('play');   // replay the entrance animation
  $('[data-act=demo]',el).focus();
}
/* immediate=true skips the fade, for example when WebGL is missing and there is nothing to show */
export function closeWelcome(immediate){
  if(!open) return;
  open=false; visited=true; app.inert=false;
  if(RM||immediate){ el.hidden=true; return; }
  el.classList.add('leaving');
  setTimeout(()=>{ if(!open) el.hidden=true; },360);
}

/* ---------- illustration: the demo's first building, drawn in isometric ---------- */
const COS=Math.cos(Math.PI/6), SIN=0.5, U=0.95;   // U = px per ft
const VX=1.8;   // vertical exaggeration, so thin floors still read as volumes at this size
const SLAB=4, CLEAR=3, GAP=1.2, EXPLODE=20, MAX_FLOORS=5;
function shade(hex,t){   // t > 0 mixes toward white, t < 0 toward black
  const n=parseInt(hex.slice(1),16), m=v=>Math.round(t>0?v+(255-v)*t:v*(1+t));
  return 'rgb('+m(n>>16)+','+m(n>>8&255)+','+m(n&255)+')';
}
function pt(X,Y,Z){ return ((X-Z)*COS*U).toFixed(1)+','+((X+Z)*SIN*U-Y*U).toFixed(1); }
function poly(pts,fill){ return '<polygon points="'+pts.join(' ')+'" fill="'+fill+'"/>'; }
/* a box seen from above-front: top face, the long face toward the viewer (z = z1), the end face (x = x1) */
function box(x0,x1,y0,y1,z0,z1,top,front,side){
  return poly([pt(x0,y1,z0),pt(x1,y1,z0),pt(x1,y1,z1),pt(x0,y1,z1)],top)+
    poly([pt(x0,y0,z1),pt(x1,y0,z1),pt(x1,y1,z1),pt(x0,y1,z1)],front)+
    poly([pt(x1,y0,z0),pt(x1,y0,z1),pt(x1,y1,z1),pt(x1,y1,z0)],side);
}
function stackSVG(){
  const b=DEMO.buildings[0], w=b.w, d=b.d, fh=b.fh*VX, plate=w*d;
  const levels=b.levels.slice(0,MAX_FLOORS), n=levels.length;
  let floors='';
  levels.forEach((ids,f)=>{
    const y0=f*fh;
    let g=box(0,w,y0,y0+SLAB,0,d,'#ffffff','#eef1f5','#dfe4eb');
    let total=0; ids.forEach(id=>{ total+=DEMO.depts[id].a; });
    const den=Math.max(plate,total);
    let x=0;
    ids.forEach(id=>{
      const dd=DEMO.depts[id], c=dd.color||DEMO.cats[dd.c].color, sw=w*dd.a/den;
      g+=box(x+GAP/2,x+sw-GAP/2,y0+SLAB,y0+fh-CLEAR,0,d,shade(c,0.3),shade(c,0),shade(c,-0.18));
      x+=sw;
    });
    floors+='<g class="wf" style="--i:'+f+'"><g class="wx">'+g+'</g></g>';
  });
  const pad=poly([pt(-10,0,-10),pt(w+10,0,-10),pt(w+10,0,d+10),pt(-10,0,d+10)],'#f1f3f6');
  // bounds: x from the pad's left corner to its right corner; y from the exploded top floor to the pad's front corner
  const x0=-(d+20)*COS*U-6, x1=(w+20)*COS*U+6;
  const y0=-n*fh*U-(n-1)*EXPLODE-10, y1=(w+d+20)*SIN*U+8;
  return '<svg viewBox="'+x0.toFixed(0)+' '+y0.toFixed(0)+' '+(x1-x0).toFixed(0)+' '+(y1-y0).toFixed(0)+'" role="presentation">'+
    '<g stroke="#dde1e7" stroke-width=".8">'+pad+'</g>'+
    '<g stroke="rgba(20,25,34,.3)" stroke-width=".6" stroke-linejoin="round">'+floors+'</g></svg>';
}

export function bindWelcome(){
  $('#wstack').innerHTML=stackSVG();
  $('#wDemoMeta').textContent=DEMO.buildings.length+' buildings · '+Object.keys(DEMO.depts).length+' departments';
  el.addEventListener('click',e=>{
    const b=e.target.closest('[data-act]'); if(!b) return;
    const a=b.dataset.act;
    if(a==='demo'){
      if(!PROJECT.demo){
        if(!window.confirm('Replace the current project with the demo campus?')) return;
        openProject(DEMO);
      }
      closeWelcome();
    }
    else if(a==='import') chooseImportFile();
    else if(a==='back') closeWelcome();
  });
  // an import started here closes the start screen once the user confirms "Replace project"
  const dlg=$('#importDlg');
  dlg.addEventListener('close',()=>{ if(open&&dlg.returnValue==='ok') closeWelcome(); });
  $('#home').addEventListener('click',showWelcome);
  if(open){ el.classList.add('play'); $('[data-act=demo]',el).focus(); }
}
