const places = [
  {id:'station', name:'오송역', emoji:'🚉', coords:[36.6207917,127.3278], short:'기차로 이어지는 곳', desc:'오송역은 여러 곳으로 가는 기차를 타고 내리는 곳이에요. 다른 지역에서 오송을 찾아오는 사람들도 만날 수 있어요.', people:'사람들이 기차를 타고 여행하거나 일하러 가요. 역에서 일하는 분들은 안전하게 이동하도록 도와줘요.', question:'오송역에서 기차를 타고 어디에 가 보고 싶나요?'},
  {id:'park', name:'오송호수공원', emoji:'🌳', coords:[36.6291035,127.3215881], short:'자연과 쉬어 가는 곳', desc:'오송호수공원은 연제저수지 주변에 있는 공원이에요. 물과 나무를 보며 마을의 자연을 만날 수 있어요.', people:'가족과 산책하거나 자연을 바라보며 쉬어요. 공원을 돌보는 분들은 모두가 편하게 쉴 수 있도록 일해요.', question:'공원에서 만날 수 있는 자연에는 무엇이 있을까요?'},
  {id:'library', name:'오송도서관', emoji:'📚', coords:[36.6348624,127.3230748], short:'책과 이야기를 만나는 곳', desc:'오송도서관은 마을 사람들이 책과 이야기를 만나는 곳이에요. 다양한 책을 찾아보며 궁금한 것을 배울 수 있어요.', people:'책을 읽거나 빌리고, 새로운 것을 배워요. 사서 선생님은 책을 찾을 수 있도록 도와줘요.', question:'도서관에서 어떤 책을 찾아보고 싶나요?'},
  {id:'center', name:'오송읍 행정복지센터', emoji:'🏡', coords:[36.6091807,127.3245567], short:'마을의 일을 돕는 곳', desc:'오송읍 행정복지센터는 마을 사람들이 생활에 필요한 도움을 받을 수 있는 곳이에요.', people:'주민들이 생활에 필요한 서류나 안내를 받아요. 일하는 분들은 마을의 여러 일을 살피고 주민을 도와요.', question:'이웃을 돕는 마을의 장소가 필요한 까닭은 무엇일까요?'},
  {id:'welfare', name:'오송종합사회복지관', emoji:'🤝', coords:[36.6351151,127.3233483], short:'이웃이 함께 어울리는 곳', desc:'오송종합사회복지관은 어린이부터 어르신까지 이웃들이 함께 어울리고 도움을 나누는 곳이에요.', people:'이웃을 만나고 여러 활동에 참여해요. 복지관에서 일하는 분들은 도움이 필요한 이웃을 살펴요.', question:'이웃과 함께하면 재미있을 활동은 무엇일까요?'}
];
const $ = (selector) => document.querySelector(selector);
const dialog = $('#place-dialog');
const placesEl = $('#places');
let activePlace = null;
let lastFocus = null;
let visited = new Set();
try { const saved = JSON.parse(sessionStorage.getItem('osong-visited') || '[]'); if(Array.isArray(saved)) visited = new Set(saved.filter(id => places.some(p => p.id === id))); } catch (_) {}
function save() { try { sessionStorage.setItem('osong-visited',JSON.stringify([...visited])); } catch (_) {} }
function render() {
  placesEl.replaceChildren();
  places.forEach((p,i) => {
    const b=document.createElement('button'); b.type='button'; b.className='place-card'; b.dataset.placeId=p.id;
    const icon=document.createElement('span'); icon.className='pc-icon'; icon.textContent=p.emoji;
    const name=document.createElement('b'); name.textContent=p.name;
    const description=document.createElement('small'); description.textContent=p.short;
    const status=document.createElement('small'); status.className=visited.has(p.id)?'visited':''; status.textContent=visited.has(p.id)?'✓ 둘러봤어요':'눌러서 살펴보기 ↗';
    b.append(icon,name,description,status); b.addEventListener('click',()=>openPlace(p,b)); placesEl.append(b);
  });
  $('#progress-text').textContent=`${visited.size} / ${places.length}곳`;
  $('#progress-bar').style.width=`${visited.size/places.length*100}%`;
  $('#progress-message').textContent=visited.size>=3?'탐험 성공! 활동지를 작성해 보세요.':'3곳 이상 둘러보면 탐험 성공!';
}
function openPlace(p, source) {
  activePlace=p; lastFocus=source || document.activeElement;
  $('#dialog-tag').textContent=`OSONG PLACE · ${String(places.indexOf(p)+1).padStart(2,'0')}`;
  $('#station-photo').hidden=p.id!=='station';
  $('#dialog-title').textContent=p.name; $('#dialog-emoji').textContent=p.emoji;
  $('#dialog-description').textContent=p.desc; $('#dialog-people').textContent=p.people; $('#dialog-question').textContent=p.question;
  $('#visit-place').textContent=visited.has(p.id)?'이미 둘러봤어요 ✓':'둘러봤어요! ✓';
  if(!dialog.open) dialog.showModal();
}
$('#close-dialog').addEventListener('click',()=>dialog.close());
$('#visit-place').addEventListener('click',()=>{if(!activePlace)return;visited.add(activePlace.id);save();render();dialog.close();});
dialog.addEventListener('close',()=>{if(lastFocus && document.contains(lastFocus)) lastFocus.focus(); else if(activePlace) [...placesEl.children].find(el => el.dataset.placeId === activePlace.id)?.focus();});
dialog.addEventListener('click',(e)=>{if(e.target===dialog) dialog.close();});
$('#reset-progress').addEventListener('click',()=>{visited.clear();save();render();});
render();
let map, tiles, tileFailures=0;
function addTiles() {
  if(tiles) map.removeLayer(tiles); tileFailures=0; $('#map-error').hidden=true;
  tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap 기여자</a>'});
  tiles.on('tileerror',()=>{tileFailures++;if(tileFailures>=2)$('#map-error').hidden=false;});
  tiles.on('tileload',()=>{if(tileFailures===0)$('#map-error').hidden=true;}); tiles.addTo(map);
}
if (window.L) {
  map=L.map('map',{scrollWheelZoom:false}); addTiles();
  places.forEach((p)=>{
    const icon=L.divIcon({className:'pin',html:p.emoji,iconSize:[43,43],iconAnchor:[21,43]});
    const marker=L.marker(p.coords,{icon,title:p.name,alt:p.name,keyboard:true}).addTo(map);
    marker.on('click',()=>openPlace(p,marker.getElement()));
  });
  const bounds=L.latLngBounds(places.map(p=>p.coords));
  function fit(){map.fitBounds(bounds,{padding:[35,35],maxZoom:15});}
  fit(); $('#fit-map').addEventListener('click',fit); $('#retry-map').addEventListener('click',addTiles);
} else { $('#map-error').hidden=false; $('#map').textContent='지도를 불러오지 못했어요. 아래 장소 목록을 이용해 주세요.'; $('#fit-map').disabled=true; $('#retry-map').addEventListener('click',()=>location.reload()); }



