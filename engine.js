// Kuli-Klicker – eigene kleine 3D-Engine (WebGL2), ohne externe Bibliotheken
const TAU = Math.PI * 2;

// ---------- Mathe ----------
const m4 = {
  ident: () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
  mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k];
      o[c*4+r] = s;
    }
    return o;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy/2), nf = 1/(n-f);
    return [t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)*nf,-1, 0,0,2*f*n*nf,0];
  },
  trans: (x,y,z) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1],
  scale: (s) => [s,0,0,0, 0,s,0,0, 0,0,s,0, 0,0,0,1],
  fromQuat([x,y,z,w]) {
    return [1-2*(y*y+z*z), 2*(x*y+z*w), 2*(x*z-y*w), 0,
            2*(x*y-z*w), 1-2*(x*x+z*z), 2*(y*z+x*w), 0,
            2*(x*z+y*w), 2*(y*z-x*w), 1-2*(x*x+y*y), 0, 0,0,0,1];
  }
};
const quat = {
  axis(ax, ay, az, a) { const s = Math.sin(a/2); return [ax*s, ay*s, az*s, Math.cos(a/2)]; },
  mul(a, b) {
    return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
            a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
            a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
            a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  },
  norm(q) { const l = Math.hypot(...q) || 1; return q.map(v => v/l); },
  fromVec(x, y, z) { // Drehvektor (Achse * Winkel)
    const a = Math.hypot(x, y, z);
    if (a < 1e-8) return [0,0,0,1];
    return quat.axis(x/a, y/a, z/a, a);
  }
};

// ---------- Geometrie ----------
const UV_MIN = -3.45, UV_LEN = 6.9;
function lathe(profile, seg = 56) {
  const n = profile.length, pos = [], nor = [], uv = [], idx = [];
  const pn = profile.map((p, i) => {
    let tr = 0, ty = 0;
    const add = (a, b) => { const dr = b[0]-a[0], dy = b[1]-a[1], l = Math.hypot(dr, dy); if (l > 1e-6) { tr += dr/l; ty += dy/l; } };
    if (i > 0) add(profile[i-1], p);
    if (i < n-1) add(p, profile[i+1]);
    const l = Math.hypot(tr, ty) || 1;
    return [ty/l, -tr/l];
  });
  for (let j = 0; j <= seg; j++) {
    const a = j/seg*TAU, c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i < n; i++) {
      const [r, y] = profile[i], [nr, ny] = pn[i];
      pos.push(r*c, y, r*s); nor.push(nr*c, ny, nr*s);
      uv.push(j/seg, (y-UV_MIN)/UV_LEN);
    }
  }
  for (let j = 0; j < seg; j++) for (let i = 0; i < n-1; i++) {
    const a = j*n+i, b = (j+1)*n+i;
    idx.push(a, a+1, b, b, a+1, b+1);
  }
  return { pos, nor, uv, idx };
}
function box(x0, x1, y0, y1, z0, z1) {
  const pos = [], nor = [], uv = [], idx = [];
  const faces = [
    [[1,0,0], [[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]]],
    [[-1,0,0],[[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0]]],
    [[0,1,0], [[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]]],
    [[0,-1,0],[[x0,y0,z1],[x0,y0,z0],[x1,y0,z0],[x1,y0,z1]]],
    [[0,0,1], [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]],
    [[0,0,-1],[[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]]],
  ];
  for (const [nv, vs] of faces) {
    const b = pos.length/3;
    for (const v of vs) { pos.push(...v); nor.push(...nv); uv.push(0.5, (v[1]-UV_MIN)/UV_LEN); }
    idx.push(b, b+1, b+2, b, b+2, b+3);
  }
  return { pos, nor, uv, idx };
}
function merge(...gs) {
  const o = { pos: [], nor: [], uv: [], idx: [] };
  for (const g of gs) {
    const b = o.pos.length/3;
    o.pos.push(...g.pos); o.nor.push(...g.nor); o.uv.push(...g.uv);
    o.idx.push(...g.idx.map(i => i+b));
  }
  return o;
}

function penParts() {
  const grip = [[0.288,-2.53]];
  for (let y = -2.5; y <= -1.5; y += 0.025) grip.push([0.297 + 0.014*(0.5+0.5*Math.cos((y+2.5)*TAU*9)), y]);
  grip.push([0.288,-1.46]);
  const barrel = [[0.284,-1.37]];
  for (let i = 0; i <= 20; i++) { const t = i/20, y = -1.37 + t*3.67; barrel.push([0.284 + 0.012*Math.sin(t*Math.PI), y]); }
  return {
    refill: { g: lathe([[0,-2.9],[0.055,-2.9],[0.055,2.75],[0,2.75]], 20), slot: 'refill', move: 'tip' },
    tip:    { g: lathe([[0,-3.42],[0.022,-3.42],[0.03,-3.39],[0.045,-3.22],[0.052,-3.1],[0.052,-2.9],[0,-2.9]], 24), slot: 'tip', move: 'tip' },
    cone:   { g: lathe([[0.05,-2.95],[0.056,-3.1],[0.075,-3.135],[0.105,-3.1],[0.27,-2.62],[0.29,-2.55],[0.29,-2.53],[0.288,-2.53]]), slot: 'cone' },
    grip:   { g: lathe(grip), slot: 'grip' },
    trim1:  { g: lathe([[0.284,-1.47],[0.302,-1.46],[0.302,-1.38],[0.284,-1.37]]), slot: 'trim' },
    barrel: { g: lathe(barrel), slot: 'barrel' },
    trim2:  { g: lathe([[0.284,2.3],[0.3,2.31],[0.3,2.39],[0.286,2.4]]), slot: 'trim' },
    cap:    { g: lathe([[0.286,2.4],[0.292,2.41],[0.292,2.84],[0.28,2.92],[0.24,2.98],[0.17,3.0],[0.17,3.0],[0,3.0]]), slot: 'cap' },
    button: { g: lathe([[0,2.86],[0.15,2.86],[0.15,2.86],[0.15,3.22],[0.14,3.3],[0.11,3.35],[0.06,3.375],[0,3.38]], 40), slot: 'button', move: 'button' },
    clip:   { g: merge(box(-0.06,0.06,2.6,2.88,0.16,0.37), box(-0.05,0.05,1.12,2.88,0.33,0.37), box(-0.045,0.045,1.08,1.2,0.29,0.36)), slot: 'clip' },
  };
}

// ---------- Shader ----------
const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec2 aUv;
uniform mat4 uModel, uView, uProj;
out vec3 vW; out vec3 vN; out vec2 vUv;
void main(){ vec4 w = uModel*vec4(aPos,1.0); vW = w.xyz; vN = mat3(uModel)*aNor; vUv = aUv; gl_Position = uProj*uView*w; }`;
const FS = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec2 vUv;
uniform vec3 uCam, uColor, uEmis;
uniform float uMetal, uRough, uUseTex, uTexEmis, uAlpha, uGlass, uTime;
uniform sampler2D uTex;
out vec4 frag;
vec3 env(vec3 d, float r){
  float h = d.y;
  vec3 c = mix(vec3(0.03,0.03,0.05), vec3(0.42,0.44,0.52), smoothstep(-0.3,0.9,h));
  float s = mix(90.0, 4.0, r), k = mix(1.0, 0.45, r);
  c += vec3(1.0,0.96,0.9)*2.6*k*pow(max(dot(d,normalize(vec3(-0.55,0.65,0.55))),0.0),s);
  c += vec3(0.55,0.72,1.0)*1.5*k*pow(max(dot(d,normalize(vec3(0.85,0.15,0.45))),0.0),s*0.8);
  c += vec3(1.0)*1.0*k*pow(max(dot(d,normalize(vec3(0.1,0.35,-1.0))),0.0),s*0.6);
  c += vec3(0.45)*exp(-pow(h*mix(16.0,2.5,r),2.0))*0.7;
  return c;
}
void main(){
  vec3 N = normalize(vN), V = normalize(uCam - vW), R = reflect(-V, N);
  vec3 alb = uColor, tex = vec3(1.0);
  if (uUseTex > 0.5) { tex = texture(uTex, vUv).rgb; alb *= tex; }
  vec3 Lk = normalize(vec3(-0.5,0.8,0.6)), Lf = normalize(vec3(0.8,0.1,0.5));
  vec3 diff = mix(vec3(0.07,0.07,0.09), vec3(0.32,0.33,0.38), N.y*0.5+0.5)
            + vec3(1.0,0.97,0.92)*max(dot(N,Lk),0.0)*0.95 + vec3(0.5,0.6,0.85)*max(dot(N,Lf),0.0)*0.35;
  float nv = max(dot(N,V),0.0);
  vec3 F0 = mix(vec3(0.04), alb, uMetal);
  vec3 F = F0 + (1.0-F0)*pow(1.0-nv,5.0)*(1.0-uRough*0.75);
  vec3 H = normalize(Lk + V);
  float sh = mix(400.0, 12.0, uRough);
  vec3 spec = env(R, uRough)*F + F*pow(max(dot(N,H),0.0), sh)*mix(2.0,0.3,uRough);
  vec3 col = alb*(1.0-uMetal)*diff + spec + uEmis + tex*uTexEmis;
  float a = uAlpha;
  if (uGlass > 0.5) {
    vec3 rb = 0.5 + 0.5*cos(6.2832*(nv*1.6 + vUv.y*0.7 + vec3(0.0,0.33,0.67)) + uTime*0.6);
    col = env(R, 0.02)*(0.25 + 0.9*pow(1.0-nv,2.0)) * mix(vec3(1.0), rb*1.6, 0.55) + alb*0.06;
    a = clamp(0.18 + 0.75*pow(1.0-nv,2.5), 0.0, 0.95);
  }
  col = (col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);
  frag = vec4(pow(clamp(col,0.0,1.0), vec3(1.0/2.2)), a);
}`;

const lin = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n>>16)&255, (n>>8)&255, n&255].map(v => Math.pow(v/255, 2.2)); };

export function createPen(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 wird nicht unterstützt');
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(prog, 0, 'aPos'); gl.bindAttribLocation(prog, 1, 'aNor'); gl.bindAttribLocation(prog, 2, 'aUv');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = {};
  for (const n of ['uModel','uView','uProj','uCam','uColor','uEmis','uMetal','uRough','uUseTex','uTexEmis','uAlpha','uGlass','uTime','uTex']) U[n] = gl.getUniformLocation(prog, n);

  const parts = penParts();
  for (const p of Object.values(parts)) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = (data, loc, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
    buf(p.g.pos, 0, 3); buf(p.g.nor, 1, 3); buf(p.g.uv, 2, 2);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(p.g.idx), gl.STATIC_DRAW);
    p.vao = vao; p.count = p.g.idx.length;
  }
  gl.bindVertexArray(null);

  const texCache = new Map();
  function getTex(canvasTex) {
    if (texCache.has(canvasTex)) return texCache.get(canvasTex);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasTex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    texCache.set(canvasTex, t); return t;
  }

  let skin = null;
  const st = {
    q: quat.axis(0, 0, 1, -0.42), angVel: [0, 0, 0], dragging: false, lastTouch: -10,
    btn: 1, tipOut: true, tipPos: 0, bump: 0, time: 0, zoom: 1, fixed: false, lift: 0, liftT: 0,
  };
  st.q = quat.mul(quat.axis(1, 0, 0, 0.25), st.q);

  function mat(slot) {
    const m = skin.parts[slot] || skin.parts.default;
    return { color: lin(m.c || '#ffffff'), metal: m.m ?? 0, rough: m.r ?? 0.35, emis: m.e ? lin(m.e).map(v => v*(m.ei ?? 1)) : [0,0,0],
             tex: m.tex || null, texEmis: m.te ?? 0, glass: !!m.glass };
  }
  let mats = {};
  function setSkin(s) { skin = s; mats = {}; for (const slot of ['refill','tip','cone','grip','trim','barrel','cap','button','clip']) mats[slot] = mat(slot); }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.round(canvas.clientWidth*dpr), h = Math.round(canvas.clientHeight*dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function press() {
    st.btn = 0; st.tipOut = !st.tipOut; st.bump = 1;
    if (!st.dragging) { st.angVel[0] += (Math.random()-0.5)*0.9; st.angVel[2] += (Math.random()-0.5)*0.9; }
  }
  function rotateBy(dx, dy, dt) {
    const k = 0.009;
    const r = quat.fromVec(dy*k, dx*k, 0);
    st.q = quat.norm(quat.mul(r, st.q));
    if (dt > 0) { const a = 0.35; st.angVel = [st.angVel[0]*(1-a) + dy*k/dt*a, st.angVel[1]*(1-a) + dx*k/dt*a, 0]; }
    st.lastTouch = st.time;
  }
  function setLift(v) { st.liftT = v; }
  function setDragging(d) { st.dragging = d; if (d) st.angVel = [0,0,0]; st.lastTouch = st.time; }

  function frame(dt) {
    st.time += dt;
    resize();
    // Physik
    if (!st.dragging && !st.fixed) {
      const idle = st.time - st.lastTouch > 1.5;
      const damp = Math.exp(-2.6*dt);
      st.angVel = st.angVel.map(v => v*damp);
      if (idle) st.angVel[1] += (0.45 - st.angVel[1])*Math.min(1, dt*0.7);
      const r = quat.fromVec(st.angVel[0]*dt, st.angVel[1]*dt, st.angVel[2]*dt);
      st.q = quat.norm(quat.mul(r, st.q));
    }
    st.btn = Math.min(1, st.btn + dt*7);
    const target = st.tipOut ? 0 : 0.27;
    st.tipPos += (target - st.tipPos)*Math.min(1, dt*25);
    st.bump = Math.max(0, st.bump - dt*5);

    const W = canvas.width, H = canvas.height, asp = W/H, fov = 0.62;
    const half = Math.tan(fov/2);
    st.lift += (st.liftT - st.lift)*Math.min(1, dt*8);
    const dist = Math.max(4.1/half, 2.25/(half*asp)) / st.zoom * (1 + st.lift*0.9);
    const shiftY = -st.lift * dist*half*0.5;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
        gl.uniformMatrix4fv(U.uProj, false, m4.persp(fov, asp, 0.1, 100));
    gl.uniformMatrix4fv(U.uView, false, m4.trans(0, -shiftY, -dist));
    gl.uniform3fv(U.uCam, [0, shiftY, dist]);
    gl.uniform1f(U.uTime, st.time);

    const pressCurve = st.btn < 0.3 ? st.btn/0.3 : 1 - (st.btn-0.3)/0.7; // 0..1..0
    const btnOff = -0.17 * Math.max(0, pressCurve);
    const sc = 1 - 0.045*Math.sin(st.bump*Math.PI);
    const bob = Math.sin(st.time*1.3)*0.06;
    const base = m4.mul(m4.trans(0, bob, 0), m4.mul(m4.fromQuat(st.q), m4.scale(sc)));

    const draw = (p, m) => {
      const off = p.move === 'button' ? btnOff : p.move === 'tip' ? st.tipPos + btnOff*0.4 : 0;
      gl.uniformMatrix4fv(U.uModel, false, off ? m4.mul(base, m4.trans(0, off, 0)) : base);
      gl.uniform3fv(U.uColor, m.color); gl.uniform3fv(U.uEmis, m.emis);
      gl.uniform1f(U.uMetal, m.metal); gl.uniform1f(U.uRough, m.rough);
      gl.uniform1f(U.uTexEmis, m.texEmis); gl.uniform1f(U.uGlass, m.glass ? 1 : 0); gl.uniform1f(U.uAlpha, 1);
      if (m.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, getTex(m.tex)); gl.uniform1i(U.uTex, 0); gl.uniform1f(U.uUseTex, 1); }
      else gl.uniform1f(U.uUseTex, 0);
      gl.bindVertexArray(p.vao); gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_SHORT, 0);
    };
    const list = Object.values(parts);
    gl.disable(gl.BLEND); gl.depthMask(true);
    for (const p of list) if (!mats[p.slot].glass) draw(p, mats[p.slot]);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (const p of list) if (mats[p.slot].glass) draw(p, mats[p.slot]);
    gl.depthMask(true);
  }

  return { setSkin, setLift, press, rotateBy, setDragging, frame, state: st, quat };
}
