import {PROJECT} from './data/demo.js';
import {$,RM} from './util.js';
import {stage,hintEl} from './dom.js';
import {renderer,scene,camera,buildScene} from './scene/scene.js';
import {retarget,snapView,stepView,updateCamera,resize} from './scene/view.js';
import {updateScene} from './scene/update.js';
import {rebuildFloorTags,updateOverlay} from './scene/overlay.js';
import {relayout} from './layout/plan.js';
import {refreshUI} from './ui/panels.js';
import {HINTS} from './ui/actions.js';
import {bindControls} from './ui/controls.js';
import {bindPointer} from './ui/pointer.js';

$('#ptitle').textContent=PROJECT.title; $('#psub').textContent=PROJECT.sub;

/* ---------- loop ---------- */
let lastT=performance.now();
function frame(now){
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
  const k=RM?1:1-Math.exp(-dt*10);
  stepView(dt);
  updateCamera();
  updateScene(k);
  updateOverlay();
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
function boot(){
  buildScene();
  bindControls();
  bindPointer();
  resize();
  relayout(true);
  rebuildFloorTags();
  refreshUI();
  hintEl.textContent=HINTS.mass;
  retarget(false); snapView();
  if('ResizeObserver' in window){
    let rt=0;
    new ResizeObserver(()=>{ resize(); clearTimeout(rt); rt=setTimeout(()=>{ retarget(true); },60); }).observe(stage);
  } else window.addEventListener('resize',()=>{ resize(); retarget(true); });
  requestAnimationFrame(frame);
}

if(renderer) boot();
else stage.insertAdjacentHTML('beforeend','<p class="nogl">The 3D view needs WebGL, which is not available in this browser.</p>');
