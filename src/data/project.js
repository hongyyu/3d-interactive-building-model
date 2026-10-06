/* The loaded project. setProjectData() refills these containers in place, so modules import
   them once and always see the current project.
   Project shape: {title, sub, demo?, cats:{key:{name,color}}, depts:{id:{n,c,a,color?,notes?}},
   buildings:[{id,name,w,d,fh,x,z,levels:[[deptId,...],...]}], unassigned:[deptId,...]} */
export const PROJECT={}, CATS={}, DEPTS={}, BUILDINGS=[], UNASSIGNED=[];

function clear(o){ for(const k in o) delete o[k]; }

/* copies p, so edits made in the app never change the source object (e.g. DEMO) */
export function setProjectData(p){
  clear(PROJECT); clear(CATS); clear(DEPTS); BUILDINGS.length=0; UNASSIGNED.length=0;
  PROJECT.title=p.title; PROJECT.sub=p.sub; PROJECT.demo=!!p.demo;
  for(const k in p.cats) CATS[k]={...p.cats[k]};
  for(const k in p.depts) DEPTS[k]={...p.depts[k]};
  p.buildings.forEach(b=>BUILDINGS.push({...b,levels:b.levels.map(a=>a.slice())}));
  p.unassigned.forEach(id=>UNASSIGNED.push(id));
}

/* a department's own colour overrides its category colour */
export function deptColor(id){ const d=DEPTS[id]; return d.color||CATS[d.c].color; }
