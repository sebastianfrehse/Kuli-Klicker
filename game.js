import { createPen } from './engine.js';
import { buildSkins } from './skins.js';
import { initCloud, cloudUser, onCloudChange, cloudBusy, signIn, signOutCloud, deleteAccount } from './cloud.js';

const $ = (s) => document.querySelector(s);
const SAVE_KEY = 'kuliKlicker.v1';

// ---------- Daten ----------
const AUTOS = [
  { id: 'feder',   icon: '🪶', name: 'Feder-Finger',   desc: 'Tippt ganz sanft für dich',     cps: 0.5,  base: 15 },
  { id: 'maus',    icon: '🖱️', name: 'Klick-Maus',     desc: 'Eine Maus, die nur klicken will', cps: 3,    base: 120 },
  { id: 'motor',   icon: '⚙️', name: 'Mini-Motor',     desc: 'Brummt und klickt',              cps: 15,   base: 1100 },
  { id: 'roboter', icon: '🤖', name: 'Klick-Roboter',  desc: 'Klickt ohne Pause',              cps: 80,   base: 12000 },
  { id: 'fabrik',  icon: '🏭', name: 'Kuli-Fabrik',    desc: 'Ganze Hallen voller Kulis',      cps: 450,  base: 130000 },
  { id: 'labor',   icon: '🧪', name: 'Klick-Labor',    desc: 'Forscht am perfekten Klick',     cps: 2600, base: 1.4e6 },
  { id: 'planet',  icon: '🪐', name: 'Kuli-Planet',    desc: 'Ein Planet aus Kulis',           cps: 16000, base: 2e7 },
];
const POWER_BASE = 25;
const powerCost = (lvl) => Math.ceil(POWER_BASE * Math.pow(1.75, lvl));
const autoCost = (a, n) => Math.ceil(a.base * Math.pow(1.15, n));
const SKINS = buildSkins();

// ---------- Spielstand ----------
const fresh = () => ({ clicks: 0, total: 0, taps: 0, power: 0, autos: {}, owned: ['blau'], skin: 'blau', sound: true, vibe: true, last: Date.now() });
let S = fresh();
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch (e) {}
const save = () => { S.last = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} };

const skinBonus = () => 1 + 0.05 * (S.owned.length - 1);
const perTap = () => (1 + S.power) * skinBonus();
const perSec = () => AUTOS.reduce((s, a) => s + a.cps * (S.autos[a.id] || 0), 0) * skinBonus();

// ---------- Zahlen ----------
function fmt(n) {
  if (n < 1000) return (n < 10 && n % 1 ? n.toFixed(1).replace('.', ',') : Math.floor(n).toString());
  if (n < 1e6) return Math.floor(n).toLocaleString('de-DE');
  const units = [[1e18, 'Trio.'], [1e15, 'Brd.'], [1e12, 'Bio.'], [1e9, 'Mrd.'], [1e6, 'Mio.']];
  for (const [v, u] of units) if (n >= v) return (n / v).toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + ' ' + u;
}

// ---------- Sound ----------
let ac = null;
function clickSound(strong = true) {
  if (!S.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime;
    const burst = (delay, freq, vol) => {
      const len = 0.03, buf = ac.createBuffer(1, Math.ceil(ac.sampleRate*len), ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.exp(-i / (ac.sampleRate*0.0035));
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.4;
      const g = ac.createGain(); g.gain.value = vol;
      src.connect(f).connect(g).connect(ac.destination); src.start(t + delay);
    };
    burst(0, 3200 + Math.random()*400, strong ? 0.9 : 0.25);
    burst(0.07, 2300 + Math.random()*300, strong ? 0.6 : 0.15);
  } catch (e) {}
}

// ---------- 3D ----------
const canvas = $('#pen');
let pen;
try { pen = createPen(canvas); }
catch (e) { $('#err').textContent = 'Dein Gerät unterstützt leider kein WebGL2 (3D).'; $('#err').hidden = false; throw e; }
const skinById = (id) => SKINS.find(s => s.id === id) || SKINS[0];
function applySkin() {
  const s = skinById(S.skin);
  pen.setSkin(s);
  document.documentElement.style.setProperty('--glow', s.glow);
}
applySkin();

// ---------- Eingabe: Tippen = klicken, Halten + Ziehen = drehen ----------
const pointers = new Map();
let rotPointer = null;
const MOVE_TOL = 12, HOLD_MS = 350;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), tl: performance.now(), rot: false });
  hideHint();
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const now = performance.now();
  if (!p.rot && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > MOVE_TOL && rotPointer === null) {
    p.rot = true; rotPointer = e.pointerId; pen.setDragging(true); p.x = e.clientX; p.y = e.clientY;
  }
  if (p.rot) pen.rotateBy(e.clientX - p.x, e.clientY - p.y, (now - p.tl) / 1000);
  p.x = e.clientX; p.y = e.clientY; p.tl = now;
});
const endPointer = (e, cancelled) => {
  const p = pointers.get(e.pointerId); if (!p) return;
  pointers.delete(e.pointerId);
  if (p.rot) { rotPointer = null; pen.setDragging(false); return; }
  if (!cancelled && performance.now() - p.t0 < HOLD_MS) tap(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', (e) => endPointer(e, false));
canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function tap(x, y) {
  const g = perTap();
  S.clicks += g; S.total += g; S.taps++;
  pen.press(); clickSound(true);
  if (S.vibe && navigator.vibrate) navigator.vibrate(8);
  floatText('+' + fmt(g), x, y, 'tap');
  ring(x, y);
  updateTop(); refreshShop();
}

// ---------- Effekte ----------
const fx = $('#fx');
function floatText(txt, x, y, cls) {
  if (fx.childElementCount > 40) fx.firstElementChild.remove();
  const d = document.createElement('div'); d.className = 'float ' + cls; d.textContent = txt;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  d.style.setProperty('--dx', ((Math.random() - 0.5) * 60) + 'px');
  fx.appendChild(d); setTimeout(() => d.remove(), 1000);
}
function ring(x, y) {
  const d = document.createElement('div'); d.className = 'ring'; d.style.left = x + 'px'; d.style.top = y + 'px';
  fx.appendChild(d); setTimeout(() => d.remove(), 500);
}

// ---------- Oberfläche ----------
function updateTop() {
  $('#count').textContent = fmt(S.clicks);
  $('#cps').textContent = fmt(perSec()) + ' pro Sek. · ' + fmt(perTap()) + ' pro Tipp';
}
let tab = null;
function openTab(t) {
  tab = tab === t ? null : t;
  $('#sheet').classList.toggle('open', !!tab);
  pen.setLift(tab ? 1 : 0);
  document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab) renderShop();
}
document.querySelectorAll('.tabbtn').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
$('#sheetClose').addEventListener('click', () => openTab(null));

function renderShop() {
  const list = $('#list'); list.innerHTML = '';
  $('#sheetTitle').textContent = { up: 'Upgrades', skins: 'Skins', menu: 'Einstellungen' }[tab];
  if (tab === 'up') {
    list.className = 'list';
    const lvl = S.power;
    list.appendChild(item({ key: 'power', icon: '👆', name: 'Starker Daumen', desc: `+1 Klick pro Tipp (jetzt ${fmt(perTap())})`, lvl, cost: powerCost(lvl), buy: () => { S.power++; } }));
    const shown = AUTOS.filter((a, i) => i === 0 || S.total >= AUTOS[i - 1].base * 0.5 || (S.autos[a.id] || 0) > 0);
    for (const a of shown) {
      const n = S.autos[a.id] || 0;
      list.appendChild(item({ key: a.id, icon: a.icon, name: a.name, desc: `${a.desc} · +${fmt(a.cps * skinBonus())}/Sek.`, lvl: n, cost: autoCost(a, n), buy: () => { S.autos[a.id] = n + 1; } }));
    }
    if (shown.length < AUTOS.length) { const d = document.createElement('div'); d.className = 'locked'; d.textContent = '🔒 Weitere Auto-Klicker werden freigeschaltet …'; list.appendChild(d); }
  } else if (tab === 'skins') {
    list.className = 'grid';
    const info = document.createElement('div'); info.className = 'info';
    info.textContent = `Jeder Skin gibt +5 % auf alles. Bonus jetzt: +${Math.round((skinBonus() - 1) * 100)} %`;
    list.appendChild(info);
    for (const s of SKINS) {
      const owned = S.owned.includes(s.id), on = S.skin === s.id;
      const c = document.createElement('button');
      c.className = 'skin' + (on ? ' on' : '') + (owned ? ' owned' : '');
      c.dataset.key = 'skin-' + s.id; c.dataset.cost = owned ? 0 : s.price;
      c.innerHTML = `<span class="sw" style="background:${s.preview}"></span><b>${s.name}</b><small>${on ? '✔ Ausgerüstet' : owned ? 'Auswählen' : '🖊️ ' + fmt(s.price)}</small>`;
      c.addEventListener('click', () => {
        if (!owned) { if (S.clicks < s.price) return nope(c); S.clicks -= s.price; S.owned.push(s.id); toast(`Neuer Skin: ${s.name}!`); }
        S.skin = s.id; applySkin(); pen.press(); clickSound(); save(); updateTop(); renderShop();
      });
      list.appendChild(c);
    }
  } else if (tab === 'menu') {
    list.className = 'list';
    const row = (label, val, fn) => { const b = document.createElement('button'); b.className = 'opt'; b.innerHTML = `<span>${label}</span><b>${val}</b>`; b.addEventListener('click', fn); list.appendChild(b); };
    const cu = cloudUser();
    const card = document.createElement('div'); card.className = 'cloud';
    if (cu) {
      card.innerHTML = `<div class="cu">${cu.photo ? `<img src="${cu.photo}" alt="" referrerpolicy="no-referrer">` : '<span class="av">☁️</span>'}<div><b></b><small>☁️ Spielstand wird in der Cloud gesichert</small></div></div>`;
      card.querySelector('b').textContent = cu.name || 'Angemeldet';
    } else {
      card.innerHTML = `<div class="ct"><b>☁️ Spielstand sichern</b><small>Melde dich freiwillig mit Google an. Dann ist dein Fortschritt auch auf einem neuen Handy wieder da.</small></div><button class="gbtn"${cloudBusy() ? ' disabled' : ''}><span class="g">G</span> Mit Google anmelden</button>`;
      card.querySelector('.gbtn').addEventListener('click', () => signIn());
    }
    list.appendChild(card);
    row('🔊 Ton', S.sound ? 'An' : 'Aus', () => { S.sound = !S.sound; save(); renderShop(); });
    row('📳 Vibration', S.vibe ? 'An' : 'Aus', () => { S.vibe = !S.vibe; save(); renderShop(); });
    const st = document.createElement('div'); st.className = 'stats';
    st.innerHTML = `Getippt: <b>${fmt(S.taps)}</b><br>Klicks gesamt: <b>${fmt(S.total)}</b><br>Skins: <b>${S.owned.length} / ${SKINS.length}</b>`;
    list.appendChild(st);
    row('🗑️ Spielstand löschen', '', () => { if (confirm('Wirklich alles auf diesem Gerät löschen und neu anfangen?' + (cu ? ' (Der Cloud-Spielstand wird dabei auch überschrieben.)' : ''))) { localStorage.removeItem(SAVE_KEY); S = fresh(); applySkin(); save(); updateTop(); renderShop(); } });
    if (cu) {
      row('🚪 Abmelden', '', async () => { await signOutCloud(); renderShop(); });
      row('❌ Konto & Cloud-Daten löschen', '', async () => { if (confirm('Dein Google-Login für Kuli-Klicker und der Cloud-Spielstand werden endgültig gelöscht. Der Spielstand auf diesem Gerät bleibt. Fortfahren?')) { await deleteAccount(); renderShop(); } });
    }
    const pl = document.createElement('a'); pl.className = 'plink'; pl.href = 'privacy.html'; pl.target = '_blank'; pl.rel = 'noopener'; pl.textContent = 'Datenschutzerklärung';
    list.appendChild(pl);
  }
  refreshShop();
}
function item({ key, icon, name, desc, lvl, cost, buy }) {
  const b = document.createElement('button'); b.className = 'item'; b.dataset.key = key; b.dataset.cost = cost;
  b.innerHTML = `<span class="ic">${icon}</span><span class="tx"><b>${name}</b><small>${desc}</small></span><span class="pr"><b>🖊️ ${fmt(cost)}</b><small>Stufe ${lvl}</small></span>`;
  b.addEventListener('click', () => {
    if (S.clicks < cost) return nope(b);
    S.clicks -= cost; buy(); clickSound(false); save(); updateTop(); renderShop();
  });
  return b;
}
function refreshShop() {
  if (!tab) return;
  document.querySelectorAll('#list [data-cost]').forEach(el => el.classList.toggle('cant', S.clicks < +el.dataset.cost));
}
function nope(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); if (S.vibe && navigator.vibrate) navigator.vibrate([20, 40, 20]); }
function toast(t) { const d = $('#toast'); d.textContent = t; d.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => d.classList.remove('show'), 2600); }

let hintHidden = S.taps > 20;
function hideHint() { if (!hintHidden) { hintHidden = true; } $('#hint').classList.toggle('gone', S.taps > 5); }
if (S.taps > 5) $('#hint').classList.add('gone');

// ---------- Offline-Einnahmen ----------
{
  const away = Math.min((Date.now() - S.last) / 1000, 8 * 3600);
  const gain = perSec() * away * 0.5;
  if (away > 60 && gain >= 1) { S.clicks += gain; S.total += gain; setTimeout(() => toast(`Willkommen zurück! Deine Auto-Klicker haben ${fmt(gain)} Klicks gesammelt.`), 600); }
}

// ---------- Hauptschleife ----------
let lastT = performance.now(), autoVis = 0, autoAcc = 0, autoFloat = 0, saveT = 0;
function loop(t) {
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  const cps = perSec();
  if (cps > 0) {
    const g = cps * dt; S.clicks += g; S.total += g; autoAcc += g;
    autoVis += dt;
    const iv = Math.max(0.18, Math.min(2, 1 / cps * (S.autos.feder ? 1 : 1)));
    if (autoVis >= iv && pointers.size === 0) { autoVis = 0; pen.press(); clickSound(false); }
    autoFloat += dt;
    if (autoFloat >= 1) { autoFloat = 0; const r = canvas.getBoundingClientRect(); floatText('+' + fmt(autoAcc), r.width * (0.5 + (Math.random() - 0.5) * 0.3), r.height * 0.32, 'auto'); autoAcc = 0; }
  }
  pen.frame(dt);
  updateTop(); refreshShop();
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  requestAnimationFrame(loop);
}
updateTop();
requestAnimationFrame(loop);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else lastT = performance.now(); });
window.addEventListener('pagehide', save);

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});

// für Tests / Icon-Erzeugung
initCloud({
  getState: () => S,
  applyState: (o) => { S = Object.assign(fresh(), o); applySkin(); save(); updateTop(); if (tab) renderShop(); },
  toast,
});
onCloudChange(() => { if (tab === 'menu') renderShop(); });

window.__kuli = { S, pen, tap, SKINS, applySkin: (id) => { S.skin = id; if (!S.owned.includes(id)) S.owned.push(id); applySkin(); } };
