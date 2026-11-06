import { strict as assert } from 'node:assert';
const { chromium } = await import(process.env.STELLA_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('http://localhost:3000/app.html');
  await page.getByText('데미지 계산기 BETA', { exact: true }).click();
  const section = number => page.locator('[data-calc-section]').nth(number - 1);
  const expand = async number => { if (await section(number).getAttribute('open') === null) await section(number).locator('summary').first().click(); };
  await expand(6);
  assert.equal(await page.locator('[data-action=cycle-search]').isDisabled(), true);
  assert.doesNotMatch(await page.locator('#dmgcalc-cycle').innerText(), /세이나/);
  await expand(1);
  await page.locator('[data-action=calc-ingame-preset]').click();
  await page.locator('#ingame-code-import-input').fill('AAAAogAAAHMAAABrzbAB4YbBiAgMAGwAIAQQ');
  await page.locator('[data-action=saveload-ingame-import]').click();
  await page.locator('#ingame-code-modal').waitFor({ state: 'detached' });
  await page.getByText('데미지 계산기 BETA', { exact: true }).click();
  await expand(3); await expand(6);
  const note = page.locator('input.dmgcalc-note-level[data-note-id="90012"]');
  await note.fill('45'); await note.press('Tab');
  await page.locator('[data-action=cycle-search]').click();
  await page.locator('[data-action=cycle-candidate]').first().waitFor({ timeout: 120000 });
  const first = await page.locator('#dmgcalc-cycle .dmgcalc-key-stats strong').first().innerText();
  const downloadEvent = page.waitForEvent('download');
  await page.locator('[data-action=cycle-download]').click();
  const download = await downloadEvent;
  const { readFile } = await import('node:fs/promises');
  const report = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(report.input.notes['90012'], 45);
  assert.equal(report.input.actors[0].limitBreak, 0); // Not the example's LB1.
  assert.ok(report.input.records.every(record => record.id === 0)); // No hidden example records.
  await note.fill('99'); await note.press('Tab');
  assert.equal(await page.locator('[data-action=cycle-candidate]').count(), 0);
  await page.locator('[data-action=cycle-search]').click();
  await page.locator('[data-action=cycle-candidate]').first().waitFor({ timeout: 120000 });
  const second = await page.locator('#dmgcalc-cycle .dmgcalc-key-stats strong').first().innerText();
  assert.notEqual(first, second);
  assert.equal(requests.some(url => url.includes('rotation-example.json')), false);
  assert.deepEqual(errors, []);
  await page.locator('#dmgcalc-cycle').screenshot({ path: 'reports/live-cycle-ui.png' });
  console.log(`Live snapshot verified: note 45 -> 99 changes score ${first} -> ${second}; actual LB0 and empty records retained; no fixture fetch.`);
} finally { await browser.close(); }
