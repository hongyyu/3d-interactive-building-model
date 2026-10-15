import {test, expect} from '@playwright/test';
import fs from 'node:fs';

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
  const [download] = await Promise.all([page.waitForEvent('download'), menuAction(page, 'a[download]')]);
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

  // importing from the start screen closes it once the user confirms
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#welcome [data-act=import]')]);
  await chooser.setFiles(new URL('./fixtures/program-with-issues.csv', import.meta.url).pathname);
  await page.click('#importOk');
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('#psub')).toHaveText('program-with-issues.csv · imported');

  // the brand mark reopens it; "Explore the demo" asks before replacing the imported project
  await page.click('#home');
  await expect(page.locator('#welcomeBack')).toBeVisible();
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
  expect(await page.evaluate(() => printTitles)).toEqual(['3D Interactive Building Model – Program report']);
  await expect(page).toHaveTitle('3D Interactive Building Model');
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
  // 1/2/3 switch the view mode, T toggles labels, P presents
  await page.keyboard.press('2');
  await pressed('#modes [data-mode=axon]');
  await page.keyboard.press('3');
  await pressed('#modes [data-mode=stack]');
  await page.keyboard.press('t');
  await expect(page.locator('#tools [data-act=labels]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#overlay .lbl:visible')).toHaveCount(0);
  await page.keyboard.press('t');
  await pressed('#tools [data-act=labels]');
  await page.keyboard.press('p');
  await expect(page.locator('#app')).toHaveClass(/present/);
  await page.keyboard.press('p');
  await expect(page.locator('#app')).not.toHaveClass(/present/);
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
  await expect(page.locator('#toolMenu a[download]')).toBeFocused();
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
  await expect(page.locator('#overlay .lbl', {hasText: 'Critical Care (ICU)'})).toHaveClass('lbl inv');
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
