# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Interactive massing and stacking diagram for a medical campus program (v0.1 prototype). The whole app is one self-contained `index.html`: inline CSS, plus one inline script that uses Three.js **r128** as a global (`THREE`) loaded from cdnjs. There is no package.json and no build, lint or test tooling.

- **Run:** open `index.html` in a browser (`open index.html`). Reload to see changes.
- **Deploy:** GitHub Pages, deployed from the branch root, so `index.html` must stay at the repo root.
- **Roadmap:** `FEATURE_PLAN.md` describes the planned phases: CSV/XLSX program import, layout options and compare, JPEG/CSV export, Rhino `.3dm` import and vertical circulation. It also proposes a later move to Vite with a `src/{data,layout,scene,ui}` split and an upgrade to current Three.js. Until that migration happens, keep everything in the single file and stick to the r128 API: no ES module imports, and no `three/examples` addons such as OrbitControls.
- **Data privacy constraint (from the plan):** the hosted site must contain only the tool and fictional sample data. User files are parsed in the browser and never uploaded. There is no backend.

## Architecture of `index.html`

The script is one IIFE, split into sections by `/* ---------- name ---------- */` comment headers.

**Data block** (`DATA` comment at the top): `PROJECT`, `CATS` (category → name and color), `DEPTS` (id → `{n: name, c: category, a: area SF}`) and `BUILDINGS` (floor plate `w`×`d` ft, floor-to-floor `fh`, site `x`/`z`, and `levels`, an array of dept-id arrays with Level 1 first). Data is in feet. The scene scale is `S = 0.1`, so 1 scene unit = 10 ft.

**State:** `state.levels[buildingId]` (a copy of each building's `levels`) is the source of truth for stacking. Area edits change `DEPTS[id].a` in place. `INIT_LEVELS` and `INIT_AREAS` are snapshots taken at boot and used by "Reset layout". `B` and `D` hold the per-building and per-department runtime records (meshes, materials, overlay elements, animation values).

**Layout (`planFloor` / `relayout`):** each level is cut into strips along the plate width, sized in proportion to department SF. Each strip uses the plate's full depth. The divisor is `max(plate, total)`, so an over-full level squeezes its departments, and leftover width becomes a translucent "void" box. A level is over capacity when its total SF > `w*d`.

**Animation model:** values come in target/current pairs, and `frame()` eases the current value toward the target each frame with exponential smoothing (`k`). With `prefers-reduced-motion`, `k = 1` and values snap.
- Departments: `tx/vx`, `tf/vf` (level, fractional while animating), `tw/vw`.
- Camera: `viewT` / `view`. FOV and size are interpolated in log space.
- Explode: `explodeT` / `explode`.

`relayout()` only sets targets. `relayout(true)` also snaps the current values. After any state change, call `relayout(...)` and then `refreshUI()`.

**View modes** (`mass`, `axon`, `stack`) share one scene and one `PerspectiveCamera`. They differ only in data:
- `EXPLODE` multiplies the floor pitch.
- `GRIDOP` sets grid opacity.
- `targetView()` sets the camera.

Axon and Section Stack get their near-orthographic look from a tiny FOV (4° and 3.2°) and a large camera distance, not from an OrthographicCamera. Only the selected building (`state.sel`) shows department meshes. The other buildings render as plain shells and fade out outside `mass` mode.

**Dragging:** while a drag is in progress, `drag.ov` holds a preview placement `{b, id, f, idx}`. `levelsWithOverride()` applies it during layout without changing `state.levels`. `commitDrag()` writes it to `state.levels`, and `cancelDrag()` (also bound to Escape) discards it. The drag plane is vertical and faces the camera, and the target level comes from the Y position.

**Labels and tags are HTML, not WebGL:** department labels (`.lbl`), building tags (`.btag`) and floor tags (`.ftag`) are DOM elements inside `#overlay`. `updateOverlay()` positions them every frame by projecting 3D points to screen space. Any future image export has to redraw them, because they are not part of the canvas.

**Panels:** `renderLeft()` and `renderRight()` rebuild their `innerHTML` from strings. Pass every program or user string through `esc()`. Clicks are handled by delegated listeners on `#left`, `#right`, `#overlay`, `#modes` and `#tools`, keyed off `data-b`, `data-dept`, `data-cat`, `data-act` and `data-mode` attributes. New controls should follow the same pattern.

**Input:** camera controls are custom pointer handling (there is no OrbitControls). A small `gesture` state machine handles orbit, pan (right-drag, Shift, or any drag in stack mode), two-finger pinch, wheel zoom, and click-vs-drag on departments and building shells. The click/drag threshold is 5 px.

**Styling:** design tokens are CSS custom properties on `:root` (`--ink*`, `--line*`, `--alert`, `--ui`, `--mono`). The layout is a three-column grid that collapses to one column below 960px. `.app.present` hides both side panels.
