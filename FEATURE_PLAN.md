# 3D Interactive Building Model — Feature Plan

**Goal:** turn the current single-page prototype into a web tool that medical planners can use on any project: load a building model and a program, study stacking options, plan vertical circulation, and export diagrams and data for client meetings.

**Current state (v0.1):** one self-contained `index.html` built on Three.js r128. It has three views (3D Massing, Axon, Section Stack). Department volumes scale with SF. Departments can be dragged between levels. Buildings and program are hard-coded sample data, and the floor plates are rectangles.

---

## Summary

| # | Feature | Feasibility | Effort | Phase |
|---|---------|-------------|--------|-------|
| 1 | Host online (GitHub Pages) | Yes, works as is | S | 1 |
| 2 | Import building model from Rhino (.3dm) | Yes, with a layer convention | L | 3 |
| 3 | Import program from CSV / Excel | Yes | S–M | 1 |
| 4a | Three diagram modes | Done in v0.1 | — | — |
| 4b | Multiple layout options + compare | Yes | M | 2 |
| 4c | Export JPEG (3 diagrams) + CSV | Yes | S–M | 2 |
| 5 | Vertical circulation (elevator blocks + axon lines) | Yes | M–L | 4 |

Effort: S = 1–2 days, M = 3–5 days, L = 1–2 weeks (one developer).

---

## 1. Online hosting

**Can GitHub Pages work? Yes.** The tool is a static site: HTML, JS and CSS with no server. GitHub Pages serves exactly that, for free, at `https://<user>.github.io/3d-interactive-building-model/`.

**Data privacy: keep project data out of the repo.** A GitHub Pages site is public on GitHub Free, and with GitHub Pro or Team even a private repo publishes a public site. Access-controlled Pages needs GitHub Enterprise Cloud. The design below sidesteps this:

- The hosted site contains **only the tool, plus a fictional sample project**.
- Users load their own Rhino and CSV files from their computer. Files are parsed **in the browser** and are never uploaded to any server.
- Saved work stays on the user's machine, in browser storage and as exported project files (see 4b).

So the public URL exposes no client data, and the tool is safe to share with anyone.

**If a password-protected site is needed later** (for example, a link that opens straight onto a specific client project), alternatives are Cloudflare Pages with Cloudflare Access (free up to 50 users), Netlify or Vercel with password protection, or an internal company server. Confirm with IT before hosting anything that holds project data.

**Tasks**
- [x] Create the GitHub repo and enable Pages
- [x] Deploy with a GitHub Actions workflow on push to `main` (`.github/workflows/pages.yml`)
- [x] Move to a small build setup (Vite), and add the build step to the deploy workflow (`src/` modules; Three.js pinned at r128 until Phase 3)
- [x] Replace the sample program with a clearly fictional demo project
- [ ] Add a "Load project" start screen: demo, or import files (deferred to feature 3, when import exists)

---

## 2. Building model import (Rhino .3dm)

**Approach:** read `.3dm` files in the browser with **rhino3dm.js**, McNeel's official WebAssembly library (npm: `rhino3dm`).

**Constraint:** rhino3dm.js can read curves, points, meshes, layers and attributes. It **cannot mesh Breps or polysurfaces itself**: a polysurface only displays if the file was saved with render meshes. Reading volumes is therefore fragile, so the tool should read **floor plate outlines** instead, which are also the data the stacking logic actually needs.

**Proposed Rhino modeling convention**

```
Layer structure:
  MASSING
    ├─ Tower
    │    ├─ L01      ← one closed planar curve = Level 1 floor plate, at its real elevation
    │    ├─ L02
    │    └─ ...
    ├─ D&T
    │    ├─ L01
    │    └─ ...
  CONTEXT           ← optional: site, roads, neighbor buildings (meshes)
```

- Each **sub-layer under a building** = one level. Its **closed curve** = floor plate outline.
- Curve **elevation (Z)** = level elevation. Floor-to-floor height = difference to the next level up; the top level uses an attribute or a default.
- Optional object **User Text** (key/value in Rhino) to override: `level_name`, `floor_to_floor`, `exclude_from_program` (for example a mechanical penthouse).
- Units are read from the file (feet or meters) and converted to SF.

**What this enables**
- Real, irregular floor plates (L-shapes, courtyards, setbacks), different on each level
- Accurate gross area per level from the curve area
- Correct building positions on the site

**Required change: department layout on irregular plates.** v0.1 slices a rectangle into strips. For arbitrary polygons, departments will be laid out by **area-proportional strip slicing of the polygon** along its long axis, using polygon clipping (for example the `polygon-clipping` or `clipper2` library). Each department becomes a polygon extruded to the level height. A later improvement is letting the user drag the cut lines between departments.

**Tasks**
- [ ] Write a 1-page Rhino modeling guide plus a template `.3dm`
- [ ] Parse layers and curves with rhino3dm.js; convert to building/level data
- [ ] Validation report on import: open curves, missing levels, duplicate elevations, unit warnings
- [ ] Polygon-based department slicing and extrusion
- [ ] Optional context meshes, drawn as light grey
- [ ] Upgrade Three.js from r128 to a current version (module build)

**Fallback:** keep a simple "define buildings by table" option (width × depth × levels × floor height) for early concept work without a Rhino model.

---

## 3. Program import (CSV / Excel)

**Formats:** `.csv` as the primary format, and `.xlsx` directly via **SheetJS**, so users don't have to export from Excel first.

**Proposed template columns**

| Column | Required | Example | Notes |
|---|---|---|---|
| Department | ✓ | Emergency Department | Unique name |
| SF | ✓ | 14,000 | Departmental gross SF (DGSF) |
| Category | | Emergency & Critical Care | Drives color; auto-assigned if blank |
| Building | | Hospital Tower | Must match a building name from the model |
| Level | | 1 | If blank, the department goes to an "Unassigned" tray |
| Color | | #E0554E | Overrides the category color |
| Notes | | Ground floor, ambulance access | Shown in the detail panel |

**Behavior**
- Map columns on import if the headers differ ("Dept", "Area", "DGSF" and so on), and remember the mapping.
- Show an import summary: rows read, total SF, rows with errors (missing SF, unknown building).
- **Unassigned tray:** departments without a level wait in a side list and can be dragged into the model.
- Re-import an updated program into an existing project: match by department name, update the SF, keep current positions.
- Provide a downloadable **template** (`program_template.csv` / `.xlsx`).

**Tasks**
- [ ] CSV/XLSX parser with column mapping
- [ ] Import summary and error report
- [ ] Unassigned tray, with drag into the model
- [ ] Re-import / merge logic
- [ ] Template download

---

## 4. Massing and stacking study

### 4a. Diagram modes (done in v0.1, to be extended)
- **3D Massing:** perspective campus view; select a building.
- **Axon:** exploded axonometric of the selected building.
- **2D Stacking:** section-style stack, level by level.

Extensions: level labels with names from Rhino, per-level SF over/under bars in all modes, and a category legend on the canvas for exports.

### 4b. Layout options and comparison

**Concept:** a project holds one building model and program, plus **multiple options**. Each option is a different assignment of departments to levels and positions (and later, a different circulation layout).

**Features**
- **Options bar:** create, duplicate, rename and delete options ("Option A – ED on L1, Surgery L2"). Duplicating is the main workflow: start from A, tweak it, and save as B.
- **Compare view:** two to four options side by side in the same view mode, with the camera synchronized. Departments that differ between options are highlighted.
- **Metrics table per option:**
  - SF per level vs. floor plate (over/under)
  - Number of levels over capacity
  - Departments moved compared with the baseline option
  - (Phase 4) elevator count and served levels by type
  - (Later) adjacency score, if an adjacency matrix is imported
- **Saving:** autosave in browser storage, plus **export/import a project file** (`.massing.json`) holding the model, program and all options. This is how work moves between computers and colleagues on a static site.

**Tasks**
- [ ] Data model refactor: `project → buildings, program, options[]`
- [ ] Options bar UI
- [ ] Side-by-side compare with a synced camera
- [ ] Metrics table
- [ ] Project file save and load

### 4c. Export

**JPEG export, one per diagram type** (3D Massing, Axon, Stacking):
- Rendered at high resolution (for example 3840 × 2160), independent of screen size
- Labels, level tags, legend and a title block (project, option name, date) drawn onto the image. The on-screen labels are HTML and are not part of the 3D canvas, so they must be redrawn into the export.
- White background, ready for decks and boards
- "Export all three": one click for the current option. "Export all options": a set of images per option.

**CSV export**

| Option | Building | Level | Department | Category | SF |
|---|---|---|---|---|---|
| Option A | Hospital Tower | 1 | Emergency Department | Emergency & Critical Care | 14000 |

Plus a level summary sheet: Building, Level, Program SF, Floor plate SF, Over/Under. Optionally a `.xlsx` export with both sheets via SheetJS.

**Tasks**
- [ ] Offscreen high-resolution render + 2D overlay compositor
- [ ] Title block and legend in exports
- [ ] CSV / XLSX writer
- [ ] Batch export (all views × all options)

---

## 5. Vertical circulation study

**Elevator types (default set, editable)**

| Type | Default color | Typical use |
|---|---|---|
| Patient / Bed elevator | Blue | Inpatient transport, bed-sized cab |
| Service / Material elevator | Brown/orange | Supplies, food, linen, waste |
| ED / Trauma elevator | Red | Direct ED → Surgery / ICU / Imaging |
| Public / Visitor elevator | Purple | Lobby to clinics and units |
| Stair (optional) | Grey | Egress |

**Placing elevators (3D Massing and Axon views)**
- Pick a type from a **circulation toolbar**, then click on the floor plate to place a shaft block.
- Each block has:
  - **Type** and **number of cabs** (for example a bank of 3 patient elevators)
  - **Footprint size**, with a default per type (for example a bed elevator at about 8' × 10' per cab) and editable
  - **Levels served:** from–to, plus individual stops toggled on or off
- The block shows as a **vertical shaft through the building** in the massing view.
- **Shaft area is taken out of the floor plate** on every level it passes through, so department fit and over/under numbers stay correct.
- Drag a block to move it; departments re-flow around it.

**Circulation in the Axon view**
- Each elevator draws as a **thick vertical line in its type color**, connecting its stops through the exploded levels.
- Stop markers (dots) on the levels it serves. Floors it passes without stopping show as a thinner or dashed segment.
- Filter by type: show only patient elevators, only material elevators, and so on.
- Implemented with Three.js "fat lines" (`Line2` / `LineMaterial`) or thin cylinders, because standard WebGL lines are always 1px wide.

**2D Stacking view:** elevators appear as colored vertical bars through the stack, at their horizontal position. This makes it easy to check which departments each elevator serves.

**Metrics:** elevator count by type and per building, the levels each type serves, and warnings such as "Surgery (L2) is not served by any patient elevator" or "ED elevator does not reach Imaging".

**Tasks**
- [ ] Circulation data model (type, cabs, footprint, position, stops)
- [ ] Placement and editing UI in 3D and Axon
- [ ] Shaft subtraction from the floor plate + department re-flow
- [ ] Fat-line rendering in Axon; bars in Stacking
- [ ] Type filter and legend
- [ ] Service-check warnings
- [ ] Include circulation in options, compare and exports

**Possible later step:** horizontal circulation (corridor spines per level) and simple travel paths, such as ED → elevator → Surgery.

---

## Phasing

| Phase | Scope | Outcome |
|---|---|---|
| **1 — Usable online** | Hosting, demo project, CSV/XLSX program import, unassigned tray, Vite build | Share a link; load a real program onto sample buildings |
| **2 — Study & present** | Options, compare view, metrics, JPEG + CSV export, project file save/load | Run a stacking workshop and export images for a deck |
| **3 — Real buildings** | Rhino import, irregular floor plates, Three.js upgrade | Work on an actual project massing |
| **4 — Circulation** | Elevator blocks, shaft subtraction, axon lines, service checks | Elevator strategy study |

Phases 1–2 are mostly independent of Rhino, so the tool becomes useful early. Phase 3 is the largest technical step, because irregular plates change how departments are laid out.

---

## Technical architecture

- **Stack:** Vite + vanilla JS or TypeScript, Three.js (current), rhino3dm.js, SheetJS, a polygon clipping library
- **Hosting:** GitHub Pages via GitHub Actions
- **Data:** everything client-side. No backend, no uploads, no accounts.
- **Project file:** a versioned JSON schema (`schemaVersion`) so older project files still open after updates

```
src/
  data/       project model, options, import/export (csv, xlsx, 3dm, json)
  layout/     polygon slicing, shaft subtraction, metrics
  scene/      three.js scene, view modes, circulation rendering, export renderer
  ui/         panels, options bar, toolbar, compare view
public/
  templates/  program_template.csv, massing_template.3dm
```

---

## Open questions

1. **Rhino convention:** does the layer-per-level, closed-curve approach fit how the team models massing today? Or are masses usually single polysurfaces that would need to be sliced?
2. **Program source:** what does the typical program spreadsheet look like (DGSF vs. NSF, grossing factors, room-level vs. department-level)? A sample file would let the importer match it.
3. **Collaboration:** is sharing project files enough, or do several people need to edit the same option live? Live editing would need a backend and changes the hosting answer.
4. **Department placement within a level:** is order along the plate enough, or do users need to draw or adjust department zones freely?
5. **Elevator defaults:** preferred cab sizes and type list, for example following FGI Guidelines or a firm standard.
6. **Adjacency:** should a department adjacency matrix be imported in a later phase to score options?
