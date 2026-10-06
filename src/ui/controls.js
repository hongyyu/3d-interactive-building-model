import {DEPTS} from '../data/project.js';
import {state} from '../state.js';
import {leftEl,rightEl,overlay} from '../dom.js';
import {$} from '../util.js';
import {retarget,setViewRate} from '../scene/view.js';
import {renderLeft,renderRight} from './panels.js';
import {selectBuilding,selectDept,setMode,setArea,moveDeptToLevel,resetLayout} from './actions.js';
import {bindImport,chooseImportFile,loadDemo} from './importDialog.js';

/* panel, overlay and toolbar clicks */
export function bindControls(){
  bindImport();
  leftEl.addEventListener('click',e=>{
    const bc=e.target.closest('[data-b]'); if(bc){ selectBuilding(bc.dataset.b,true); return; }
    const cat=e.target.closest('[data-cat]'); if(cat){ state.isolate=(state.isolate===cat.dataset.cat)?null:cat.dataset.cat; renderLeft(); return; }
    if(e.target.closest('[data-act="campus"]')){ state.focus='campus'; if(state.mode!=='mass'){ setMode('mass'); } else { retarget(false); setViewRate(3.2); } }
    else if(e.target.closest('[data-act="demo"]')) loadDemo();
  });
  rightEl.addEventListener('click',e=>{
    const dp=e.target.closest('[data-dept]'); if(dp){ selectDept(dp.dataset.dept); return; }
    const act=e.target.closest('[data-act]'); if(!act)return;
    const a=act.dataset.act, id=state.selDept;
    if(a==='desel'){ state.selDept=null; renderRight(); }
    else if(a==='inc'&&id) setArea(id,DEPTS[id].a+500);
    else if(a==='dec'&&id) setArea(id,DEPTS[id].a-500);
  });
  rightEl.addEventListener('change',e=>{
    if(e.target.id==='area') setArea(state.selDept,parseFloat(e.target.value));
    else if(e.target.id==='lvl') moveDeptToLevel(state.selDept,parseInt(e.target.value,10));
  });
  overlay.addEventListener('click',e=>{
    const t=e.target.closest('.btag'); if(t) selectBuilding(t.dataset.b,true);
  });
  $('#modes').addEventListener('click',e=>{
    const b=e.target.closest('button[data-mode]'); if(b) setMode(b.dataset.mode);
  });
  $('#tools').addEventListener('click',e=>{
    const b=e.target.closest('button[data-act]'); if(!b)return;
    const a=b.dataset.act;
    if(a==='labels'){ state.labels=!state.labels; b.setAttribute('aria-pressed',String(state.labels)); }
    else if(a==='resetview'){ retarget(false); setViewRate(3.2); }
    else if(a==='resetlayout') resetLayout();
    else if(a==='import') chooseImportFile();
    else if(a==='present'){
      const on=!$('#app').classList.contains('present');
      $('#app').classList.toggle('present',on); b.setAttribute('aria-pressed',String(on));
    }
  });
}
