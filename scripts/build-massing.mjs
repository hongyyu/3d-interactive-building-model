// Generates public/templates/campus_massing.3dm, a Rhino massing of the demo campus, from the demo
// project. Each building is one closed box on its own layer under Massing, named after the building,
// with User Text levels and floor_to_floor so it imports back exactly; a site outline on the Site
// layer shows that flat objects are left out. Units are feet; Rhino's Y axis is the app's -z.
import {mkdirSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {DEMO} from '../src/data/demo.js';

const require = createRequire(import.meta.url);
const OUT = new URL('../public/templates/campus_massing.3dm', import.meta.url);
const rh = await require('rhino3dm')();

const doc = new rh.File3dm();
doc.settings().modelUnitSystem = rh.UnitSystem.Feet;
doc.applicationName = '3D Interactive Building Model';
const layer = (name, color, parent) => {
  const l = new rh.Layer();
  l.name = name; l.color = color;
  if (parent != null) l.parentLayerId = doc.layers().findIndex(parent).id;
  return doc.layers().add(l);
};
const massing = layer('Massing', {r: 120, g: 128, b: 140, a: 255});
let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
DEMO.buildings.forEach(b => {
  const n = b.levels.length, X0 = b.x - b.w / 2, X1 = b.x + b.w / 2, Y0 = -b.z - b.d / 2, Y1 = -b.z + b.d / 2;
  const a = new rh.ObjectAttributes();
  a.layerIndex = layer(b.name, {r: 200, g: 205, b: 212, a: 255}, massing);
  a.name = b.name;
  a.setUserString('levels', String(n));
  a.setUserString('floor_to_floor', String(b.fh));
  doc.objects().add(rh.Brep.createFromBoundingBox(new rh.BoundingBox([X0, Y0, 0], [X1, Y1, n * b.fh])), a);
  x0 = Math.min(x0, X0); x1 = Math.max(x1, X1); y0 = Math.min(y0, Y0); y1 = Math.max(y1, Y1);
});
const site = new rh.ObjectAttributes();
site.layerIndex = layer('Site', {r: 90, g: 160, b: 90, a: 255});
site.name = 'Site boundary';
const m = 60;
doc.objects().add(rh.Curve.createControlPointCurve([[x0 - m, y0 - m, 0], [x1 + m, y0 - m, 0], [x1 + m, y1 + m, 0], [x0 - m, y1 + m, 0], [x0 - m, y0 - m, 0]], 1), site);

mkdirSync(new URL('.', OUT), {recursive: true});
writeFileSync(OUT, doc.toByteArray());
console.log('wrote', OUT.pathname);
