const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const published = path.join(root, 'dist');
const { places } = JSON.parse(fs.readFileSync(path.join(root, 'data/places.json'), 'utf8'));
const prefix = '/osong-town-classroom/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (!url.startsWith(prefix)) { res.writeHead(404).end(); return; }
  const file = path.resolve(published, url.slice(prefix.length) || 'index.html');
  if (!file.startsWith(published + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(data);
  });
});
const results = [];
function check(value, message) { assert.ok(value, message); results.push(message); }
async function ready(page, base) {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('html[data-app-ready="true"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ client: innerWidth, scroll: document.documentElement.scrollWidth }));
  check(size.scroll <= size.client + 1, `${label}: no horizontal page overflow (${size.scroll}/${size.client})`);
}
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [label, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844], ['small-mobile', 320, 780]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await ready(page, base);
      assert.equal(await page.locator('#places .place-card').count(), 5);
      assert.equal(await page.locator('#map .leaflet-marker-icon').count(), 4);
      await noOverflow(page, label);
      await page.screenshot({ path: `test-results/${label}-hero.png` });
      for (const card of await page.locator('#places .place-card').all()) await card.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll('#places img')].every(img => img.complete && img.naturalWidth > 0));
      await page.locator('#map').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/${label}-map.png` });
      await page.screenshot({ path: `test-results/${label}-full.png`, fullPage: true });
      for (const place of places) {
        const group = place.mapGroup || place.id;
        await page.locator(`#map [data-map-group="${group}"]`).click();
        if (group === 'station') await page.locator(`.map-place-choice[data-place-id="${place.id}"]`).click();
        check((await page.locator('#dialog-title').innerText()).includes(place.name), `${label}: map opens ${place.name}`);
        await page.keyboard.press('Escape');
        check(!(await page.locator('#place-dialog').evaluate(d => d.open)), `${label}: Escape closes place dialog`);
      }
      for (const [i, place] of places.entries()) {
        await page.locator(`#places [data-place-id="${place.id}"]`).click();
        await page.waitForFunction(() => document.querySelector('#dialog-photo').naturalWidth > 0);
        check(await page.locator('#visit-place').isDisabled(), `${label}: stamp requires correct answer`);
        const wrong = (place.quiz.answer + 1) % 3;
        await page.locator('.quiz-option').nth(wrong).click();
        check(await page.locator('#visit-place').isDisabled(), `${label}: wrong answer cannot stamp`);
        check((await page.locator('#quiz-feedback').innerText()).length > 5, `${label}: wrong answer gives feedback`);
        await page.locator('.quiz-option').nth(place.quiz.answer).click();
        check(await page.locator('#visit-place').isEnabled(), `${label}: retry unlocks stamp`);
        if (i === 0) {
          await page.locator('#zoom-photo').click();
          check(await page.locator('#photo-dialog').evaluate(d => d.open), `${label}: photo enlargement opens`);
          await page.keyboard.press('Escape');
          check(await page.locator('#place-dialog').evaluate(d => d.open), `${label}: photo Escape preserves place dialog`);
        }
        if (label === 'desktop' || i === 0) await page.screenshot({ path: `test-results/${label}-place-${place.id}.png` });
        await page.locator('#visit-place').click();
        assert.match(await page.locator('#progress-text').innerText(), new RegExp(`${i + 1}\\s*/\\s*5`));
        check(await page.locator('#visit-place').isDisabled(), `${label}: duplicate stamp disabled`);
        await page.locator('#close-dialog').click();
        check(await page.locator(`#places [data-place-id="${place.id}"]`).evaluate(el => el === document.activeElement), `${label}: focus restored after card rerender`);
      }
      assert.match(await page.locator('#progress-message').innerText(), /탐험 성공/);
      await page.locator('#favorite-place').selectOption('health');
      const observation = '사진에서 건물 입구와 간판을 보았어요. <img src=x onerror=alert(1)>';
      await page.locator('#observation').fill(observation);
      await page.locator('#people-note').fill('이웃의 건강을 돌보는 일을 해요.');
      await page.locator('#promise-note').fill('차례를 지키고 이웃에게 인사할게요.');
      await page.locator('#promise-note').blur();
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('html[data-app-ready="true"]').waitFor();
      assert.equal(await page.locator('#observation').inputValue(), observation);
      assert.equal(await page.locator('#favorite-place').inputValue(), 'health');
      assert.match(await page.locator('#progress-text').innerText(), /5\s*\/\s*5/);
      check(true, `${label}: notes and stamps survive refresh`);
      await page.evaluate(() => { window.print = () => { window.printRequested = true; }; });
      await page.locator('#print-notebook').click();
      check(await page.evaluate(() => window.printRequested), `${label}: record requests printing`);
      assert.equal(await page.locator('#print-record img').count(), 0, 'User text cannot create HTML');
      assert.ok((await page.locator('#print-record').textContent()).includes(observation));
      if (label === 'desktop') {
        await page.emulateMedia({ media: 'print' });
        await page.pdf({ path: 'test-results/filled-notebook.pdf', format: 'A4', printBackground: true });
        await page.screenshot({ path: 'test-results/notebook-print.png', fullPage: true });
        await page.emulateMedia({ media: 'screen' });
      }
      await page.locator('#reset-progress').click();
      assert.match(await page.locator('#progress-text').innerText(), /0\s*\/\s*5/);
      assert.equal(await page.locator('#observation').inputValue(), observation, 'Reset does not erase notes');
      await page.locator('#places .place-card').first().click();
      await page.locator('#next-place').click();
      assert.ok((await page.locator('#dialog-title').innerText()).includes(places[1].name));
      await page.keyboard.press('Tab');
      check(await page.evaluate(() => document.querySelector('#place-dialog').contains(document.activeElement)), `${label}: keyboard focus remains inside modal`);
      await page.keyboard.press('Escape');
      await noOverflow(page, label);
      assert.deepEqual(errors, [], `${label}: no uncaught JavaScript errors`);
      await context.close();
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    await ready(page, base);
    await page.locator('#map-error').waitFor({ state: 'visible' });
    check(await page.locator('#simple-map-fallback').evaluate(el => el.open), 'Map failure opens diagram');
    await page.locator('#places .place-card').first().click();
    check((await page.locator('#dialog-title').innerText()).includes('오송역'), 'Exploration works without external map tiles');
    await page.keyboard.press('Escape');
    for (const file of ['student-worksheet.pdf', 'exploration-guide.pdf', 'teacher-guide.pdf', 'full-set.pdf']) {
      check(await page.locator(`a[href="pdf/${file}"][download]`).count() > 0, `${file}: direct download link`);
      const response = await page.request.get(`${base}pdf/${file}`);
      assert.equal(response.status(), 200);
      assert.match(response.headers()['content-type'], /application\/pdf/);
      assert.equal((await response.body()).subarray(0, 5).toString(), '%PDF-');
    }
    await page.screenshot({ path: 'test-results/map-fallback.png', fullPage: true });
    await context.close();
    const failureContext = await browser.newContext();
    const failurePage = await failureContext.newPage();
    await failurePage.route('**/data/places.json', route => route.abort());
    await failurePage.goto(base, { waitUntil: 'networkidle' });
    await failurePage.locator('html[data-app-ready="error"]').waitFor();
    check((await failurePage.locator('#data-status').innerText()).includes('PDF'), 'Data failure offers PDF alternative');
    await failureContext.close();
    console.log(`All browser checks passed (${results.length} assertions plus exact value checks).`);
  } finally {
    fs.writeFileSync('test-results/check-report.json', JSON.stringify({ assertions: results, completed: results.length }, null, 2));
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
