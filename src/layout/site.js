import {BUILDINGS} from '../data/project.js';
import {S} from '../scene/constants.js';

/* campus extent in scene units: footprint centre, half-diagonal of the footprint, tallest building */
export function campusBounds(){
  let x0=Infinity, x1=-Infinity, z0=Infinity, z1=-Infinity, h=0;
  BUILDINGS.forEach(b=>{
    x0=Math.min(x0,b.x-b.w/2); x1=Math.max(x1,b.x+b.w/2);
    z0=Math.min(z0,b.z-b.d/2); z1=Math.max(z1,b.z+b.d/2);
    h=Math.max(h,b.levels.length*b.fh);
  });
  return {cx:(x0+x1)/2*S, cz:(z0+z1)/2*S, r:Math.hypot(x1-x0,z1-z0)/2*S, h:h*S};
}
