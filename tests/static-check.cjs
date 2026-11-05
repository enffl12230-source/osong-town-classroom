const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const { places } = JSON.parse(fs.readFileSync(path.join(root, 'data/places.json'), 'utf8'));
assert.deepEqual(places.map(p => p.id), ['station', 'sunhamaru', 'park', 'health', 'center']);
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'Unique HTML IDs');
for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const ref = m[1].split('#')[0];
  if (/^(https?:|data:|mailto:)/.test(ref)) continue;
  assert.ok(fs.existsSync(path.join(root, ref)), `Local link exists: ${ref}`);
}
for (const place of places) {
  assert.ok(place.coords.length === 2 && place.coords.every(Number.isFinite));
  assert.ok(place.coords[0] > 36.5 && place.coords[0] < 36.8 && place.coords[1] > 127.2 && place.coords[1] < 127.5, 'Osong location');
  assert.equal(place.quiz.options.length, 3);
  assert.ok(Number.isInteger(place.quiz.answer) && place.quiz.answer >= 0 && place.quiz.answer < 3);
  for (const key of ['observe', 'people', 'question', 'desc']) assert.ok(place[key]);
  for (const photo of [place.photo, ...(place.extraPhotos || [])]) {
    const bytes = fs.readFileSync(path.join(root, photo.src));
    assert.ok(bytes.length > 10000, `Photograph exists: ${place.id}`);
    assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8', 'Actual JPEG bytes');
    for (const key of ['date', 'dateKind', 'author', 'license', 'licenseUrl', 'sourceUrl', 'alt']) assert.ok(photo[key], `${place.id}: ${key}`);
    assert.ok(Number(photo.date.slice(0, 4)) >= 2024, 'Recent source date');
  }
}
assert.deepEqual(places[0].coords, places[1].coords, 'Station and Sunhamaru share a verified location group');
const sourceData = JSON.parse(fs.readFileSync(path.join(root, 'assets/photo-sources.json'), 'utf8'));
assert.ok(sourceData.photos.length >= 5);
for (const name of ['student-worksheet', 'exploration-guide', 'teacher-guide', 'full-set']) {
  const bytes = fs.readFileSync(path.join(root, 'pdf', `${name}.pdf`));
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
}
for (const code of ['2슬02-01', '2슬02-04', '2바02-01']) assert.ok(html.includes(code));
assert.match(html, /40분/);
assert.ok(!/오송도서관|오송종합사회복지관|오송호수공원|src="places\.js"/.test(html), 'No obsolete place content or duplicate data script');
console.log('Static checks passed: five places, recent actual photographs, attribution, local links, PDFs and curriculum.');
