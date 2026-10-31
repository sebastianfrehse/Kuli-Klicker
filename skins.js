// Skins und prozedurale Texturen
function cv(w = 512, h = 512) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function rnd(seed) { let s = seed; return () => (s = (s*16807) % 2147483647) / 2147483647; }

function woodTex() {
  const [c, x] = cv(); const r = rnd(7);
  const img = x.createImageData(512, 512);
  const off = Array.from({ length: 8 }, () => r()*6.28);
  for (let py = 0; py < 512; py++) for (let px = 0; px < 512; px++) {
    const u = px/512, v = py/512;
    const n = Math.sin(v*9 + off[0]) * 0.6 + Math.sin(v*23 + u*6.28 + off[1])*0.25 + Math.sin(v*3 + off[2])*1.2;
    const g = Math.sin((u*6.28*7) + n*2.2) * 0.5 + 0.5;
    const f = Math.pow(g, 3) * 0.7 + (Math.sin(u*400 + v*30)*0.5+0.5)*0.08;
    const i = (py*512+px)*4;
    img.data[i] = 150 - f*80; img.data[i+1] = 96 - f*55; img.data[i+2] = 52 - f*30; img.data[i+3] = 255;
  }
  x.putImageData(img, 0, 0); return c;
}
function rainbowTex() {
  const [c, x] = cv(64, 512);
  for (let y = 0; y < 512; y++) { x.fillStyle = `hsl(${(y/512)*360*1.4},95%,55%)`; x.fillRect(0, y, 64, 1); }
  return c;
}
function galaxyTex() {
  const [c, x] = cv(); const r = rnd(42);
  x.fillStyle = '#070418'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) {
    const px = r()*512, py = r()*512, rad = 40 + r()*120;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    const hue = [270, 300, 220, 190][i % 4];
    g.addColorStop(0, `hsla(${hue},90%,55%,0.35)`); g.addColorStop(1, 'hsla(0,0%,0%,0)');
    x.fillStyle = g;
    for (const dx of [-512, 0, 512]) { x.save(); x.translate(dx, 0); x.fillRect(px-rad, py-rad, rad*2, rad*2); x.restore(); }
  }
  for (let i = 0; i < 700; i++) {
    const px = r()*512, py = r()*512, s = r() < 0.92 ? 1 : 2.2;
    x.fillStyle = `rgba(255,255,255,${0.5 + r()*0.5})`; x.beginPath(); x.arc(px, py, s, 0, 6.28); x.fill();
  }
  return c;
}
function stripeTex() { // Elektriker: Warnstreifen
  const [c, x] = cv(256, 512);
  x.fillStyle = '#f5c400'; x.fillRect(0, 0, 256, 512);
  x.fillStyle = '#111';
  for (let i = -10; i < 20; i++) { x.beginPath(); x.moveTo(i*40, 0); x.lineTo(i*40+20, 0); x.lineTo(i*40+20+256, 512); x.lineTo(i*40+256, 512); x.fill(); }
  return c;
}
function lavaTex() {
  const [c, x] = cv(); const r = rnd(99);
  x.fillStyle = '#140302'; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#ff5a00'; x.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    x.lineWidth = 1 + r()*5; x.globalAlpha = 0.6 + r()*0.4;
    x.beginPath(); let px = r()*512, py = r()*512; x.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += (r()-0.5)*90; py += (r()-0.5)*90; x.lineTo(px, py); }
    x.stroke();
  }
  x.globalAlpha = 1; return c;
}

const metal = (c, r = 0.2) => ({ c, m: 1, r });
const plastic = (c, r = 0.3) => ({ c, m: 0, r });
const chrome = metal('#d8dde3', 0.12);

let texCache = null;
export function textures() {
  if (!texCache) texCache = { wood: woodTex(), rainbow: rainbowTex(), galaxy: galaxyTex(), stripe: stripeTex(), lava: lavaTex() };
  return texCache;
}

export function buildSkins() {
  const T = textures();
  const std = (barrel, grip, extra = {}) => ({
    default: barrel, barrel, cap: barrel, cone: barrel, grip,
    button: plastic('#f2f2f2', 0.3), clip: chrome, trim: chrome, tip: metal('#c9ccd1', 0.25), refill: plastic('#2a4fd8', 0.4), ...extra,
  });
  return [
    { id: 'blau', name: 'Klassik Blau', price: 0, glow: '#2f6bff', preview: 'linear-gradient(135deg,#2f6bff,#173a9c)',
      parts: std(plastic('#1f56e0', 0.28), plastic('#10265e', 0.7)) },
    { id: 'rot', name: 'Feuerrot', price: 150, glow: '#ff3b30', preview: 'linear-gradient(135deg,#ff4b3a,#9c140c)',
      parts: std(plastic('#d81e12', 0.25), plastic('#3a0805', 0.7), { refill: plastic('#d81e12') }) },
    { id: 'schwarz', name: 'Business Schwarz', price: 500, glow: '#9aa3b5', preview: 'linear-gradient(135deg,#3a3d44,#0b0c0f)',
      parts: std(plastic('#0d0e11', 0.45), plastic('#050506', 0.8), { button: chrome, refill: plastic('#111') }) },
    { id: 'mint', name: 'Minzgrün', price: 1500, glow: '#3ee8b5', preview: 'linear-gradient(135deg,#7ff5d0,#12a37a)',
      parts: std(plastic('#3fd9a6', 0.3), plastic('#0d5d47', 0.7), { button: plastic('#ffffff', 0.2), refill: plastic('#0a8f5f') }) },
    { id: 'elektriker', name: 'Elektriker', price: 5000, glow: '#ffd000', preview: 'repeating-linear-gradient(45deg,#f5c400 0 10px,#111 10px 20px)',
      parts: std(plastic('#f5c400', 0.3), { c: '#ffffff', m: 0, r: 0.6, tex: T.stripe }, { button: plastic('#e01b1b', 0.25), cap: plastic('#111111', 0.5), cone: plastic('#111111', 0.5), refill: plastic('#e01b1b') }) },
    { id: 'chrom', name: 'Chrom', price: 15000, glow: '#cfe3ff', preview: 'linear-gradient(135deg,#ffffff,#8a939e,#e4e9ef)',
      parts: std(metal('#e3e7ec', 0.08), metal('#4a4f57', 0.45), { button: metal('#e3e7ec', 0.08) }) },
    { id: 'holz', name: 'Echtholz', price: 45000, glow: '#ffae55', preview: 'linear-gradient(135deg,#b07a45,#5b361a)',
      parts: std({ c: '#ffffff', m: 0, r: 0.55, tex: T.wood }, metal('#2b2420', 0.5), { clip: metal('#d9a752', 0.22), trim: metal('#d9a752', 0.22), button: metal('#d9a752', 0.22), tip: metal('#d9a752', 0.25) }) },
    { id: 'neon', name: 'Neon', price: 120000, glow: '#ff2bd6', preview: 'linear-gradient(135deg,#ff2bd6,#21f0ff)',
      parts: std({ c: '#1a0420', m: 0, r: 0.2, e: '#ff2bd6', ei: 0.9 }, { c: '#021a1f', m: 0, r: 0.4, e: '#21f0ff', ei: 0.9 }, { button: { c: '#021a1f', e: '#21f0ff', ei: 1.2 }, clip: { c: '#021a1f', e: '#21f0ff', ei: 1.0 }, trim: { c: '#1a0420', e: '#ffffff', ei: 1.2 } }) },
    { id: 'gold', name: 'Gold', price: 350000, glow: '#ffcf4a', preview: 'linear-gradient(135deg,#fff1a8,#d4a017,#7a5600)',
      parts: std(metal('#ffd25e', 0.1), metal('#b8862a', 0.35), { clip: metal('#ffe08a', 0.08), trim: metal('#ffe08a', 0.08), button: metal('#ffe08a', 0.08), tip: metal('#ffe08a', 0.1) }) },
    { id: 'lava', name: 'Lava', price: 1e6, glow: '#ff4d00', preview: 'radial-gradient(circle at 30% 30%,#ff8a00,#5a0d00 60%,#140302)',
      parts: std({ c: '#ffffff', m: 0, r: 0.6, tex: T.lava, te: 0.9 }, plastic('#1a0402', 0.8), { clip: metal('#3a3a3a', 0.5), trim: { c: '#300', e: '#ff5a00', ei: 1.3 }, button: { c: '#300', e: '#ff5a00', ei: 1.0 }, refill: { c: '#300', e: '#ff5a00' } }) },
    { id: 'regenbogen', name: 'Regenbogen', price: 3e6, glow: '#ff7af5', preview: 'linear-gradient(135deg,red,orange,yellow,lime,cyan,blue,violet)',
      parts: std({ c: '#ffffff', m: 0, r: 0.22, tex: T.rainbow, te: 0.15 }, plastic('#ffffff', 0.5), { grip: { c: '#ffffff', m: 0, r: 0.6, tex: T.rainbow } }) },
    { id: 'galaxie', name: 'Galaxie', price: 1e7, glow: '#8a5cff', preview: 'radial-gradient(circle at 30% 30%,#8a5cff,#22105a 50%,#05030f)',
      parts: std({ c: '#ffffff', m: 0, r: 0.15, tex: T.galaxy, te: 0.8 }, { c: '#ffffff', m: 0, r: 0.5, tex: T.galaxy, te: 0.5 }, { clip: metal('#b9a6ff', 0.1), trim: metal('#b9a6ff', 0.1), button: metal('#b9a6ff', 0.1) }) },
    { id: 'diamant', name: 'Diamant', price: 5e7, glow: '#bff6ff', preview: 'linear-gradient(135deg,#ffffff,#bff6ff,#ffd6fb,#d6fffa)',
      parts: std({ c: '#e8fbff', glass: true }, { c: '#e8fbff', glass: true }, { refill: { c: '#9be8ff', m: 0, r: 0.2, e: '#5fd8ff', ei: 0.35 }, button: { c: '#e8fbff', glass: true }, clip: metal('#f4f8ff', 0.05), trim: metal('#f4f8ff', 0.05), tip: metal('#f4f8ff', 0.05) }) },
  ];
}
