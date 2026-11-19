import {CATS,DEPTS} from '../data/project.js';
import {state,BDEF,deptNameTaken} from '../state.js';
import {rightEl} from '../dom.js';
import {$,esc,fmt} from '../util.js';
import {floorStat} from '../layout/plan.js';
import {addDept} from './actions.js';

/* ---------- Add department dialog ----------
   "+ Add department" in the Levels heading, or "Add department here…" in a level's ⋯ menu, opens it
   for the selected building. It asks for the name (which must be new, like the importer wants it),
   category, area and level, and the summary says how full that level gets. addDept() places the
   department and selects it, so its card opens for any further edits. */
let dlg, fName, fCat, fArea, fLvl, sum, bid=null;
const DEFAULT_SF=5000;

function defaultName(){
  let n='New department', k=1;
  while(deptNameTaken(n)) n='New department '+(++k);
  return n;
}
/* the level with the most free area, the lowest one on a tie */
function roomiest(){
  const n=state.levels[bid].length;
  let best=0, free=-Infinity;
  for(let f=0;f<n;f++){ const s=floorStat(bid,f), r=s.plate-s.total; if(r>free){ free=r; best=f; } }
  return best;
}
function values(){
  return {name:fName.value.trim().replace(/\s+/g,' '),c:fCat.value,a:fArea.valueAsNumber,f:parseInt(fLvl.value,10)};
}
function check(){
  const v=values();
  fName.setCustomValidity(!v.name?'Enter a name for the department.':deptNameTaken(v.name)?'Another department already has this name.':'');
  if(!fArea.validity.valid){ sum.textContent=''; return; }
  if(v.f<0){ sum.textContent='It waits in the Unassigned tray until you place it.'; return; }
  const s=floorStat(bid,v.f), tot=s.total+v.a;
  sum.textContent='Level '+(v.f+1)+' then holds '+fmt(tot)+' of its '+fmt(s.plate)+' SF'+(tot>s.plate+0.5?', over by '+fmt(tot-s.plate)+' SF.':'.');
}
/* opens the dialog for the selected building; f picks the level, otherwise the roomiest one */
export function openAddDept(f){
  if(dlg.open||!BDEF[state.sel]) return;
  bid=state.sel;
  const n=state.levels[bid].length;
  $('#ddKind').textContent=BDEF[bid].name;
  fName.value=defaultName();
  let cats=''; for(const k in CATS) cats+='<option value="'+k+'">'+esc(CATS[k].name)+'</option>';
  fCat.innerHTML=cats;
  // a new department takes the category of the selected one, so a run of similar ones is quick
  const sd=state.selDept&&DEPTS[state.selDept];
  if(sd) fCat.value=sd.c;
  fArea.value=DEFAULT_SF;
  let lv=''; for(let k=n-1;k>=0;k--) lv+='<option value="'+k+'">Level '+(k+1)+'</option>';
  fLvl.innerHTML=lv+'<option value="-1">Unassigned</option>';
  fLvl.value=String(f!=null&&f>=0&&f<n?f:roomiest());
  check();
  dlg.showModal();
  fName.select();
}

export function bindDeptDialog(){
  dlg=$('#deptDlg'); sum=$('#ddSum');
  fName=$('#ddName'); fCat=$('#ddCat'); fArea=$('#ddArea'); fLvl=$('#ddLvl');
  const form=$('#deptForm');
  form.addEventListener('input',check);
  form.addEventListener('change',check);
  let added=false;
  form.addEventListener('submit',e=>{
    if(!e.submitter||e.submitter.value!=='ok') return;
    const v=values();
    added=addDept(v,bid,v.f)!=null;
  });
  // the panel was rebuilt, so focus goes back to the new "+ Add department" button
  dlg.addEventListener('close',()=>{
    if(!added) return;
    added=false;
    const b=rightEl.querySelector('[data-act=adddept]'); if(b) b.focus();
  });
}
