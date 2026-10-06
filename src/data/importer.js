/* Reads a program workbook (.xlsx / .xls with Program, Buildings and Categories sheets) or a
   single-sheet .csv (Program only) into a project object; see data/project.js for its shape.
   Sheets that are missing fall back to the current project's buildings and categories.
   SheetJS is loaded on first use, and the file never leaves the browser. */
import {CATS,BUILDINGS} from './project.js';

const PALETTE=['#e0554e','#5fb27f','#26a5a0','#5b7fe0','#eeab3d','#8d96a6','#a478d4','#d46f9d','#7a9a3a','#c98a4b'];
const UNCATEGORIZED={name:'Uncategorized',color:'#9aa3b2'};

/* accepted header spellings, after lower-casing and dropping '*', units in brackets and extra spaces */
const COLS={
  program:{
    name:['department','dept','department name','name'],
    sf:['sf','area','dgsf','nsf','area sf','sq ft','square feet'],
    cat:['category','cat','group'],
    bldg:['building','bldg'],
    level:['level','floor','lvl'],
    color:['color','colour'],
    notes:['notes','note','comments','comment'],
  },
  buildings:{
    name:['building','bldg','name'],
    w:['width ft','width'],
    d:['depth ft','depth'],
    fh:['floor-to-floor ft','floor-to-floor','floor to floor','floor height','fh'],
    levels:['levels','floors','stories','storeys'],
    x:['site x ft','site x','x'],
    z:['site z ft','site z','z','site y ft','site y','y'],
  },
  categories:{name:['category','name'],color:['color','colour']},
};
const REQUIRED={program:['name','sf'],buildings:['name','w','d','fh','levels'],categories:['name']};
const SHEET={program:'Program',buildings:'Buildings',categories:'Categories'};
const LABEL={program:{name:'Department',sf:'SF'},buildings:{name:'Building',w:'Width ft',d:'Depth ft',fh:'Floor-to-floor ft',levels:'Levels'},categories:{name:'Category'}};

const norm=s=>String(s).toLowerCase().replace(/\*/g,'').replace(/\(.*?\)/g,'').replace(/\s+/g,' ').trim();
const text=v=>String(v==null?'':v).trim();
function num(v){
  if(typeof v==='number') return v;
  const s=text(v).replace(/[,\s]/g,'').replace(/sf$/i,'');
  return s===''?NaN:Number(s);
}
function color(v){
  const m=/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(text(v));
  if(!m) return null;
  const h=m[1].length===3?m[1].replace(/./g,c=>c+c):m[1];
  return '#'+h.toLowerCase();
}

/* rows of a sheet as {row: Excel row number, v: {field: value}}, plus the header problems */
function readTable(XLSX,ws,kind,errors){
  const range=XLSX.utils.decode_range(ws['!ref']||'A1:A1');
  const grid=XLSX.utils.sheet_to_json(ws,{header:1,blankrows:true,defval:''});
  const hi=grid.findIndex(r=>r.some(c=>text(c)!==''));
  if(hi<0){ errors.push(`The ${SHEET[kind]} sheet is empty.`); return null; }
  const map={};
  grid[hi].forEach((h,i)=>{
    const key=Object.keys(COLS[kind]).find(k=>COLS[kind][k].includes(norm(h)));
    if(key&&!(key in map)) map[key]=i;
  });
  const missing=REQUIRED[kind].filter(k=>!(k in map));
  if(missing.length){
    errors.push(`The ${SHEET[kind]} sheet has no ${missing.map(k=>LABEL[kind][k]).join(' or ')} column. Use the column headers from the template.`);
    return null;
  }
  const rows=[];
  for(let i=hi+1;i<grid.length;i++){
    if(!grid[i].some(c=>text(c)!=='')) continue;
    const v={}; for(const k in map) v[k]=grid[i][map[k]];
    rows.push({row:range.s.r+i+1,v});
  }
  return rows;
}

function findSheet(wb,name){
  return wb.SheetNames.find(n=>norm(n)===name);
}

/* returns {project, summary, errors, warnings}; project is null when errors block the import */
export async function readProgramFile(file){
  const XLSX=await import('xlsx');
  const errors=[], warnings=[];
  const isBook=!/\.csv$/i.test(file.name), buf=await file.arrayBuffer();
  // CSV bytes must be decoded first: SheetJS would read them as Latin-1. Excel writes UTF-8
  // ("CSV UTF-8") or Windows-1252 (plain "CSV"), so try strict UTF-8 and fall back.
  let wb;
  if(isBook) wb=XLSX.read(buf,{type:'array'});
  else {
    let csv;
    try{ csv=new TextDecoder('utf-8',{fatal:true}).decode(buf); }catch(err){ csv=new TextDecoder('windows-1252').decode(buf); }
    wb=XLSX.read(csv,{type:'string'});
  }
  const progName=findSheet(wb,'program')||(wb.SheetNames.length===1?wb.SheetNames[0]:null);
  const fail=()=>({project:null,summary:null,errors,warnings});
  if(!progName){ errors.push('No "Program" sheet found.'); return fail(); }

  // categories: keyed c1, c2... by lower-case name
  const cats={}, catByName={};
  const addCat=(name,col)=>{ const k='c'+(Object.keys(cats).length+1); cats[k]={name,color:col}; catByName[name.toLowerCase()]=k; return k; };
  const catName=isBook&&findSheet(wb,'categories');
  if(catName){
    const rows=readTable(XLSX,wb.Sheets[catName],'categories',errors)||[];
    rows.forEach(({row,v})=>{
      const name=text(v.name); if(!name) return;
      if(catByName[name.toLowerCase()]){ warnings.push(`Categories row ${row}: "${name}" is listed twice; the first one is used.`); return; }
      let c=color(v.color);
      if(text(v.color)&&!c) warnings.push(`Categories row ${row}: "${text(v.color)}" is not a hex colour; a default colour is used.`);
      addCat(name,c||PALETTE[Object.keys(cats).length%PALETTE.length]);
    });
  } else {
    Object.values(CATS).forEach(c=>addCat(c.name,c.color));
  }

  // buildings: keyed b1, b2...
  const buildings=[], bByName={};
  const bName=isBook&&findSheet(wb,'buildings');
  if(bName){
    const rows=readTable(XLSX,wb.Sheets[bName],'buildings',errors);
    if(!rows) return fail();
    rows.forEach(({row,v})=>{
      const name=text(v.name);
      if(!name){ warnings.push(`Buildings row ${row}: no building name; row skipped.`); return; }
      if(bByName[name.toLowerCase()]){ warnings.push(`Buildings row ${row}: "${name}" is listed twice; the first one is used.`); return; }
      const w=num(v.w), d=num(v.d), fh=num(v.fh), n=num(v.levels);
      if(!(w>0&&d>0&&fh>0)){ warnings.push(`Buildings row ${row}: "${name}" needs Width, Depth and Floor-to-floor greater than 0; row skipped.`); return; }
      if(!(Number.isInteger(n)&&n>=1&&n<=100)){ warnings.push(`Buildings row ${row}: "${name}" needs Levels between 1 and 100; row skipped.`); return; }
      const x=num(v.x), z=num(v.z);
      const b={id:'b'+(buildings.length+1),name,w,d,fh,x:isFinite(x)?x:null,z:isFinite(z)?z:null,levels:Array.from({length:n},()=>[])};
      buildings.push(b); bByName[name.toLowerCase()]=b;
    });
  } else {
    BUILDINGS.forEach(c=>{ const b={...c,levels:c.levels.map(()=>[])}; buildings.push(b); bByName[b.name.toLowerCase()]=b; });
  }
  if(!buildings.length){ errors.push('No valid buildings. Add at least one row to the Buildings sheet.'); return fail(); }
  // buildings without a site position go in a row east of the others, 60 ft apart
  let east=Math.max(...buildings.filter(b=>b.x!=null).map(b=>b.x+b.w/2),-60);
  buildings.forEach(b=>{
    if(b.x==null||b.z==null){ b.x=east+60+b.w/2; b.z=b.z==null?0:b.z; east=b.x+b.w/2; }
  });

  // program
  const rows=readTable(XLSX,wb.Sheets[progName],'program',errors);
  if(!rows) return fail();
  const depts={}, seen={}, unassigned=[];
  let totalSF=0;
  rows.forEach(({row,v})=>{
    const name=text(v.name);
    if(!name){ warnings.push(`Program row ${row}: no department name; row skipped.`); return; }
    if(seen[name.toLowerCase()]){ warnings.push(`Program row ${row}: "${name}" is listed twice; the first one is used.`); return; }
    const a=num(v.sf);
    if(!(a>0)){ warnings.push(`Program row ${row}: "${name}" has no SF greater than 0; row skipped.`); return; }
    seen[name.toLowerCase()]=true;
    const cn=text(v.cat);
    let c=cn?catByName[cn.toLowerCase()]:null;
    if(!c&&cn){ c=addCat(cn,PALETTE[Object.keys(cats).length%PALETTE.length]); warnings.push(`Program row ${row}: new category "${cn}" created.`); }
    if(!c) c=catByName[UNCATEGORIZED.name.toLowerCase()]||addCat(UNCATEGORIZED.name,UNCATEGORIZED.color);
    const id='d'+(Object.keys(depts).length+1);
    const d={n:name,c,a:Math.round(a)};
    const col=color(v.color);
    if(col) d.color=col; else if(text(v.color)) warnings.push(`Program row ${row}: "${text(v.color)}" is not a hex colour; the category colour is used.`);
    if(text(v.notes)) d.notes=text(v.notes);
    depts[id]=d; totalSF+=d.a;

    const bn=text(v.bldg), lm=/(\d+)/.exec(text(v.level)), f=lm?parseInt(lm[1],10)-1:-1;
    const b=bn?bByName[bn.toLowerCase()]:null;
    if(bn&&!b) warnings.push(`Program row ${row}: building "${bn}" not found; "${name}" goes to Unassigned.`);
    else if(b&&f>=b.levels.length) warnings.push(`Program row ${row}: ${b.name} has no Level ${f+1}; "${name}" goes to Unassigned.`);
    else if(b&&lm&&f<0) warnings.push(`Program row ${row}: Level must be 1 or higher; "${name}" goes to Unassigned.`);
    if(b&&f>=0&&f<b.levels.length) b.levels[f].push(id);
    else unassigned.push(id);
  });
  const nDepts=Object.keys(depts).length;
  if(!nDepts){ errors.push('No valid departments on the Program sheet.'); return fail(); }
  if(unassigned.length) warnings.unshift(`${unassigned.length} department${unassigned.length>1?'s have':' has'} no building or level and will wait in the Unassigned tray.`);

  const project={title:'3D Interactive Building Model',sub:file.name+' · imported',cats,depts,buildings,unassigned};
  const summary={file:file.name,departments:nDepts,totalSF,buildings:buildings.length,
    placed:nDepts-unassigned.length,unassigned:unassigned.length,keptBuildings:!bName,keptCategories:!catName};
  return {project,summary,errors,warnings};
}
