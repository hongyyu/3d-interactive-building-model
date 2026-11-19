import {test, expect} from '@playwright/test';
import fs from 'node:fs';
import {demoMassing} from './massing-fixture.js';

// Replays a fixed scenario on the demo program. Each step checks a text snapshot of the
// panels and overlay labels plus a screenshot of the 3D stage; a few steps also check the
// whole page. Update baselines after an intended change with `npm run test:visual:update`.

const FULL_PAGE = new Set(['initial', 'select-dept-chip', 'narrow-viewport']);

async function settle(page) {
  await page.evaluate(() => new Promise(r => { let n = 0; const f = () => (++n > 6 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
}

async function domSnapshot(page) {
  return page.evaluate(() => JSON.stringify({
    title: document.title,
    top: document.querySelector('.top').innerText,
    left: document.querySelector('#left').innerHTML,
    right: document.querySelector('#right').innerHTML,
    status: document.querySelector('#status').hidden ? null : document.querySelector('#status').textContent,
    hint: document.querySelector('#hint').textContent,
    cursor: document.querySelector('#gl').style.cursor,
    overlay: [...document.querySelectorAll('#overlay > *')].map(e => [e.className, e.style.display, e.textContent].join('|')),
  }, null, 1));
}

async function labelCenter(page, name) {
  const c = await page.evaluate(n => {
    const el = [...document.querySelectorAll('#overlay .lbl')].find(l => l.style.display !== 'none' && l.querySelector('b').textContent === n);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x: r.left + r.width / 2, y: r.top + r.height / 2};
  }, name);
  if (!c) throw new Error('label not visible: ' + name);
  return c;
}

async function dragLabel(page, name, dx, dy) {
  const c = await labelCenter(page, name);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(c.x + dx * i / 10, c.y + dy * i / 10);
}

/* Screenshot of the free part of the stage, between the floating side panels: the 3D view and its
   labels. The panels' content is in the text snapshots, and the full-page shots show how they look. */
async function stageShot(page, name, soft = true) {
  const clip = await page.evaluate(() => {
    const s = document.querySelector('#stage'), r = s.getBoundingClientRect(), cs = getComputedStyle(s);
    // stay 24px clear of a panel, past its shadow
    const inset = v => { const n = parseFloat(cs.getPropertyValue(v)) || 0; return n ? n + 24 : 0; };
    const l = inset('--inset-l'), rr = inset('--inset-r');
    return {x: r.left + l, y: r.top, width: r.width - l - rr, height: r.height};
  });
  await (soft ? expect.soft(page) : expect(page)).toHaveScreenshot(name, {clip});
}

/* runs an item of a level row's ⋯ menu in the right panel; f is the level index (0 = Level 1) */
async function levelAction(page, f, act) {
  await page.click(`#right .lvl[data-f="${f}"] [data-act=lvlmenu]`);
  await page.click(`#levelMenu [data-act=${act}]`);
}

/* drags a level row's grip in the right panel to page height y */
async function dragLevel(page, f, y, release = true) {
  const g = await page.locator(`#right .grip[data-f="${f}"]`).boundingBox();
  const x = g.x + g.width / 2, y0 = g.y + g.height / 2;
  await page.mouse.move(x, y0);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x, y0 + (y - y0) * i / 10);
  if (release) await page.mouse.up();
}

/* the rows of the Rhino massing import dialog as 'ticked | name | levels | departments from' ('-' when
   there is no program to take departments from) */
function massRows(page) {
  return page.locator('#importBody .mrow').evaluateAll(rs => rs.map(r => [r.querySelector('[data-m=on]').checked, r.querySelector('.mname').value,
    r.querySelector('.mlv').value, (r.querySelector('select') || {value: '-'}).value].join(' | ')));
}

/* runs an item of the toolbar's More actions menu */
async function menuAction(page, sel) {
  await page.click('#tools [data-act=menu]');
  await page.click('#toolMenu ' + sel);
}

async function dragCanvas(page, button, sx, sy) {
  // start on open canvas, right of the floating left panel
  const b = await page.locator('#gl').boundingBox(), l = await page.locator('#left').boundingBox();
  const x = l.x + l.width + 40, y = b.y + 60;
  await page.mouse.move(x, y);
  await page.mouse.down({button});
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + sx * i, y + sy * i);
  await page.mouse.up({button});
}

const steps = [
  ['initial', async () => {}],
  ['labels-off', p => p.click('#tools [data-act=labels]')],
  ['labels-on', p => p.click('#tools [data-act=labels]')],
  ['axon', p => p.click('#modes [data-mode=axon]')],
  ['stack', p => p.click('#modes [data-mode=stack]')],
  ['select-opp', p => p.click('#left [data-b=opp]')],
  ['select-dept-chip', p => p.click('#right .chip[data-dept=inf]')],
  ['area-inc', p => p.click('#right [data-act=inc]')],
  ['area-dec', p => p.click('#right [data-act=dec]')],
  ['area-input', p => p.$eval('#area', el => { el.value = '30000'; el.dispatchEvent(new Event('change', {bubbles: true})); })],
  ['level-select', p => p.selectOption('#lvl', '4')],
  ['isolate-cat', p => p.click('#left [data-cat=amb]')],
  ['isolate-off', p => p.click('#left [data-cat=amb]')],
  ['axon2', p => p.click('#modes [data-mode=axon]')],
  ['hover-dept', async p => { const c = await labelCenter(p, 'Cardiology Clinic'); await p.mouse.move(c.x, c.y); }],
  ['drag-preview', p => dragLabel(p, 'Cardiology Clinic', 0, -140)],
  ['drag-commit', p => p.mouse.up()],
  ['drag-escape-preview', p => dragLabel(p, 'Neurology', 0, 160)],
  ['drag-escape', async p => { await p.keyboard.press('Escape'); await p.mouse.up(); }],
  ['deselect-x', p => p.click('#right [data-act=desel]')],
  ['wheel-zoom', async p => { const b = await p.locator('#gl').boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.wheel(0, -400); }],
  ['orbit', p => dragCanvas(p, 'left', 15, 6)],
  ['pan-right-drag', p => dragCanvas(p, 'right', 10, 5)],
  ['resetview', p => p.click('#tools [data-act=resetview]')],
  ['mass', p => p.click('#modes [data-mode=mass]')],
  ['btag-cup', p => p.click('#overlay .btag[data-b=cup]')],
  ['campus', p => p.click('#left [data-act=campus]')],
  ['select-tower-card', p => p.click('#left [data-b=tower]')],
  ['resetlayout', p => menuAction(p, '[data-act=resetlayout]')],
  ['present-on', p => p.click('#tools [data-act=present]')],
  ['present-off', p => p.click('#tools [data-act=present]')],
  ['narrow-viewport', p => p.setViewportSize({width: 420, height: 900})],
];

/* loads the page, which opens on the start screen; returns the list that collects uncaught page errors */
async function load(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Block web fonts so the test runs offline and fallback fonts keep rendering stable.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('/');
  await settle(page);
  return errors;
}

/* opens the app on the demo, past the start screen */
async function open(page) {
  const errors = await load(page);
  await page.click('#welcome [data-act=demo]');
  await expect(page.locator('#welcome')).toBeHidden();
  await settle(page);
  return errors;
}

test('demo program scenario', async ({page}) => {
  test.setTimeout(180_000);
  const errors = await open(page);

  for (const [i, [name, act]] of steps.entries()) {
    const id = String(i).padStart(2, '0') + '-' + name;
    await test.step(id, async () => {
      await act(page);
      await settle(page);
      expect.soft(await domSnapshot(page)).toMatchSnapshot(id + '.json');
      await stageShot(page, id + '.png');
      if (FULL_PAGE.has(name)) await expect.soft(page).toHaveScreenshot(id + '-page.png', {fullPage: true});
    });
  }
  expect(errors).toEqual([]);
});

test('downloaded template imports back to the same model', async ({page}) => {
  const errors = await open(page);
  const [download] = await Promise.all([page.waitForEvent('download'), menuAction(page, 'a[href$=".xlsx"]')]);
  expect(download.suggestedFilename()).toBe('program_template.xlsx');
  await page.setInputFiles('#importFile', {
    name: 'program_template.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: fs.readFileSync(await download.path()),
  });
  const body = page.locator('#importBody');
  await expect(body.locator('.kv')).toContainText('376,000 SF');
  await expect(body.locator('.kv')).toContainText('36 · 0');
  await expect(body.locator('.msgs')).toHaveCount(0);
  await page.click('#importOk');
  await expect(page.locator('#importDlg')).toBeHidden();
  await expect(page.locator('#psub')).toHaveText('program_template.xlsx · imported');
  await settle(page);
  // the imported template must render exactly like the built-in demo
  await stageShot(page, '00-initial.png', false);

  page.once('dialog', d => d.accept());
  await page.click('#left [data-act=demo]');
  await expect(page.locator('#psub')).toHaveText('Fictional demo campus · placeholder figures');
  await expect(page.locator('#left [data-act=demo]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('CSV import reports problems and fills the Unassigned tray', async ({page}) => {
  const errors = await open(page);
  await page.setInputFiles('#importFile', new URL('./fixtures/program-with-issues.csv', import.meta.url).pathname);
  const body = page.locator('#importBody');
  await expect(body.locator('.kv')).toContainText('37,300 SF');
  expect(await body.innerText()).toMatchSnapshot('csv-summary.txt');
  await page.click('#importOk');
  await settle(page);

  const right = page.locator('#right');
  const tray = right.locator('.blk', {hasText: 'Unassigned · 3'});
  await expect(tray.locator('.chip')).toHaveText([/Sleep Lab/, /Pharmacy/, /Rooftop Garden/]);
  expect.soft(await domSnapshot(page)).toMatchSnapshot('csv-imported.json');
  await stageShot(page, 'csv-imported.png');

  // place a tray department on Level 3 of the selected building, then send it back
  await tray.locator('.chip', {hasText: 'Sleep Lab'}).click();
  await expect(right.locator('.dcard')).toContainText('Sleep Medicine · Unassigned');
  await page.selectOption('#lvl', '2');
  await expect(right).toContainText('Unassigned · 2');
  await expect(right.locator('.lvl', {hasText: 'Level 3'})).toContainText('Sleep Lab');
  await settle(page);
  await stageShot(page, 'csv-placed.png');
  await page.selectOption('#lvl', '-1');
  await expect(right).toContainText('Unassigned · 3');

  // notes from the file show on the department card
  await right.locator('.chip', {hasText: 'Emergency Department'}).click();
  await expect(right.locator('.dnotes')).toHaveText('Ambulance entrance on the north side');

  // Reset layout returns to the imported layout, not the demo
  await page.selectOption('#lvl', '-1');
  await expect(right).toContainText('Unassigned · 4');
  await menuAction(page, '[data-act=resetlayout]');
  await expect(right).toContainText('Unassigned · 3');
  await expect(page.locator('#psub')).toHaveText('program-with-issues.csv · imported');
  expect(errors).toEqual([]);
});

test('a Rhino massing replaces the buildings and keeps the program', async ({page}) => {
  const errors = await open(page);
  const body = page.locator('#importBody'), rows = body.locator('.mrow');
  // a file that is not a Rhino model is rejected
  await page.setInputFiles('#massFile', {name: 'broken.3dm', mimeType: 'application/octet-stream', buffer: Buffer.from('not a rhino model')});
  await expect(body.locator('.msgs.err')).toContainText('could not be read', {timeout: 30_000});
  await expect(page.locator('#importOk')).toBeHidden();
  await page.click('#importDlg [value=cancel]');
  // so is a file that is neither a Rhino model nor a spreadsheet (the pickers don't filter by type)
  await page.setInputFiles('#massFile', {name: 'plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4')});
  await expect(body.locator('.msgs.err')).toContainText('reads a Rhino model (.3dm) for the buildings');
  await page.click('#importDlg [value=cancel]');

  // a program first (the template, so the demo's departments are the user's), then the massing
  const [template] = await Promise.all([page.waitForEvent('download'), menuAction(page, 'a[href$=".xlsx"]')]);
  await page.setInputFiles('#importFile', {name: 'program_template.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: fs.readFileSync(await template.path())});
  await page.click('#importOk');
  await expect(page.locator('#importDlg')).toBeHidden();

  await page.setInputFiles('#massFile', {name: 'campus-massing.3dm', mimeType: 'application/octet-stream', buffer: await demoMassing()});
  await expect(rows).toHaveCount(6, {timeout: 30_000});
  // names come from object and layer names and pick the demo building of that name; levels come from
  // User Text, stacked floors and the layer's floor-to-floor, and the plain boxes from their height;
  // the Context layer's mass starts unticked, and the box without a name is called Building 1
  expect(await massRows(page)).toEqual([
    'true | Hospital Tower | 8 | b1',
    'true | Diagnostic & Treatment | 3 | b2',
    'true | Outpatient Pavilion | 5 | b3',
    'true | Central Utility Plant | 3 | b4',
    'false | Neighbour | 4 | ',
    'true | Building 1 | 3 | ',
  ]);
  // guesses are marked until changed, the line above the list counts the ticked ones, and every row
  // says where its levels came from
  const hint = body.locator('#mhint');
  await expect(hint).toHaveText('Check the marked values: 2 level counts are estimated from height, and 1 building has no name in the file.');
  await expect(rows.nth(0).locator('.mmeta')).toContainText('levels from User Text');
  await expect(rows.nth(1).locator('.mmeta')).toContainText('levels from its floor boxes');
  await expect(rows.nth(3).locator('.mlv')).toHaveClass(/\best\b/);
  await expect(rows.nth(3).locator('.mmeta')).toContainText('levels estimated at 15 ft per floor');
  await expect(rows.nth(5).locator('.mname')).toHaveClass(/\best\b/);
  await expect(rows.nth(5).locator('.mmeta')).toContainText('no name in the file');
  await rows.nth(5).locator('[data-m=on]').uncheck();
  await expect(hint).toHaveText('Check the marked values: 1 level count is estimated from height.');
  await expect(body.locator('#mdemo')).toHaveCount(0);
  const notes = body.locator('.msgs:not(.warn)');
  for (const t of ['in metres', 'turned 20.0°', '1 hidden object', '1 flat object']) await expect(notes).toContainText(t);
  await expect(body.locator('#mkv')).toContainText('36 · 0');
  // a building's departments go to one mass only, and an untyped name follows the building picked
  await rows.nth(4).locator('select').selectOption('b1');
  await expect(rows.nth(0).locator('select')).toHaveValue('');
  await expect(rows.nth(4).locator('.mname')).toHaveValue('Hospital Tower');
  await expect(body.locator('#mkv')).not.toContainText('36 · 0');
  await rows.nth(0).locator('select').selectOption('b1');
  await expect(rows.nth(4).locator('select')).toHaveValue('');
  // the plant's height over 2 levels gives the demo's 20 ft floors, and it is no longer a guess
  await rows.nth(3).locator('.mlv').fill('2');
  await expect(rows.nth(3).locator('.mmeta')).toContainText('20.0 ft floor-to-floor');
  await expect(rows.nth(3).locator('.mmeta')).toContainText('levels set by you');
  await expect(rows.nth(3).locator('.mlv')).not.toHaveClass(/\best\b/);
  await expect(hint).toBeHidden();
  await page.click('#importOk');
  await expect(page.locator('#importDlg')).toBeHidden();
  await expect(page.locator('#psub')).toHaveText('program_template.xlsx · imported · campus-massing.3dm');
  await settle(page);
  // the massing is the demo campus, so the model must look exactly like it
  await stageShot(page, '00-initial.png', false);
  expect(errors).toEqual([]);
});

test('downloaded Rhino example imports back, and a program import keeps its buildings', async ({page}) => {
  const errors = await open(page);
  const [massing] = await Promise.all([page.waitForEvent('download'), menuAction(page, 'a[href$=".3dm"]')]);
  expect(massing.suggestedFilename()).toBe('campus_massing.3dm');
  const [template] = await Promise.all([page.waitForEvent('download'), menuAction(page, 'a[href$=".xlsx"]')]);
  await page.setInputFiles('#massFile', {name: 'campus_massing.3dm', mimeType: 'application/octet-stream', buffer: fs.readFileSync(await massing.path())});
  await expect(page.locator('#importBody .mrow')).toHaveCount(4, {timeout: 30_000});
  // only the demo program is loaded, which is not carried over: the buildings come in empty and there
  // is no "Departments from" column
  expect(await massRows(page)).toEqual([
    'true | Hospital Tower | 8 | -',
    'true | Diagnostic & Treatment | 3 | -',
    'true | Central Utility Plant | 2 | -',
    'true | Outpatient Pavilion | 5 | -',
  ]);
  await expect(page.locator('#mdemo')).toContainText('No program loaded yet');
  await expect(page.locator('#mkv')).toContainText('Not loaded yet');
  // every level count and name comes from the file, so nothing is marked
  await expect(page.locator('#mhint')).toBeHidden();
  await expect(page.locator('#importBody .est')).toHaveCount(0);
  await expect(page.locator('#importBody .msgs:not(.warn)')).toContainText('1 flat object');
  // "Replace, then import program…" applies the massing and opens the program file picker straight away
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#importOkProg')]);
  await expect(page.locator('#psub')).toHaveText('campus_massing.3dm');
  await expect(page.locator('#left')).toContainText('No program loaded yet');
  await expect(page.locator('#right')).toContainText('0 SF · 0%');
  await settle(page);
  await stageShot(page, 'rhino-no-program.png');

  // the Excel template has a Buildings sheet, but the buildings from Rhino are kept unless it is ticked
  await chooser.setFiles({name: 'program_template.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: fs.readFileSync(await template.path())});
  const kv = page.locator('#importBody .kv'), use = page.locator('#useSheet');
  await expect(kv).toContainText('4 (current)');
  await expect(use).not.toBeChecked();
  await expect(page.locator('#importBody .opt')).toContainText('instead of the current buildings from campus_massing.3dm');
  await use.check();
  await expect(kv).not.toContainText('(current)');
  await use.uncheck();
  await expect(kv).toContainText('4 (current)');
  await page.click('#importOk');
  await expect(page.locator('#psub')).toHaveText('program_template.xlsx · imported · campus_massing.3dm');
  await settle(page);
  await stageShot(page, '00-initial.png', false);
  // the start screen's checklist shows both files
  await page.click('#home');
  await expect(page.locator('#wBldg')).toHaveText('✓ campus_massing.3dm · 4 buildings');
  await expect(page.locator('#wProg')).toHaveText('✓ program_template.xlsx · 36 departments');
  expect(errors).toEqual([]);
});

test('a file without the required columns is rejected', async ({page}) => {
  await open(page);
  await page.setInputFiles('#importFile', {name: 'rooms.csv', mimeType: 'text/csv', buffer: Buffer.from('Room,Size\nExam 1,120\n')});
  await expect(page.locator('#importBody .msgs.err')).toContainText('The Program sheet has no Department or SF column.');
  await expect(page.locator('#importOk')).toBeHidden();
  await page.click('#importDlg button[value=cancel]');
  await expect(page.locator('#importDlg')).toBeHidden();
  await expect(page.locator('#psub')).toHaveText('Fictional demo campus · placeholder figures');
});

test('start screen, adding levels and the laser pointer', async ({page}) => {
  const errors = await load(page);
  // the start screen covers the app until the user picks a way in
  await expect(page.locator('#welcome')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('#app').inert)).toBe(true);
  await expect.soft(page).toHaveScreenshot('welcome-page.png');

  // the checklist starts empty; an import from it keeps the start screen open and ticks its row, and
  // "Open the model" goes in
  const bldg = page.locator('#wBldg'), prog = page.locator('#wProg'), go = page.locator('#wGo');
  await expect(bldg).toHaveText('Not loaded yet · example model');
  await expect(prog).toHaveText('Not loaded yet · template');
  await expect(go).toContainText('Explore the demo');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#welcome [data-act=import]')]);
  await chooser.setFiles(new URL('./fixtures/program-with-issues.csv', import.meta.url).pathname);
  await page.click('#importOk');
  await expect(prog).toHaveText('✓ program-with-issues.csv · 6 departments');
  await expect(bldg).toHaveText('Not loaded yet · example model');
  await expect(page.locator('#wGoNote')).toContainText('The program sits on the demo buildings');
  await expect(go).toHaveText('Open the model');
  await expect(page.locator('#welcome')).toBeVisible();
  await go.click();
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('#psub')).toHaveText('program-with-issues.csv · imported');

  // the brand mark reopens it; "Explore the demo instead" asks before replacing the imported project
  await page.click('#home');
  await expect(go).toHaveText('Open the model');
  page.once('dialog', d => d.accept());
  await page.click('#welcome [data-act=demo]');
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('#psub')).toHaveText('Fictional demo campus · placeholder figures');

  // add an empty level on top of the Hospital Tower
  await page.click('#modes [data-mode=axon]');
  const right = page.locator('#right'), tower = page.locator('#left [data-b=tower]');
  await page.click('#right [data-act=addlevel]');
  await expect(tower).toContainText('9 levels');
  await expect(right.locator('.lvl').first()).toContainText('Level 9');
  await expect(right.locator('.lvl').first()).toContainText('Empty level');
  await settle(page);
  await stageShot(page, 'level-added.png');

  // removing a level that holds departments sends them to the Unassigned tray
  await levelAction(page, 8, 'lvl-remove');
  await levelAction(page, 7, 'lvl-remove');
  await expect(tower).toContainText('7 levels');
  await expect(right.locator('.blk', {hasText: 'Unassigned · 2'}).locator('.chip')).toHaveText([/Behavioral Health/, /Administration/]);
  await settle(page);
  await stageShot(page, 'level-removed.png');

  // Reset layout restores the loaded level count, so the view matches the scenario's axon step
  await menuAction(page, '[data-act=resetlayout]');
  await expect(tower).toContainText('8 levels');
  await expect(right).not.toContainText('Unassigned');
  await settle(page);
  await stageShot(page, '03-axon.png');

  // laser: moving the mouse draws nothing; a drag draws a red line and leaves the model where it was
  await page.click('#tools [data-act=laser]');
  await expect(page.locator('#laser')).toBeVisible();
  await expect(page.locator('#stage')).toHaveClass(/lasering/);
  // draw on open canvas, right of the floating left panel; the laser leaves the panels alone
  const b = await page.locator('#gl').boundingBox(), lp = await page.locator('#left').boundingBox();
  const x = lp.x + lp.width + 40, y = b.y + 200;
  const laserPixel = (px, py) => page.evaluate(([px, py]) => new Promise(done => {
    // two frames, so the laser has drawn the latest pointer moves
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = document.querySelector('#laser'), s = c.width / innerWidth;
      done([...c.getContext('2d').getImageData(Math.round(px * s), Math.round(py * s), 1, 1).data]);
    }));
  }), [px, py]);
  for (let i = 0; i <= 10; i++) await page.mouse.move(x + i * 20, y + i * 5);
  expect((await laserPixel(x + 100, y + 25))[3]).toBe(0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + i * 20, y + i * 5);
  const px = await laserPixel(x + 100, y + 25);
  await page.mouse.up();
  expect(px[0]).toBeGreaterThan(150);
  expect(px[3]).toBeGreaterThan(100);
  // L toggles it off and clears the drawing
  // the laser tool keeps focus from its click, and a key press would show its focus tooltip over the stage
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('l');
  await expect(page.locator('#laser')).toBeHidden();
  await expect(page.locator('#tools [data-act=laser]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#stage')).not.toHaveClass(/lasering/);
  await page.mouse.move(b.x + b.width + 40, b.y + 40);
  await settle(page);
  await stageShot(page, '03-axon.png');
  expect(errors).toEqual([]);
});

test('printed report covers every building, level and department', async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-03-02T12:00:00'));
  const errors = await open(page);
  // headless Chromium skips the print dialog but still fires beforeprint and afterprint; this
  // listener runs after the app's, so it sees the title that names the PDF
  await page.evaluate(() => { window.printTitles = []; addEventListener('beforeprint', () => printTitles.push(document.title)); });
  await menuAction(page, '[data-act=print]');
  expect(await page.evaluate(() => printTitles)).toEqual(['Dado – Program report']);
  await expect(page).toHaveTitle('Dado');
  // the view picture is rendered at 2x; the model on screen must come back unchanged
  await settle(page);
  await stageShot(page, '00-initial.png', false);

  // in print, the page holds only the report: the summary, then one page per building
  await page.emulateMedia({media: 'print'});
  const report = page.locator('#report');
  await expect(report).toBeVisible();
  await expect(page.locator('#app')).toBeHidden();
  expect.soft(await report.innerText()).toMatchSnapshot('report.txt');
  await expect(report.locator('.r-bldg')).toHaveCount(4);
  expect(await report.locator('.r-bldg').first().evaluate(e => getComputedStyle(e).breakBefore)).toBe('page');
  // the view picture shows the model, trimmed to it
  const inked = await report.locator('.r-fig canvas').evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.min(d[i], d[i + 1], d[i + 2]) < 200) n++;
    return n / (c.width * c.height);
  });
  expect(inked).toBeGreaterThan(0.2);
  await page.emulateMedia({media: 'screen'});

  // the browser's own print (Ctrl+P / ⌘P) rebuilds it from the live layout. Chromium ignores repeated
  // print() calls without a user gesture, so fire its events directly
  const browserPrint = () => page.evaluate(() => { dispatchEvent(new Event('beforeprint')); dispatchEvent(new Event('afterprint')); });
  await page.click('#left [data-b=tower]');
  await page.click('#right .chip[data-dept=icu]');
  await page.fill('#area', '30000');
  await page.press('#area', 'Enter');
  await expect(page.locator('#right .lvl', {hasText: 'Level 4'})).toContainText('35,000 / 24,000 SF · over');
  await page.click('#right .chip[data-dept=bh]');
  await page.selectOption('#lvl', '-1');
  await browserPrint();
  await expect(report.locator('.r-kv').first()).toContainText('35 placed · 1 unassigned');
  await expect(report.locator('.r-kv').first()).toContainText('1 level');
  await expect(report.locator('.r-sec', {hasText: 'Unassigned · 1'})).toContainText('Behavioral Health');
  await expect(report.locator('.r-lvrow.r-over')).toHaveText(/Level 4Over by 11,000 SF\s*35,000\s*146%/);

  // from the start screen the browser prints the page as it is
  await page.click('#home');
  await browserPrint();
  await expect(page.locator('html')).not.toHaveClass(/print-report/);
  expect(errors).toEqual([]);
});

test('toolbar shortcuts and menu', async ({page}) => {
  const errors = await open(page);
  const pressed = sel => expect(page.locator(sel)).toHaveAttribute('aria-pressed', 'true');
  // 1/2/3 switch the view mode
  await page.keyboard.press('2');
  await pressed('#modes [data-mode=axon]');
  await page.keyboard.press('3');
  await pressed('#modes [data-mode=stack]');
  // T (labels) and S (SF on labels) apply to every view: switched off in one, they stay off in the others
  const labels = page.locator('#tools [data-act=labels]'), sf = page.locator('#tools [data-act=sf]');
  const shown = page.locator('#overlay .lbl:visible'), sfLines = page.locator('#overlay .lbl span:visible');
  await page.keyboard.press('t');
  await expect(labels).toHaveAttribute('aria-pressed', 'false');
  await expect(shown).toHaveCount(0);
  for (const key of ['2', '1']) {
    await page.keyboard.press(key);
    await expect(labels).toHaveAttribute('aria-pressed', 'false');
    await expect(shown).toHaveCount(0);
  }
  await page.keyboard.press('t');
  await pressed('#tools [data-act=labels]');
  await pressed('#tools [data-act=sf]');
  await expect(sfLines.first()).toBeVisible();
  await page.keyboard.press('s');
  await expect(sf).toHaveAttribute('aria-pressed', 'false');
  for (const key of ['3', '2', '1']) {
    await page.keyboard.press(key);
    await expect(sf).toHaveAttribute('aria-pressed', 'false');
    await expect(shown.first()).toBeVisible();
    await expect(sfLines).toHaveCount(0);
  }
  await sf.click();
  for (const key of ['1', '2', '3']) {
    await page.keyboard.press(key);
    await pressed('#tools [data-act=sf]');
    await expect(sfLines.first()).toBeVisible();
  }
  // P presents
  await page.keyboard.press('p');
  await expect(page.locator('#app')).toHaveClass(/present/);
  await page.keyboard.press('p');
  await expect(page.locator('#app')).not.toHaveClass(/present/);
  // in a smaller window Axon's floors are too thin for two full-size lines: the SF line still shows,
  // on smaller text, and S still takes it away and brings it back
  const shrunk = () => page.evaluate(() => [...document.querySelectorAll('#overlay .lbl')].some(l => l.style.display !== 'none' &&
    getComputedStyle(l.lastChild).display !== 'none' && parseFloat(l.style.getPropertyValue('--ls')) < 1));
  await page.setViewportSize({width: 846, height: 946});
  await page.keyboard.press('2');
  await expect(sfLines.first()).toBeVisible();
  await expect.poll(shrunk).toBe(true);
  await page.keyboard.press('s');
  await expect(sfLines).toHaveCount(0);
  await expect(page.locator('#overlay .lbl:visible').first()).toBeVisible();
  await page.keyboard.press('s');
  await expect(sfLines.first()).toBeVisible();
  await page.setViewportSize({width: 1440, height: 900});
  await page.keyboard.press('1');
  await pressed('#modes [data-mode=mass]');
  // shortcuts are ignored while typing in a field
  await page.click('#left [data-b=tower]');
  await page.click('#right .chip[data-dept=icu]');
  await page.focus('#area');
  await page.keyboard.press('2');
  await pressed('#modes [data-mode=mass]');
  await page.fill('#area', '18000');
  // the menu opens from the keyboard with focus on its first item, and Escape closes it
  await page.focus('#tools [data-act=menu]');
  await page.keyboard.press('Enter');
  await expect(page.locator('#toolMenu')).toBeVisible();
  await expect(page.locator('#toolMenu [data-act=import]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#toolMenu [data-act=massing]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#toolMenu')).toBeHidden();
  await expect(page.locator('#tools [data-act=menu]')).toBeFocused();
  // a click outside closes it too
  await page.click('#tools [data-act=menu]');
  await expect(page.locator('#tools [data-act=menu]')).toHaveAttribute('aria-expanded', 'true');
  await page.mouse.click(700, 500);
  await expect(page.locator('#toolMenu')).toBeHidden();
  expect(errors).toEqual([]);
});

test('levels can be reordered, inserted and removed from the panel', async ({page}) => {
  const errors = await open(page);
  await page.click('#left [data-b=tower]');
  await page.click('#modes [data-mode=axon]');
  const right = page.locator('#right'), row = f => right.locator(`.lvl[data-f="${f}"]`);
  const tag = n => page.locator('#overlay .ftag').nth(n - 1);

  // drag Level 3 above Level 8: it becomes Level 8, the levels above it move down, and the
  // building follows (the floor tags show the new totals)
  const top = await row(7).boundingBox();
  await dragLevel(page, 2, top.y - 6);
  await expect(row(7)).toContainText('Imaging');
  await expect(row(6)).toContainText('Behavioral Health');
  await expect(row(2)).toContainText('Critical Care (ICU)');
  await expect(tag(8)).toHaveText('L823.0k / 24.0k');
  await settle(page);
  await stageShot(page, 'level-dragged.png');

  // the arrow keys on a grip move its level one step, and the grip keeps focus
  await page.focus('#right .grip[data-f="7"]');
  await page.keyboard.press('ArrowDown');
  await expect(row(6)).toContainText('Imaging');
  await expect(page.locator('#right .grip[data-f="6"]')).toBeFocused();

  // Escape during a drag puts the old order back
  await dragLevel(page, 0, (await row(3).boundingBox()).y, false);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(row(0)).toContainText('Emergency Department');
  await expect(row(6)).toContainText('Imaging');

  // insert an empty level below Level 5, then remove Level 2, which sends its departments to the tray
  await levelAction(page, 4, 'lvl-below');
  await expect(page.locator('#left [data-b=tower]')).toContainText('9 levels');
  await expect(row(4)).toContainText('Empty level');
  await expect(row(5)).toContainText('Med-Surg Unit A');
  await levelAction(page, 1, 'lvl-remove');
  await expect(page.locator('#left [data-b=tower]')).toContainText('8 levels');
  await expect(right.locator('.blk', {hasText: 'Unassigned · 3'}).locator('.chip')).toHaveText([/Surgery Suite/, /PACU/, /Sterile Processing/]);

  // the fold button hides everything under the building name, and shows it again
  await page.click('#right [data-act=fold]');
  await expect(right.locator('.lvls')).toHaveCount(0);
  await expect(page.locator('#right [data-act=fold]')).toHaveAttribute('aria-expanded', 'false');
  await page.click('#right [data-act=fold]');
  await expect(right.locator('.lvls')).toBeVisible();

  // the Buildings fold button hides the building cards, and shows them again
  const bfold = page.locator('#left [data-act=bfold]');
  await bfold.click();
  await expect(page.locator('#left .bcard')).toHaveCount(0);
  await expect(bfold).toHaveAttribute('aria-expanded', 'false');
  await expect(bfold).toBeFocused();
  await bfold.click();
  await expect(page.locator('#left .bcard')).toHaveCount(4);
  await expect(page.locator('#left [data-act=campus]')).toBeVisible();
  await expect(page.locator('#left [data-b=tower]')).toContainText('8 levels');
  expect(errors).toEqual([]);
});

test('buildings can be added and deleted', async ({page}) => {
  const errors = await open(page);
  const left = page.locator('#left'), right = page.locator('#right'), dlg = page.locator('#buildingDlg');
  const sum = page.locator('#bdSum');

  // the dialog suggests a new name and sizes, and refuses a name another building has
  await page.click('#left [data-act=addbuilding]');
  await expect(dlg).toBeVisible();
  await expect(page.locator('#bdName')).toHaveValue('Building 5');
  await expect(sum).toHaveText('21,600 SF floor plate · 4 levels · 86,400 GSF. It goes on a free spot of the site.');
  await page.fill('#bdName', 'hospital tower');
  await page.click('#buildingDlg button[value=ok]');
  await expect(dlg).toBeVisible();
  expect(await page.$eval('#bdName', e => e.validationMessage)).toBe('Another building already has this name.');
  await page.fill('#bdName', 'Research Pavilion');
  await page.fill('#bdW', '160');
  await page.fill('#bdN', '5');
  await expect(sum).toContainText('19,200 SF floor plate · 5 levels · 96,000 GSF');
  await page.click('#buildingDlg button[value=ok]');
  await expect(dlg).toBeHidden();

  // the new building is focused with its empty levels, and stands where the camera sees it
  await expect(left.locator('.bcard')).toHaveCount(5);
  await expect(left.locator('.bcard.on')).toContainText('Research Pavilion5 levels · 96,000 GSF');
  await expect(right.locator('.title')).toHaveText('Research Pavilion');
  await expect(right.locator('.lvl')).toHaveCount(5);
  await expect(right.locator('.lvl').first()).toContainText('Empty level');
  await expect(page.locator('#left [data-act=addbuilding]')).toBeFocused();
  await settle(page);
  await stageShot(page, 'building-added.png');
  await page.click('#left [data-act=campus]');
  await expect(right.locator('.kv')).toContainText('Buildings5');
  await settle(page);
  await stageShot(page, 'building-added-campus.png');

  // the next dialog keeps the last sizes; Cancel adds nothing
  await page.click('#left [data-act=addbuilding]');
  await expect(page.locator('#bdName')).toHaveValue('Building 6');
  await expect(sum).toContainText('19,200 SF floor plate · 5 levels');
  await page.click('#buildingDlg button[value=cancel]');
  await expect(left.locator('.bcard')).toHaveCount(5);

  // Edit building (⋯ menu) renames and resizes a building in place, and warns when the new plate
  // would overlap a neighbour
  const more = page.locator('#right [data-act=bldmenu]');
  await page.click('#left [data-b=b1]');
  await more.click();
  await page.click('#buildingMenu [data-act=bld-edit]');
  await expect(page.locator('#bdTitle')).toHaveText('Edit building');
  await expect(page.locator('#bdName')).toHaveValue('Research Pavilion');
  await expect(page.locator('#bdNWrap')).toBeHidden();
  await page.fill('#bdW', '320');
  await expect(sum).toHaveText('38,400 SF floor plate · 5 levels · 192,000 GSF. It would overlap Diagnostic & Treatment.');
  await page.fill('#bdName', 'Research Center');
  await page.fill('#bdW', '180');
  await page.fill('#bdD', '130');
  await expect(sum).toHaveText('23,400 SF floor plate · 5 levels · 117,000 GSF.');
  await page.click('#bdOk');
  await expect(dlg).toBeHidden();
  await expect(left.locator('.bcard.on')).toContainText('Research Center5 levels · 117,000 GSF');
  await expect(right.locator('.title')).toHaveText('Research Center');
  await expect(right.locator('.kv')).toContainText('Floor plate23,400 SF');
  await expect(more).toBeFocused();
  await settle(page);
  await stageShot(page, 'building-edited.png');

  // the ⋯ menu deletes the focused building: its departments go to the tray and 3D Massing goes
  // back to the campus overview; it opens from the keyboard and Escape returns focus to it
  await page.click('#left [data-b=tower]');
  const del = page.locator('#buildingMenu [data-act=bld-delete]');
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#buildingMenu [data-act=bld-edit]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(del).toBeFocused();
  await expect(del).toHaveText(/Delete Hospital Tower\s*16 departments move to Unassigned/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#buildingMenu')).toBeHidden();
  await expect(more).toBeFocused();
  await more.click();
  await del.click();
  await expect(left.locator('.bcard')).toHaveCount(4);
  await expect(left).not.toContainText('Hospital Tower');
  await expect(page.locator('#left [data-act=campus]')).toHaveAttribute('aria-pressed', 'true');
  await expect(right.locator('.blk', {hasText: 'Unassigned · 16'})).toBeVisible();
  await settle(page);
  await stageShot(page, 'building-deleted.png');

  // Reset layout brings the tower back and drops the added building, so the stage matches the
  // scenario's first step
  await menuAction(page, '[data-act=resetlayout]');
  await expect(left.locator('.bcard .bn')).toHaveText(['Hospital Tower', 'Diagnostic & Treatment', 'Outpatient Pavilion', 'Central Utility Plant']);
  await expect(right).not.toContainText('Unassigned');
  await settle(page);
  await stageShot(page, '00-initial.png');
  expect(errors).toEqual([]);
});

test('departments can be added, edited, moved and deleted', async ({page}) => {
  const errors = await open(page);
  const right = page.locator('#right'), card = right.locator('.dcard'), dlg = page.locator('#deptDlg');
  const sum = page.locator('#ddSum'), row = f => right.locator(`.lvl[data-f="${f}"]`);

  // a new building starts empty and says how to fill it
  await page.click('#left [data-act=addbuilding]');
  await page.click('#bdOk');
  await expect(right.locator('.title')).toHaveText('Building 5');
  await expect(right).toContainText('No departments here yet.');

  // + Add department suggests a new name and the roomiest level, and refuses a name in use
  await page.click('#right [data-act=adddept]');
  await expect(dlg).toBeVisible();
  await expect(page.locator('#ddKind')).toHaveText('Building 5');
  await expect(page.locator('#ddName')).toHaveValue('New department');
  await expect(page.locator('#ddLvl')).toHaveValue('0');
  await expect(sum).toHaveText('Level 1 then holds 5,000 of its 21,600 SF.');
  await page.fill('#ddName', 'pharmacy');
  await page.click('#deptDlg button[value=ok]');
  await expect(dlg).toBeVisible();
  expect(await page.$eval('#ddName', e => e.validationMessage)).toBe('Another department already has this name.');
  await page.fill('#ddName', 'Sleep Lab');
  await page.selectOption('#ddCat', 'diag');
  await page.selectOption('#ddLvl', '1');
  await page.fill('#ddArea', '24000');
  await expect(sum).toHaveText('Level 2 then holds 24,000 of its 21,600 SF, over by 2,400 SF.');
  await page.fill('#ddArea', '9000');
  await page.click('#deptDlg button[value=ok]');
  await expect(dlg).toBeHidden();
  // the new department is selected, so its card is open
  await expect(page.locator('#dname')).toHaveValue('Sleep Lab');
  await expect(card).toContainText('Diagnostic & Imaging · Level 2');
  await expect(row(1)).toContainText('9,000 / 21,600 SF');
  await expect(page.locator('#right [data-act=adddept]')).toBeFocused();

  // the card renames it, refusing a name in use, and changes its category
  await page.fill('#dname', 'Pharmacy');
  await page.press('#dname', 'Enter');
  expect(await page.$eval('#dname', e => e.validationMessage)).toBe('Another department already has this name.');
  await expect(row(1).locator('.chip')).toHaveText(/Sleep Lab/);
  await page.fill('#dname', 'Sleep Medicine');
  await page.press('#dname', 'Enter');
  await expect(row(1).locator('.chip')).toHaveText(/Sleep Medicine/);
  await page.selectOption('#dcat', 'amb');
  await expect(card).toContainText('Ambulatory & Clinics · Level 2');

  // a level's ⋯ menu adds a department on that level, in the selected department's category
  await levelAction(page, 3, 'lvl-dept');
  await expect(page.locator('#ddLvl')).toHaveValue('3');
  await expect(page.locator('#ddCat')).toHaveValue('amb');
  await page.fill('#ddName', 'Sleep Clinic');
  await page.click('#deptDlg button[value=ok]');
  await expect(row(3)).toContainText('Sleep Clinic');

  // the Level list reaches every building: the tower's Laboratory moves to Level 3 here, and the
  // view follows it
  await page.click('#left [data-b=tower]');
  await right.locator('.chip[data-dept=lab]').click();
  await page.selectOption('#lvl', 'b1:2');
  await expect(right.locator('.title')).toHaveText('Building 5');
  await expect(card).toContainText('Diagnostic & Imaging · Level 3');
  await expect(row(2)).toContainText('Laboratory');
  await settle(page);
  await stageShot(page, 'program-added.png');

  // Delete department takes it out of the program
  await right.locator('.chip', {hasText: 'Sleep Medicine'}).click();
  await page.click('#right [data-act=deldept]');
  await expect(card).toHaveCount(0);
  await expect(right).not.toContainText('Sleep Medicine');
  await expect(page.locator('#overlay .lbl b', {hasText: 'Sleep Medicine'})).toHaveCount(0);

  // Reset layout goes back to the loaded program and buildings, so the stage matches the scenario's
  // first step
  await menuAction(page, '[data-act=resetlayout]');
  await expect(page.locator('#left .bcard')).toHaveCount(4);
  await expect(page.locator('#overlay .lbl')).toHaveCount(36);
  await settle(page);
  await stageShot(page, '00-initial.png');
  await page.click('#left [data-b=tower]');
  await expect(row(2)).toContainText('Laboratory');
  expect(errors).toEqual([]);
});

test('colour panel', async ({page}) => {
  const errors = await open(page);
  const left = page.locator('#left'), right = page.locator('#right'), panel = page.locator('#colorPanel');
  const hex = panel.locator('#cpHex'), reset = left.locator('[data-act=resetcolors]'), swatch = left.locator('[data-catcolor=inpt]');
  const navy = 'rgb(31, 42, 102)';

  // a category swatch opens the panel on the category's colour
  await expect(reset).toBeHidden();
  await swatch.click();
  await expect(panel).toBeVisible();
  await expect(panel.locator('#cpTitle')).toHaveText('Inpatient Units');
  await expect(hex).toHaveValue('#5FB27F');
  await expect(panel.locator('#cpPalette .on')).toHaveAttribute('data-hex', '#5fb27f');

  // palette, saturation/brightness area and hex field all apply at once, and the panel stays open
  await panel.locator('#cpPalette [data-hex="#3451a8"]').click();
  await expect(swatch.locator('i')).toHaveCSS('background-color', 'rgb(52, 81, 168)');
  const sv = await panel.locator('#cpSV').boundingBox();
  await page.mouse.move(sv.x + sv.width / 2, sv.y + sv.height / 2);
  await page.mouse.down();
  await page.mouse.move(sv.x - 30, sv.y + sv.height + 30);  // past the bottom-left corner: black
  await page.mouse.up();
  await expect(hex).toHaveValue('#000000');
  await hex.fill('#1f2a66');
  await expect(right.locator('.pb .bar i[title^="Inpatient Units"]')).toHaveCSS('background-color', navy);
  await expect(reset).toBeVisible();
  await expect(panel).toBeVisible();
  await page.mouse.move(10, 10);
  await settle(page);
  await expect.soft(page).toHaveScreenshot('color-panel-page.png');

  // Escape closes it and returns focus to the swatch
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(swatch).toBeFocused();
  await settle(page);
  await stageShot(page, 'recolor-category.png');

  // Reset colours brings back the loaded colours exactly
  await reset.click();
  await expect(reset).toBeHidden();
  await expect(swatch.locator('i')).toHaveCSS('background-color', 'rgb(95, 178, 127)');
  await settle(page);
  await stageShot(page, '00-initial.png', false);

  // a department's own colour overrides its category; a label on a dark colour turns white
  await page.click('#left [data-b=tower]');
  await page.click('#modes [data-mode=axon]');
  await page.click('#right .chip[data-dept=icu]');
  await right.locator('#dcol').click();
  await expect(panel.locator('#cpKind')).toHaveText('Department colour');
  await expect(panel.locator('#cpReset')).toBeHidden();
  await hex.fill('#1f2a66');
  for (const sel of ['.dhead i', '.bseg[data-dept=icu]', '.chip[data-dept=icu] i', '#dcol i']) await expect(right.locator(sel)).toHaveCSS('background-color', navy);
  await expect(right.locator('#dcol')).toContainText('Custom');
  await expect(panel.locator('#cpReset')).toBeVisible();
  // a click outside closes the panel
  await right.locator('.title').click();
  await expect(panel).toBeHidden();
  await settle(page);
  await expect(page.locator('#overlay .lbl', {hasText: 'Critical Care (ICU)'})).toHaveClass(/\binv\b/);
  await stageShot(page, 'recolor-dept.png');

  // "Use category colour" drops it again
  await right.locator('#dcol').click();
  await panel.locator('#cpReset').click();
  await expect(hex).toHaveValue('#E0554E');
  await expect(panel.locator('#cpReset')).toBeHidden();
  await expect(right.locator('#dcol')).toContainText('Category colour');
  await expect(reset).toBeHidden();
  expect(errors).toEqual([]);
});
