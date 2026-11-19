/* Builds a fictional Rhino massing of the demo campus in memory, for the .3dm import test. Each
   demo building is modelled a different way, the way massing models tend to be:
   - Hospital Tower: one extrusion with User Text levels = 8;
   - Diagnostic & Treatment: three stacked floor boxes;
   - Outpatient Pavilion: a closed mesh on its own layer, User Text floor_to_floor on the layer;
   - Central Utility Plant: a plain box, so its level count comes from its height.
   Plus a neighbour on a Context layer, a box with no name, a site outline, and a hidden box. The model is in metres
   and turned 20°, so the importer has to convert and turn it back. */
import {createRequire} from 'node:module';
import {DEMO} from '../src/data/demo.js';

const require = createRequire(import.meta.url);
const M = 0.3048, TURN = 20 * Math.PI / 180;

export async function demoMassing() {
  const rh = await require('rhino3dm')();
  const doc = new rh.File3dm();
  doc.settings().modelUnitSystem = rh.UnitSystem.Meters;
  const layer = (name, parent, user) => {
    const l = new rh.Layer(); l.name = name;
    if (parent != null) l.parentLayerId = doc.layers().findIndex(parent).id;
    if (user) for (const k in user) l.setUserString(k, String(user[k]));
    return doc.layers().add(l);
  };
  const massing = layer('Massing'), context = layer('Context');
  const attrs = (li, name, user, hidden) => {
    const a = new rh.ObjectAttributes(); a.layerIndex = li;
    if (name) a.name = name;
    if (user) for (const k in user) a.setUserString(k, String(user[k]));
    if (hidden) a.visible = false;
    return a;
  };
  // demo feet to model metres; demo z is Rhino -Y; then turned about the origin
  const place = g => { g.scale(M); g.rotate(TURN, [0, 0, 1], [0, 0, 0]); return g; };
  const box = (b, z0, z1) => place(rh.Brep.createFromBoundingBox(new rh.BoundingBox([b.x - b.w / 2, -b.z - b.d / 2, z0], [b.x + b.w / 2, -b.z + b.d / 2, z1])));
  const [tower, dt, opp, cup] = DEMO.buildings;
  const objs = doc.objects();

  const outline = rh.Curve.createControlPointCurve([[-tower.w / 2, -tower.d / 2, 0], [tower.w / 2, -tower.d / 2, 0], [tower.w / 2, tower.d / 2, 0], [-tower.w / 2, tower.d / 2, 0], [-tower.w / 2, -tower.d / 2, 0]].map(p => [p[0] + tower.x, p[1] - tower.z, 0]), 1);
  objs.add(place(rh.Extrusion.create(outline, tower.levels.length * tower.fh, true)), attrs(massing, tower.name, {levels: tower.levels.length}));

  const dtLayer = layer(dt.name, massing);
  dt.levels.forEach((_, f) => objs.add(box(dt, f * dt.fh, (f + 1) * dt.fh), attrs(dtLayer)));

  const oppLayer = layer(opp.name, massing, {floor_to_floor: opp.fh * M});
  const mesh = new rh.Mesh(), H = opp.levels.length * opp.fh;
  [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0], [-1, -1, H], [1, -1, H], [1, 1, H], [-1, 1, H]]
    .forEach(([sx, sy, z]) => mesh.vertices().add(opp.x + sx * opp.w / 2, -opp.z + sy * opp.d / 2, z));
  [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]].forEach(f => mesh.faces().addQuadFace(...f));
  objs.add(place(mesh), attrs(oppLayer));

  objs.add(box(cup, 0, cup.levels.length * cup.fh), attrs(massing, cup.name));

  // not part of the project
  objs.add(box({x: -400, z: 0, w: 120, d: 120}, 0, 60), attrs(context, 'Neighbour'));
  objs.add(place(rh.Curve.createControlPointCurve([[-600, -400, 0], [600, -400, 0], [600, 400, 0], [-600, 400, 0], [-600, -400, 0]], 1)), attrs(context));
  objs.add(box({x: 600, z: 0, w: 80, d: 80}, 0, 40), attrs(massing, 'Hidden box', null, true));
  // no object name, on a layer whose name says nothing about it: the importer names it Building 1
  objs.add(box({x: 600, z: 300, w: 100, d: 100}, 0, 40), attrs(massing));
  return Buffer.from(doc.toByteArray());
}
