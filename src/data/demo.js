/* Fictional demo program. Edit this file to load a different program,
   but keep real client data out of this public repo. */
export const PROJECT={title:'3D Interactive Building Model',sub:'Fictional demo campus · placeholder figures'};
export const CATS={
  crit:{name:'Emergency & Critical Care',color:'#e0554e'},
  inpt:{name:'Inpatient Units',color:'#5fb27f'},
  proc:{name:'Procedural & Surgical',color:'#26a5a0'},
  diag:{name:'Diagnostic & Imaging',color:'#5b7fe0'},
  amb:{name:'Ambulatory & Clinics',color:'#eeab3d'},
  supp:{name:'Support & Plant',color:'#8d96a6'},
  pub:{name:'Public & Admin',color:'#a478d4'}
};
/* n = name, c = category, a = area in departmental SF */
export const DEPTS={
  ed:{n:'Emergency Department',c:'crit',a:14000},
  lobby:{n:'Main Lobby & Public',c:'pub',a:6000},
  pharm:{n:'Pharmacy',c:'supp',a:3000},
  surg:{n:'Surgery Suite',c:'proc',a:15000},
  pacu:{n:'PACU & Pre-op',c:'proc',a:6000},
  spd:{n:'Sterile Processing',c:'supp',a:2500},
  img:{n:'Imaging',c:'diag',a:12000},
  cath:{n:'Interventional & Cath',c:'proc',a:7000},
  lab:{n:'Laboratory',c:'diag',a:4000},
  icu:{n:'Critical Care (ICU)',c:'crit',a:18000},
  step:{n:'Cardiac Step-down',c:'crit',a:5000},
  wn:{n:'Women & Newborn',c:'inpt',a:17000},
  msa:{n:'Med-Surg Unit A',c:'inpt',a:19000},
  msb:{n:'Med-Surg Unit B',c:'inpt',a:19000},
  bh:{n:'Behavioral Health',c:'inpt',a:16000},
  adm:{n:'Administration',c:'pub',a:5000},
  rdg:{n:'Radiology Core',c:'diag',a:22000},
  dial:{n:'Dialysis',c:'amb',a:9000},
  olab:{n:'Outpatient Lab',c:'diag',a:8000},
  asc:{n:'Ambulatory Surgery',c:'proc',a:24000},
  endo:{n:'Endoscopy',c:'proc',a:9000},
  sim:{n:'Simulation & Education',c:'pub',a:18000},
  res:{n:'Research Labs',c:'diag',a:14000},
  pc:{n:'Primary Care',c:'amb',a:12000},
  rx:{n:'Retail Pharmacy',c:'supp',a:2500},
  cafe:{n:'Café & Gathering',c:'pub',a:2500},
  inf:{n:'Oncology Infusion',c:'amb',a:11000},
  rad:{n:'Radiation Oncology',c:'diag',a:7000},
  card:{n:'Cardiology Clinic',c:'amb',a:9000},
  ortho:{n:'Orthopedics',c:'amb',a:9500},
  neuro:{n:'Neurology',c:'amb',a:8000},
  rehab:{n:'Pain & Rehab',c:'amb',a:8500},
  fp:{n:'Faculty Practice',c:'pub',a:15000},
  plant:{n:'Chillers & Boilers',c:'supp',a:7500},
  dock:{n:'Loading Dock & Materials',c:'supp',a:3000},
  elec:{n:'Electrical & Generators',c:'supp',a:8000}
};
/* w x d = floor plate in ft, fh = floor-to-floor ft, x/z = plan position in ft, levels = department ids per level (Level 1 first) */
export const BUILDINGS=[
  {id:'tower',name:'Hospital Tower',w:200,d:120,fh:17,x:-50,z:-40,
   levels:[['ed','lobby','pharm'],['surg','pacu','spd'],['img','cath','lab'],['icu','step'],['wn'],['msa'],['msb'],['bh','adm']]},
  {id:'dt',name:'Diagnostic & Treatment',w:300,d:160,fh:17,x:-50,z:140,
   levels:[['rdg','dial','olab'],['asc','endo'],['sim','res']]},
  {id:'opp',name:'Outpatient Pavilion',w:180,d:110,fh:15,x:240,z:30,
   levels:[['pc','rx','cafe'],['inf','rad'],['card','ortho'],['neuro','rehab'],['fp']]},
  {id:'cup',name:'Central Utility Plant',w:120,d:90,fh:20,x:240,z:-140,
   levels:[['plant','dock'],['elec']]}
];
