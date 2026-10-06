import {test, expect} from '@playwright/test';

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

async function dragCanvas(page, button, sx, sy) {
  const b = await page.locator('#gl').boundingBox();
  const x = b.x + 40, y = b.y + 60;
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
  ['resetlayout', p => p.click('#tools [data-act=resetlayout]')],
  ['present-on', p => p.click('#tools [data-act=present]')],
  ['present-off', p => p.click('#tools [data-act=present]')],
  ['narrow-viewport', p => p.setViewportSize({width: 420, height: 900})],
];

test('demo program scenario', async ({page}) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Block web fonts so the test runs offline and fallback fonts keep rendering stable.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('/');
  await settle(page);

  for (const [i, [name, act]] of steps.entries()) {
    const id = String(i).padStart(2, '0') + '-' + name;
    await test.step(id, async () => {
      await act(page);
      await settle(page);
      expect.soft(await domSnapshot(page)).toMatchSnapshot(id + '.json');
      await expect.soft(page.locator('#stage')).toHaveScreenshot(id + '.png');
      if (FULL_PAGE.has(name)) await expect.soft(page).toHaveScreenshot(id + '-page.png', {fullPage: true});
    });
  }
  expect(errors).toEqual([]);
});
