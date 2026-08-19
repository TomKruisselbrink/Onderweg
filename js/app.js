// ============================================================
// FIREBASE — verbinding, login, realtime data
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult,
  signInAnonymously, onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, updateDoc, deleteDoc, getDoc, collection,
  query, orderBy, onSnapshot, arrayUnion, enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAESp3mAYnvHhtpIIRY9QyJwqUciBmijdM",
  authDomain: "jut-en-juul-op-vakantie.firebaseapp.com",
  projectId: "jut-en-juul-op-vakantie",
  storageBucket: "jut-en-juul-op-vakantie.firebasestorage.app",
  messagingSenderId: "564201748696",
  appId: "1:564201748696:web:f49f0e3303ce7c0d4dffad",
  measurementId: "G-JFD9ZZJ9CN"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
enableIndexedDbPersistence(db).catch(() => { /* meerdere tabbladen open o.i.d. — niet kritiek */ });

let currentUser = null;
let currentTripCode = null;
let currentRole = null; // 'traveler' | 'follower'
let unsubscribeEntries = null;

function authorName() {
  if (!currentUser) return 'Reisgenoot';
  return currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Reisgenoot');
}
function generateTripCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // zonder verwarrende tekens (0/O, 1/I/L)
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ---------- Onboarding UI ----------
const obScreen = document.getElementById('onboardScreen');
const obError = document.getElementById('obError');
const obLoading = document.getElementById('obLoading');

function obShowError(msg) {
  obError.textContent = msg;
  obError.hidden = false;
}
function obClearError() { obError.hidden = true; }
function obSetLoading(on) { obLoading.hidden = !on; }
function obShowStep(id) {
  document.querySelectorAll('.onboard__step').forEach(s => s.hidden = s.id !== id);
  obClearError();
}

document.getElementById('obTraveler').addEventListener('click', async () => {
  obClearError();
  obSetLoading(true);
  try {
    sessionStorage.setItem('pendingRole', 'traveler');
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  } catch (err) {
    obSetLoading(false);
    obShowError('Inloggen mislukt: ' + err.message);
  }
});
document.getElementById('obFollower').addEventListener('click', () => {
  obShowStep('obStepFollower');
});
document.getElementById('obBackFromTraveler').addEventListener('click', () => obShowStep('obStepRole'));
document.getElementById('obBackFromFollower').addEventListener('click', () => obShowStep('obStepRole'));

document.getElementById('obCreateTrip').addEventListener('click', async () => {
  obClearError();
  obSetLoading(true);
  try {
    const name = document.getElementById('obTripNameInput').value.trim() || 'Jut en Juul op vakantie';
    let code, exists = true, attempts = 0;
    while (exists && attempts < 8) {
      code = generateTripCode();
      const snap = await getDoc(doc(db, 'trips', code));
      exists = snap.exists();
      attempts++;
    }
    await setDoc(doc(db, 'trips', code), {
      name,
      ownerUids: [currentUser.uid],
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('tripCode', code);
    localStorage.setItem('tripRole', 'traveler');
    enterApp(code, 'traveler');
  } catch (err) {
    obSetLoading(false);
    obShowError('Kon geen reis aanmaken: ' + err.message);
  }
});

document.getElementById('obJoinTrip').addEventListener('click', async () => {
  obClearError();
  const code = document.getElementById('obJoinCodeInput').value.trim().toUpperCase();
  if (code.length !== 6) { obShowError('Vul een geldige 6-tekens reiscode in.'); return; }
  obSetLoading(true);
  try {
    const ref = doc(db, 'trips', code);
    const snap = await getDoc(ref);
    if (!snap.exists()) { obSetLoading(false); obShowError('Deze reiscode bestaat niet.'); return; }
    await updateDoc(ref, { ownerUids: arrayUnion(currentUser.uid) });
    localStorage.setItem('tripCode', code);
    localStorage.setItem('tripRole', 'traveler');
    enterApp(code, 'traveler');
  } catch (err) {
    obSetLoading(false);
    obShowError('Kon niet bij deze reis komen: ' + err.message);
  }
});

document.getElementById('obFollowGo').addEventListener('click', async () => {
  obClearError();
  const name = document.getElementById('obFollowNameInput').value.trim();
  const code = document.getElementById('obFollowCodeInput').value.trim().toUpperCase();
  if (!name) { obShowError('Vul je naam in, zodat je herkenbaar bent als je reageert.'); return; }
  if (code.length !== 6) { obShowError('Vul een geldige 6-tekens reiscode in.'); return; }
  obSetLoading(true);
  try {
    if (!currentUser) await signInAnonymously(auth);
    await updateProfile(auth.currentUser, { displayName: name });
    currentUser = auth.currentUser;
    const ref = doc(db, 'trips', code);
    const snap = await getDoc(ref);
    if (!snap.exists()) { obSetLoading(false); obShowError('Deze reiscode bestaat niet.'); return; }
    localStorage.setItem('tripCode', code);
    localStorage.setItem('tripRole', 'follower');
    enterApp(code, 'follower');
  } catch (err) {
    obSetLoading(false);
    obShowError('Kon niet meekijken: ' + err.message);
  }
});

async function enterApp(code, role) {
  obSetLoading(false);
  currentTripCode = code;
  currentRole = role;
  const tripSnap = await getDoc(doc(db, 'trips', code));
  const tripName = tripSnap.exists() ? tripSnap.data().name : 'Jut en Juul op vakantie';

  document.getElementById('tripTitle').textContent = tripName;
  document.getElementById('tripSub').textContent = role === 'follower' ? 'je kijkt mee en kunt reageren' : 'jullie reisdagboek';
  document.getElementById('tripCodeDisplay').textContent = code;

  document.getElementById('fabNieuw').style.display = role === 'follower' ? 'none' : '';
  updateWhoButton();

  obScreen.hidden = true;
  document.getElementById('app').hidden = false;

  subscribeToEntries(code);
  subscribeToComments(code);
}

function leaveTrip() {
  if (unsubscribeEntries) unsubscribeEntries();
  if (unsubscribeComments) unsubscribeComments();
  localStorage.removeItem('tripCode');
  localStorage.removeItem('tripRole');
  signOut(auth).catch(() => {});
  location.reload();
}
document.getElementById('btnLeaveTrip').addEventListener('click', () => {
  if (confirm('Deze reis verlaten? Je kunt altijd opnieuw inloggen of de code opnieuw invoeren.')) leaveTrip();
});

// ---------- Auth state ----------
getRedirectResult(auth).catch((err) => {
  obShowError('Inloggen mislukt: ' + err.message);
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) return;

  const savedCode = localStorage.getItem('tripCode');
  const savedRole = localStorage.getItem('tripRole');
  if (savedCode && savedRole) {
    enterApp(savedCode, savedRole);
    return;
  }

  const pendingRole = sessionStorage.getItem('pendingRole');
  if (pendingRole === 'traveler' && !user.isAnonymous) {
    sessionStorage.removeItem('pendingRole');
    obShowStep('obStepTraveler');
  }
});

// ---------- Firestore: entries + reacties realtime ----------
let allEntries = [];
let allComments = [];
let unsubscribeComments = null;

function subscribeToEntries(code) {
  if (unsubscribeEntries) unsubscribeEntries();
  const q = query(collection(db, 'trips', code, 'entries'), orderBy('timestamp'));
  unsubscribeEntries = onSnapshot(q, (snapshot) => {
    allEntries = snapshot.docs.map(d => d.data());
    renderTimeline();
    renderMap();
    updateCounts();
    renderDashboard();
  }, (err) => {
    toast('Synchronisatie-fout: ' + err.message);
  });
}

function subscribeToComments(code) {
  if (unsubscribeComments) unsubscribeComments();
  const q = query(collection(db, 'trips', code, 'comments'), orderBy('createdAt'));
  unsubscribeComments = onSnapshot(q, (snapshot) => {
    allComments = snapshot.docs.map(d => d.data());
    renderTimeline();
  }, (err) => {
    toast('Synchronisatie-fout (reacties): ' + err.message);
  });
}

async function saveEntry(entry) {
  await setDoc(doc(db, 'trips', currentTripCode, 'entries', entry.id), entry);
}
async function removeEntry(id) {
  await deleteDoc(doc(db, 'trips', currentTripCode, 'entries', id));
}
async function addComment(day, text) {
  const comment = {
    id: crypto.randomUUID ? crypto.randomUUID() : 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    day,
    text: text.trim(),
    author: authorName(),
    authorUid: currentUser.uid,
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'trips', currentTripCode, 'comments', comment.id), comment);
}
async function removeComment(id) {
  await deleteDoc(doc(db, 'trips', currentTripCode, 'comments', id));
}


// ============================================================
// MODAL open/sluiten met vloeiende overgang
// ============================================================
function openModal() {
  const modal = document.getElementById('entryModal');
  modal.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
}
function closeModal() {
  const modal = document.getElementById('entryModal');
  modal.classList.remove('is-open');
  setTimeout(() => { modal.hidden = true; }, 260);
}

// ============================================================
// NIEUW MOMENT / WIJZIGEN
// ============================================================
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

  document.querySelectorAll('.pill-chip').forEach(c => c.classList.remove('is-active'));
  pendingMealType = null; pendingQuickTag = null; pendingPlaceType = null;
  pendingStayType = null; pendingTransportMode = null;
  pendingRating = 0;
  renderStarPicker();
  document.getElementById('fHighlight').checked = false;
  document.getElementById('chkGoedBed').checked = false;
  document.getElementById('chkUitzicht').checked = false;
  document.getElementById('chkDouche').checked = false;
  document.getElementById('chkLawaai').checked = false;
  document.getElementById('fFrom').value = '';
  document.getElementById('fTo').value = '';

  updateTypeFields();
  prefillDateTime();
}

function setChipActive(rowId, value) {
  document.querySelectorAll(`#${rowId} .pill-chip`).forEach((c) => {
    c.classList.toggle('is-active', c.dataset.value === value);
  });
}

function editEntry(entry) {
  editingId = entry.id;
  editingAuthor = entry.author;
  editingCreatedAt = entry.createdAt;
  closeModal();

  const type = normType(entry.type);
  selectedType = type;
  document.querySelectorAll('.type-chip').forEach(c => c.classList.toggle('is-active', c.dataset.type === type));
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

  document.querySelectorAll('.pill-chip').forEach(c => c.classList.remove('is-active'));
  pendingMealType = entry.mealType || null;
  pendingQuickTag = entry.quickTag || null;
  pendingPlaceType = entry.placeType || null;
  pendingStayType = entry.stayType || null;
  pendingTransportMode = entry.transportMode || null;
  if (pendingMealType) setChipActive('mealTypeRow', pendingMealType);
  if (pendingQuickTag) setChipActive('quickTagRow', pendingQuickTag);
  if (pendingPlaceType) setChipActive('placeTypeRow', pendingPlaceType);
  if (pendingStayType) setChipActive('stayTypeRow', pendingStayType);
  if (pendingTransportMode) setChipActive('transportRow', pendingTransportMode);

  pendingRating = entry.rating || 0;
  renderStarPicker();
  document.getElementById('fHighlight').checked = !!entry.highlight;
  const checks = entry.checks || {};
  document.getElementById('chkGoedBed').checked = !!checks.goedBed;
  document.getElementById('chkUitzicht').checked = !!checks.uitzicht;
  document.getElementById('chkDouche').checked = !!checks.douche;
  document.getElementById('chkLawaai').checked = !!checks.lawaai;
  document.getElementById('fFrom').value = entry.fromPlace || '';
  document.getElementById('fTo').value = entry.toPlace || '';

  updateTypeFields();
  document.getElementById('nieuwHeading').textContent = 'Moment wijzigen';
  document.getElementById('btnSaveEntry').textContent = 'Wijzigingen opslaan';
  showView('view-nieuw');
}

// ---------- Reis-knop (rechtsboven) ----------
const AUTHOR_COLORS = ['#2B6E63', '#B23A2E', '#D6A419', '#5B6EA8'];
function authorColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}
function updateWhoButton() {
  const btn = document.getElementById('btnWho');
  const name = authorName();
  btn.textContent = name.slice(0, 1).toUpperCase();
  btn.style.background = authorColor(name);
  btn.style.borderColor = 'transparent';
  btn.style.color = '#fff';
}
document.getElementById('btnWho').addEventListener('click', () => showView('view-overzicht'));

// ============================================================
// NAVIGATIE
// ============================================================
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
    if (btn.dataset.target === 'view-nieuw') {
      if (currentRole === 'follower') { showView('view-dashboard'); return; }
      resetEntryForm();
    }
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

// ============================================================
// TYPE PICKER + categorie-specifieke velden
// ============================================================
let selectedType = 'plek';

const TYPE_ICON = { plek: '📍', eten: '🍴', slaap: '🛏️', vervoer: '🚗' };
const TYPE_LABEL = { plek: 'Plek / Activiteit', eten: 'Eten & Drinken', slaap: 'Slaapplek', vervoer: 'Verplaatsing' };
const TYPE_COLOR = { plek: '#2B6E63', eten: '#D6A419', slaap: '#B23A2E', vervoer: '#5B6EA8' };
const LEGACY_TYPE_MAP = { activiteit: 'plek', overnachting: 'slaap' };
function normType(type) { return LEGACY_TYPE_MAP[type] || type; }

const MEAL_LABEL = { ontbijt: '🥐 Ontbijt', lunch: '🥪 Lunch', diner: '🍽️ Diner', snack: '☕ Snack/Koffie' };
const TAG_LABEL = { delicatesse: 'Lokale delicatesse', aanrader: 'Aanrader', touristtrap: 'Tourist trap', koffie: 'Aanrader voor koffie' };
const PLACE_LABEL = { natuur: '🌿 Natuur', cultuur: '🏛️ Cultuur', stad: '🏘️ Stad/Dorp', parel: '💎 Verborgen parel' };
const STAY_LABEL = { camping: '⛺ Camping/Tent', hotel: '🏨 Hotel/B&B', camper: '🚐 Camper/Bus', overig: '🚂 Nachttrein/Overig' };
const TRANSPORT_LABEL = { auto: '🚗 Auto', trein: '🚆 Trein', vliegtuig: '✈️ Vliegtuig', boot: '⛴️ Boot', fiets: '🚴 Benenwagen/Fiets' };

const TITLE_PLACEHOLDER = {
  eten: 'Bijv. Trattoria da Luigi, Rome',
  plek: 'Bijv. Uitzichtpunt Tre Cime',
  slaap: 'Bijv. Camping Le Pin, Provence',
  vervoer: 'Bijv. Rit naar Rome'
};
const NOTE_PLACEHOLDER = {
  eten: 'Wat heb je gegeten en gedronken?',
  plek: 'Sfeer, verhalen of praktische tips',
  slaap: 'Toelichting voor als je er ooit terug wil',
  vervoer: 'Bijv. "Prachtige bergpas" of "vertraging gehad"'
};

function updateTypeFields() {
  document.querySelectorAll('.type-fields[data-for]').forEach((sec) => {
    sec.hidden = !sec.dataset.for.split(' ').includes(selectedType);
  });
  document.getElementById('titleLabel').textContent = selectedType === 'vervoer' ? 'Naam / omschrijving rit' : 'Naam / locatie';
  document.getElementById('fTitle').placeholder = TITLE_PLACEHOLDER[selectedType];
  document.getElementById('noteLabel').textContent = selectedType === 'vervoer' ? 'Karakter van de rit' : 'Aantekening';
  document.getElementById('fNote').placeholder = NOTE_PLACEHOLDER[selectedType];
  document.getElementById('ratingFieldLabel').textContent = selectedType === 'slaap' ? 'Slaapscore' : 'Beoordeling';
}

document.querySelectorAll('.type-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    selectedType = chip.dataset.type;
    updateTypeFields();
  });
});
document.querySelector('.type-chip[data-type="plek"]').classList.add('is-active');

let pendingMealType = null, pendingQuickTag = null, pendingPlaceType = null,
    pendingStayType = null, pendingTransportMode = null;

document.querySelectorAll('.pill-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const row = chip.closest('.chip-row');
    const wasActive = chip.classList.contains('is-active');
    row.querySelectorAll('.pill-chip').forEach((c) => c.classList.remove('is-active'));
    if (!wasActive) chip.classList.add('is-active');
    pendingMealType = document.querySelector('#mealTypeRow .pill-chip.is-active')?.dataset.value || null;
    pendingQuickTag = document.querySelector('#quickTagRow .pill-chip.is-active')?.dataset.value || null;
    pendingPlaceType = document.querySelector('#placeTypeRow .pill-chip.is-active')?.dataset.value || null;
    pendingStayType = document.querySelector('#stayTypeRow .pill-chip.is-active')?.dataset.value || null;
    pendingTransportMode = document.querySelector('#transportRow .pill-chip.is-active')?.dataset.value || null;
  });
});

let pendingRating = 0;
function renderStarPicker() {
  document.querySelectorAll('#ratingPicker .star-btn').forEach((b) => {
    b.classList.toggle('is-filled', Number(b.dataset.value) <= pendingRating);
  });
}
document.getElementById('ratingPicker').addEventListener('click', (e) => {
  const btn = e.target.closest('.star-btn');
  if (!btn) return;
  const val = Number(btn.dataset.value);
  pendingRating = (pendingRating === val) ? 0 : val;
  renderStarPicker();
});

function prefillDateTime() {
  const now = new Date();
  document.getElementById('fDate').value = now.toISOString().slice(0, 10);
  document.getElementById('fTime').value = now.toTimeString().slice(0, 5);
}

// ============================================================
// LOCATIE (GPS + adres zoeken)
// ============================================================
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

// ============================================================
// FOTO'S — camera of bibliotheek (native keuzemenu), max 3, sterk gecomprimeerd
// zodat een moment ruim binnen de opslaglimiet van één document blijft.
// ============================================================
const MAX_PHOTOS = 3;
let pendingPhotos = [];
document.getElementById('btnAddPhoto').addEventListener('click', () => {
  document.getElementById('fPhotos').click();
});
document.getElementById('fPhotos').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  for (const file of files) {
    if (pendingPhotos.length >= MAX_PHOTOS) {
      toast(`Maximaal ${MAX_PHOTOS} foto's per moment`);
      break;
    }
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
      const maxW = 900;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.55));
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================
// FORMULIER OPSLAAN
// ============================================================
document.getElementById('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (currentRole === 'follower') return;

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
    author: isEdit ? editingAuthor : authorName(),
    createdAt: isEdit ? editingCreatedAt : new Date().toISOString()
  };

  if (selectedType === 'eten') {
    entry.mealType = pendingMealType;
    entry.quickTag = pendingQuickTag;
    entry.rating = pendingRating || null;
  } else if (selectedType === 'plek') {
    entry.placeType = pendingPlaceType;
    entry.highlight = document.getElementById('fHighlight').checked;
    entry.rating = pendingRating || null;
  } else if (selectedType === 'slaap') {
    entry.stayType = pendingStayType;
    entry.rating = pendingRating || null;
    entry.checks = {
      goedBed: document.getElementById('chkGoedBed').checked,
      uitzicht: document.getElementById('chkUitzicht').checked,
      douche: document.getElementById('chkDouche').checked,
      lawaai: document.getElementById('chkLawaai').checked
    };
  } else if (selectedType === 'vervoer') {
    entry.fromPlace = document.getElementById('fFrom').value.trim();
    entry.toPlace = document.getElementById('fTo').value.trim();
    entry.transportMode = pendingTransportMode;
  }

  try {
    await saveEntry(entry);
    toast(isEdit ? 'Moment bijgewerkt ✓' : 'Moment bewaard ✓');
    resetEntryForm();
    showView('view-dashboard');
  } catch (err) {
    toast('Opslaan mislukt: ' + err.message);
  }
});

// ============================================================
// TIJDLIJN / POSTKAARTJES
// ============================================================
function fmtDayHeading(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmtTime(ts) { return ts.slice(11, 16); }
function fmtStamp(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' }).toUpperCase();
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
    groups[day].forEach(entry => container.appendChild(renderPostcard(entry)));
    container.appendChild(renderDayComments(day));
  });
}

function renderDayComments(day) {
  const wrap = document.createElement('div');
  wrap.className = 'day-comments';
  const dayComments = allComments.filter(c => c.day === day);

  const list = document.createElement('div');
  list.className = 'day-comments__list';
  if (dayComments.length === 0) {
    list.innerHTML = '<p class="day-comments__empty">Nog geen reacties op deze dag — wees de eerste!</p>';
  } else {
    dayComments.forEach((c) => {
      const row = document.createElement('div');
      row.className = 'comment';
      const canRemove = currentRole !== 'follower' || c.authorUid === currentUser.uid;
      row.innerHTML = `
        <span class="author-dot" style="background:${authorColor(c.author)}">${escapeHtml(c.author.slice(0, 1).toUpperCase())}</span>
        <div style="flex:1;">
          <b>${escapeHtml(c.author)}</b>
          <p>${escapeHtml(c.text)}</p>
        </div>
        ${canRemove ? `<button type="button" class="comment__remove" title="Verwijderen">×</button>` : ''}
      `;
      if (canRemove) {
        row.querySelector('.comment__remove').addEventListener('click', () => removeComment(c.id));
      }
      list.appendChild(row);
    });
  }
  wrap.appendChild(list);

  const form = document.createElement('form');
  form.className = 'day-comments__form';
  form.innerHTML = `<input type="text" placeholder="Reageer op deze dag…" maxlength="300"><button type="submit">➤</button>`;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    input.disabled = true;
    try {
      await addComment(day, text);
      input.value = '';
    } catch (err) {
      toast('Reageren mislukt: ' + err.message);
    }
    input.disabled = false;
    input.focus();
  });
  wrap.appendChild(form);

  return wrap;
}

function renderBadges(entry) {
  const type = normType(entry.type);
  const badges = [];
  if (entry.rating) badges.push(`<span class="postcard__stars">${'★'.repeat(entry.rating)}${'☆'.repeat(5 - entry.rating)}</span>`);
  if (type === 'eten') {
    if (entry.mealType) badges.push(`<span class="badge">${MEAL_LABEL[entry.mealType] || entry.mealType}</span>`);
    if (entry.quickTag) badges.push(`<span class="badge">${TAG_LABEL[entry.quickTag] || entry.quickTag}</span>`);
  } else if (type === 'plek') {
    if (entry.placeType) badges.push(`<span class="badge">${PLACE_LABEL[entry.placeType] || entry.placeType}</span>`);
    if (entry.highlight) badges.push(`<span class="badge badge--highlight">🏆 Beste van de reis</span>`);
  } else if (type === 'slaap') {
    if (entry.stayType) badges.push(`<span class="badge">${STAY_LABEL[entry.stayType] || entry.stayType}</span>`);
    const c = entry.checks || {};
    if (c.goedBed) badges.push('<span class="badge">Goed bed</span>');
    if (c.uitzicht) badges.push('<span class="badge">Mooi uitzicht</span>');
    if (c.douche) badges.push('<span class="badge">Lekkere douche</span>');
    if (c.lawaai) badges.push('<span class="badge">Lawaai/rumoerig</span>');
  } else if (type === 'vervoer') {
    if (entry.fromPlace || entry.toPlace) badges.push(`<span class="badge">${escapeHtml(entry.fromPlace || '?')} → ${escapeHtml(entry.toPlace || '?')}</span>`);
    if (entry.transportMode) badges.push(`<span class="badge">${TRANSPORT_LABEL[entry.transportMode] || entry.transportMode}</span>`);
  }
  return badges.length ? `<div class="postcard__badges">${badges.join('')}</div>` : '';
}

function renderPostcard(entry) {
  const el = document.createElement('article');
  el.className = 'postcard';
  el.dataset.id = entry.id;
  const color = authorColor(entry.author);
  const initial = entry.author.slice(0, 1).toUpperCase();
  const type = normType(entry.type);
  el.innerHTML = `
    <div class="postcard__tape"></div>
    <div class="postcard__top">
      <span class="postcard__type">${TYPE_ICON[type] || '📍'}</span>
      <h3 class="postcard__title">${escapeHtml(entry.title)}</h3>
      <span class="postcard__stamp">${fmtStamp(entry.timestamp)}</span>
    </div>
    ${entry.note ? `<p class="postcard__note">${escapeHtml(entry.note)}</p>` : ''}
    ${renderBadges(entry)}
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
  const type = normType(entry.type);
  const canEdit = currentRole !== 'follower';
  card.innerHTML = `
    <h3 style="font-family:var(--font-display);margin:0 0 4px;">${TYPE_ICON[type]} ${escapeHtml(entry.title)}</h3>
    <p style="font-family:var(--font-mono);font-size:11px;color:#7c8580;margin:0 0 12px;">
      ${TYPE_LABEL[type]} · ${entry.author} · ${new Date(entry.timestamp).toLocaleString('nl-NL')}
    </p>
    ${renderBadges(entry)}
    ${type === 'vervoer' && (entry.fromPlace || entry.toPlace) ? `<p style="font-size:13px;margin:8px 0 0;">${escapeHtml(entry.fromPlace || '?')} → ${escapeHtml(entry.toPlace || '?')}</p>` : ''}
    ${entry.note ? `<p style="line-height:1.6;">${escapeHtml(entry.note)}</p>` : ''}
    ${(entry.photos || []).map(p => `<img src="${p}">`).join('')}
    ${entry.lat ? `<p style="font-size:12px;color:#7c8580;">📍 ${entry.locationName ? escapeHtml(entry.locationName) : entry.lat.toFixed(5) + ', ' + entry.lng.toFixed(5)}</p>` : ''}
    ${canEdit ? `<button class="btn btn--primary btn--wide" id="btnEditEntry">✏️ Wijzigen</button>
    <button class="btn btn--ghost btn--wide" id="btnDeleteEntry">🗑️ Verwijderen</button>` : ''}
    <button class="modal__close" id="btnCloseModal">Sluiten</button>
  `;
  modal.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
  document.getElementById('btnCloseModal').onclick = () => { closeModal(); };
  if (canEdit) {
    document.getElementById('btnEditEntry').onclick = () => { editEntry(entry); };
    document.getElementById('btnDeleteEntry').onclick = async () => {
      if (confirm('Dit moment verwijderen?')) {
        await removeEntry(entry.id);
        closeModal();
      }
    };
  }
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

// ============================================================
// DASHBOARD
// ============================================================
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

  const grid = document.getElementById('dashStats');
  const plekken = allEntries.filter(e => normType(e.type) === 'plek').length;
  const maaltijden = allEntries.filter(e => normType(e.type) === 'eten').length;
  const nachtjes = allEntries.filter(e => normType(e.type) === 'slaap').length;
  grid.innerHTML = `
    <div class="stat-card"><b>${plekken}</b><span>📍 Plekken bezocht</span></div>
    <div class="stat-card"><b>${maaltijden}</b><span>🍴 Maaltijden</span></div>
    <div class="stat-card"><b>${nachtjes}</b><span>🛏️ Nachtjes geslapen</span></div>
    <div class="stat-card"><b>${allEntries.length}</b><span>Momenten totaal</span></div>
  `;

  const now = new Date();
  const future = allEntries
    .filter(e => new Date(e.timestamp) > now)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const wrap = document.getElementById('nextStopWrap');
  if (future.length) {
    const next = future[0];
    const nextType = normType(next.type);
    const daysUntil = Math.ceil((new Date(next.timestamp) - now) / (1000 * 60 * 60 * 24));
    wrap.innerHTML = `
      <div class="next-stop-card">
        <p class="next-stop-card__eyebrow">Volgende halte</p>
        <p class="next-stop-card__title">${TYPE_ICON[nextType]} ${escapeHtml(next.title)}</p>
        <p class="next-stop-card__meta">${next.locationName ? escapeHtml(next.locationName.split(',').slice(0, 2).join(',')) : fmtDayHeading(next.timestamp.slice(0, 10))}</p>
        <p class="next-stop-card__count">over ${daysUntil} dag${daysUntil === 1 ? '' : 'en'}</p>
      </div>`;
  } else {
    wrap.innerHTML = '';
  }

  const recentWrap = document.getElementById('dashRecent');
  recentWrap.innerHTML = '';
  allEntries.slice(-3).reverse().forEach(entry => recentWrap.appendChild(renderPostcard(entry)));

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
    const type = normType(entry.type);
    const icon = L.divIcon({
      className: '', html: `<div class="map-pin-num" style="background:${TYPE_COLOR[type] || 'var(--jade)'}">${i + 1}</div>`,
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

// ============================================================
// KAART
// ============================================================
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
    const type = normType(entry.type);
    const icon = L.divIcon({
      className: '',
      html: `<div class="map-pin-num" style="background:${TYPE_COLOR[type] || 'var(--jade)'}">${i + 1}</div>`,
      iconSize: [26, 26], iconAnchor: [13, 13]
    });
    const marker = L.marker([entry.lat, entry.lng], { icon }).addTo(mapLayer);
    marker.bindPopup(`<b>${TYPE_ICON[type]} ${escapeHtml(entry.title)}</b><br>${fmtStamp(entry.timestamp)} · ${entry.author}${entry.locationName ? '<br>' + escapeHtml(entry.locationName) : ''}`);
    latlngs.push([entry.lat, entry.lng]);
  });
  L.polyline(latlngs, { color: '#B23A2E', weight: 2, dashArray: '6 6', opacity: 0.8 }).addTo(mapLayer);
  map.fitBounds(latlngs, { padding: [30, 30] });
}

// ============================================================
// OVERZICHT / STATS / REISCODE DELEN
// ============================================================
function renderStats() {
  const grid = document.getElementById('statsGrid');
  const days = new Set(allEntries.map(e => e.timestamp.slice(0, 10))).size;
  const photos = allEntries.reduce((n, e) => n + (e.photos ? e.photos.length : 0), 0);
  const plekken = allEntries.filter(e => normType(e.type) === 'plek').length;
  const maaltijden = allEntries.filter(e => normType(e.type) === 'eten').length;
  const nachtjes = allEntries.filter(e => normType(e.type) === 'slaap').length;
  const highlights = allEntries.filter(e => e.highlight).length;
  grid.innerHTML = `
    <div class="stat-card"><b>${plekken}</b><span>📍 Plekken bezocht</span></div>
    <div class="stat-card"><b>${maaltijden}</b><span>🍴 Maaltijden</span></div>
    <div class="stat-card"><b>${nachtjes}</b><span>🛏️ Nachtjes geslapen</span></div>
    <div class="stat-card"><b>${days}</b><span>Dagen vastgelegd</span></div>
    <div class="stat-card"><b>${photos}</b><span>Foto's</span></div>
    <div class="stat-card"><b>${highlights}</b><span>🏆 Beste van de reis</span></div>
  `;
}

document.getElementById('btnShareCode').addEventListener('click', async () => {
  const text = `Doe mee met ons reisdagboek "Jut en Juul op vakantie"! Vul reiscode ${currentTripCode} in op de app.`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Jut en Juul op vakantie', text });
      return;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Tekst gekopieerd ✓');
  } catch (err) {
    toast(`Reiscode: ${currentTripCode}`);
  }
});
document.getElementById('btnCopyCode').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentTripCode);
    toast('Code gekopieerd ✓');
  } catch (err) {
    toast(`Reiscode: ${currentTripCode}`);
  }
});

// ============================================================
// SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ============================================================
// START
// ============================================================
prefillDateTime();
updateTypeFields();
