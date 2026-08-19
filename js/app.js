// ---------- Modal open/sluiten met vloeiende overgang ----------
function openModal() {
  const modal = document.getElementById('entryModal');
  modal.hidden = false;
  // volgende frame: trigger de overgang (anders animeert 'display' niet mee)
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
}
function closeModal() {
  const modal = document.getElementById('entryModal');
  modal.classList.remove('is-open');
  setTimeout(() => { modal.hidden = true; }, 260);
}

// ---------- Nieuw moment / Wijzigen (zelfde formulier) ----------
let editingId = null;
let editingAuthor = null;
let editingCreatedAt = null;

function resetEntryForm() {
  editingId = null;
  editingAuthor = null;
  editingCreatedAt = null;
  document.getElementById('nieuwHeading').textContent = 'Nieuw moment';
  document.getElementById('btnSaveEntry').textContent = 'Bewaar dit moment';
  document.getElementById('entryForm').reset();
  pendingPhotos = [];
  pendingLocation = null;
  pendingLocationName = null;
  document.getElementById('locateStatus').textContent = '';
  document.getElementById('addressResults').innerHTML = '';
  renderPhotoPreview();
  document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('is-active'));
  document.querySelector('.type-chip[data-type="plek"]').classList.add('is-active');
  selectedType = 'plek';
  prefillDateTime();
}

function editEntry(entry) {
  editingId = entry.id;
  editingAuthor = entry.author;
  editingCreatedAt = entry.createdAt;
  closeModal();

  selectedType = entry.type;
  document.querySelectorAll('.type-chip').forEach(c => c.classList.toggle('is-active', c.dataset.type === entry.type));
  document.getElementById('fTitle').value = entry.title;
  document.getElementById('fNote').value = entry.note || '';
  document.getElementById('fDate').value = entry.timestamp.slice(0, 10);
  document.getElementById('fTime').value = entry.timestamp.slice(11, 16);

  pendingPhotos = (entry.photos || []).slice();
  renderPhotoPreview();

  pendingLocation = entry.lat ? { lat: entry.lat, lng: entry.lng } : null;
  pendingLocationName = entry.locationName || null;
  document.getElementById('locateStatus').textContent = pendingLocation
    ? `✓ ${pendingLocationName || pendingLocation.lat.toFixed(4) + ', ' + pendingLocation.lng.toFixed(4)}`
    : '';
  document.getElementById('addressResults').innerHTML = '';

  document.getElementById('nieuwHeading').textContent = 'Moment wijzigen';
  document.getElementById('btnSaveEntry').textContent = 'Wijzigingen opslaan';
  showView('view-nieuw');
}

// ---------- Auteur (wie ben jij) ----------
const AUTHOR_COLORS = ['#2B6E63', '#B23A2E', '#D6A419', '#5B6EA8'];
let memoryAuthor = null; // fallback als localStorage niet beschikbaar is (bijv. Safari privénavigatie)

function getAuthor() {
  try {
    return localStorage.getItem('auteurNaam') || memoryAuthor;
  } catch (e) {
    return memoryAuthor;
  }
}
function setAuthor(name) {
  memoryAuthor = name;
  try {
    localStorage.setItem('auteurNaam', name);
  } catch (e) {
    console.warn('Kon naam niet blijvend opslaan (privénavigatie?), werkt wel voor deze sessie.', e);
    toast('Naam onthouden voor nu — zet privénavigatie uit om ’m te bewaren');
  }
}
function authorColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}
function updateWhoButton() {
  const btn = document.getElementById('btnWho');
  const author = getAuthor();
  if (author) {
    btn.textContent = author.slice(0, 1).toUpperCase();
    btn.style.background = authorColor(author);
    btn.style.borderColor = 'transparent';
    btn.style.color = '#fff';
  } else {
    btn.textContent = '👤';
    btn.style.background = '';
    btn.style.borderColor = '';
    btn.style.color = '';
  }
}

function askAuthor(force) {
  const existing = getAuthor();
  if (existing && !force) return;
  const modal = document.getElementById('entryModal');
  const card = document.getElementById('entryModalCard');
  card.innerHTML = `
    <form class="who-card" id="whoForm">
      <h3 style="font-family:var(--font-display);margin:0;">Wie ben jij?</h3>
      <p style="font-size:13px;color:#7c8580;margin:0;">Zo zien jullie straks van wie welk moment komt.</p>
      <input type="text" id="whoInput" placeholder="Jouw naam" value="${existing || ''}" required autocomplete="off">
      <button type="submit" class="btn btn--primary btn--wide">Opslaan</button>
    </form>`;
  modal.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));

  const form = document.getElementById('whoForm');
  const input = document.getElementById('whoInput');
  setTimeout(() => input.focus(), 60);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    setAuthor(val);
    closeModal();
    updateWhoButton();
    renderAll();
  });
}
document.getElementById('btnWho').addEventListener('click', () => askAuthor(true));

// ---------- Navigatie ----------
const tabButtons = document.querySelectorAll('.tabbar__btn');
const views = document.querySelectorAll('[data-view]');
function showView(id) {
  views.forEach(v => v.hidden = v.id !== id);
  tabButtons.forEach(b => b.classList.toggle('is-active', b.dataset.target === id));
  if (id === 'view-kaart') setTimeout(() => { if (map) map.invalidateSize(); }, 50);
  if (id === 'view-dashboard') setTimeout(() => { if (dashMap) dashMap.invalidateSize(); }, 50);
  if (id === 'view-overzicht') renderStats();
}
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.target === 'view-nieuw') resetEntryForm();
    showView(btn.dataset.target);
  });
});

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { t.hidden = true; }, 2400);
}

// ---------- Type picker ----------
let selectedType = 'plek';
document.querySelectorAll('.type-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    selectedType = chip.dataset.type;
  });
});
document.querySelector('.type-chip[data-type="plek"]').classList.add('is-active');

const TYPE_ICON = { plek: '📍', eten: '🍴', activiteit: '🎒', overnachting: '🛏️', vervoer: '🚗' };
const TYPE_LABEL = { plek: 'Plek', eten: 'Eten', activiteit: 'Activiteit', overnachting: 'Slapen', vervoer: 'Onderweg' };

function prefillDateTime() {
  const now = new Date();
  document.getElementById('fDate').value = now.toISOString().slice(0, 10);
  document.getElementById('fTime').value = now.toTimeString().slice(0, 5);
}

// ---------- Locatie ----------
let pendingLocation = null;
let pendingLocationName = null;

document.getElementById('btnLocate').addEventListener('click', () => {
  const status = document.getElementById('locateStatus');
  if (!navigator.geolocation) { status.textContent = 'Niet ondersteund'; return; }
  status.textContent = 'Bezig met zoeken…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      pendingLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      pendingLocationName = null;
      status.textContent = `✓ ${pendingLocation.lat.toFixed(4)}, ${pendingLocation.lng.toFixed(4)}`;
    },
    () => { status.textContent = 'Kon locatie niet bepalen'; },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

// Adres zoeken — handig om nu al bekende adressen (bijv. accommodaties) vast te leggen,
// ook als je er nog niet fysiek bent. Vereist internet.
document.getElementById('btnSearchAddress').addEventListener('click', async () => {
  const query = document.getElementById('fAddressQuery').value.trim();
  const results = document.getElementById('addressResults');
  if (!query) return;
  results.innerHTML = '<p class="location-status">Zoeken…</p>';
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&addressdetails=1&extratags=1&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      results.innerHTML = '<p class="location-status">Niets gevonden — probeer een andere zoekterm, eventueel met de plaatsnaam erbij</p>';
      return;
    }
    // Hotels/accommodaties (tourism-categorie in OpenStreetMap) eerst tonen
    const isStay = (p) => p.class === 'tourism' || ['hotel','guest_house','hostel','apartment','motel','camp_site'].includes(p.type);
    data.sort((a, b) => (isStay(b) ? 1 : 0) - (isStay(a) ? 1 : 0));
    results.innerHTML = '';
    data.forEach((place) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'address-result';
      const icon = isStay(place) ? '🏨 ' : '📍 ';
      btn.textContent = icon + place.display_name;
      btn.addEventListener('click', () => {
        pendingLocation = { lat: parseFloat(place.lat), lng: parseFloat(place.lon) };
        pendingLocationName = place.display_name;
        document.getElementById('locateStatus').textContent = `✓ ${place.display_name}`;
        results.innerHTML = '';
        document.getElementById('fAddressQuery').value = '';
      });
      results.appendChild(btn);
    });
  } catch (err) {
    results.innerHTML = '<p class="location-status">Kon niet zoeken — controleer je internetverbinding</p>';
  }
});

// ---------- Foto's ----------
let pendingPhotos = [];
document.getElementById('btnAddPhoto').addEventListener('click', () => {
  document.getElementById('fPhotos').click();
});
document.getElementById('fPhotos').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  for (const file of files) {
    const dataUrl = await compressImage(file);
    pendingPhotos.push(dataUrl);
  }
  renderPhotoPreview();
  e.target.value = '';
});
function renderPhotoPreview() {
  const wrap = document.getElementById('photoPreview');
  wrap.innerHTML = '';
  pendingPhotos.forEach((src, i) => {
    const item = document.createElement('div');
    item.className = 'photo-preview__item';
    item.innerHTML = `<img src="${src}"><button type="button" class="photo-preview__remove" data-i="${i}">×</button>`;
    wrap.appendChild(item);
  });
  wrap.querySelectorAll('.photo-preview__remove').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingPhotos.splice(Number(btn.dataset.i), 1);
      renderPhotoPreview();
    });
  });
}
function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = () => {
      const maxW = 1280;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    reader.readAsDataURL(file);
  });
}

// ---------- Formulier opslaan ----------
document.getElementById('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  askAuthor(false);
  const author = getAuthor();
  if (!author) return;

  const isEdit = editingId !== null;
  const date = document.getElementById('fDate').value;
  const time = document.getElementById('fTime').value;
  const entry = {
    id: isEdit ? editingId : (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2)),
    type: selectedType,
    title: document.getElementById('fTitle').value.trim(),
    note: document.getElementById('fNote').value.trim(),
    timestamp: `${date}T${time}:00`,
    lat: pendingLocation ? pendingLocation.lat : null,
    lng: pendingLocation ? pendingLocation.lng : null,
    locationName: pendingLocationName,
    photos: pendingPhotos.slice(),
    author: isEdit ? editingAuthor : author,
    createdAt: isEdit ? editingCreatedAt : new Date().toISOString()
  };
  await VakantieDB.put(entry);
  toast(isEdit ? 'Moment bijgewerkt ✓' : 'Moment bewaard ✓');

  resetEntryForm();
  await renderAll();
  showView('view-dashboard');
});

// ---------- Tijdlijn renderen ----------
function fmtDayHeading(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmtTime(ts) {
  return ts.slice(11, 16);
}
function fmtStamp(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' }).toUpperCase();
}

let allEntries = [];

async function renderAll() {
  allEntries = await VakantieDB.getAll();
  renderTimeline();
  renderMap();
  updateCounts();
  renderDashboard();
}

function renderTimeline() {
  const container = document.getElementById('timeline');
  container.innerHTML = '';
  const main = document.querySelector('main');
  main.classList.toggle('is-empty', allEntries.length === 0);

  const groups = {};
  allEntries.forEach(entry => {
    const day = entry.timestamp.slice(0, 10);
    (groups[day] = groups[day] || []).push(entry);
  });

  Object.keys(groups).sort().forEach(day => {
    const heading = document.createElement('div');
    heading.className = 'day-heading';
    heading.textContent = fmtDayHeading(day);
    container.appendChild(heading);

    groups[day].forEach(entry => {
      container.appendChild(renderPostcard(entry));
    });
  });
}

function renderPostcard(entry) {
  const el = document.createElement('article');
  el.className = 'postcard';
  el.dataset.id = entry.id;
  const color = authorColor(entry.author);
  const initial = entry.author.slice(0, 1).toUpperCase();
  el.innerHTML = `
    <div class="postcard__tape"></div>
    <div class="postcard__top">
      <span class="postcard__type">${TYPE_ICON[entry.type] || '📍'}</span>
      <h3 class="postcard__title">${escapeHtml(entry.title)}</h3>
      <span class="postcard__stamp">${fmtStamp(entry.timestamp)}</span>
    </div>
    ${entry.note ? `<p class="postcard__note">${escapeHtml(entry.note)}</p>` : ''}
    ${entry.photos && entry.photos.length ? `<div class="postcard__photos">${entry.photos.map(p => `<img src="${p}">`).join('')}</div>` : ''}
    <div class="postcard__meta">
      <span class="author-dot" style="background:${color}">${initial}</span>
      <span>${entry.author} · ${fmtTime(entry.timestamp)}</span>
      ${entry.lat ? `<span>· 📍 ${entry.locationName ? escapeHtml(entry.locationName.split(',').slice(0,2).join(',')) : 'vastgelegd'}</span>` : ''}
    </div>
  `;
  el.addEventListener('click', () => openEntryModal(entry));
  return el;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function openEntryModal(entry) {
  const modal = document.getElementById('entryModal');
  const card = document.getElementById('entryModalCard');
  card.innerHTML = `
    <h3 style="font-family:var(--font-display);margin:0 0 4px;">${TYPE_ICON[entry.type]} ${escapeHtml(entry.title)}</h3>
    <p style="font-family:var(--font-mono);font-size:11px;color:#7c8580;margin:0 0 12px;">
      ${TYPE_LABEL[entry.type]} · ${entry.author} · ${new Date(entry.timestamp).toLocaleString('nl-NL')}
    </p>
    ${entry.note ? `<p style="line-height:1.6;">${escapeHtml(entry.note)}</p>` : ''}
    ${(entry.photos || []).map(p => `<img src="${p}">`).join('')}
    ${entry.lat ? `<p style="font-size:12px;color:#7c8580;">📍 ${entry.locationName ? escapeHtml(entry.locationName) : entry.lat.toFixed(5) + ', ' + entry.lng.toFixed(5)}</p>` : ''}
    <button class="btn btn--primary btn--wide" id="btnEditEntry">✏️ Wijzigen</button>
    <button class="btn btn--ghost btn--wide" id="btnDeleteEntry">🗑️ Verwijderen</button>
    <button class="modal__close" id="btnCloseModal">Sluiten</button>
  `;
  modal.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
  document.getElementById('btnCloseModal').onclick = () => { closeModal(); };
  document.getElementById('btnEditEntry').onclick = () => { editEntry(entry); };
  document.getElementById('btnDeleteEntry').onclick = async () => {
    if (confirm('Dit moment verwijderen?')) {
      await VakantieDB.remove(entry.id);
      closeModal();
      await renderAll();
    }
  };
}
document.getElementById('entryModal').addEventListener('click', (e) => {
  if (e.target.id === 'entryModal') closeModal();
});

function updateCounts() {
  document.getElementById('countPill').textContent = `${allEntries.length} moment${allEntries.length === 1 ? '' : 'en'}`;
  document.getElementById('countPillDash').textContent = `${allEntries.length} moment${allEntries.length === 1 ? '' : 'en'}`;
  const withLoc = allEntries.filter(e => e.lat);
  document.getElementById('countPillMap').textContent = `${withLoc.length} pin${withLoc.length === 1 ? '' : 's'}`;
}

// ---------- Dashboard ----------
function renderDashboard() {
  const empty = document.getElementById('dashEmpty');
  const content = document.getElementById('dashContent');

  if (allEntries.length === 0) {
    empty.hidden = false;
    content.hidden = true;
    return;
  }
  empty.hidden = true;
  content.hidden = false;

  // Statistieken (zelfde berekening als Overzicht)
  const grid = document.getElementById('dashStats');
  const days = new Set(allEntries.map(e => e.timestamp.slice(0, 10))).size;
  const photos = allEntries.reduce((n, e) => n + (e.photos ? e.photos.length : 0), 0);
  const eten = allEntries.filter(e => e.type === 'eten').length;
  grid.innerHTML = `
    <div class="stat-card"><b>${days}</b><span>Dagen vastgelegd</span></div>
    <div class="stat-card"><b>${allEntries.length}</b><span>Momenten</span></div>
    <div class="stat-card"><b>${photos}</b><span>Foto's</span></div>
    <div class="stat-card"><b>${eten}</b><span>Eetmomenten</span></div>
  `;

  // Volgende halte: eerstvolgende moment met een datum in de toekomst
  const now = new Date();
  const future = allEntries
    .filter(e => new Date(e.timestamp) > now)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const wrap = document.getElementById('nextStopWrap');
  if (future.length) {
    const next = future[0];
    const daysUntil = Math.ceil((new Date(next.timestamp) - now) / (1000 * 60 * 60 * 24));
    wrap.innerHTML = `
      <div class="next-stop-card">
        <p class="next-stop-card__eyebrow">Volgende halte</p>
        <p class="next-stop-card__title">${TYPE_ICON[next.type]} ${escapeHtml(next.title)}</p>
        <p class="next-stop-card__meta">${next.locationName ? escapeHtml(next.locationName.split(',').slice(0, 2).join(',')) : fmtDayHeading(next.timestamp.slice(0, 10))}</p>
        <p class="next-stop-card__count">over ${daysUntil} dag${daysUntil === 1 ? '' : 'en'}</p>
      </div>`;
  } else {
    wrap.innerHTML = '';
  }

  // Laatste 3 momenten
  const recentWrap = document.getElementById('dashRecent');
  recentWrap.innerHTML = '';
  allEntries.slice(-3).reverse().forEach(entry => {
    recentWrap.appendChild(renderPostcard(entry));
  });

  renderDashMap();
}

let dashMap = null, dashMapLayer = null;
function renderDashMap() {
  const withLoc = allEntries.filter(e => e.lat);
  if (!withLoc.length) {
    document.getElementById('dashMap').closest('.dash-map-wrap').style.display = 'none';
    return;
  }
  document.getElementById('dashMap').closest('.dash-map-wrap').style.display = '';

  if (!dashMap) {
    dashMap = L.map('dashMap', {
      zoomControl: false, dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false
    }).setView([52.1, 5.3], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap', maxZoom: 19
    }).addTo(dashMap);
    dashMapLayer = L.layerGroup().addTo(dashMap);
  }
  dashMapLayer.clearLayers();
  const latlngs = [];
  withLoc.forEach((entry, i) => {
    const icon = L.divIcon({
      className: '', html: `<div class="map-pin-num">${i + 1}</div>`,
      iconSize: [22, 22], iconAnchor: [11, 11]
    });
    L.marker([entry.lat, entry.lng], { icon }).addTo(dashMapLayer);
    latlngs.push([entry.lat, entry.lng]);
  });
  L.polyline(latlngs, { color: '#B23A2E', weight: 2, dashArray: '6 6', opacity: 0.8 }).addTo(dashMapLayer);
  setTimeout(() => {
    dashMap.invalidateSize();
    dashMap.fitBounds(latlngs, { padding: [20, 20] });
  }, 60);
}

document.getElementById('btnOpenMap').addEventListener('click', () => showView('view-kaart'));
document.getElementById('btnOpenTijdlijn').addEventListener('click', () => showView('view-tijdlijn'));

// ---------- Kaart ----------
let map = null, mapLayer = null;
function renderMap() {
  if (!map) {
    map = L.map('map').setView([52.1, 5.3], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
    mapLayer = L.layerGroup().addTo(map);
  }
  mapLayer.clearLayers();
  const withLoc = allEntries.filter(e => e.lat);
  if (withLoc.length === 0) return;

  const latlngs = [];
  withLoc.forEach((entry, i) => {
    const icon = L.divIcon({
      className: '',
      html: `<div class="map-pin-num">${i + 1}</div>`,
      iconSize: [26, 26], iconAnchor: [13, 13]
    });
    const marker = L.marker([entry.lat, entry.lng], { icon }).addTo(mapLayer);
    marker.bindPopup(`<b>${TYPE_ICON[entry.type]} ${escapeHtml(entry.title)}</b><br>${fmtStamp(entry.timestamp)} · ${entry.author}${entry.locationName ? '<br>' + escapeHtml(entry.locationName) : ''}`);
    latlngs.push([entry.lat, entry.lng]);
  });
  L.polyline(latlngs, { color: '#B23A2E', weight: 2, dashArray: '6 6', opacity: 0.8 }).addTo(mapLayer);
  map.fitBounds(latlngs, { padding: [30, 30] });
}

// ---------- Overzicht / stats ----------
function renderStats() {
  const grid = document.getElementById('statsGrid');
  const days = new Set(allEntries.map(e => e.timestamp.slice(0, 10))).size;
  const photos = allEntries.reduce((n, e) => n + (e.photos ? e.photos.length : 0), 0);
  const eten = allEntries.filter(e => e.type === 'eten').length;
  const plekken = allEntries.filter(e => e.type === 'plek' || e.lat).length;
  grid.innerHTML = `
    <div class="stat-card"><b>${days}</b><span>Dagen vastgelegd</span></div>
    <div class="stat-card"><b>${allEntries.length}</b><span>Momenten</span></div>
    <div class="stat-card"><b>${photos}</b><span>Foto's</span></div>
    <div class="stat-card"><b>${eten}</b><span>Eetmomenten</span></div>
  `;
}

// ---------- Export / import ----------
document.getElementById('btnExport').addEventListener('click', async () => {
  const author = getAuthor() || 'reis';
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `onderweg-${author.toLowerCase()}-${stamp}.json`;
  const data = JSON.stringify(allEntries, null, 0);

  // Eén tik: opent direct het native deelmenu (WhatsApp, AirDrop, mail, ...)
  try {
    const file = new File([data], filename, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Onderweg — reisdagboek',
        text: `Momenten van ${author}`
      });
      toast('Gedeeld ✓');
      return;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return; // gebruiker annuleerde het deelmenu zelf
    // val terug op downloaden hieronder
  }

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Bestand gedownload — deel ’m via WhatsApp/AirDrop');
});

document.getElementById('fImport').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById('importStatus');
  try {
    const text = await file.text();
    const incoming = JSON.parse(text);
    if (!Array.isArray(incoming)) throw new Error('bad format');
    const result = await VakantieDB.mergeMany(incoming);
    status.textContent = `✓ ${result.added} nieuw toegevoegd, ${result.skipped} bestonden al`;
    await renderAll();
    toast('Samengevoegd ✓');
  } catch (err) {
    status.textContent = 'Kon bestand niet lezen — is het een export van deze app?';
  }
  e.target.value = '';
});

// ---------- Service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ---------- Start ----------
prefillDateTime();
askAuthor(false);
updateWhoButton();
renderAll();
