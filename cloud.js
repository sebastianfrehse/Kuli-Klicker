// Kuli-Klicker – freiwilliger Google-Login + Cloud-Spielstand (Firebase)
// Das Firebase-SDK wird nur geladen, wenn der Spieler die Cloud nutzt.
const FB_VERSION = '11.0.2';
const CDN = `https://www.gstatic.com/firebasejs/${FB_VERSION}`;
const firebaseConfig = {
  apiKey: 'AIzaSyCRgu3OX5qjM3XsGZybUk8lFNdKWUtSnyM',
  authDomain: 'kuli-klicker.firebaseapp.com',
  projectId: 'kuli-klicker',
  storageBucket: 'kuli-klicker.firebasestorage.app',
  messagingSenderId: '325952187013',
  appId: '1:325952187013:web:c8eaff569ab49b8acf17ec',
};
const FLAG = 'kuliKlicker.cloud';
const FIELDS = ['clicks', 'total', 'taps', 'power', 'autos', 'owned', 'skin', 'sound', 'vibe', 'last'];

let fb = null, user = null, hooks = null, lastUploaded = '', busy = false;
const listeners = new Set();
const notify = () => listeners.forEach(f => { try { f(); } catch (e) {} });

async function loadSdk() {
  if (fb) return fb;
  const [app, auth, fs] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
  ]);
  const a = app.initializeApp(firebaseConfig);
  fb = { auth, fs, authI: auth.getAuth(a), db: fs.getFirestore(a) };
  fb.authI.languageCode = 'de';
  return fb;
}

function snapshot() {
  const S = hooks.getState(), o = {};
  for (const k of FIELDS) o[k] = S[k];
  return o;
}

async function upload(force = false) {
  if (!user || !fb) return;
  const data = snapshot();
  const key = JSON.stringify(data);
  if (!force && key === lastUploaded) return;
  try {
    await fb.fs.setDoc(fb.fs.doc(fb.db, 'spielstaende', user.uid), { ...data, updatedAt: fb.fs.serverTimestamp() });
    lastUploaded = key;
  } catch (e) { console.warn('Cloud-Speichern fehlgeschlagen', e); }
}

async function syncAfterLogin() {
  try {
    const snap = await fb.fs.getDoc(fb.fs.doc(fb.db, 'spielstaende', user.uid));
    const local = hooks.getState();
    if (snap.exists()) {
      const cloud = snap.data();
      if ((cloud.total || 0) > (local.total || 0)) {
        const o = {};
        for (const k of FIELDS) if (k in cloud) o[k] = cloud[k];
        hooks.applyState(o);
        lastUploaded = JSON.stringify(snapshot());
        hooks.toast('☁️ Cloud-Spielstand geladen!');
        return;
      }
    }
    await upload(true);
    hooks.toast('☁️ Spielstand in der Cloud gesichert!');
  } catch (e) { console.warn(e); hooks.toast('Cloud gerade nicht erreichbar – wird später gesichert.'); }
}

function watchAuth() {
  if (watchAuth.started) return; watchAuth.started = true;
  fb.auth.onAuthStateChanged(fb.authI, (u) => {
    const wasNew = !user && u;
    user = u;
    if (u) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG);
    notify();
    if (wasNew) syncAfterLogin();
  });
}

export async function initCloud(h) {
  hooks = h;
  if (localStorage.getItem(FLAG) === '1' && navigator.onLine !== false) {
    try { await loadSdk(); watchAuth(); } catch (e) { console.warn('Firebase nicht geladen', e); }
  }
  setInterval(() => upload(), 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) upload(); });
}

export function cloudUser() { return user ? { name: user.displayName || user.email, email: user.email, photo: user.photoURL } : null; }
export function onCloudChange(f) { listeners.add(f); }
export function cloudBusy() { return busy; }

export async function signIn() {
  if (busy) return; busy = true; notify();
  try {
    await loadSdk();
    watchAuth();
    const provider = new fb.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await fb.auth.signInWithPopup(fb.authI, provider);
    } catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) {
        localStorage.setItem(FLAG, '1');
        await fb.auth.signInWithRedirect(fb.authI, provider);
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        throw e;
      }
    }
  } catch (e) {
    console.warn(e);
    hooks.toast(navigator.onLine === false ? 'Keine Internetverbindung.' : 'Anmeldung hat nicht geklappt. Bitte nochmal versuchen.');
  } finally { busy = false; notify(); }
}

export async function signOutCloud() {
  if (!fb || !user) return;
  await upload(true);
  await fb.auth.signOut(fb.authI);
  hooks.toast('Abgemeldet. Dein Spielstand bleibt auf diesem Gerät.');
}

export async function deleteAccount() {
  if (!fb || !user) return;
  busy = true; notify();
  try {
    await fb.fs.deleteDoc(fb.fs.doc(fb.db, 'spielstaende', user.uid));
    try { await fb.auth.deleteUser(user); }
    catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        await fb.auth.reauthenticateWithPopup(user, new fb.auth.GoogleAuthProvider());
        await fb.auth.deleteUser(fb.authI.currentUser);
      } else throw e;
    }
    hooks.toast('Konto und Cloud-Spielstand wurden gelöscht.');
  } catch (e) {
    console.warn(e);
    hooks.toast('Löschen hat nicht geklappt. Bitte nochmal versuchen.');
  } finally { busy = false; notify(); }
}

