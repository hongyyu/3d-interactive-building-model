// Generates public/templates/program_template.xlsx from the demo project.
// Runs before `npm run dev` and `npm run build`; the output is not committed.
// The sheet and column names here are what src/data/importer.js reads back.
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import {DEMO} from '../src/data/demo.js';

const OUT = new URL('../public/templates/program_template.xlsx', import.meta.url);
const ROWS = 1000; // rows that get dropdowns and number checks

const wb = new ExcelJS.Workbook();
wb.creator = '3D Interactive Building Model';

function sheet(name, columns) {
  const ws = wb.addWorksheet(name, {views: [{state: 'frozen', ySplit: 1}]});
  ws.columns = columns.map(([header, width, numFmt]) => ({header, width, style: numFmt ? {numFmt} : {}}));
  const head = ws.getRow(1);
  head.font = {bold: true};
  head.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFEEF0F4'}};
  return ws;
}

function validate(ws, col, rule) {
  for (let r = 2; r <= ROWS; r++) ws.getCell(col + r).dataValidation = rule;
}

const positive = (title) => ({type: 'decimal', operator: 'greaterThan', formulae: [0], allowBlank: true,
  showErrorMessage: true, errorTitle: title, error: 'Enter a number greater than 0.'});

// Instructions
const info = wb.addWorksheet('Instructions');
info.getColumn(1).width = 110;
[
  ['3D Interactive Building Model: program template', {bold: true, size: 14}],
  [''],
  ['How to use', {bold: true}],
  ['1. Buildings sheet: one row per building.'],
  ['2. Categories sheet (optional): one row per category, with a hex colour such as #E0554E.'],
  ['3. Program sheet: one row per department.'],
  ['4. In the app, click "Import…" and choose this file. It is read in your browser and never uploaded.'],
  ['Columns marked * are required. Areas are in square feet (SF); dimensions are in feet.'],
  ['The example rows are a fictional demo campus. Replace them with your own data.'],
  [''],
  ['Program sheet', {bold: true}],
  ['Department*: unique name.  SF*: departmental area in SF.'],
  ['Category: pick one from the Categories sheet. A new name creates a new category; blank means Uncategorized.'],
  ['Building and Level: where the department sits. Level 1 is the ground floor.'],
  ['Leave Level blank (or Building blank) to put the department in the Unassigned tray, then place it in the app.'],
  ['Departments on the same level are laid out in row order.'],
  ['Color: optional hex colour that overrides the category colour.  Notes: shown when the department is selected.'],
  [''],
  ['Buildings sheet', {bold: true}],
  ['Building*: unique name.  Width* and Depth*: floor plate in ft.  Floor-to-floor*: in ft.  Levels*: number of floors.'],
  ['Site X and Site Z: position of the building centre on the site plan, in ft. Leave both blank to line buildings up in a row.'],
].forEach(([text, font]) => { const row = info.addRow([text]); if (font) row.font = font; });

// Program
const program = sheet('Program', [
  ['Department*', 32], ['SF*', 12, '#,##0'], ['Category', 28], ['Building', 26], ['Level', 8], ['Color', 11], ['Notes', 40],
]);
DEMO.buildings.forEach(b => b.levels.forEach((ids, f) => ids.forEach(id => {
  const d = DEMO.depts[id];
  program.addRow([d.n, d.a, DEMO.cats[d.c].name, b.name, f + 1, d.color || '', d.notes || '']);
})));
validate(program, 'B', positive('SF'));
validate(program, 'C', {type: 'list', allowBlank: true, formulae: ['Categories!$A$2:$A$200'], showErrorMessage: false});
validate(program, 'D', {type: 'list', allowBlank: true, formulae: ['Buildings!$A$2:$A$100'], showErrorMessage: true,
  errorStyle: 'warning', errorTitle: 'Building', error: 'This building is not on the Buildings sheet. The department will go to the Unassigned tray.'});
validate(program, 'E', {type: 'whole', operator: 'between', formulae: [1, 200], allowBlank: true,
  showErrorMessage: true, errorTitle: 'Level', error: 'Enter a level number: 1 is the ground floor.'});

// Buildings
const buildings = sheet('Buildings', [
  ['Building*', 26], ['Width ft*', 11, '#,##0'], ['Depth ft*', 11, '#,##0'], ['Floor-to-floor ft*', 18],
  ['Levels*', 9], ['Site X ft', 11], ['Site Z ft', 11],
]);
DEMO.buildings.forEach(b => buildings.addRow([b.name, b.w, b.d, b.fh, b.levels.length, b.x, b.z]));
['B', 'C', 'D'].forEach(c => validate(buildings, c, positive('Dimension')));
validate(buildings, 'E', {type: 'whole', operator: 'between', formulae: [1, 100], allowBlank: true,
  showErrorMessage: true, errorTitle: 'Levels', error: 'Enter the number of floors (1 to 100).'});

// Categories
const cats = sheet('Categories', [['Category', 30], ['Color', 11]]);
Object.values(DEMO.cats).forEach(c => {
  const row = cats.addRow([c.name, c.color.toUpperCase()]);
  row.getCell(2).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF' + c.color.slice(1).toUpperCase()}};
});

fs.mkdirSync(new URL('.', OUT), {recursive: true});
await wb.xlsx.writeFile(OUT.pathname);
console.log('wrote', OUT.pathname.replace(process.cwd() + '/', ''));
