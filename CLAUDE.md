# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**Dado** is an interactive massing and stacking diagram for a medical campus program (v0.1 prototype). It's a Vite app written in vanilla JS ES modules. Three.js is pinned to **r128** (`three@0.128.0` from npm).

```sh
npm install
npm run dev       # dev server on :5173 with hot reload (runs `npm run template` first)
npm run build     # production build into dist/ (runs `npm run template` first)
npm run template  # regenerate public/templates/program_template.xlsx from the demo
npm run preview   # serve dist/
npm run test:visual          # Playwright visual regression test (first run: npx playwright install chromium)
npm run test:visual:update   # re-record baselines after an intended change
```

There is no lint tooling. Vite 8 needs Node 20.19+ or 22.12+.

- **Visual test** (`tests/visual.spec.js`): builds the app and serves `dist/` on :4174.
  - **Demo scenario:** replays 32 steps on the demo program. Each step checks an exact text snapshot of `#left`, `#right` and the overlay labels, plus a screenshot of the stage. Three steps also get full-page shots.
  - `stageShot()` clips stage screenshots to the free area between the floating side panels, 24px clear of their shadows. The panels' content is covered by the text snapshots and their look by the full-page shots. Canvas drags in the spec start right of the left panel.
  - **Import tests:** a template round trip (download, import, then compare against the demo's `00-initial.png`), a CSV with problems (`tests/fixtures/program-with-issues.csv`), and a rejected file
  - **Start screen, levels and laser:** imports from the start screen, adds and removes levels, then checks that the laser draws only while dragging. After "Reset layout", and again after the laser drawing, the stage must match `03-axon.png`.
  - **Printed report:** prints from the ☰ menu, then checks the report text in print media (the date comes from a fixed clock), the page per building and the view picture. The stage must still match `00-initial.png` afterwards. A second print after edits must show the over-capacity level and the tray. The test fires the print events itself, because Chromium ignores repeated `print()` calls that have no user gesture.
  - **Toolbar shortcuts and menu:** keyboard shortcuts, the Labels and SF settings (shared by every view, also in a small window), the shortcuts' guard while typing, and the ☰ menu from the keyboard. No screenshots.
  - **Colour panel:** recolours a category from the palette, the saturation/brightness area and the hex field, then a department, and checks Escape, outside clicks and "Use category colour". One full-page shot shows the open panel. After "Reset colours" the stage must match `00-initial.png`.

  The page opens on the start screen. `open()` in the spec clicks **Explore the demo** first; `load()` stops at the start screen.

  Screenshot tolerances: `threshold: 0.01` and `maxDiffPixels: 100` absorb SwiftShader antialiasing wobble. The config comment has the measurements. Web fonts are blocked so the run is offline and stable. Run it after any refactor that should not change behavior.

  The scenario relies on demo ids (`tower`, `opp`, `cup`, `inf`, `amb`) and label names. If the demo data or UI changes on purpose, update the scenario or re-record the baselines, and review the diffs first. Baselines are macOS-specific (`*-darwin.*`).

- **Deploy:** every push to `main` runs `.github/workflows/pages.yml`, which runs `npm ci` and `npm run build`, then publishes `dist/` to GitHub Pages at https://hongyyu.github.io/3d-interactive-building-model/. `vite.config.js` uses `base: './'` so asset paths work under that subpath. Only `dist/` is served. Static files that must ship as-is go in `public/`. `public/templates/` is generated, not committed.
- **Roadmap:** `FEATURE_PLAN.md` describes the planned phases: CSV/XLSX program import, layout options and compare, JPEG/CSV export, Rhino `.3dm` import and vertical circulation. Upgrading Three.js beyond r128 is a Phase 3 task. Until then, stick to the r128 API, and import any addons from `three/examples/jsm/...` of 0.128.0.
- **Data privacy constraint:** the repo and the Pages site are public. `src/data/demo.js` must hold only the fictional demo program, so never commit real client data. Test fixtures must be fictional too. User files are parsed in the browser and never uploaded. There is no backend.
- **Copyright notice:** the project is proprietary (see `LICENSE`); never add an open-source license. "© 2026 Hongyu Li and Zining Cheng" appears in `LICENSE`, the README's License section, the `author` and `copyright` meta tags and the start screen footer (`.wlegal`) in `index.html`, the report footer (`ui/report.js`) and a comment at the top of the entry JS chunk (`postBanner` in `vite.config.js`). Keep them in step. The banner skips the lazy SheetJS chunk, which is third-party code.
- **Name and logo:** the app is Dado (the solid block of a pedestal; Italian for a die). The mark is three floors stacked with a gap between them, the middle one turned 14°, drawn in isometric line art.
  - It is the `#mark` symbol at the top of `index.html`. The header's `#home` button and the start screen title use it, and each sets its own `stroke-width`.
  - `public/favicon.svg` (heavier lines, dark-mode colours), `public/favicon-32.png` and `public/apple-touch-icon.png` are the same drawing, so redraw them together.
  - The wordmark is Jost 400 set lowercase (`--brand` in `style.css`), on the header title and the start screen title. `index.html` loads only the letters of "Dado" (`text=Dado`). The name stays "Dado" in text: the page title, the report and the PDF name.
  - The GitHub repo and the Pages URL keep the old name, `3d-interactive-building-model`.

## Architecture

`index.html` holds only markup. `src/main.js` runs the frame loop and boots the app, but only if `scene/scene.js` managed to create a WebGL renderer (`renderer` is null otherwise).

| Folder | Contents |
|---|---|
| `src/data/` | Demo project, live project containers, spreadsheet importer |
| `src/layout/` | Stacking and fit logic |
| `src/scene/` | Three.js objects, camera and per-frame updates |
| `src/ui/` | Panels, state-change actions and input |
| `src/state.js`, `src/dom.js`, `src/util.js` | Shared state, element refs, helpers |

**Data:** a project is a plain object, `{title, sub, demo?, cats, depts, buildings, unassigned}`:
- `cats`: key → `{name, color}`
- `depts`: id → `{n: name, c: category key, a: area SF, color?, notes?}`
- `buildings`: `{id, name, w, d, fh, x, z, levels}`, with floor plate `w`×`d` ft, floor-to-floor `fh`, site `x`/`z`, and `levels` as an array of dept-id arrays (Level 1 first)
- `unassigned`: dept ids in the tray

`data/demo.js` exports `DEMO`. `data/project.js` holds the **live containers** `PROJECT`, `CATS`, `DEPTS`, `BUILDINGS` and `UNASSIGNED`. Modules import these once. `setProjectData(p)` refills them in place with copies, so the source object (for example `DEMO`) is never mutated. Use `deptColor(id)` rather than the category colour, because a department colour overrides it. Data is in feet. The scene scale is `S = 0.1` (`scene/constants.js`), so 1 scene unit = 10 ft.

**Loading a project:** `openProject(p)` (`ui/actions.js`) runs the whole sequence: `setProjectData`, then `initState`, then `clearScene`/`buildScene`/`fitSite`, then relayout, panels, title and camera. Boot calls it with `DEMO`, and the import dialog calls it with the imported project.
- `fitSite()` keeps the default sun shadow box and grid unless the campus doesn't fit them.
- The campus camera framing comes from `campusBounds()` (`layout/site.js`).

**Import** (`data/importer.js`, `ui/importDialog.js`): `readProgramFile(file)` lazy-loads SheetJS, a separate ~490 KB chunk.
- It reads the Program, Buildings and Categories sheets by header aliases (see `COLS`). A CSV is the Program sheet only and keeps the current buildings and categories.
- CSV bytes are decoded as UTF-8, falling back to Windows-1252, before SheetJS parses them.
- It returns `{project, summary, errors, warnings}`. Errors block the import, and warnings are per row.
- Imported ids are generated (`d1…`, `b1…`, `c1…`). Colours from files are validated as hex before they reach `style` attributes.
- The dialog shows the summary and calls `openProject` only on "Replace project". Import replaces the whole project; there is no merge.
- The dialog's `close` event arrives a task later, so the handler ignores it when the next import has already reopened the dialog.

**Template** (`scripts/build-template.mjs`): ExcelJS (a dev dependency) writes the template from `DEMO`, with dropdowns, number checks and an Instructions sheet. Its sheet and column names must stay in step with `COLS` in the importer.

**Start screen** (`ui/welcome.js`): `#welcome` is visible in the markup and `#app` starts `inert`, so the app never flashes before boot.
- Its brand block (`.wbrand`) has the app header's size and position, so the mark and name stay put when it closes and only the line under the name changes.
- The illustration is an isometric SVG generated from the demo's first building. It is animated purely in CSS: `.wf` drops each floor in, `.wx` explodes the stack, and both run on the same 10 s loop.
- `showWelcome()` and `closeWelcome()` toggle it, and the brand mark `#home` reopens it. `main.js` skips rendering while it is open.
- An import started from the start screen closes it when the import dialog closes with `returnValue === 'ok'`. `importDialog.js` clears `returnValue` on open, because Escape keeps the old value.
- `#importFile` sits outside `#app`, so the file picker still opens while `#app` is inert.

**Laser** (`ui/laser.js`), after Excalidraw's: while it is on, the stage shows a laser-pen cursor and a left drag on the stage draws a solid red line. Moving without pressing draws nothing.
- The line is drawn on a full-window 2D canvas `#laser` with `pointer-events:none`, as one filled outline per drag, so it has no seams. It tapers behind the pen tip, and each point shrinks away over `FADE` ms.
- Its pointer listeners run in the capture phase on `window`. A left press on the stage stops propagation, so the 3D gesture never starts and the model stays still. Right-drag (pan) and the wheel (zoom) pass through. The panels and toolbar are not affected.
- The class `.lasering` on `#stage` applies the cursor (`--laser-cursor`, set in `bindLaser()`) over the grab and pointer cursors from `ui/pointer.js`, and swaps `#hint` for `.laser-hint`.
- The draw loop runs only while a line is on screen.
- `L` toggles the laser. Escape turns it off, unless a department drag is in progress (then Escape cancels only the drag).

**Printed report** (`ui/report.js`): "Print report (PDF)…" calls `window.print()`. A `beforeprint` listener rebuilds `#report` from the live state and adds `print-report` to `<html>`. While that class is set, the print stylesheet hides everything else, so the browser's own Ctrl+P / ⌘P prints the report too. The user saves it as a PDF from the print dialog.
- Layout: a summary page (totals, a picture of the current view, buildings and categories, the tray), then one page per building (`.r-bldg`, `break-before:page`) with a stacking diagram and a department table grouped by level. It shows the whole project, whatever building is focused.
- The picture is a 2D canvas copied from the WebGL canvas right after a render, at a pixel ratio of at least 2. It is cropped to the free area between the panels and then trimmed to the model. The HTML labels are not in it. The renderer is set back to its own pixel ratio and renders again at once, so the stage doesn't blank behind the print dialog.
- With the start screen open, `beforeprint` removes the class and the browser prints the page as it is.
- While printing, `document.title` names the PDF (`<title> – Program report`). `afterprint` restores it.

**State** (`state.js`): `state.levels[buildingId]` and `state.unassigned` (the tray) are the source of truth for stacking. `state.levels[bid].length` is the live level count; `def.levels` is only the loaded definition, so don't read the count from it. `insertLevel(bid, f)`, `addLevel` (on top) and `removeLevel(bid, f)` (`ui/actions.js`) change the count; removing a level sends its departments to the tray. `moveLevel(bid, from, to)` reorders levels. `setLevelCount(bid, n, drop)` (`scene/scene.js`) creates or disposes that building's per-level shell, slab and void meshes at the top to match, since meshes are positioned by index; with `drop`, a level added on top starts with `R.lift[f] = 1` and drops into place.

**Level rows** (`ui/levels.js`): each row in the right panel has a grip and a ⋯ menu (`#levelMenu`, shared, `position: fixed`).
- Dragging a grip rewrites `state.levels[bid]` live whenever the drop slot changes, then calls `relayout()`, so the building follows the drag. The panel isn't re-rendered until the drop: rows slide with transforms and are renumbered in place. Escape restores the snapshot taken at the start.
- Arrow keys on a focused grip call `moveLevel()`. Hovering or dragging a row sets `hotIds` (`state.js`), which `scene/update.js` lights up.
- `state.panelOpen` (the fold button) hides everything in the right panel below its title row. `state.buildingsOpen` does the same for the left panel's Buildings section. Arrow-key navigation for both menus is in `ui/menu.js`. Area edits change `DEPTS[id].a` in place. `initState()` resets selection and stacking for a newly loaded project and snapshots `INIT_LEVELS` / `INIT_AREAS` for "Reset layout". `B` and `D` (`scene/scene.js`) hold the per-building and per-department runtime records: meshes, materials, overlay elements and animation values. A tray department keeps its `D` record but has `b = null`, so it is hidden. `moveDeptToLevel(id, -1)` sends a department to the tray.

**Shared mutable variables:** a value that is reassigned across modules is an exported `let`. Only its home module reassigns it, because ES module imports are read-only and assigning to one from another module throws.
- `drag` and `hoverId` live in `state.js` and change through `setDrag` and `setHoverId`. `INIT_LEVELS` is reassigned only by `initState()`.
- `viewRate` lives in `scene/view.js` and changes through `setViewRate`.
- `explode`, `explodeT`, `gridT`, `SW` and `SH` live in `scene/view.js` and change only there.

Mutating properties (for example `drag.ov = …` or `viewT.s = …`) works from any module.

**Layout** (`layout/plan.js`, `planFloor` / `relayout`): each level is cut into strips along the plate width, sized in proportion to department SF. Each strip uses the plate's full depth. The divisor is `max(plate, total)`, so an over-full level squeezes its departments, and leftover width becomes a translucent "void" box. A level is over capacity when its total SF > `w*d`.

**Animation model:** values come in target/current pairs, and each frame eases the current value toward the target with exponential smoothing (`k`). With `prefers-reduced-motion`, `k = 1` and values snap.
- Departments: `tx/vx`, `tf/vf` (level, fractional while animating), `tw/vw`. Eased in `scene/update.js`.
- Camera: `viewT` / `view`. FOV and size are interpolated in log space. Eased by `stepView()` in `scene/view.js`.
- Explode: `explodeT` / `explode`. Also eased by `stepView()`.

`relayout()` only sets targets. `relayout(true)` also snaps the current values. After any state change, call `relayout(...)` and then `refreshUI()`. The functions in `ui/actions.js` already do this.

**View modes** (`mass`, `axon`, `stack`; `stack` is labelled "Stacking" in the UI) share one scene and one `PerspectiveCamera`. They differ only in data:
- `EXPLODE` multiplies the floor pitch. It is 0 for Stacking as well as 3D Massing, so Stacking draws its levels without gaps.
- `GRIDOP` sets grid opacity.
- `targetView()` sets the camera.

Axon and Stacking get their near-orthographic look from a tiny FOV (4° and 0.2°) and a large camera distance, not from an OrthographicCamera. Stacking's 0.2° makes it a flat elevation: no side or top face shows. A focused building in 3D Massing is framed at 1.5× its plan diagonal (at least 16 units), close enough for two-line labels on its floors. Only the selected building (`state.sel`) shows department meshes, except in the campus overview. The other buildings render as plain shells and fade out outside `mass` mode.

**Campus overview** (`isOverview()` in `state.js`: `mass` mode with `state.focus === 'campus'`): the demo and every imported project open here.
- Every building shows its department meshes and no building tag is highlighted. `state.sel` still names a building: the one Axon, Stacking and the Unassigned tray use.
- Only the hovered or selected department gets a label. Hovering a department also glows its whole building.
- A click on a department, a building tag or a card focuses that building (`state.focus = 'building'`). A click on a department also selects it, and dragging orbits instead of moving departments.
- The right panel shows campus totals, the tray and "Program by building". "Program by category" in the left panel covers the whole campus.
- `showCampus()` (the "Full campus" button above the building cards) returns from any building or mode. `setMode()` sets the focus to `building` for Axon and Stacking and leaves it alone for 3D Massing, so going back to 3D Massing keeps the focused building.

**Dragging** (`ui/pointer.js`): while a drag is in progress, `drag.ov` holds a preview placement `{b, id, f, idx}`. `levelsWithOverride()` applies it during layout without changing `state.levels`. `commitDrag()` writes it to `state.levels`, and `cancelDrag()` (also bound to Escape) discards it. The drag plane is vertical and faces the camera, and the target level comes from the Y position.

**Labels and tags are HTML, not WebGL** (`scene/overlay.js`): department labels (`.lbl`), building tags (`.btag`) and floor tags (`.ftag`) are DOM elements inside `#overlay`. `updateOverlay()` positions them every frame by projecting 3D points to screen space. Any future image export has to redraw them, because they are not part of the canvas.
- `placeLabels()` puts each department label on the band of the department the camera can actually see: in 3D Massing and Stacking a side face plus whatever strip of top face the level above leaves uncovered. The top level counts the same strip as if a level sat above it, so every label sits on its floor's facade band; only a top-level department with no facade in view (seen end-on) is labelled on its roof. In Axon (`labelRegions()`), a label is centred on one face instead: the side face on every level alike (the uncovered top is partly in the shadow of the level above), then the top (all of the roof on the top level), the end face, and last the combined band. `labelRegion(…, part)` limits a band to the side face (1) or the top strip (2). Labels hidden behind another building are dropped. Each label is sheared (`skewY`) to follow the floor edge.
- Labels never overlap each other or a tag. They are placed in priority order (dragged, selected, hovered, then larger SF), and each one tries name + SF on two lines, then the two lines shrunk to the band's height (in 5% steps, down to `MIN_FIT` = 0.75, through the label's own `--ls`), then name only, then hides. Label lines have a line height of 1.1 and need 2 px of clearance in their band. Without the shrink step, a small window would show names only in Axon whatever the SF setting, because the side faces get too thin for two full-size lines. The flicker tolerance applies to full-size labels only, so a shrunk label never grows past its face.
- `state.labels` (Labels, `T`) and `state.sf` (SF on labels, `S`, `toggleSF()` in `ui/actions.js`) are single settings shared by every view mode, chips included. The SF tool dims while labels are off.
- Floor tags (Axon and Stacking) are centred on their floor's height, left of the plate corner furthest left on screen (picked once per frame at the middle of the column): the back-left corner in Axon, the front-left in Stacking. Zoomed in, a tag that would go under the left panel pins to the free area's edge on a white chip (class `pin`).
- Overlay text grows with zoom: `textScale()` (`scene/view.js`) is the square root of the zoom past the framing (`view.lb` eases toward `viewT.base`, the framing's size, at the camera's rate), clamped to 1–1.6. `updateOverlay()` sets it as `--tz` on `#overlay` in 2% steps, the CSS font sizes multiply by it, and label sizes are measured at scale 1 and multiplied.
- Building tags sit just above the building's outline on screen (its highest projected roof corner), centred over the roof, so they don't cover the building. The selected building's tag stays in the free area and pins to its top edge when the building's top is out of view.
- Building tags follow the same rules. The selected building's tag is placed first and always shows. Other tags are placed after the department labels, nearest first. They hide when the point above their roof is behind another building. Otherwise each tries centred, then shifted left or right, then hides (class `off`, which uses `visibility` so the tag can still be measured).
- The selected and hovered departments fall back to an upright `.chip` when their label doesn't fit. The dragged department always shows as a chip.
- A shown label keeps its kind and spot within a few pixels of tolerance (`d.on`), so it doesn't flicker while the camera moves. `retarget()` bumps `reframes` (`scene/view.js`), and the overlay then drops that tolerance, so the labels after a reframe don't depend on the frames before it. This keeps the visual test deterministic: the panels resize after a mode change, which reframes about 60 ms later.
- Text widths are measured with a canvas and cached per label (`d.nw`, `d.aw`). Call `setLabelHTML(d)` after changing a department's name or area so they are measured again.

**Colours** (`ui/colorPanel.js`): the swatches in "Program by category" (`data-catcolor`) and the department card's Colour field (`#dcol`) open the colour panel `#colorPanel`. It has a saturation/brightness area, a hue slider, a hex field, a fixed palette, the project's own colours, and for a department "Use category colour".
- It is a non-modal `<dialog>` (`show()`), placed beside the side panel that holds the swatch, or above or below the swatch in the one-column layout. Single-key shortcuts are off while it is open, because they skip keys while any dialog is open.
- Every change applies at once through `setCatColor` / `setDeptColor` (`ui/actions.js`). They change `CATS` / `DEPTS` in place, call `paintDepts()` (`scene/scene.js`) to re-apply every department's colour, then `refreshUI()`.
- The panel sits outside the side panels, so their rebuilds leave it open. It finds its swatch again by selector (`cur.sel`), and `state.picking` lets the panels render that swatch as expanded.
- Escape (caught in the capture phase before the laser's listener) and the close button return focus to the swatch. A press outside closes it, and the swatch that opened it toggles it.
- "Reset colours" shows only when `colorsEdited()` and restores `INIT_CAT_COLORS` / `INIT_DEPT_COLORS` from `initState()`. "Reset layout" leaves colours alone.
- A department darker than relative luminance 0.18 gets white label text (class `inv`). The demo's darkest colour is 0.23, so the demo keeps dark labels.
- `hexColor()` (`util.js`) parses hex codes for both the panel and the importer.

**Panels** (`ui/panels.js`): `renderLeft()` and `renderRight()` rebuild their `innerHTML` from strings. Pass every program or user string through `esc()`. Clicks are handled in `ui/controls.js` by delegated listeners on `#left`, `#right`, `#overlay`, `#modes` and `#tools`, keyed off `data-b`, `data-dept`, `data-cat`, `data-act` and `data-mode` attributes. New controls should follow the same pattern.

**Toolbar** (header, `index.html` + `ui/controls.js`): two Excalidraw-style islands, `#modes` (view modes) and `#tools`. Each `.tool` is an icon button with a `<kbd>` shortcut hint and a CSS tooltip from `data-tip`.
- The islands are 38px tall but take 32px of layout (`margin-block:-3px`), so the header keeps the height of the brand block. A taller header would shrink the stage and change every stage screenshot.
- Import program…, Download template, Print report (PDF)… and Reset layout live in the ☰ menu (`#toolMenu`); `menuAction()` in the spec opens it. Its keyboard handling and outside-click closing are in `bindToolbarUI()`.
- Single-key shortcuts are in the `KEYS` map in `ui/controls.js`. `L` (laser) stays in `ui/laser.js`. Shortcuts are ignored with a modifier key, while typing in a field, while a dialog is open, and while the start screen covers the app.
- A tool's tooltip is hidden after it is clicked (class `tipoff`) until the pointer leaves it, so it doesn't sit over the stage.

**Input** (`ui/pointer.js`): camera controls are custom pointer handling (there is no OrbitControls). A small `gesture` state machine handles orbit, pan (right-drag, Shift, or any drag in stack mode), two-finger pinch, wheel zoom, and click-vs-drag on departments and building shells. The click/drag threshold is 5 px.

**Styling** (`src/style.css`): design tokens are CSS custom properties on `:root` (`--ink*`, `--line*`, `--alert`, `--ui`, `--mono`). The stage fills the area under the header, and the side panels float over it as frosted bubbles (`backdrop-filter`) in the outer grid columns. Below 960px the layout is one column, with solid panels stacked under the stage. `.app.present` hides both side panels.
- `measureInsets()` (`scene/view.js`) records how far the panels reach into the stage (`insetL` / `insetR`, also set as `--inset-l` / `--inset-r` on `#stage`) and their rects (`panelRects`).
- `updateCamera()` uses `setViewOffset` to put the projection centre in the middle of the free area, and `targetView()` fits to its aspect. The status bar and hint are positioned with the CSS variables.
- The overlay treats `panelRects` as obstacles, so labels and tags stay off the panels.
- A ResizeObserver on each panel re-measures and reframes only when an inset changes, because the panels also resize whenever their content does.
