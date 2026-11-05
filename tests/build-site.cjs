const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
assert.equal(path.relative(root, dist), 'dist');
fs.rmSync(dist, { recursive: true, force: true });
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/places.json'), 'utf8'));
const files = new Set([
  'index.html', 'style.css', 'experience.css', 'app.js', 'data/places.json',
  'assets/favicon.svg', 'assets/osong-simple-map.svg', 'assets/photo-sources.json',
  'assets/leaflet.js', 'assets/leaflet.css', 'assets/Leaflet-LICENSE.txt',
  'assets/Jua-Regular.ttf', 'assets/Jua-OFL.txt',
  'assets/GowunDodum-Regular.ttf', 'assets/GowunDodum-OFL.txt',
  'research/curriculum-evidence.json',
  ...['student-worksheet', 'exploration-guide', 'teacher-guide', 'full-set'].map(n => `pdf/${n}.pdf`)
]);
for (const place of data.places) {
  files.add(place.photo.src);
  for (const photo of place.extraPhotos || []) files.add(photo.src);
}
for (const rel of files) {
  const source = path.resolve(root, rel);
  assert.ok(source.startsWith(root + path.sep), 'All published files are inside the project');
  const target = path.join(dist, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log(`Published file set prepared: ${files.size} files.`);
