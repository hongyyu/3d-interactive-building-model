# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Interactive massing and stacking diagram for a medical campus program (v0.1 prototype). It's a Vite app written in vanilla JS ES modules. Three.js is pinned to **r128** (`three@0.128.0` from npm).

```sh
npm install
npm run dev       # dev server on :5173 with hot reload
npm run build     # production build into dist/
npm run preview   # serve dist/
```

There is no lint or test tooling. Vite 8 needs Node 20.19+ or 22.12+.

- **Deploy:** every push to `main` runs `.github/workflows/pages.yml`, which runs `npm ci` and `npm run build`, then publishes `dist/` to GitHub Pages at https://hongyyu.github.io/3d-interactive-building-model/. `vite.config.js` uses `base: './'` so asset paths work under that subpath. Only `dist/` is served. Static files that must ship as-is (such as planned import templates) go in `public/`.
- **Roadmap:** `FEATURE_PLAN.md` describes the planned phases: CSV/XLSX program import, layout options and compare, JPEG/CSV export, Rhino `.3dm` import and vertical circulation. Upgrading Three.js beyond r128 is a Phase 3 task. Until then, stick to the r128 API, and import any addons from `three/examples/jsm/...` of 0.128.0.
- **Data privacy constraint:** the repo and the Pages site are public. `src/data/demo.js` must hold only the fictional demo program, so never commit real client data. User files are parsed in the browser and never uploaded. There is no backend.

## Architecture

`index.html` holds only markup. `src/main.js` runs the frame loop and boots the app, but only if `scene/scene.js` managed to create a WebGL renderer (`renderer` is null otherwise).

| Folder | Contents |
|---|---|
| `src/data/` | The program |
| `src/layout/` | Stacking and fit logic |
| `src/scene/` | Three.js objects, camera and per-frame updates |
| `src/ui/` | Panels, state-change actions and input |
| `src/state.js`, `src/dom.js`, `src/util.js` | Shared state, element refs, helpers |

**Data** (`data/demo.js`): `PROJECT`, `CATS` (category → name and color), `DEPTS` (id → `{n: name, c: category, a: area SF}`) and `BUILDINGS` (floor plate `w`×`d` ft, floor-to-floor `fh`, site `x`/`z`, and `levels`, an array of dept-id arrays with Level 1 first). Data is in feet. The scene scale is `S = 0.1` (`scene/constants.js`), so 1 scene unit = 10 ft.

**State** (`state.js`): `state.levels[buildingId]` is the source of truth for stacking. Area edits change `DEPTS[id].a` in place. `INIT_LEVELS` and `INIT_AREAS` are snapshots used by "Reset layout". `B` and `D` (`scene/scene.js`) hold the per-building and per-department runtime records: meshes, materials, overlay elements and animation values.

**Shared mutable variables:** a value that is reassigned across modules is an exported `let`. Only its home module reassigns it, because ES module imports are read-only and assigning to one from another module throws.
- `drag` and `hoverId` live in `state.js` and change through `setDrag` and `setHoverId`.
- `viewRate` lives in `scene/view.js` and changes through `setViewRate`.
- `explode`, `explodeT`, `gridT`, `SW` and `SH` live in `scene/view.js` and change only there.

Mutating properties (for example `drag.ov = …` or `viewT.s = …`) works from any module.

**Layout** (`layout/plan.js`, `planFloor` / `relayout`): each level is cut into strips along the plate width, sized in proportion to department SF. Each strip uses the plate's full depth. The divisor is `max(plate, total)`, so an over-full level squeezes its departments, and leftover width becomes a translucent "void" box. A level is over capacity when its total SF > `w*d`.

**Animation model:** values come in target/current pairs, and each frame eases the current value toward the target with exponential smoothing (`k`). With `prefers-reduced-motion`, `k = 1` and values snap.
- Departments: `tx/vx`, `tf/vf` (level, fractional while animating), `tw/vw`. Eased in `scene/update.js`.
- Camera: `viewT` / `view`. FOV and size are interpolated in log space. Eased by `stepView()` in `scene/view.js`.
- Explode: `explodeT` / `explode`. Also eased by `stepView()`.

`relayout()` only sets targets. `relayout(true)` also snaps the current values. After any state change, call `relayout(...)` and then `refreshUI()`. The functions in `ui/actions.js` already do this.

**View modes** (`mass`, `axon`, `stack`) share one scene and one `PerspectiveCamera`. They differ only in data:
- `EXPLODE` multiplies the floor pitch.
- `GRIDOP` sets grid opacity.
- `targetView()` sets the camera.

Axon and Section Stack get their near-orthographic look from a tiny FOV (4° and 3.2°) and a large camera distance, not from an OrthographicCamera. Only the selected building (`state.sel`) shows department meshes. The other buildings render as plain shells and fade out outside `mass` mode.

**Dragging** (`ui/pointer.js`): while a drag is in progress, `drag.ov` holds a preview placement `{b, id, f, idx}`. `levelsWithOverride()` applies it during layout without changing `state.levels`. `commitDrag()` writes it to `state.levels`, and `cancelDrag()` (also bound to Escape) discards it. The drag plane is vertical and faces the camera, and the target level comes from the Y position.

**Labels and tags are HTML, not WebGL** (`scene/overlay.js`): department labels (`.lbl`), building tags (`.btag`) and floor tags (`.ftag`) are DOM elements inside `#overlay`. `updateOverlay()` positions them every frame by projecting 3D points to screen space. Any future image export has to redraw them, because they are not part of the canvas.

**Panels** (`ui/panels.js`): `renderLeft()` and `renderRight()` rebuild their `innerHTML` from strings. Pass every program or user string through `esc()`. Clicks are handled in `ui/controls.js` by delegated listeners on `#left`, `#right`, `#overlay`, `#modes` and `#tools`, keyed off `data-b`, `data-dept`, `data-cat`, `data-act` and `data-mode` attributes. New controls should follow the same pattern.

**Input** (`ui/pointer.js`): camera controls are custom pointer handling (there is no OrbitControls). A small `gesture` state machine handles orbit, pan (right-drag, Shift, or any drag in stack mode), two-finger pinch, wheel zoom, and click-vs-drag on departments and building shells. The click/drag threshold is 5 px.

**Styling** (`src/style.css`): design tokens are CSS custom properties on `:root` (`--ink*`, `--line*`, `--alert`, `--ui`, `--mono`). The layout is a three-column grid that collapses to one column below 960px. `.app.present` hides both side panels.
