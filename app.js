'use strict';

// One canonical dataset feeds the cards, quizzes, notebook and map.
async function loadExplorer() {
  const status = document.querySelector('#data-status');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('data/places.json', {signal:controller.signal, cache:'no-cache'});
    if (!response.ok) throw new Error('Place data unavailable');
    const data = await response.json();
    const expected = ['station','sunhamaru','park','health','center'];
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.places) || data.places.length !== expected.length) throw new Error('Invalid place data');
    const groups = new Map();
    data.places.forEach((place, index) => {
      if (place.id !== expected[index] || !Array.isArray(place.coords) || place.coords.length !== 2 || !place.coords.every(Number.isFinite)) throw new Error('Invalid place order or location');
      if (!place.photo || typeof place.photo.src !== 'string' || !place.photo.src.startsWith('assets/photos/') || !place.quiz || !Array.isArray(place.quiz.options) || !Number.isInteger(place.quiz.answer) || !place.quiz.options[place.quiz.answer]) throw new Error('Invalid photo or quiz');
      const group = place.mapGroup || place.coords.join(',');
      if (groups.has(group) && groups.get(group) !== place.coords.join(',')) throw new Error('Shared places must use the same coordinates');
      groups.set(group, place.coords.join(','));
    });
    initializeExplorer(data);
    status.hidden = true;
    document.documentElement.dataset.appReady = 'true';
  } catch (_) {
    status.hidden = false; status.className = 'data-status is-error'; status.replaceChildren();
    const message = document.createElement('p'); message.textContent = '탐험 자료를 불러오지 못했어요. 다시 시도하거나 PDF로 탐험해 보세요.';
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'small-btn'; retry.textContent = '자료 다시 불러오기'; retry.addEventListener('click', () => location.reload());
    const pdf = document.createElement('a'); pdf.href = 'pdf/full-set.pdf'; pdf.className = 'button light'; pdf.textContent = '전체 수업 PDF 받기 ↓'; pdf.download = '';
    status.append(message, retry, pdf);
    document.querySelector('#progress-message').textContent = 'PDF 자료로도 우리 마을을 탐험할 수 있어요.';
    for (const selector of ['#reset-progress','#fit-map','#print-notebook','#favorite-place','#observation','#people-note','#promise-note']) document.querySelector(selector).disabled = true;
    document.querySelector('#save-status').textContent = '탐험 자료를 불러온 뒤 노트를 쓸 수 있어요. 지금은 종이 활동지 PDF를 이용해 주세요.';
    const fallback = document.querySelector('#simple-map-fallback'); if (fallback) fallback.open = true;
    document.documentElement.dataset.appReady = 'error';
  } finally { clearTimeout(timeout); }
}

function initializeExplorer(data) {
const places = data.places;
const photoNotice = document.querySelector('.photo-time-note');
if (photoNotice && typeof data.photoNotice === 'string') photoNotice.textContent = data.photoNotice;
// Classroom notes stay in this browser tab; no student data is uploaded.
const $ = (selector) => document.querySelector(selector);
const dialog = $('#place-dialog');
const photoDialog = $('#photo-dialog');
const placesEl = $('#places');
const VISIT_KEY = 'osong-explorer-visited-v3';
const NOTE_KEY = 'osong-explorer-notebook-v2';
$('#progress-bar').setAttribute('role', 'progressbar');
$('#progress-bar').setAttribute('aria-label', '다섯 곳 중 도장을 받은 장소 수');
$('#progress-bar').setAttribute('aria-valuemin', '0');
$('#progress-bar').setAttribute('aria-valuemax', String(places.length));
let activePlace = null, lastFocus = null, photoLastFocus = null;
let answeredCorrectly = false, photoIsAvailable = false, activePhoto = null;
function readStored(key, fallback) {
  try { const value = sessionStorage.getItem(key); return value === null ? fallback : JSON.parse(value); }
  catch (_) { return fallback; }
}
function writeStored(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
}
const savedVisits = readStored(VISIT_KEY, []);
let visited = new Set(Array.isArray(savedVisits) ? savedVisits.filter(id => places.some(p => p.id === id)) : []);
function textElement(tag, text, className) {
  const element = document.createElement(tag); element.textContent = text;
  if (className) element.className = className;
  return element;
}
function sourceLink(text, url) {
  const link = textElement('a', text); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
function addPhotoAttribution(container, place, full = false, photo = place.photo) {
  container.replaceChildren();
  container.append(document.createTextNode(photo.caption + ' · '), sourceLink(photo.author, photo.sourceUrl));
  container.append(document.createTextNode(' · '), sourceLink(photo.license, photo.licenseUrl));
  if (full && photo.changes) container.append(document.createTextNode(' · ' + photo.changes));
}
function renderPlaces() {
  placesEl.replaceChildren();
  places.forEach((place, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'place-card' + (visited.has(place.id) ? ' is-visited' : ''); button.dataset.placeId = place.id;
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-label', (index + 1) + '. ' + place.name + ', ' + (visited.has(place.id) ? '탐험 도장 받음' : '사진 보고 탐험하기'));
    const photoWrap = textElement('span', '', 'place-photo-thumb');
    const image = document.createElement('img');
    image.src = place.photo.src; image.alt = place.photo.alt; image.loading = 'lazy'; image.decoding = 'async';
    image.width = place.photo.width || 640; image.height = place.photo.height || 420;
    image.addEventListener('error', () => {
      image.hidden = true; photoWrap.classList.add('photo-unavailable');
      photoWrap.append(textElement('span', '사진을 불러오지 못했어요', 'photo-fallback'));
    }, {once:true});
    photoWrap.append(image);
    const copy = textElement('span', '', 'place-card-copy');
    const icon = textElement('span', place.emoji, 'pc-icon'); icon.setAttribute('aria-hidden', 'true');
    copy.append(textElement('span', '탐험 ' + String(index + 1).padStart(2, '0'), 'place-card-eyebrow'));
    copy.append(icon, textElement('b', place.name), textElement('small', place.short));
    copy.append(textElement('small', visited.has(place.id) ? '✓ 탐험 도장 받았어요!' : '사진 보고 탐험하기 →', visited.has(place.id) ? 'visited' : 'card-action'));
    button.append(photoWrap, copy); button.addEventListener('click', () => openPlace(place, button)); placesEl.append(button);
  });
  $('#progress-text').textContent = visited.size + ' / ' + places.length + '곳';
  $('#progress-bar').style.width = visited.size / places.length * 100 + '%';
  $('#progress-bar').setAttribute('aria-valuenow', String(visited.size));
  $('#progress-message').textContent = visited.size === places.length
    ? '다섯 곳 탐험 성공! 나의 탐험 기록을 남겨요.'
    : '사진을 보고 퀴즈를 풀어요. ' + (places.length - visited.size) + '곳이 남았어요!';
}
function showPhoto(place, photo = place.photo) {
  activePhoto = photo;
  $('#dialog-observe').textContent = photo === place.photo ? place.observe : (photo.observe || '이 사진에서 눈에 보이는 것 두 가지를 찾아보세요. 첫 번째 사진과 같은 점과 다른 점은 무엇인가요?');
  const image = $('#dialog-photo'), zoom = $('#zoom-photo'), figure = image.closest('figure');
  let error = figure.querySelector('.photo-error');
  if (!error) {
    error = textElement('p', '사진을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요. 아래 장소 이야기는 계속 읽을 수 있어요.', 'photo-error');
    error.setAttribute('role', 'status'); figure.append(error);
  }
  error.hidden = true; image.hidden = false; image.alt = photo.alt; photoIsAvailable = false; zoom.disabled = true;
  image.onload = () => {
    if (activePlace?.id !== place.id) return;
    photoIsAvailable = true; image.hidden = false; error.hidden = true; zoom.disabled = false;
  };
  image.onerror = () => {
    if (activePlace?.id !== place.id) return;
    photoIsAvailable = false; image.hidden = true; error.hidden = false; zoom.disabled = true;
  };
  image.src = photo.src;
  if (image.complete && image.naturalWidth > 0) { photoIsAvailable = true; zoom.disabled = false; }
  addPhotoAttribution($('#photo-credit'), place, false, photo);
  document.querySelectorAll('.photo-choice').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.photoSrc === photo.src)));
}
function renderPhotoChoices(place) {
  let choices = $('#photo-choices');
  if (!choices) {
    choices = textElement('div', '', 'photo-choices'); choices.id = 'photo-choices';
    choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', '다른 실제 사진 보기');
    $('#zoom-photo').before(choices);
  }
  choices.replaceChildren();
  const photos = [place.photo, ...(Array.isArray(place.extraPhotos) ? place.extraPhotos : [])];
  choices.hidden = photos.length < 2;
  photos.forEach((photo, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'photo-choice';
    button.dataset.photoSrc = photo.src; button.setAttribute('aria-pressed', String(index === 0));
    button.setAttribute('aria-label', '사진 ' + (index + 1) + ': ' + photo.alt);
    const thumbnail = document.createElement('img'); thumbnail.src = photo.src; thumbnail.alt = ''; thumbnail.loading = 'lazy';
    button.append(thumbnail, textElement('span', '사진 ' + (index + 1)));
    button.addEventListener('click', () => showPhoto(place, photo)); choices.append(button);
  });
}
function updateVisitButton() {
  const button = $('#visit-place'), already = activePlace && visited.has(activePlace.id);
  button.disabled = Boolean(already || !answeredCorrectly);
  button.textContent = already ? '탐험 도장 받았어요! ✓' : answeredCorrectly ? '탐험 도장 받기 ✓' : '퀴즈를 풀면 도장을 받아요';
}
function renderQuiz(place) {
  const choices = $('#quiz-options'), feedback = $('#quiz-feedback');
  choices.replaceChildren(); choices.setAttribute('role', 'group'); choices.setAttribute('aria-labelledby', 'quiz-question');
  $('#quiz-question').textContent = place.quiz.question;
  feedback.className = 'quiz-feedback';
  feedback.textContent = visited.has(place.id) ? '이곳의 탐험 도장을 받았어요. 다시 풀어 봐도 좋아요!' : '장소 이야기를 읽고, 알맞은 일을 골라요.';
  answeredCorrectly = false;
  place.quiz.options.forEach((option, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'quiz-option'; button.setAttribute('aria-pressed', 'false');
    button.append(textElement('span', String(index + 1), 'choice-number'), textElement('span', option));
    button.addEventListener('click', () => {
      choices.querySelectorAll('button').forEach(choice => { choice.classList.remove('correct', 'try-again'); choice.setAttribute('aria-pressed', 'false'); });
      button.setAttribute('aria-pressed', 'true'); answeredCorrectly = index === place.quiz.answer;
      button.classList.add(answeredCorrectly ? 'correct' : 'try-again');
      feedback.className = 'quiz-feedback ' + (answeredCorrectly ? 'is-correct' : 'is-hint');
      feedback.textContent = answeredCorrectly ? '맞아요! ' + place.quiz.explanation : '다시 생각해 볼까요? ' + place.quiz.hint;
      updateVisitButton();
    });
    choices.append(button);
  });
  updateVisitButton();
}
function openPlace(place, source) {
  const wasOpen = dialog.open; activePlace = place;
  $('#dialog-title').tabIndex = -1;
  if (!wasOpen) lastFocus = source || document.activeElement;
  $('#dialog-tag').textContent = '오송 탐험 ' + (places.indexOf(place) + 1) + ' / ' + places.length;
  $('#dialog-title').textContent = place.emoji + ' ' + place.name;
  $('#dialog-description').textContent = place.desc; $('#dialog-people').textContent = place.people;
  $('#dialog-question').textContent = place.question; $('#dialog-observe').textContent = place.observe;
  const next = places[(places.indexOf(place) + 1) % places.length];
  $('#next-place').textContent = (places.indexOf(place) === places.length - 1 ? '첫' : '다음') + ' 장소 · ' + next.name + ' →';
  renderPhotoChoices(place); showPhoto(place); renderQuiz(place);
  if (!wasOpen) { dialog.showModal(); $('#close-dialog').focus({preventScroll:true}); }
  dialog.scrollTop = 0;
  if (wasOpen) $('#dialog-title').focus({preventScroll:true});
}
$('#close-dialog').addEventListener('click', () => dialog.close());
$('#visit-place').addEventListener('click', () => {
  if (!activePlace || !answeredCorrectly || visited.has(activePlace.id)) return;
  visited.add(activePlace.id); writeStored(VISIT_KEY, [...visited]); renderPlaces(); updateVisitButton();
  $('#quiz-feedback').className = 'quiz-feedback is-correct';
  $('#quiz-feedback').textContent = visited.size === places.length
    ? '짝짝짝! 다섯 곳의 도장을 모두 모았어요. 창을 닫고 나의 탐험 기록을 남겨요.'
    : activePlace.name + ' 도장을 받았어요! 다음 장소로 떠나 볼까요?';
});
$('#next-place').addEventListener('click', () => { if (activePlace) openPlace(places[(places.indexOf(activePlace) + 1) % places.length]); });
dialog.addEventListener('close', () => {
  if (photoDialog.open) photoDialog.close();
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  else if (activePlace) placesEl.querySelector('[data-place-id="' + activePlace.id + '"]')?.focus();
});
function clickedOutside(event, target) {
  if (event.target !== target) return false;
  const rect = target.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}
dialog.addEventListener('click', event => { if (clickedOutside(event, dialog)) dialog.close(); });
$('#zoom-photo').addEventListener('click', () => {
  if (!activePlace || !photoIsAvailable) return;
  photoLastFocus = document.activeElement;
  $('#large-photo').src = activePhoto.src; $('#large-photo').alt = activePhoto.alt;
  addPhotoAttribution($('#large-photo-caption'), activePlace, true, activePhoto); photoDialog.showModal(); $('#close-photo').focus();
});
$('#close-photo').addEventListener('click', () => photoDialog.close());
photoDialog.addEventListener('click', event => { if (clickedOutside(event, photoDialog)) photoDialog.close(); });
photoDialog.addEventListener('close', () => { if (dialog.open && photoLastFocus && document.contains(photoLastFocus)) photoLastFocus.focus(); });
$('#reset-progress').addEventListener('click', () => {
  visited.clear(); writeStored(VISIT_KEY, []); renderPlaces();
  $('#progress-message').textContent = '도장을 새로 모아 봐요! 적어 둔 탐험 기록은 그대로 있어요.';
});
function renderSources() {
  const container = $('#photo-sources'); if (!container) return;
  container.replaceChildren(); const list = document.createElement('ul');
  places.forEach(place => {
    const item = document.createElement('li'), credit = document.createElement('span');
    item.append(textElement('strong', place.name + ' — ')); addPhotoAttribution(credit, place, true); item.append(credit); list.append(item);
    if (Array.isArray(place.extraPhotos)) place.extraPhotos.forEach((photo, index) => {
      const extra = document.createElement('li'), extraCredit = document.createElement('span');
      extra.append(textElement('strong', place.name + ' 추가 사진 ' + (index + 1) + ' — '));
      addPhotoAttribution(extraCredit, place, true, photo); extra.append(extraCredit); list.append(extra);
    });
  });
  container.append(list);
}
const noteFields = ['favorite-place', 'observation', 'people-note', 'promise-note'];
const favoriteSelect = $('#favorite-place');
favoriteSelect.replaceChildren();
const placeholder = textElement('option', '소개하고 싶은 장소를 골라요'); placeholder.value = ''; favoriteSelect.append(placeholder);
places.forEach(place => { const option = textElement('option', place.emoji + ' ' + place.name); option.value = place.id; favoriteSelect.append(option); });
const storedNotebook = readStored(NOTE_KEY, {});
if (storedNotebook && typeof storedNotebook === 'object' && !Array.isArray(storedNotebook)) {
  noteFields.forEach(id => { if (typeof storedNotebook[id] === 'string') $('#' + id).value = storedNotebook[id].slice(0, 800); });
  if (!places.some(place => place.id === favoriteSelect.value)) favoriteSelect.value = '';
}
function notebookValues() { const values = {}; noteFields.forEach(id => { values[id] = $('#' + id).value.slice(0, 800); }); return values; }
let notebookTimer;
function saveNotebook() {
  clearTimeout(notebookTimer); const saved = writeStored(NOTE_KEY, notebookValues());
  $('#save-status').textContent = saved ? '이 탭에 저장했어요. 새로고침해도 기록이 남아요.' : '이 브라우저에서는 저장할 수 없어요. 창을 닫기 전에 인쇄해 주세요.';
}
noteFields.forEach(id => {
  $('#' + id).addEventListener('input', () => {
    $('#save-status').textContent = '기록하는 중이에요…'; clearTimeout(notebookTimer); notebookTimer = setTimeout(saveNotebook, 300);
  });
  $('#' + id).addEventListener('change', saveNotebook);
});
$('#notebook').addEventListener('submit', event => { event.preventDefault(); saveNotebook(); });
window.addEventListener('pagehide', () => { writeStored(NOTE_KEY, notebookValues()); });
function preparePrintRecord() {
  const values = notebookValues(), place = places.find(entry => entry.id === values['favorite-place']), record = $('#print-record');
  record.replaceChildren();
  record.append(textElement('p', '2학년 통합교과 · 우리 마을 탐험하기', 'print-kicker'), textElement('h1', '나의 오송 탐험 기록'));
  record.append(textElement('p', '날짜: ____________________    이름: ____________________', 'print-name'));
  const prompts = [
    ['내가 소개하고 싶은 곳', place ? place.name : '아직 고르지 않았어요.'],
    ['사진에서 발견했어요', values.observation.trim() || '그림이나 글로 적어 보세요.'],
    ['사람들은 이곳에서', values['people-note'].trim() || '사람들이 하는 일을 생각해 보세요.'],
    ['우리 마을을 위한 나의 약속', values['promise-note'].trim() || '내가 할 수 있는 일을 적어 보세요.']
  ];
  prompts.forEach(([title, answer]) => { const section = document.createElement('section'); section.append(textElement('h2', title), textElement('p', answer)); record.append(section); });
  record.append(textElement('p', '탐험 도장 ' + visited.size + ' / ' + places.length + '곳', 'print-stamp-heading'));
  record.append(textElement('p', places.map(entry => (visited.has(entry.id) ? '☑ ' : '□ ') + entry.name).join('  /  '), 'print-stamps'));
  record.append(textElement('p', '사진과 지도로 만난 우리 동네, 오송 · 오송 동네 탐험대', 'print-footer'));
}
$('#print-notebook').addEventListener('click', () => { saveNotebook(); preparePrintRecord(); window.print(); });
window.addEventListener('beforeprint', preparePrintRecord);
renderPlaces(); renderSources();
let map, tiles, tileFailures = 0;
function showMapFallback() {
  $('#map-error').hidden = false;
  const fallback = $('#simple-map-fallback'); if (fallback) fallback.open = true;
}
function addTiles() {
  if (tiles) map.removeLayer(tiles); tileFailures = 0; $('#map-error').hidden = true;
  tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap 기여자</a>'});
  tiles.on('tileerror', () => { tileFailures += 1; if (tileFailures >= 2) showMapFallback(); });
  tiles.on('tileload', () => { if (tileFailures === 0) $('#map-error').hidden = true; }); tiles.addTo(map);
}
if (window.L) {
  map = L.map('map', {scrollWheelZoom:false}); addTiles();
  const markerGroups = new Map();
  places.forEach(place => {
    const key = place.mapGroup || place.coords.join(',');
    if (!markerGroups.has(key)) markerGroups.set(key, []);
    markerGroups.get(key).push(place);
  });
  markerGroups.forEach(group => {
    const first = group[0];
    const shared = group.length > 1;
    const pinContent = textElement('span', first.emoji, 'pin-emoji');
    if (shared) pinContent.append(textElement('span', String(group.length), 'pin-count'));
    const icon = L.divIcon({className:'pin' + (shared ? ' shared-pin' : ''), html:pinContent, iconSize:[48,48], iconAnchor:[24,48]});
    const names = group.map(place => place.name).join(' · ');
    const marker = L.marker(first.coords, {icon, title:names, alt:names, keyboard:true}).addTo(map);
    const element = marker.getElement();
    const openMarker = () => {
      if (shared) marker.openPopup();
      else openPlace(first, element);
    };
    if (shared) {
      const picker = textElement('div', '', 'map-place-picker');
      picker.setAttribute('role', 'group');
      picker.setAttribute('aria-label', names + ' 중 탐험할 장소 선택');
      picker.append(textElement('p', '같은 위치에서 만나는 두 장소', 'map-picker-title'));
      group.forEach(place => {
        const choice = textElement('button', place.emoji + ' ' + place.name + ' →', 'map-place-choice');
        choice.type = 'button'; choice.dataset.placeId = place.id; choice.setAttribute('aria-haspopup', 'dialog');
        choice.addEventListener('click', () => { map.closePopup(); openPlace(place, element); });
        picker.append(choice);
      });
      picker.append(textElement('small', '장소 이름을 눌러 각각 탐험해요.'));
      marker.bindPopup(picker, {maxWidth:290, minWidth:220, autoPanPadding:[30,30]});
      marker.on('popupopen', () => {
        element?.setAttribute('aria-expanded', 'true');
        picker.querySelector('button')?.focus({preventScroll:true});
      });
      marker.on('popupclose', () => { element?.setAttribute('aria-expanded', 'false'); });
    } else marker.on('click', openMarker);
    if (element) {
      element.dataset.mapGroup = first.mapGroup || first.id;
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', shared ? names + ', 같은 위치의 두 장소 선택' : first.name + ' 사진과 이야기 열기');
      if (shared) element.setAttribute('aria-expanded', 'false');
      else element.setAttribute('aria-haspopup', 'dialog');
      element.addEventListener('keydown', event => {
        if (event.key === ' ') { event.preventDefault(); openMarker(); }
      });
    }
  });
  const bounds = L.latLngBounds(places.map(place => place.coords));
  const fit = () => map.fitBounds(bounds, {padding:[70,70], maxZoom:15});
  fit(); $('#fit-map').addEventListener('click', fit); $('#retry-map').addEventListener('click', addTiles);
} else {
  showMapFallback(); $('#map').textContent = '지도를 불러오지 못했어요. 아래 장소 카드와 그림 지도로 계속 탐험할 수 있어요.';
  $('#fit-map').disabled = true; $('#retry-map').addEventListener('click', () => location.reload());
}


}

loadExplorer();
