const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (p === '/') p = '/index.html';
  const f = path.resolve(root, '.' + p);
  if (!f.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }).end(data);
  });
});

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  fs.mkdirSync('test-results', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.locator('#map').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `test-results/${label}-map.png` });
      await page.screenshot({ path: `test-results/${label}-full.png`, fullPage: true });
      assert.equal(await page.locator('#places .place-card').count(), 5, `${label}: five place cards`);
      assert.equal(await page.locator('#map .leaflet-marker-icon').count(), 5, `${label}: five map markers`);
      const tiles = await page.locator('#map img.leaflet-tile-loaded').count();
      console.log(`${label}: ${tiles} map tiles loaded`);
      assert.ok(tiles > 0, `${label}: real OpenStreetMap tiles load`);
      for (const name of ['오송역', '오송호수공원', '오송도서관', '오송읍 행정복지센터', '오송종합사회복지관']) {
        await page.locator(`#map .leaflet-marker-icon[title="${name}"]`).click();
        assert.equal(await page.locator('#dialog-title').innerText(), name);
        await page.locator('#close-dialog').click();
      }
      const library = await page.locator('#map .leaflet-marker-icon[title="오송도서관"]').boundingBox();
      const welfare = await page.locator('#map .leaflet-marker-icon[title="오송종합사회복지관"]').boundingBox();
      assert.ok(library && welfare && (library.x + library.width <= welfare.x || welfare.x + welfare.width <= library.x || library.y + library.height <= welfare.y || welfare.y + welfare.height <= library.y), `${label}: nearby markers do not overlap`);
      const cards = page.locator('#places .place-card');
      await cards.nth(0).click();
      await page.locator('#visit-place').click();
      assert.match(await page.locator('#progress-text').innerText(), /1\s*\/\s*5/);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.placeId), 'station', `${label}: focus returns to selected card`);
      await cards.nth(0).click();
      await page.locator('#visit-place').click();
      assert.match(await page.locator('#progress-text').innerText(), /1\s*\/\s*5/);
      for (let i = 1; i < 3; i++) { await cards.nth(i).click(); await page.locator('#visit-place').click(); }
      assert.match(await page.locator('#progress-message').innerText(), /탐험 성공/);
      assert.ok(await page.locator('#reset-progress').isVisible(), `${label}: reset is visible`);
      await page.locator('#reset-progress').click();
      assert.match(await page.locator('#progress-text').innerText(), /0\s*\/\s*5/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label}: no horizontal overflow`);
      assert.deepEqual(errors, [], `${label}: no uncaught JS errors`);
      await context.close();
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route('https://tile.openstreetmap.org/**', route => route.abort());
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('#map-error').waitFor({ state: 'visible' });
    await page.locator('#places .place-card').first().click();
    assert.equal(await page.locator('#dialog-title').innerText(), '오송역', 'place list still works when map tiles fail');
    for (const file of ['student-worksheet.pdf', 'exploration-guide.pdf', 'teacher-guide.pdf', 'full-set.pdf']) {
      assert.ok(await page.locator(`a[href="pdf/${file}"]`).count(), `${file}: download link`);
      const response = await page.request.get(`${base}/pdf/${file}`);
      assert.equal(response.status(), 200, `${file}: HTTP status`);
      assert.match(response.headers()['content-type'], /application\/pdf/);
      assert.equal((await response.body()).subarray(0, 5).toString(), '%PDF-', `${file}: PDF signature`);
    }
    await context.close();
    console.log('All browser checks passed.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
