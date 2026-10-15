# 3D Interactive Building Model

Interactive massing diagram for presenting a medical campus program to clients. Built with Vite and Three.js r128.

## Views
- **Campus overview**: the demo and imported projects open on the whole campus, with every building's departments in colour and a campus summary on the right. Click a building, its tag or its card to focus it; **Full campus** (top of the Buildings list) comes back here.
- **3D Massing**: perspective master plan; click a building to select it
- **Axon**: exploded near-orthographic axonometric of the selected building
- **Section Stack**: elevation stacking diagram, level by level

Department volumes scale with area (SF) relative to the floor plate. Drag a department to change its level or position. Area and level can also be edited in the right panel.

- **Toolbar:** the view modes sit in the middle of the header and the tools on the right, each with its shortcut in the corner and a tooltip on hover: `1` `2` `3` switch the view, `T` labels, `L` laser, `P` present, `F` reset view. The ☰ menu holds **Import program…**, **Download template**, **Print report (PDF)…** and **Reset layout**.
- **Start screen:** the app opens on an animated overview with two ways in, **Explore the demo** or **Import Excel program**. The icon left of the title brings it back.
- **Levels:** in the right panel, drag a level by its grip to move it to another position (or focus the grip and use ↑ ↓); the building follows as you drag, and Escape cancels. Each level's ⋯ menu inserts an empty level above or below it, or removes it, sending its departments to the Unassigned tray. **+ Add level** puts an empty level on top. **Reset layout** (☰ menu) restores the loaded levels.
- **Hide details:** the chevron next to the building name folds the right panel down to its title.
- **Print report:** **Print report (PDF)…** in the ☰ menu (or the browser's own `Ctrl+P` / `⌘P`) prints the whole project. A summary page has campus totals, a picture of the current view, the buildings, the program by category and the Unassigned tray. Then each building gets its own page, with a stacking diagram and every department listed level by level, with SF, share of the floor plate, notes and over-capacity flags. Choose **Save as PDF** in the print dialog to get a PDF.
- **Laser pointer:** the laser tool (or the `L` key) turns the cursor into a laser pen. Drag on the model to draw a red line that shrinks away within two seconds, so the room can follow along; the model stays still. Right-drag still pans and the wheel still zooms. `L` or Escape turns it off.

## Run
Live at https://hongyyu.github.io/3d-interactive-building-model/

To run locally (Node 20.19+ or 22.12+):

```sh
npm install
npm run dev       # dev server at http://localhost:5173, reloads on save
npm run build     # production build into dist/
npm run preview   # serve dist/ locally
```

## Visual regression test
`npm run test:visual` builds the app and runs seven Playwright tests in headless Chromium:
- **Demo scenario:** replays 32 steps covering the view modes, selection, area edits, dragging, camera moves, reset, present mode and a narrow window. At each step it compares a screenshot of the 3D stage and a text snapshot of the panels against the baselines in `tests/visual.spec.js-snapshots/`.
- **Template round trip:** downloads the template and imports it back, then checks that the model renders exactly like the demo.
- **CSV import with problems:** imports `tests/fixtures/program-with-issues.csv` and checks the import summary and the Unassigned tray.
- **Rejected file:** checks that a file with the wrong columns can't be loaded.
- **Start screen, levels and laser:** imports from the start screen and returns to it. Then it adds and removes levels on the Hospital Tower, resets the layout, and checks that the laser draws only while dragging.
- **Printed report:** prints from the ☰ menu and checks the report's text and pages. Then it overfills a level, sends a department to the tray and checks that a second print shows both.
- **Toolbar shortcuts and menu:** checks the keyboard shortcuts, that they are ignored while typing in a field, and that the ☰ menu works from the keyboard.

- First time only: `npx playwright install chromium`
- After an intended visual change: review the failures with `npx playwright show-report`, then re-record the baselines with `npm run test:visual:update` and commit them.
- The baselines were rendered on macOS. Other platforms need their own.

## Use your own program
1. Choose **Download template** from the ☰ menu. You get an Excel workbook pre-filled with the fictional demo campus. It has four sheets:
   - **Instructions**
   - **Program:** department, SF, category, building, level, colour, notes
   - **Buildings:** floor plate, floor-to-floor height, number of levels, site position
   - **Categories:** name and colour
2. Replace the example rows with your own. Building and Category cells have dropdowns. Leave Level blank for any department you want to place later.
3. Choose **Import program…** from the ☰ menu (or **Import Excel program** on the start screen) and choose the file (`.xlsx`, or a `.csv` holding just the Program columns). A summary lists what was read and any rows with problems. **Replace project** then loads it.

Departments without a building or level wait in the **Unassigned** tray in the right panel. Select one and pick a level to place it in the selected building. **Reset layout** returns to the imported layout, and **Load demo project** (left panel) brings back the demo.

Files are read in the browser and never uploaded. Keep real client data out of the repo; the bundled demo (`src/data/demo.js`) must stay fictional.

## Deployment
Every push to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`, which runs `npm run build` and publishes only `dist/`. To redeploy without a new commit, run the workflow manually from the Actions tab.

## License
Proprietary and confidential. Copyright (c) 2026 Hongyu Li and Zining Cheng. All rights reserved.
No use, copying or distribution without written permission; see [LICENSE](LICENSE). Third-party packages keep their own licenses.
