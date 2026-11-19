import {DEMO} from '../data/demo.js';
import {PROJECT,BUILDINGS} from '../data/project.js';
import {readProgramFile} from '../data/importer.js';
import {readMassingFile,massingProject,DEFAULT_FH} from '../data/massing.js';
import {state} from '../state.js';
import {MAX_LEVELS} from '../scene/constants.js';
import {$,esc,fmt,clamp} from '../util.js';
import {openProject} from './actions.js';

const MAX_NOTES=12;
let dlg, body, ok, okProg, commit=null, massing=null, reads=0;

/* Reads the chosen file and shows a summary. Nothing changes until the user confirms: a program
   (.xlsx / .csv) replaces the project, a Rhino massing (.3dm) replaces the buildings. */
async function importFile(file){
  const rhino=/\.3dm$/i.test(file.name), sheet=/\.(xlsx|xls|csv)$/i.test(file.name);
  commit=null; massing=null; ok.hidden=true; ok.disabled=false; okProg.hidden=true;
  ok.textContent=rhino?'Replace buildings':'Replace project';
  dlg.classList.toggle('wide',rhino);
  body.innerHTML=heading(file.name,rhino)+'<p class="note">'+(rhino?'Loading the Rhino reader…':'Reading…')+'</p>';
  // Escape closes the dialog without changing returnValue, so clear an "ok" left by an earlier import
  if(!dlg.open){ dlg.returnValue=''; dlg.showModal(); }
  if(!rhino&&!sheet){
    body.innerHTML=heading(file.name)+'<div class="msgs err"><b>This file can’t be imported</b>'+list(['Dado reads a Rhino model (.3dm) for the buildings, and an Excel workbook (.xlsx, .xls) or a CSV file for the program.'])+'</div>';
    return;
  }
  if(rhino) return importMassing(file);
  // buildings from Rhino are kept unless the user picks the workbook's Buildings sheet
  return importProgram(file,!!PROJECT.massing);
}
async function importProgram(file,keep){
  const n=++reads;
  let r;
  try{ r=await readProgramFile(file,keep); }
  catch(err){ r={project:null,errors:['This file could not be read. Use an Excel workbook (.xlsx) or a CSV file.'],warnings:[]}; }
  if(n!==reads) return;
  commit=r.project?()=>openProject(r.project):null;
  ok.hidden=!commit;
  body.innerHTML=summaryHTML(file.name,r);
  const use=$('#useSheet');
  if(use) use.addEventListener('change',()=>importProgram(file,!use.checked));
}

function heading(name,rhino){
  return '<div><p class="eyebrow">'+(rhino?'Import Rhino massing':'Import')+'</p><h2 class="title" id="importTitle">'+esc(name)+'</h2></div>';
}

function list(items){
  const shown=items.slice(0,MAX_NOTES).map(m=>'<li>'+esc(m)+'</li>').join('');
  return '<ul>'+shown+(items.length>MAX_NOTES?'<li>…and '+(items.length-MAX_NOTES)+' more</li>':'')+'</ul>';
}
const notesHTML=items=>items.length?'<div class="msgs"><b>'+items.length+' note'+(items.length>1?'s':'')+'</b>'+list(items)+'</div>':'';

function summaryHTML(name,r){
  let h=heading(name);
  if(!r.project) return h+'<div class="msgs err"><b>This file can’t be imported</b>'+list(r.errors)+'</div>';
  const s=r.summary;
  h+='<dl class="kv"><div><dt>Departments</dt><dd>'+s.departments+'</dd></div><div><dt>Total program</dt><dd>'+fmt(s.totalSF)+' SF</dd></div>'+
     '<div><dt>Buildings</dt><dd>'+s.buildings+(s.keptBuildings?' (current)':'')+'</dd></div>'+
     '<div><dt>Placed · unassigned</dt><dd>'+s.placed+' · '+s.unassigned+'</dd></div></dl>';
  h+=notesHTML(r.warnings);
  if(s.buildingsSheet) h+='<label class="opt"><input type="checkbox" id="useSheet"'+(s.keptBuildings?'':' checked')+'>Use its Buildings sheet'+
    (s.keptBuildings?', instead of the current buildings'+(PROJECT.massing?' from '+esc(PROJECT.massing):''):'')+'</label>';
  else if(s.keptBuildings) h+='<p class="note">The file has no Buildings sheet, so the current buildings are kept.</p>';
  return h+'<p class="note">Importing replaces the current project, including changes made in the app.</p>';
}

/* ---------- Rhino massing ----------
   Each mass found is a row: whether to import it, its name, its level count (its height stays, so
   the floor-to-floor follows) and the current building whose departments it takes over, which
   defaults to the one with the same name. Departments of buildings no mass takes over, and levels
   above a mass's count, go to the Unassigned tray.
   Guesses are marked (class est) until the user changes them: a level count estimated from the
   height, and a name the file doesn't have. Each row says where its level count came from. With the
   demo program loaded (no PROJECT.program) the buildings come in empty: the "Departments from"
   column is left out, a note says so, and "Replace, then import program…" chains the two imports. */
const LEVELS_FROM={text:'levels from User Text',floors:'levels from its floor boxes',plates:'levels from its floor outlines'};
async function importMassing(file){
  let r;
  try{ r=await readMassingFile(file); }
  catch(err){ r={masses:null,errors:['This file could not be read. Use a Rhino model (.3dm) saved from Rhino 5 or later.'],notes:[]}; }
  if(!r.masses){ body.innerHTML=heading(file.name,true)+'<div class="msgs err"><b>This file can’t be imported</b>'+list(r.errors)+'</div>'; return; }
  const byName={};
  BUILDINGS.forEach((b,i)=>{ byName[b.name.trim().toLowerCase()]=i; });
  // only a program of the user's has departments to hand on; the demo's is not carried over
  const prog=!!PROJECT.program;
  const rows=r.masses.map(m=>{ const i=prog?byName[m.name.toLowerCase()]:null; return {...m,from:i==null?'':BUILDINGS[i].id,edited:false,est:m.src==='height',anon:!!m.unnamed}; });
  // masses that take over a building come first, in the current order; the rest west to east
  const rank=m=>m.from?BUILDINGS.findIndex(b=>b.id===m.from):BUILDINGS.length;
  rows.sort((a,b)=>rank(a)-rank(b));
  massing={file:file.name,rows,units:r.units,notes:r.notes,prog};
  commit=()=>{ const p=massingResult(); if(p) openProject(p.project); };
  ok.hidden=false; okProg.hidden=!!PROJECT.program;
  body.innerHTML=heading(file.name,true)+'<dl class="kv" id="mkv"></dl>'+
    (!prog?'<div class="msgs warn" id="mdemo"><b>No program loaded yet</b><p>These buildings come in empty. Import your program (Excel or CSV) next; its Building column places departments on the masses of the same name.</p></div>':'')+
    '<p class="mhint" id="mhint" hidden></p>'+
    '<div class="masses'+(prog?'':' noprog')+'" role="group" aria-label="Masses found"><div class="mhead"><span></span><span>Building</span><span>Levels</span>'+(prog?'<span>Departments from</span>':'')+'</div>'+
    rows.map(rowHTML).join('')+'</div>'+notesHTML(r.notes)+
    (prog?'<p class="note">Your program stays. Each mass gets the departments of the building you pick, level by level; the rest wait in the Unassigned tray. Name a mass in Rhino (object name or layer) like a building in your program and it is picked for you.</p>':'');
  updateMassing();
}

function rowHTML(m,i){
  const opts='<option value="">None</option>'+BUILDINGS.map(b=>'<option value="'+esc(b.id)+'"'+(b.id===m.from?' selected':'')+'>'+esc(b.name)+'</option>').join('');
  return '<div class="mrow'+(m.on?'':' off')+'" data-i="'+i+'">'+
    '<input type="checkbox" data-m="on"'+(m.on?' checked':'')+' aria-label="Import this mass">'+
    '<input type="text" class="mname'+(m.anon?' est':'')+'" data-m="name" value="'+esc(m.name)+'" maxlength="60" aria-label="Building name" spellcheck="false">'+
    '<input type="number" class="mlv'+(m.est?' est':'')+'" data-m="levels" value="'+m.levels+'" min="1" max="'+MAX_LEVELS+'" step="1" aria-label="Levels">'+
    (massing.prog?'<select data-m="from" aria-label="Departments from">'+opts+'</select>':'')+
    '<p class="note mmeta">'+meta(m)+'</p></div>';
}
function meta(m){
  const from=m.est?'<span class="mest">levels estimated at '+DEFAULT_FH+' ft per floor: check them</span>':m.levelsSet?'levels set by you':LEVELS_FROM[m.src];
  return fmt(m.w)+' × '+fmt(m.d)+' ft · '+fmt(m.h)+' ft tall · '+m.fh.toFixed(1)+' ft floor-to-floor'+(m.layer?' · '+esc(m.layer):'')+
    '<br>'+from+(m.anon?' · <span class="mest">no name in the file</span>':'')+
    (m.notes.length?'<br><span class="mwarn">'+esc(m.notes.join('; '))+'</span>':'');
}
/* the chosen masses with unique names, as a project */
function massingResult(){
  const used={}, chosen=massing.rows.filter(m=>m.on).map((m,i)=>{
    const base=m.name.trim()||'Building '+(i+1);
    let name=base, n=1;
    while(used[name.toLowerCase()]) name=base+' '+(++n);
    used[name.toLowerCase()]=true;
    return {...m,name};
  });
  return chosen.length?massingProject(chosen,state.levels,state.unassigned,massing.file):null;
}
function updateMassing(){
  const p=massingResult(), on=massing.rows.filter(m=>m.on), n=on.length;
  ok.disabled=okProg.disabled=!p;
  // what is still a guess among the ticked masses
  const est=on.filter(m=>m.est).length, anon=on.filter(m=>m.anon).length, hint=$('#mhint');
  const parts=[];
  if(est) parts.push(est+(est>1?' level counts are':' level count is')+' estimated from height');
  if(anon) parts.push(anon+(anon>1?' buildings have':' building has')+' no name in the file');
  hint.hidden=!parts.length;
  hint.textContent=parts.length?'Check the marked values: '+parts.join(', and ')+'.':'';
  $('#mkv').innerHTML='<div><dt>Buildings</dt><dd>'+n+' of '+massing.rows.length+'</dd></div><div><dt>Units</dt><dd>'+esc(massing.units)+'</dd></div>'+
    (massing.prog?'<div><dt>Departments</dt><dd>'+Object.keys(p?p.project.depts:{}).length+'</dd></div>'+
      '<div><dt>Placed · unassigned</dt><dd>'+(p?p.placed+' · '+p.unassigned:'–')+'</dd></div>':
      '<div><dt>Program</dt><dd>Not loaded yet</dd></div>');
}
function onMassInput(e){
  const t=e.target, row=t.closest('.mrow'); if(!row||!t.dataset.m) return;
  const m=massing.rows[+row.dataset.i];
  if(t.dataset.m==='on'){ m.on=t.checked; row.classList.toggle('off',!m.on); }
  else if(t.dataset.m==='name'){ m.name=t.value; m.edited=true; m.anon=false; t.classList.remove('est'); row.querySelector('.mmeta').innerHTML=meta(m); }
  else if(t.dataset.m==='levels'){
    const n=parseInt(t.value,10);
    if(!(n>=1)) return;
    m.levels=clamp(n,1,MAX_LEVELS); m.fh=Math.round(m.h/m.levels*100)/100;
    m.est=false; m.levelsSet=true; t.classList.remove('est');
    row.querySelector('.mmeta').innerHTML=meta(m);
  }
  else if(t.dataset.m==='from'){
    m.from=t.value;
    // a building's departments go to one mass only
    if(m.from) massing.rows.forEach((o,i)=>{ if(o!==m&&o.from===m.from){ o.from=''; body.querySelector('.mrow[data-i="'+i+'"] select').value=''; } });
    // a name the user has not typed follows the building picked
    if(m.from&&!m.edited){
      m.name=BUILDINGS.find(b=>b.id===m.from).name; m.anon=false;
      const nm=row.querySelector('.mname'); nm.value=m.name; nm.classList.remove('est');
      row.querySelector('.mmeta').innerHTML=meta(m);
    }
  }
  updateMassing();
}

export function bindImport(){
  dlg=$('#importDlg'); body=$('#importBody'); ok=$('#importOk'); okProg=$('#importOkProg');
  // applies the massing, then opens the program file picker while the click still counts as a gesture
  okProg.addEventListener('click',()=>{
    const c=commit; commit=null;
    dlg.close('ok');
    if(c) c();
    chooseImportFile();
  });
  [$('#importFile'),$('#massFile')].forEach(input=>input.addEventListener('change',()=>{
    const file=input.files[0]; input.value='';
    if(file) importFile(file);
  }));
  body.addEventListener('input',e=>{ if(massing) onMassInput(e); });
  body.addEventListener('change',e=>{ if(massing&&e.target.dataset.m==='levels'&&!(parseInt(e.target.value,10)>=1)) e.target.value=massing.rows[+e.target.closest('.mrow').dataset.i].levels; });
  // Enter in a field would submit the form with its first button, Cancel
  body.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.matches('input')) e.preventDefault(); });
  // The import is applied on the submit itself: the close event comes a task later, and by then the
  // next import may have opened the dialog again, so a close event that finds it open is stale.
  dlg.querySelector('form').addEventListener('submit',e=>{
    if(e.submitter&&e.submitter.value==='ok'&&commit){ const c=commit; commit=null; c(); }
  });
  dlg.addEventListener('close',()=>{
    if(dlg.open) return;
    commit=null; massing=null;
  });
}

export function chooseImportFile(){ $('#importFile').click(); }
export function chooseMassingFile(){ $('#massFile').click(); }

export function loadDemo(){
  if(window.confirm('Replace the current project with the demo campus?')) openProject(DEMO);
}
