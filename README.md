# 3D Interactive Building Model

Interactive massing diagram for presenting a medical campus program to clients. Single self-contained HTML file built on Three.js r128, loaded from cdnjs.

## Views
- **3D Massing**: perspective master plan; click a building to select it
- **Axon**: exploded near-orthographic axonometric of the selected building
- **Section Stack**: elevation stacking diagram, level by level

Department volumes scale with area (SF) relative to the floor plate. Drag a department to change its level or position. Area and level can also be edited in the right panel.

## Run
Live at https://hongyyu.github.io/3d-interactive-building-model/

To run locally, open `index.html` in a browser. No build step.

## Use your own program
This repo and its site are public. The bundled program is a fictional demo, so do not commit real client data here.

To try a real program locally, edit the `DATA` block at the top of the script in `index.html`:
- `CATS`: department categories and colors
- `DEPTS`: id → name, category, area in SF
- `BUILDINGS`: floor plate (w × d ft), floor-to-floor (fh), site position (x, z), and the department ids on each level, starting at Level 1

## Deployment
Every push to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`, which publishes `index.html` only. To redeploy without a new commit, run the workflow manually from the Actions tab.
