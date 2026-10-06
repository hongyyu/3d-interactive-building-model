import {DEMO} from '../data/demo.js';
import {readProgramFile} from '../data/importer.js';
import {$,esc,fmt} from '../util.js';
import {openProject} from './actions.js';

const MAX_NOTES=12;
let dlg, body, ok, pending=null;

/* Reads the chosen file and shows a summary. The project is replaced only when the user
   confirms with "Replace project". */
async function importFile(file){
  pending=null; ok.hidden=true;
  body.innerHTML=heading(file.name)+'<p class="note">Reading…</p>';
  if(!dlg.open) dlg.showModal();
  let r;
  try{ r=await readProgramFile(file); }
  catch(err){ r={project:null,errors:['This file could not be read. Use an Excel workbook (.xlsx) or a CSV file.'],warnings:[]}; }
  pending=r.project;
  ok.hidden=!pending;
  body.innerHTML=summaryHTML(file.name,r);
}

function heading(name){
  return '<div><p class="eyebrow">Import</p><h2 class="title" id="importTitle">'+esc(name)+'</h2></div>';
}

function list(items){
  const shown=items.slice(0,MAX_NOTES).map(m=>'<li>'+esc(m)+'</li>').join('');
  return '<ul>'+shown+(items.length>MAX_NOTES?'<li>…and '+(items.length-MAX_NOTES)+' more</li>':'')+'</ul>';
}

function summaryHTML(name,r){
  let h=heading(name);
  if(!r.project) return h+'<div class="msgs err"><b>This file can’t be imported</b>'+list(r.errors)+'</div>';
  const s=r.summary;
  h+='<dl class="kv"><div><dt>Departments</dt><dd>'+s.departments+'</dd></div><div><dt>Total program</dt><dd>'+fmt(s.totalSF)+' SF</dd></div>'+
     '<div><dt>Buildings</dt><dd>'+s.buildings+(s.keptBuildings?' (current)':'')+'</dd></div>'+
     '<div><dt>Placed · unassigned</dt><dd>'+s.placed+' · '+s.unassigned+'</dd></div></dl>';
  if(r.warnings.length) h+='<div class="msgs"><b>'+r.warnings.length+' note'+(r.warnings.length>1?'s':'')+'</b>'+list(r.warnings)+'</div>';
  if(s.keptBuildings) h+='<p class="note">The file has no Buildings sheet, so the current buildings are kept.</p>';
  return h+'<p class="note">Importing replaces the current project, including changes made in the app.</p>';
}

export function bindImport(){
  dlg=$('#importDlg'); body=$('#importBody'); ok=$('#importOk');
  const input=$('#importFile');
  input.addEventListener('change',()=>{
    const file=input.files[0]; input.value='';
    if(file) importFile(file);
  });
  dlg.addEventListener('close',()=>{
    if(dlg.returnValue==='ok'&&pending) openProject(pending);
    pending=null;
  });
}

export function chooseImportFile(){ $('#importFile').click(); }

export function loadDemo(){
  if(window.confirm('Replace the current project with the demo campus?')) openProject(DEMO);
}
