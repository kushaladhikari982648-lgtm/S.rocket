/* ============================================================================
   S.ROCKET — Nepali Bus Simulator (3D)
   Real 3D with three.js: spline road, mesh terrain, instanced scenery,
   arcade bus physics, passengers/fuel/damage, procedural audio.
   ========================================================================== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ------------------------------- utils ---------------------------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const UP = { x: 0, y: 1, z: 0 };
const nowMs = () => ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const choice = (a) => a[Math.floor(Math.random() * a.length)];
const fmt = (n) => Math.round(n).toLocaleString('en-IN');
const $ = (id) => document.getElementById(id);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------- routes --------------------------------- */
const ROUTES = [
  {
    id: 'ktm-pkr', name: 'Kathmandu → Pokhara', ne: 'काठमाडौं → पोखरा',
    desc: 'Hilly Prithvi highway — river bends, villages and lots of stops.',
    diff: '⭐⭐ MEDIUM', time: 145, km: 200, style: 'hill', length: 2400,
    stops: [
      { name: 'Kathmandu', ne: 'काठमाडौं', at: 0.02 },
      { name: 'Thankot', ne: 'थानकोट', at: 0.17 },
      { name: 'Naubise', ne: 'नौबिसे', at: 0.31 },
      { name: 'Malekhu', ne: 'मलेखु', at: 0.47 },
      { name: 'Muglin', ne: 'मुग्लिन', at: 0.63 },
      { name: 'Dumre', ne: 'डुम्रे', at: 0.79 },
      { name: 'Pokhara', ne: 'पोखरा', at: 0.975 }
    ]
  },
  {
    id: 'terai', name: 'Biratnagar → Birgunj', ne: 'विराटनगर → वीरगञ्ज',
    desc: 'Flat Terai highway — fast and straight, but trucks and cows everywhere.',
    diff: '⭐ EASY', time: 160, km: 245, style: 'flat', length: 3000,
    stops: [
      { name: 'Biratnagar', ne: 'विराटनगर', at: 0.02 },
      { name: 'Itahari', ne: 'इटहरी', at: 0.22 },
      { name: 'Janakpur', ne: 'जनकपुर', at: 0.44 },
      { name: 'Hetauda', ne: 'हेटौंडा', at: 0.66 },
      { name: 'Birgunj', ne: 'वीरगञ्ज', at: 0.975 }
    ]
  },
  {
    id: 'mountain', name: 'Baglung → Jomsom', ne: 'बागलुङ → जोमसोम',
    desc: 'Mustang mountain road — hairpins, prayer flags and cold thin air.',
    diff: '⭐⭐⭐ HARD', time: 150, km: 155, style: 'mountain', length: 2100,
    stops: [
      { name: 'Baglung', ne: 'बागलुङ', at: 0.02 },
      { name: 'Beni', ne: 'बेनी', at: 0.25 },
      { name: 'Tatopani', ne: 'तातोपानी', at: 0.49 },
      { name: 'Jomsom', ne: 'जोमसोम', at: 0.78 },
      { name: 'Muktinath', ne: 'मुक्तिनाथ', at: 0.975 }
    ]
  }
];

const STYLE = {
  hill: {
    sky: ['#3f9fe8', '#9ed4f4', '#eaf5fd'], fog: '#dceefb', fogNear: 70, fogFar: 420,
    grass: '#5aa845', grass2: '#4d9440', road: '#6e6e6e', dirt: '#8d7b5f',
    mtn: '#c9dae8', mtn2: '#9fb4c6', snow: '#ffffff', props: 'hill'
  },
  flat: {
    sky: ['#4fb6ef', '#b3e2f8', '#f4fbe8'], fog: '#e8f4de', fogNear: 80, fogFar: 460,
    grass: '#8fc44e', grass2: '#7cb744', road: '#777777', dirt: '#a08d6a',
    mtn: '#dbe8d6', mtn2: '#b9cfa8', snow: '#f4fbff', props: 'flat'
  },
  mountain: {
    sky: ['#5893c4', '#a9c6df', '#e9eef3'], fog: '#dfe8ef', fogNear: 60, fogFar: 380,
    grass: '#8b8d76', grass2: '#7d7f69', road: '#5f6266', dirt: '#7c7360',
    mtn: '#f2f6fa', mtn2: '#93a3b3', snow: '#ffffff', props: 'mountain'
  }
};

/* ------------------------------ track path ------------------------------- */
class Track {
  constructor(route) {
    this.route = route;
    this.style = STYLE[route.style];
    const rnd = mulberry32(1234 + route.length);
    const pieces = makePieces(route.style, rnd);
    // integrate
    const step = 2;
    const pts = [];
    let heading = 0, x = 0, y = 0, z = 0;
    for (const p of pieces) {
      const n = Math.max(1, Math.round(p.len / step));
      const ds = p.len / n;
      for (let i = 0; i < n; i++) {
        heading += p.curve * ds;
        x += Math.sin(heading) * ds;
        z += Math.cos(heading) * ds;
        y += p.slope * ds;
        pts.push({ x, y, z, h: heading });
      }
    }
    // final sample
    pts.push({ x, y, z, h: heading });
    this.pts = pts;
    this.step = step;
    this.length = (pts.length - 1) * step;
    this.rawLength = this.length;
    // rescale so the loop is exactly the wanted length
    const k = route.length / this.length;
    this.step *= k;
    this.length = route.length;
    this.pts.forEach((p) => { p.x *= k; p.z *= k; p.y *= k * 0.9; });

    // precompute frames (pos, dir, right) for fast sampling
    const n = pts.length;
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
    this.dx = new Float32Array(n); this.dy = new Float32Array(n); this.dz = new Float32Array(n);
    this.rx = new Float32Array(n); this.rz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[Math.min(i + 1, n - 1)];
      this.px[i] = a.x; this.py[i] = a.y; this.pz[i] = a.z;
      let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
      const l = Math.hypot(tx, ty, tz) || 1;
      tx /= l; ty /= l; tz /= l;
      this.dx[i] = tx; this.dy[i] = ty; this.dz[i] = tz;
      // right = up x forward
      this.rx[i] = Math.cos(a.h); this.rz[i] = -Math.sin(a.h);
    }
  }
  idx(s) {
    const t = ((s % this.length) + this.length) % this.length / this.step;
    return clamp(t, 0, this.pts.length - 1.0001);
  }
  // writes into out vectors (no allocation)
  sample(s, outPos, outDir, outRight) {
    const f = this.idx(s);
    const i = Math.floor(f), t = f - i, j = Math.min(i + 1, this.pts.length - 1);
    if (outPos) {
      outPos.set(
        lerp(this.px[i], this.px[j], t),
        lerp(this.py[i], this.py[j], t),
        lerp(this.pz[i], this.pz[j], t)
      );
    }
    if (outDir) outDir.set(this.dx[i], this.dy[i], this.dz[i]).normalize();
    if (outRight) outRight.set(this.rx[i], 0, this.rz[i]).normalize();
  }
  // lateral point helper
  pointAt(s, lateral, out) {
    const f = this.idx(s);
    const i = Math.floor(f), t = f - i, j = Math.min(i + 1, this.pts.length - 1);
    const px = lerp(this.px[i], this.px[j], t), py = lerp(this.py[i], this.py[j], t), pz = lerp(this.pz[i], this.pz[j], t);
    const rx = lerp(this.rx[i], this.rx[j], t), rz = lerp(this.rz[i], this.rz[j], t);
    out.set(px + rx * lateral, py, pz + rz * lateral);
    return out;
  }
  headingAt(s) {
    const f = this.idx(s);
    const i = Math.floor(f), j = Math.min(i + 1, this.pts.length - 1);
    return Math.atan2(lerp(this.dx[i], this.dx[j], f - i), lerp(this.dz[i], this.dz[j], f - i));
  }
}

function makePieces(style, rnd) {
  const out = [];
  const add = (len, curve, slope) => out.push({ len, curve: curve || 0, slope: slope || 0 });
  const straight = (len) => add(len, 0, 0);
  const curve = (len, c) => add(len, c, 0);
  const hill = (len, sl) => add(len, 0, sl);
  let guard = 0;
  while (out.reduce((a, p) => a + p.len, 0) < 3400 && guard++ < 60) {
    if (style === 'flat') {
      straight(90 + rnd() * 70);
      curve(70 + rnd() * 60, (rnd() - 0.5) * 0.006);
      straight(60 + rnd() * 90);
      curve(50 + rnd() * 50, (rnd() - 0.5) * 0.004);
    } else if (style === 'mountain') {
      straight(25 + rnd() * 25);
      curve(45 + rnd() * 35, (rnd() < 0.5 ? -1 : 1) * (0.012 + rnd() * 0.014));
      hill(40 + rnd() * 30, (rnd() - 0.45) * 0.09);
      curve(35 + rnd() * 25, (rnd() < 0.5 ? -1 : 1) * (0.01 + rnd() * 0.012));
      hill(30 + rnd() * 40, (rnd() - 0.5) * 0.07);
    } else {
      straight(45 + rnd() * 40);
      curve(50 + rnd() * 40, (rnd() < 0.5 ? -1 : 1) * (0.005 + rnd() * 0.008));
      hill(40 + rnd() * 30, (rnd() - 0.5) * 0.05);
      straight(40 + rnd() * 50);
      curve(40 + rnd() * 30, (rnd() < 0.5 ? -1 : 1) * (0.004 + rnd() * 0.007));
      hill(30 + rnd() * 30, (rnd() - 0.5) * 0.045);
    }
  }
  for (const p of out) p.len = Math.max(10, p.len);
  return out;
}

/* ---------------------------- geometry helpers --------------------------- */
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v3 = new THREE.Vector3();

function paint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** place a coloured primitive into a list for later merging */
function part(list, geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const g = geo.clone();
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
  _m4.compose(_v3.set(pos[0], pos[1], pos[2]), _q, new THREE.Vector3(scale[0], scale[1], scale[2]));
  g.applyMatrix4(_m4);
  paint(g, color);
  list.push(g);
  return g;
}
function merge(list) {
  const g = mergeGeometries(list, false);
  list.forEach((x) => x.dispose());
  return g;
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const CONE = new THREE.ConeGeometry(1, 1, 7);
const ICO = new THREE.IcosahedronGeometry(1, 0);

function meshOf(list, flat = true) {
  const geo = merge(list);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: flat });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = true;
  return m;
}

/* ------------------------------ textures -------------------------------- */
function canvasTex(w, h, draw, repeatY = 1) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  draw(c, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (repeatY !== 1) t.repeat.set(1, repeatY);
  return t;
}

function roadTexture(style) {
  return canvasTex(128, 256, (c, w, h) => {
    c.fillStyle = style.road;
    c.fillRect(0, 0, w, h);
    // asphalt speckle
    for (let i = 0; i < 900; i++) {
      const g = 60 + Math.random() * 60;
      c.fillStyle = `rgba(${g},${g},${g},${0.16 + Math.random() * 0.2})`;
      c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // tyre wear bands
    c.fillStyle = 'rgba(0,0,0,.07)';
    c.fillRect(w * 0.18, 0, w * 0.12, h);
    c.fillRect(w * 0.7, 0, w * 0.12, h);
    // centre dashes (3 m painted of every 8 m tile)
    c.fillStyle = '#f4f4e8';
    c.fillRect(w * 0.475, h * 0.1, w * 0.05, h * 0.38);
    // edge lines
    c.fillStyle = 'rgba(245,245,225,.92)';
    c.fillRect(w * 0.045, 0, w * 0.022, h);
    c.fillRect(w * 0.933, 0, w * 0.022, h);
  });
}

function skyTexture(st) {
  return canvasTex(1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, st.sky[0]);
    g.addColorStop(0.55, st.sky[1]);
    g.addColorStop(0.78, st.sky[2]);
    g.addColorStop(1, st.sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // sun
    const sx = w * 0.72, sy = h * 0.2;
    const sg = c.createRadialGradient(sx, sy, 2, sx, sy, w * 0.11);
    sg.addColorStop(0, 'rgba(255,252,225,1)');
    sg.addColorStop(0.12, 'rgba(255,248,190,.95)');
    sg.addColorStop(0.4, 'rgba(255,240,170,.28)');
    sg.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = sg;
    c.beginPath(); c.arc(sx, sy, w * 0.11, 0, 7); c.fill();
    // clouds
    for (let i = 0; i < 26; i++) {
      const cx = Math.random() * w;
      const cy = h * (0.1 + Math.random() * 0.42);
      const s = 26 + Math.random() * 60;
      c.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.45})`;
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.ellipse(cx + (k - 1.5) * s * 0.5, cy + Math.sin(k) * s * 0.16, s * (0.5 + Math.random() * 0.28), s * 0.24, 0, 0, 7);
        c.fill();
      }
    }
  });
}

function plateTexture() {
  return canvasTex(512, 160, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d32f2f'; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#111';
    c.font = 'bold 62px system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('बा २ ख ४५६७', w / 2, h * 0.55);
  });
}

/* ------------------------------- the game -------------------------------- */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = 'menu';
    this.route = ROUTES[0];
    this.keys = {};
    this.camMode = 0;
    this.muted = false;
    this._p = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._p2 = new THREE.Vector3();
    this._q2 = new THREE.Quaternion();
    this.initRenderer();
    this.initScene();
    this.loadRoute(ROUTES[0]);
    this.initInput();
    this.initUI();
    this.clock = new THREE.Clock();
    this.hudAcc = 0;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  initRenderer() {
    let renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: this.canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance'
      });
      renderer.setPixelRatio = renderer.setPixelRatio.bind(renderer);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.maxDPR = Math.min(window.devicePixelRatio || 1, 1.75);
      renderer.setPixelRatio(this.maxDPR);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.shadowMap.enabled = false;
    } catch (e) {
      console.warn('WebGL unavailable:', e);
      renderer = null;
    }
    this.renderer = renderer;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.6, 3000);

    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 1.05);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d0, 1.55);
    this.sun.position.set(0.55, 1, 0.35);
    this.scene.add(this.sun);
    this.amb = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(this.amb);

    // sky dome (unfogged)
    this.skyMat = new THREE.MeshBasicMaterial({ fog: false, side: THREE.BackSide, depthWrite: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 24, 16), this.skyMat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.bus = new THREE.Group();
    this.scene.add(this.bus);

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    // widen the vertical fov a touch on tall phones so the road stays readable
    this.camera.fov = h > w * 1.25 ? 76 : 64;
    this.camera.updateProjectionMatrix();
    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxDPR || 1.75));
      this.renderer.setSize(w, h, false);
    }
  }

  /* ----------------------------- world build ---------------------------- */
  loadRoute(route) {
    this.route = route;
    this.style = STYLE[route.style];
    this.track = new Track(route);
    this.disposeWorld();
    this.scene.fog = new THREE.Fog(new THREE.Color(this.style.fog), this.style.fogNear, this.style.fogFar);
    this.scene.background = null;
    this.skyMat.map = skyTexture(this.style);
    this.skyMat.needsUpdate = true;
    this.buildRoad();
    this.buildTerrain();
    this.buildMountains();
    this.buildScenery();
    this.buildStops();
    this.buildPlayerBus();
    this.spawnTraffic();
    this.resetRun();
  }

  disposeWorld() {
    const kill = [];
    this.world.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) {
        kill.push(o);
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map && o.material.map !== this.skyMat.map) o.material.map.dispose();
          o.material.dispose();
        }
      }
    });
    kill.forEach((o) => o.parent && o.parent.remove(o));
    this.world.clear();
    while (this.bus.children.length) {
      const c = this.bus.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); }
    }
    this.cows = [];
    this.traffic = [];
  }

  buildRoad() {
    const t = this.track;
    const ROAD = 3.7;      // half width of asphalt
    const SHOULDER = 1.5;
    const stepS = 2;
    const count = Math.floor(t.length / stepS);
    const vPos = [], vUv = [], vIdx = [];
    const sPos = [], sIdx = [];
    const p = new THREE.Vector3(), r = new THREE.Vector3();
    let base = 0;
    for (let i = 0; i <= count; i++) {
      const s = i * stepS;
      const f = t.idx(s) - (i === count ? 0 : 0);
      const idx = Math.min(Math.floor(f), t.pts.length - 1);
      const j = Math.min(idx + 1, t.pts.length - 1);
      const tt = f - idx;
      const cx = lerp(t.px[idx], t.px[j], tt), cy = lerp(t.py[idx], t.py[j], tt), cz = lerp(t.pz[idx], t.pz[j], tt);
      const rx = lerp(t.rx[idx], t.rx[j], tt), rz = lerp(t.rz[idx], t.rz[j], tt);
      // asphalt
      vPos.push(cx - rx * ROAD, cy, cz - rz * ROAD);
      vPos.push(cx + rx * ROAD, cy, cz + rz * ROAD);
      vUv.push(0, s / 8, 1, s / 8);
      // shoulder strips (left then right), slightly below the asphalt
      sPos.push(cx - rx * ROAD, cy - 0.06, cz - rz * ROAD);
      sPos.push(cx - rx * (ROAD + SHOULDER), cy - 0.1, cz - rz * (ROAD + SHOULDER));
      sPos.push(cx + rx * ROAD, cy - 0.06, cz + rz * ROAD);
      sPos.push(cx + rx * (ROAD + SHOULDER), cy - 0.1, cz + rz * (ROAD + SHOULDER));
      if (i > 0) {
        const a = base, b = base + 1, c2 = base + 2, d = base + 3;
        vIdx.push(a, c2, b, b, c2, d);
        const sb = (i - 1) * 4;
        const sa = i * 4;
        sIdx.push(sb, sa, sb + 1, sb + 1, sa, sa + 1);            // left strip
        sIdx.push(sb + 2, sb + 3, sa + 2, sb + 3, sa + 3, sa + 2); // right strip
      }
      base += 2;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(vUv, 2));
    rg.setIndex(vIdx);
    rg.computeVertexNormals();
    const rmat = new THREE.MeshLambertMaterial({ map: roadTexture(this.style), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.roadMesh = new THREE.Mesh(rg, rmat);
    this.roadMesh.frustumCulled = false;
    this.world.add(this.roadMesh);

    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
    sg.setIndex(sIdx);
    sg.computeVertexNormals();
    const smat = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.style.dirt) });
    this.shoulderMesh = new THREE.Mesh(sg, smat);
    this.shoulderMesh.frustumCulled = false;
    this.world.add(this.shoulderMesh);
  }

  buildTerrain() {
    const t = this.track;
    const st = this.style;
    const stepS = 8;
    const count = Math.floor(t.length / stepS);
    const inner = 5.2;
    const outer = this.route.style === 'flat' ? 950 : 780;
    const pos = [], col = [], idx = [];
    const c1 = new THREE.Color(st.grass), c2 = new THREE.Color(st.grass2);
    const tmp = new THREE.Color();
    let base = 0;
    for (let side = -1; side <= 1; side += 2) {
      base = pos.length / 3;
      for (let i = 0; i <= count; i++) {
        const s = (i % count) * stepS;
        const f = t.idx(s);
        const idxp = Math.floor(f), j = Math.min(idxp + 1, t.pts.length - 1), tt = f - idxp;
        const cx = lerp(t.px[idxp], t.px[j], tt), cy = lerp(t.py[idxp], t.py[j], tt), cz = lerp(t.pz[idxp], t.pz[j], tt);
        const rx = lerp(t.rx[idxp], t.rx[j], tt), rz = lerp(t.rz[idxp], t.rz[j], tt);
        // two rings: inner near the road, outer far away and lower
        pos.push(cx + side * rx * inner, cy - 0.15, cz + side * rz * inner);
        const drop = this.route.style === 'flat' ? 4 : 26;
        const wobble = Math.sin(i * 0.31) * (this.route.style === 'flat' ? 2.5 : 9) + Math.sin(i * 0.07) * 12;
        pos.push(cx + side * rx * outer, cy - drop + wobble, cz + side * rz * outer);
        const shade = 0.86 + ((i * 37) % 17) / 100;
        tmp.copy(((i >> 1) % 2) ? c1 : c2).multiplyScalar(shade);
        col.push(tmp.r, tmp.g, tmp.b);
        tmp.copy(((i >> 1) % 2) ? c2 : c1).multiplyScalar(shade * 0.94);
        col.push(tmp.r, tmp.g, tmp.b);
        if (i > 0) {
          const a = base + (i - 1) * 2, b = a + 1, c3 = base + i * 2, d = c3 + 1;
          if (side < 0) idx.push(a, c3, b, b, c3, d); else idx.push(a, b, c3, b, d, c3);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.terrain = new THREE.Mesh(g, m);
    this.terrain.frustumCulled = false;
    this.world.add(this.terrain);
  }

  buildMountains() {
    const st = this.style;
    const list = [];
    const n = this.route.style === 'flat' ? 16 : 22;
    const tall = this.route.style === 'mountain' ? 1.45 : 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.1, 0.1);
      const dist = rand(1500, 2400);
      const h = rand(340, 720) * tall;
      const w = h * rand(0.7, 1.1);
      const x = Math.sin(a) * dist, z = Math.cos(a) * dist;
      const geo = new THREE.ConeGeometry(1, 1, 6 + (i % 3));
      const haze = clamp((dist - 1200) / 1200, 0, 0.62);
      const base = new THREE.Color(i % 3 === 0 ? st.mtn2 : st.mtn).lerp(new THREE.Color(st.sky[2]), haze);
      part(list, geo, base, [x, h * 0.5 - 30, z], [0, rand(0, 3), 0], [w, h, w]);
      // snow cap
      const snowC = new THREE.Color(st.snow).lerp(new THREE.Color(st.sky[2]), haze * 0.7);
      part(list, geo, snowC, [x, h * 0.78 - 30, z], [0, rand(0, 3), 0], [w * 0.45, h * 0.34, w * 0.45]);
    }
    // near ridge line for depth
    const ridge = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const dist = rand(900, 1400);
      const h = rand(150, 300) * tall;
      const hz = clamp((dist - 900) / 900, 0, 0.5);
      const rc = new THREE.Color(i % 2 ? st.mtn2 : st.mtn).lerp(new THREE.Color(st.sky[2]), 0.25 + hz);
      part(ridge, new THREE.ConeGeometry(1, 1, 5), rc, [Math.sin(a) * dist, h * 0.5 - 20, Math.cos(a) * dist], [0, rand(0, 3), 0], [h * 0.95, h, h * 0.95]);
    }
    const mtnMesh = meshOf(list);
    mtnMesh.material.fog = false;
    mtnMesh.frustumCulled = false;
    this.world.add(mtnMesh);
    const ridgeMesh = meshOf(ridge);
    ridgeMesh.material.fog = false;
    ridgeMesh.frustumCulled = false;
    this.world.add(ridgeMesh);
  }

  buildScenery() {
    const t = this.track;
    const style = this.route.style;
    const rnd = mulberry32(99 + this.route.length);

    /* ---- trees (instanced) ---- */
    const treeGeo = (() => {
      const l = [];
      part(l, new THREE.CylinderGeometry(0.16, 0.22, 1.6, 5), '#6d4c41', [0, 0.8, 0]);
      part(l, new THREE.ConeGeometry(1.5, 2.6, 7), '#2e7d32', [0, 2.4, 0]);
      part(l, new THREE.ConeGeometry(1.1, 2.0, 7), '#388e3c', [0, 3.5, 0]);
      return merge(l);
    })();
    const treeCount = style === 'flat' ? 190 : 300;
    const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), treeCount);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
    for (let i = 0; i < treeCount; i++) {
      const s = rnd() * t.length;
      const side = rnd() < 0.5 ? -1 : 1;
      const lat = side * (7 + rnd() * 46);
      t.pointAt(s, lat, pos);
      const sc = 0.7 + rnd() * 1.5;
      scl.set(sc, sc * (0.85 + rnd() * 0.5), sc);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
      pos.y -= 0.2;
      m.compose(pos, q, scl);
      trees.setMatrixAt(i, m);
    }
    trees.instanceMatrix.needsUpdate = true;
    trees.frustumCulled = false;
    this.world.add(trees);

    /* ---- rocks / bushes ---- */
    const rockGeo = merge([
      part([], new THREE.IcosahedronGeometry(1, 0), '#8d8d84', [0, 0.3, 0], [0.3, 1, 0.2], [1, 0.7, 0.9])
    ]);
    const rockCount = style === 'mountain' ? 180 : 90;
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), rockCount);
    for (let i = 0; i < rockCount; i++) {
      const s = rnd() * t.length;
      const lat = (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 40);
      t.pointAt(s, lat, pos);
      const sc = 0.5 + rnd() * 2.2;
      scl.set(sc, sc * (0.6 + rnd() * 0.5), sc);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
      m.compose(pos, q, scl);
      rocks.setMatrixAt(i, m);
    }
    rocks.instanceMatrix.needsUpdate = true;
    rocks.frustumCulled = false;
    this.world.add(rocks);

    /* ---- houses: walls + roofs in two instanced meshes ---- */
    const houseCount = style === 'flat' ? 70 : 55;
    const wallGeo = merge([
      part([], new THREE.BoxGeometry(1, 1, 1), '#fff3e0', [0, 0.5, 0])
    ]);
    const roofGeo = merge([
      part([], new THREE.ConeGeometry(0.95, 0.6, 4), '#d32f2f', [0, 1.28, 0], [0, Math.PI / 4, 0])
    ]);
    const walls = new THREE.InstancedMesh(wallGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), houseCount);
    const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), houseCount);
    for (let i = 0; i < houseCount; i++) {
      const s = rnd() * t.length;
      const lat = (rnd() < 0.5 ? -1 : 1) * (11 + rnd() * 34);
      t.pointAt(s, lat, pos);
      const w = 4 + rnd() * 4, h = 3 + rnd() * 2.4, d = 4 + rnd() * 4;
      scl.set(w, h, d);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
      pos.y -= 0.1;
      m.compose(pos, q, scl);
      walls.setMatrixAt(i, m);
      roofs.position.copy(pos); roofs.quaternion.copy(q); roofs.scale.copy(scl);
      m.compose(pos, q, scl);
      roofs.setMatrixAt(i, m);
    }
    walls.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    walls.frustumCulled = false; roofs.frustumCulled = false;
    this.world.add(walls, roofs);

    /* ---- temples / shrines ---- */
    const temples = [];
    const templeCount = 12;
    for (let i = 0; i < templeCount; i++) {
      const s = rnd() * t.length;
      const lat = (rnd() < 0.5 ? -1 : 1) * (14 + rnd() * 22);
      t.pointAt(s, lat, pos);
      const l = [];
      part(l, new THREE.BoxGeometry(4.4, 0.7, 4.4), '#a1887f', [0, 0.35, 0]);
      part(l, new THREE.BoxGeometry(3.2, 2.2, 3.2), '#c62828', [0, 1.8, 0]);
      part(l, new THREE.ConeGeometry(2.6, 1.5, 4), '#8d6e63', [0, 3.6, 0], [0, Math.PI / 4, 0]);
      part(l, new THREE.ConeGeometry(1.9, 1.2, 4), '#8d6e63', [0, 4.5, 0], [0, Math.PI / 4, 0]);
      part(l, new THREE.ConeGeometry(1.1, 2.2, 4), '#ffd54a', [0, 5.9, 0], [0, Math.PI / 4, 0]);
      const g = merge(l);
      const mm = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      mm.position.copy(pos);
      mm.rotation.y = rnd() * 6.28;
      this.world.add(mm);
      temples.push(mm);
    }

    /* ---- prayer flags strung across the road ---- */
    {
      const l = [];
      const gap = style === 'mountain' ? 55 : style === 'flat' ? 130 : 90;
      const cols = ['#1565c0', '#ffffff', '#d32f2f', '#2e7d32', '#ffd54a'];
      for (let s = 30; s < t.length - 30; s += gap) {
        const a = t.pointAt(s, -6.5, new THREE.Vector3());
        const b = t.pointAt(s, 6.5, new THREE.Vector3());
        const topY = 5.2 + Math.sin(s) * 0.4;
        part(l, new THREE.CylinderGeometry(0.12, 0.14, topY + 1, 5), '#8d6e63', [a.x, a.y + (topY + 1) / 2, a.z], [0, 0, 0]);
        part(l, new THREE.CylinderGeometry(0.12, 0.14, topY + 1, 5), '#8d6e63', [b.x, b.y + (topY + 1) / 2, b.z], [0, 0, 0]);
        const nFlags = 9;
        for (let i = 0; i < nFlags; i++) {
          const tt = i / (nFlags - 1);
          const x = lerp(a.x, b.x, tt), z = lerp(a.z, b.z, tt), y = a.y + topY - Math.sin(tt * Math.PI) * 0.7;
          part(l, new THREE.PlaneGeometry(0.55, 0.8), cols[i % 5], [x, y - 0.4, z], [0, Math.atan2(b.x - a.x, b.z - a.z), 0]);
        }
      }
      const g = merge(l);
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      const flags = new THREE.Mesh(g, mat);
      flags.frustumCulled = false;
      this.world.add(flags);
    }

    /* ---- kilometre posts / signs ---- */
    {
      const l = [];
      const texts = [];
      for (let s = 60; s < t.length - 60; s += 180) {
        const p1 = t.pointAt(s, 5.4, new THREE.Vector3());
        part(l, new THREE.CylinderGeometry(0.08, 0.08, 2.2, 4), '#9e9e9e', [p1.x, p1.y + 1.1, p1.z]);
        part(l, new THREE.BoxGeometry(0.9, 0.5, 0.1), '#ffffff', [p1.x, p1.y + 1.9, p1.z]);
        texts.push(new THREE.Vector3(p1.x, p1.y + 1.9, p1.z));
      }
      const g = merge(l);
      const mm = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      mm.frustumCulled = false;
      this.world.add(mm);
    }

    /* ---- cows (instanced, they move when you honk) ---- */
    const cowGeo = (() => {
      const l = [];
      part(l, new THREE.BoxGeometry(1.5, 0.95, 0.75), '#fafafa', [0, 1.05, 0]);
      part(l, new THREE.BoxGeometry(0.55, 0.55, 0.5), '#fafafa', [0.85, 1.35, 0]);
      part(l, new THREE.BoxGeometry(0.16, 0.5, 0.16), '#e0d5b7', [0.95, 1.7, 0.12], [0, 0, 0.3]);
      part(l, new THREE.BoxGeometry(0.16, 0.5, 0.16), '#e0d5b7', [0.95, 1.7, -0.12], [0, 0, 0.3]);
      part(l, new THREE.BoxGeometry(0.42, 0.42, 0.42), '#37474f', [-0.3, 1.2, 0.18]);
      part(l, new THREE.BoxGeometry(0.42, 0.42, 0.42), '#37474f', [0.25, 0.95, -0.2]);
      for (const [lx, lz] of [[-0.55, 0.25], [-0.55, -0.25], [0.5, 0.25], [0.5, -0.25]])
        part(l, new THREE.BoxGeometry(0.16, 0.62, 0.16), '#e8e8e8', [lx, 0.31, lz]);
      part(l, new THREE.BoxGeometry(0.1, 0.6, 0.1), '#e0e0e0', [-0.8, 1.15, 0], [0, 0, 0.4]);
      return merge(l);
    })();
    const cowCount = 10;
    this.cowMesh = new THREE.InstancedMesh(cowGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), cowCount);
    this.cows = [];
    for (let i = 0; i < cowCount; i++) {
      const s = (i / cowCount) * t.length + rand(-40, 40);
      this.cows.push({ s, x: rand(-2.4, 2.4), moved: false, hit: false, wob: rand(0, 6.28) });
    }
    this.cowMesh.frustumCulled = false;
    this.world.add(this.cowMesh);

    /* ---- start / finish gate ---- */
    {
      const l = [];
      const gate = (s, colA, colB) => {
        const a = t.pointAt(s, -7, new THREE.Vector3());
        const b = t.pointAt(s, 7, new THREE.Vector3());
        part(l, new THREE.BoxGeometry(0.5, 7, 0.5), '#eeeeee', [a.x, a.y + 3.5, a.z]);
        part(l, new THREE.BoxGeometry(0.5, 7, 0.5), '#eeeeee', [b.x, b.y + 3.5, b.z]);
        const mid = t.pointAt(s, 0, new THREE.Vector3());
        const w = 14;
        for (let i = 0; i < 10; i++) {
          part(l, new THREE.BoxGeometry(w / 10, 0.9, 0.35), i % 2 ? colA : colB,
            [lerp(a.x, b.x, (i + 0.5) / 10), a.y + 6.7, lerp(a.z, b.z, (i + 0.5) / 10)],
            [0, Math.atan2(b.x - a.x, b.z - a.z), 0]);
        }
      };
      gate(6, '#ffffff', '#d32f2f');
      gate(t.length - 12, '#ffffff', '#ffd54a');
      const mm = new THREE.Mesh(merge(l), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      mm.frustumCulled = false;
      this.world.add(mm);
    }
  }

  buildStops() {
    const t = this.track;
    this.stopPos = [];
    this.stopMarkers = [];
    const busShelter = () => {
      const l = [];
      part(l, new THREE.BoxGeometry(5.2, 0.16, 0.25), '#c62828', [0, 3.1, 0]);
      part(l, new THREE.BoxGeometry(0.16, 3.1, 0.16), '#455a64', [-2.3, 1.55, -0.5]);
      part(l, new THREE.BoxGeometry(0.16, 3.1, 0.16), '#455a64', [2.3, 1.55, -0.5]);
      part(l, new THREE.BoxGeometry(5.2, 0.12, 1.6), '#b71c1c', [0, 3.2, -0.6], [0.12, 0, 0]);
      part(l, new THREE.BoxGeometry(2.6, 0.12, 0.5), '#8d6e63', [0, 0.55, -0.4]);
      part(l, new THREE.BoxGeometry(0.12, 0.55, 0.4), '#6d4c41', [-1.1, 0.28, -0.4]);
      part(l, new THREE.BoxGeometry(0.12, 0.55, 0.4), '#6d4c41', [1.1, 0.28, -0.4]);
      // sign board on a pole
      part(l, new THREE.CylinderGeometry(0.09, 0.09, 3.4, 5), '#455a64', [3.1, 1.7, 0.2]);
      part(l, new THREE.BoxGeometry(1.5, 0.9, 0.12), '#ffd54a', [3.1, 3.2, 0.2]);
      part(l, new THREE.BoxGeometry(1.2, 0.55, 0.14), '#0d47a1', [3.1, 3.2, 0.26]);
      // waiting passengers
      const cols = ['#e91e63', '#2196f3', '#ff9800'];
      for (let i = 0; i < 3; i++) {
        const px = -1.4 + i * 1.3;
        part(l, new THREE.CylinderGeometry(0.24, 0.3, 1.2, 6), cols[i], [px, 1.15, -0.35]);
        part(l, new THREE.SphereGeometry(0.24, 6, 5), '#3e2723', [px, 1.95, -0.35]);
      }
      return merge(l);
    };
    const shelterGeo = busShelter();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.route.stops.forEach((st, i) => {
      const s = st.at * t.length;
      this.stopPos.push(s);
      const g = new THREE.Mesh(shelterGeo, mat);
      const p = t.pointAt(s, 8.4, new THREE.Vector3());
      g.position.copy(p);
      g.rotation.y = t.headingAt(s) + Math.PI;
      this.world.add(g);
      this.stopMarkers.push(g);
      if (i === 0) g.visible = true;
    });
    // petrol pumps
    this.pumpPos = [0.36 * t.length, 0.73 * t.length];
    const pumpGeo = (() => {
      const l = [];
      part(l, new THREE.BoxGeometry(6, 0.2, 4.2), '#eceff1', [0, 3.4, 0]);
      part(l, new THREE.BoxGeometry(0.25, 3.4, 0.25), '#90a4ae', [-2.4, 1.7, -1.6]);
      part(l, new THREE.BoxGeometry(0.25, 3.4, 0.25), '#90a4ae', [2.4, 1.7, -1.6]);
      part(l, new THREE.BoxGeometry(0.25, 3.4, 0.25), '#90a4ae', [-2.4, 1.7, 1.6]);
      part(l, new THREE.BoxGeometry(0.25, 3.4, 0.25), '#90a4ae', [2.4, 1.7, 1.6]);
      part(l, new THREE.BoxGeometry(0.9, 1.8, 0.7), '#d32f2f', [-1.4, 0.9, 0]);
      part(l, new THREE.BoxGeometry(0.9, 1.8, 0.7), '#d32f2f', [1.4, 0.9, 0]);
      part(l, new THREE.BoxGeometry(1.1, 0.5, 0.9), '#37474f', [-1.4, 1.9, 0]);
      part(l, new THREE.BoxGeometry(1.1, 0.5, 0.9), '#37474f', [1.4, 1.9, 0]);
      return merge(l);
    })();
    this.pumpPos.forEach((s) => {
      const g = new THREE.Mesh(pumpGeo, mat);
      g.position.copy(t.pointAt(s, 10, new THREE.Vector3()));
      g.rotation.y = t.headingAt(s) + Math.PI;
      this.world.add(g);
    });
  }

  buildPlayerBus() {
    while (this.bus.children.length) this.bus.children.pop();
    const body = [];
    // chassis + body
    part(body, new THREE.BoxGeometry(2.5, 1.05, 7.6), '#1b5e20', [0, 0.95, 0]);
    part(body, new THREE.BoxGeometry(2.52, 1.5, 7.6), '#f7f7f2', [0, 2.25, 0]);
    part(body, new THREE.BoxGeometry(2.54, 0.22, 7.62), '#ffd54a', [0, 1.52, 0]);
    // roof
    part(body, new THREE.BoxGeometry(2.45, 0.16, 7.4), '#e8e8e0', [0, 3.06, 0]);
    // windows (dark glass) both sides
    for (let i = 0; i < 5; i++) {
      const z = -3 + i * 1.35;
      part(body, new THREE.BoxGeometry(2.56, 0.85, 0.95), '#243b45', [0, 2.45, z]);
    }
    // rear window
    part(body, new THREE.BoxGeometry(2.1, 0.8, 0.12), '#243b45', [0, 2.45, -3.78]);
    // front windshield
    part(body, new THREE.BoxGeometry(2.2, 0.9, 0.12), '#243b45', [0, 2.4, 3.78]);
    // bumper + lights
    part(body, new THREE.BoxGeometry(2.5, 0.3, 0.25), '#37474f', [0, 0.85, -3.85]);
    part(body, new THREE.BoxGeometry(0.35, 0.22, 0.12), '#ff1744', [-0.95, 1.3, -3.86]);
    part(body, new THREE.BoxGeometry(0.35, 0.22, 0.12), '#ff1744', [0.95, 1.3, -3.86]);
    part(body, new THREE.BoxGeometry(0.3, 0.2, 0.12), '#fff59d', [-0.95, 1.05, 3.86]);
    part(body, new THREE.BoxGeometry(0.3, 0.2, 0.12), '#fff59d', [0.95, 1.05, 3.86]);
    // mirrors
    part(body, new THREE.BoxGeometry(0.1, 0.4, 0.1), '#455a64', [-1.35, 2.6, 3.5]);
    part(body, new THREE.BoxGeometry(0.1, 0.4, 0.1), '#455a64', [1.35, 2.6, 3.5]);
    // ladder at the back
    part(body, new THREE.BoxGeometry(0.08, 1.6, 0.08), '#b0bec5', [1.05, 1.9, -3.9]);
    part(body, new THREE.BoxGeometry(0.08, 1.6, 0.08), '#b0bec5', [1.3, 1.9, -3.9]);
    // marigold garland across the back
    for (let i = 0; i < 9; i++) {
      part(body, new THREE.SphereGeometry(0.09, 5, 4), i % 2 ? '#ff9800' : '#ffd54a',
        [-0.9 + i * 0.225, 2.95 - Math.sin((i / 8) * Math.PI) * 0.25, -3.86]);
    }
    const bodyMesh = new THREE.Mesh(merge(body), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.bus.add(bodyMesh);

    // number plate with texture
    const plateMat = new THREE.MeshBasicMaterial({ map: plateTexture() });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.36), plateMat);
    plate.position.set(0, 1.42, -3.87);
    plate.rotation.y = Math.PI;
    this.bus.add(plate);

    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.34, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414, flatShading: true });
    const hubMat = new THREE.MeshLambertMaterial({ color: 0xb0bec5, flatShading: true });
    this.wheels = [];
    for (const [wx, wz] of [[-1.25, 2.5], [1.25, 2.5], [-1.25, -2.4], [1.25, -2.4]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.52, wz);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 8), hubMat);
      hub.rotation.z = Math.PI / 2;
      w.add(hub);
      this.bus.add(w);
      this.wheels.push(w);
    }
    // soft contact shadow
    const sh = new THREE.Mesh(
      new THREE.CircleGeometry(2.3, 18),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.scale.set(0.85, 1.6, 1);
    sh.position.y = 0.05;
    this.bus.add(sh);

    // headlight glow cones (cheap)
    this.bus.position.set(0, 0, 0);
  }

  spawnTraffic() {
    const TYPES = [
      { id: 'truck', w: 2.6, h: 3.1, l: 8.2, color: '#ef6c00', roof: '#fff8e1', speed: 9 },
      { id: 'bus', w: 2.5, h: 3.0, l: 8.6, color: '#00838f', roof: '#f5f5f5', speed: 10 },
      { id: 'car', w: 1.9, h: 1.5, l: 4.2, color: '#1565c0', roof: '#90caf9', speed: 14 },
      { id: 'tempo', w: 1.9, h: 2.1, l: 4.6, color: '#2e7d32', roof: '#ffffff', speed: 12 },
      { id: 'bike', w: 0.7, h: 1.6, l: 1.9, color: '#6a1b9a', roof: '#37474f', speed: 16 },
      { id: 'tractor', w: 2.0, h: 2.4, l: 4.0, color: '#c62828', roof: '#c8a44a', speed: 7 }
    ];
    this.traffic = [];
    const geos = {};
    for (const T of TYPES) {
      const l = [];
      const bodyH = T.h * (T.id === 'car' ? 0.55 : 0.7);
      part(l, new THREE.BoxGeometry(T.w, bodyH, T.l), T.color, [0, bodyH / 2 + 0.35, 0]);
      part(l, new THREE.BoxGeometry(T.w * 0.96, T.h * 0.32, T.l * (T.id === 'bike' ? 0.5 : 0.75)), T.roof, [0, bodyH + 0.35 + T.h * 0.16, T.id === 'car' ? -0.2 : -0.6]);
      // wheels
      const wr = T.id === 'truck' || T.id === 'bus' ? 0.55 : 0.38;
      for (const [wx, wz] of [[-T.w / 2, T.l * 0.3], [T.w / 2, T.l * 0.3], [-T.w / 2, -T.l * 0.3], [T.w / 2, -T.l * 0.3]]) {
        part(l, new THREE.CylinderGeometry(wr, wr, 0.28, 8), '#141414', [wx, wr, wz], [0, 0, Math.PI / 2]);
      }
      // tail lights
      part(l, new THREE.BoxGeometry(0.22, 0.16, 0.1), '#ff1744', [-T.w * 0.35, bodyH * 0.7 + 0.35, -T.l / 2 - 0.02]);
      part(l, new THREE.BoxGeometry(0.22, 0.16, 0.1), '#ff1744', [T.w * 0.35, bodyH * 0.7 + 0.35, -T.l / 2 - 0.02]);
      geos[T.id] = merge(l);
    }
    this.trafficTypes = TYPES;
    this.trafficMeshes = {};
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const T of TYPES) {
      const count = T.id === 'bike' ? 6 : T.id === 'truck' ? 7 : 5;
      const im = new THREE.InstancedMesh(geos[T.id], mat, count);
      im.frustumCulled = false;
      this.world.add(im);
      this.trafficMeshes[T.id] = im;
      for (let i = 0; i < count; i++) {
        this.traffic.push({
          type: T, s: rand(60, this.track.length), x: rand(-2.6, 2.6),
          speed: T.speed * rand(0.8, 1.15), mesh: im, idx: i, l: T.l, w: T.w
        });
      }
    }
    this._tm = new THREE.Matrix4();
    this._tq = new THREE.Quaternion();
    this._tp = new THREE.Vector3();
    this._ts = new THREE.Vector3(1, 1, 1);
  }

  /* ------------------------------- run state ---------------------------- */
  resetRun() {
    this.state = 'menu';
    this.s = 30;
    this.x = 0;
    this.speed = 0;
    this.steer = 0;
    this.money = 0;
    this.pax = 12;
    this.fuel = 100;
    this.damage = 0;
    this.crashes = 0;
    this.honks = 0;
    this.delivered = 0;
    this.timeLeft = this.route.time;
    this.elapsed = 0;
    this.nextStop = 1;
    this.doorOpen = false;
    this.doorTimer = 0;
    this.shake = 0;
    this.msgTimer = 0;
    this.started = false;
    this.cows.forEach((c) => { c.moved = false; c.hit = false; });
    this.placeBus(0);
  }

  startRun() {
    this.resetRun();
    this.state = 'playing';
    this.bus.visible = true;
    this.started = true;
    $('hud').classList.add('on');
    $('startScreen').classList.add('hidden');
    $('pauseScreen').classList.add('hidden');
    $('endScreen').classList.add('hidden');
    $('routeName').textContent = this.route.ne;
    $('lblFrom').textContent = this.route.stops[0].ne;
    $('lblTo').textContent = this.route.stops[this.route.stops.length - 1].ne;
    const track = $('routeTrack');
    track.querySelectorAll('.stopDot').forEach((d) => d.remove());
    this.route.stops.forEach((st) => {
      const d = document.createElement('div');
      d.className = 'stopDot';
      d.style.left = (st.at * 100) + '%';
      d.title = st.ne;
      track.appendChild(d);
    });
    this.hudCache = {};
    this.updateHUD(true);
    this.showMsg(`🚌 ${this.route.ne}`, `यात्रा सुरु! Next stop: ${this.route.stops[1].ne}`, 3.2);
    if (this.AC && this.AC.state === 'suspended') this.AC.resume();
  }

  endRun(success) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.setEngine(0, false);
    $('hud').classList.remove('on');
    const timeBonus = success ? Math.round(this.timeLeft * 12) : 0;
    this.money += timeBonus;
    $('endTitle').textContent = success ? '🎉 ROUTE COMPLETE!' : '⏰ TIME UP!';
    $('endSub').textContent = success ? 'धन्यवाद! तपाईं गन्तव्यमा पुग्नुभयो' : 'समय सकियो — अर्को पटक छिटो जानुहोस्!';
    $('stMoney').textContent = 'रू ' + fmt(this.money) + (timeBonus ? ` (+${fmt(timeBonus)} bonus)` : '');
    $('stPax').textContent = this.delivered;
    $('stTime').textContent = Math.floor(this.elapsed / 60) + ':' + String(Math.floor(this.elapsed % 60)).padStart(2, '0');
    $('stCrash').textContent = this.crashes;
    let stars = 1, rank = '🐢 नयाँ ड्राइभर — Keep Practicing!';
    if (success && this.crashes === 0 && this.timeLeft > this.route.time * 0.3) { stars = 3; rank = '🏆 सुपर ड्राइभर! — Super Driver!'; }
    else if (success && this.crashes <= 2) { stars = 2; rank = '⭐⭐ राम्रो ड्राइभर! — Good Driver!'; }
    else if (success) { stars = 1; rank = '🚌 यात्रुहरू खुशी छन्! — Passengers Happy!'; }
    $('endStars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    $('endRank').textContent = rank;
    $('endScreen').classList.remove('hidden');
    if (success) [523, 659, 784, 1046].forEach((f, i) => this.beep(f, 0.25, 'square', 0.15, i * 0.12));
  }

  /* ------------------------------- input -------------------------------- */
  initInput() {
    const k = this.keys;
    const down = (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      k[key] = true;
      if (key === ' ' || e.key === ' ') k[' '] = true;
      if (this.state !== 'playing') {
        if ((key === 'p' || key === 'P') && this.state === 'paused') this.resume();
        if (key === 'Enter' && this.state === 'menu') this.startRun();
        return;
      }
      if (key === 'h') this.doHorn();
      if (key === 'e') this.toggleDoor();
      if (key === 'f') this.tryRefuel();
      if (key === 'c') { this.camMode = (this.camMode + 1) % 2; this.showMsg(this.camMode ? '📷 Close Camera' : '📷 Far Camera', 'क्यामेरा परिवर्तन', 1); }
      if (key === 'm') { this.muted = !this.muted; this.showMsg(this.muted ? '🔇 Sound OFF' : '🔊 Sound ON', 'आवाज बन्द/चालु', 1.2); }
      if (key === 'p') this.pause();
    };
    const up = (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      k[key] = false;
      if (e.key === ' ') k[' '] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    // touch / mouse buttons
    const bind = (id, key) => {
      const el = $(id);
      if (!el) return;
      const on = (e) => { e.preventDefault(); k[key] = true; };
      const off = (e) => { e.preventDefault(); k[key] = false; };
      el.addEventListener('touchstart', on, { passive: false });
      el.addEventListener('touchend', off);
      el.addEventListener('touchcancel', off);
      el.addEventListener('mousedown', on);
      el.addEventListener('mouseup', off);
      el.addEventListener('mouseleave', off);
    };
    bind('tLeft', 'a');
    bind('tRight', 'd');
    bind('tGas', 'w');
    bind('tBrake', 's');
    $('tHorn').addEventListener('click', () => { if (this.state === 'playing') this.doHorn(); });
    $('tDoor').addEventListener('click', () => { if (this.state === 'playing') this.toggleDoor(); });
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      $('touch').classList.add('on');
      document.body.classList.add('is-touch');
    }
    window.addEventListener('blur', () => { if (this.state === 'playing') this.pause(); });
  }

  initUI() {
    const list = $('routeList');
    list.innerHTML = '';
    ROUTES.forEach((r, i) => {
      const div = document.createElement('div');
      div.className = 'route' + (i === 0 ? ' sel' : '');
      div.innerHTML = `<b>${r.name}</b><span class="ne">${r.ne}</span><span>${r.desc}</span>` +
        `<span class="diff">${r.diff} • 🛣️ ${r.km} km • ⏱️ ${Math.round(r.time / 60)} min</span>`;
      div.onclick = () => {
        list.querySelectorAll('.route').forEach((x) => x.classList.remove('sel'));
        div.classList.add('sel');
        this.loadRoute(r);
        this.beep(660, 0.08, 'square', 0.07);
      };
      list.appendChild(div);
    });
    $('startBtn').onclick = () => { this.audioInit(); this.startRun(); };
    $('resumeBtn').onclick = () => this.resume();
    $('restartBtn').onclick = () => { this.startRun(); };
    $('menuBtn').onclick = () => this.toMenu();
    $('againBtn').onclick = () => this.startRun();
    $('endMenuBtn').onclick = () => this.toMenu();
    this.hudCache = {};
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    $('pauseScreen').classList.remove('hidden');
    this.setEngine(0, false);
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    $('pauseScreen').classList.add('hidden');
  }
  toMenu() {
    this.state = 'menu';
    ['startScreen', 'pauseScreen', 'endScreen'].forEach((id) => $(id).classList.add('hidden'));
    $('startScreen').classList.remove('hidden');
    $('hud').classList.remove('on');
    this.setEngine(0, false);
    this.resetRun();
  }

  /* ------------------------------ audio --------------------------------- */
  audioInit() {
    if (this.AC) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.AC = new Ctx();
      const osc = this.AC.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 42;
      const filt = this.AC.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 340;
      const gain = this.AC.createGain();
      gain.gain.value = 0;
      osc.connect(filt); filt.connect(gain); gain.connect(this.AC.destination);
      osc.start();
      this.engineOsc = osc; this.engineGain = gain;
    } catch (e) { /* audio not available */ }
  }
  setEngine(ratio, on) {
    if (!this.AC || !this.engineOsc) return;
    this.engineOsc.frequency.value = 40 + ratio * 120;
    this.engineGain.gain.value = this.muted ? 0 : (on ? 0.03 + ratio * 0.05 : 0.008);
  }
  beep(freq, dur, type = 'square', vol = 0.12, delay = 0) {
    if (!this.AC || this.muted) return;
    const t = this.AC.currentTime + delay;
    const o = this.AC.createOscillator(), g = this.AC.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.AC.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  hornSound() {
    if (!this.AC || this.muted) return;
    const t = this.AC.currentTime;
    [415, 500].forEach((f) => {
      const o = this.AC.createOscillator(), g = this.AC.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g); g.connect(this.AC.destination);
      o.start(t); o.stop(t + 0.5);
    });
  }
  bellSound() { this.beep(880, 0.12, 'sine', 0.16); this.beep(1174, 0.18, 'sine', 0.16, 0.12); }
  cashSound() { this.beep(1318, 0.08, 'square', 0.1); this.beep(1760, 0.15, 'square', 0.1, 0.07); }
  crashSound() {
    if (!this.AC || this.muted) return;
    const t = this.AC.currentTime, o = this.AC.createOscillator(), g = this.AC.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.3);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(this.AC.destination);
    o.start(t); o.stop(t + 0.4);
  }

  /* ----------------------------- gameplay ------------------------------- */
  doHorn() {
    this.honks++;
    this.hornSound();
    const hp = $('hornPop');
    hp.classList.remove('show');
    void hp.offsetWidth;
    hp.classList.add('show');
    // cows ahead get out of the way
    for (const c of this.cows) {
      let ds = c.s - this.s;
      if (ds < -this.track.length / 2) ds += this.track.length;
      if (ds > this.track.length / 2) ds -= this.track.length;
      if (ds > -6 && ds < 60 && !c.moved) {
        c.moved = true;
        c.target = c.x > 0 ? 5.2 : -5.2;
        this.beep(700, 0.1, 'sine', 0.06);
      }
    }
  }

  toggleDoor() {
    if (this.doorTimer > 0) return;
    this.doorTimer = 0.55;
    this.doorOpen = !this.doorOpen;
    this.bellSound();
    if (!this.doorOpen) { this.showMsg('🚪 Door Closed', 'ढोका बन्द — चल्नुहोस्!', 1.2); return; }
    if (this.nextStop >= this.route.stops.length) { this.showMsg('🏁 Finish!', 'गन्तव्यमा पुग्नुभयो!', 1.4); return; }
    const st = this.route.stops[this.nextStop];
    const stopS = this.stopPos[this.nextStop];
    let ds = this.s - stopS;
    if (ds < -this.track.length / 2) ds += this.track.length;
    if (ds > this.track.length / 2) ds -= this.track.length;
    if (this.speed > 1.2) {
      this.showMsg('⚠️ Stop the bus first!', 'पहिले बस रोक्नुहोस्', 1.5);
      this.doorOpen = false;
      return;
    }
    if (Math.abs(ds) > 9) {
      this.showMsg('🚪 Door Open', `स्टपमा रोक्नुहोस् — Next: ${st.ne}`, 1.6);
      return;
    }
    const data = this.stopData[this.nextStop];
    const alighting = Math.min(this.pax, data.alighting);
    const waiting = data.waiting;
    const space = 40 - this.pax;
    const boarding = Math.min(waiting, space);
    const fare = boarding * data.fare;
    this.pax = this.pax - alighting + boarding;
    this.delivered += alighting;
    this.money += fare;
    data.waiting = 0;
    data.alighting = 0;
    this.cashSound();
    this.showMsg(`🚏 ${st.ne} — ${st.name}`, `⬇️ ${alighting} उतरे • ⬆️ ${boarding} चढे • +रू ${fmt(fare)}`, 3);
    this.nextStop++;
    if (this.nextStop >= this.route.stops.length) {
      this.doorOpen = false;
      setTimeout(() => this.endRun(true), 1100);
    } else {
      this.doorOpen = false;
      this.doorTimer = 0.9;
    }
  }

  tryRefuel() {
    const near = this.pumpPos.some((ps) => {
      let ds = this.s - ps;
      if (ds < -this.track.length / 2) ds += this.track.length;
      if (ds > this.track.length / 2) ds -= this.track.length;
      return Math.abs(ds) < 16;
    });
    if (!near) { this.showMsg('⛽ No petrol pump here', 'पेट्रोल पम्प खोज्नुहोस्', 1.5); return; }
    if (this.speed > 1.2) { this.showMsg('⚠️ Stop at the pump first!', 'पम्पमा रोक्नुहोस्', 1.5); return; }
    if (this.fuel > 98) { this.showMsg('⛽ Tank Full!', 'ट्याङ्की फुल छ', 1.2); return; }
    const cost = Math.round((100 - this.fuel) * 3);
    if (this.money < cost) { this.showMsg('💸 Not enough money!', 'पैसा पुगेन — रू ' + fmt(cost) + ' चाहिन्छ', 2); return; }
    this.money -= cost;
    this.fuel = 100;
    this.cashSound();
    this.showMsg('⛽ Refuel Done!', 'इन्धन भर्नुभयो — रू ' + fmt(cost), 2);
  }

  update(dt) {
    const MAXS = 22.2;  // 80 km/h
    this.elapsed += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.endRun(false); return; }
    if (this.damage >= 100) { this.showMsg('💥 Bus Broken!', 'बस बिग्रियो — Game Over', 2); this.endRun(false); return; }
    if (this.doorTimer > 0) this.doorTimer -= dt;

    const k = this.keys;
    const gas = k['w'] || k['arrowup'];
    const brake = k['s'] || k['arrowdown'] || k[' '];
    const left = k['a'] || k['arrowleft'];
    const right = k['d'] || k['arrowright'];
    this.steer = (left ? -1 : 0) + (right ? 1 : 0);

    if (gas && this.fuel > 0 && !this.doorOpen) this.speed += 7.2 * dt;
    else if (brake) this.speed -= 15 * dt;
    else this.speed -= 1.9 * dt;

    // engine braking in gear + off-road penalty
    const offroad = Math.abs(this.x) > 4.1;
    if (offroad) {
      this.speed -= 7 * dt;
      if (this.speed > 6) this.shake = Math.max(this.shake, 0.22);
    }
    this.speed = clamp(this.speed, 0, MAXS);

    // steering (speed dependent)
    const grip = 0.35 + 0.65 * Math.min(1, this.speed / 9);
    this.x += this.steer * 4.6 * grip * dt * (this.speed > 0.4 ? 1 : 0.15);
    this.x = clamp(this.x, -6.4, 6.4);

    this.s = (this.s + this.speed * dt) % this.track.length;

    this.fuel = Math.max(0, this.fuel - dt * (0.22 + (this.speed / MAXS) * 0.78));
    if (this.fuel <= 0 && this.speed > 1) this.showMsg('⛽ Out of Fuel!', 'इन्धन सकियो — पम्प खोज्नुहोस्', 2.5);

    this.updateTraffic(dt);
    this.checkCollisions();
    this.updateCows(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.msgTimer > 0) { this.msgTimer -= dt; if (this.msgTimer <= 0) $('msg').classList.remove('show'); }

    // stop / pump prompt
    this.updatePrompt();

    this.hudAcc += dt;
    if (this.hudAcc > 0.1) { this.hudAcc = 0; this.updateHUD(); }
  }

  updateTraffic(dt) {
    for (const c of this.traffic) {
      c.s = (c.s + c.speed * dt) % this.track.length;
      if (c.cool > 0) c.cool -= dt;
    }
  }

  checkCollisions() {
    const half = this.track.length / 2;
    for (const c of this.traffic) {
      let ds = c.s - this.s;
      if (ds < -half) ds += this.track.length;
      if (ds > half) ds -= this.track.length;
      const dx = Math.abs(c.x - this.x);
      if (Math.abs(ds) < (c.l / 2 + 3.6) && dx < (c.w / 2 + 1.15)) {
        if (c.cool > 0) continue;
        if (this.speed > c.speed * 0.8) {
          this.speed = c.speed * 0.45;
          this.damage = Math.min(100, this.damage + 8);
          this.crashes++;
          this.shake = 0.7;
          c.cool = 2.2;
          c.s = (c.s + 4) % this.track.length;
          this.crashSound();
          this.showMsg('💥 CRASH! दुर्घटना!', 'Damage +8% — बिस्तारै चलाउनुहोस्', 1.6);
        }
      }
    }
  }

  updateCows(dt) {
    for (const c of this.cows) {
      if (c.moved && c.target !== undefined) c.x = lerp(c.x, c.target, dt * 1.5);
      let ds = c.s - this.s;
      const half = this.track.length / 2;
      if (ds < -half) ds += this.track.length;
      if (ds > half) ds -= this.track.length;
      if (!c.hit && Math.abs(ds) < 3.4 && Math.abs(c.x - this.x) < 2.0 && this.speed > 1.5) {
        c.hit = true;
        this.damage = Math.min(100, this.damage + 5);
        this.crashes++;
        this.speed *= 0.35;
        this.shake = 0.55;
        this.crashSound();
        this.showMsg('🐄 Oh no! Cow! गाई!', 'Horn बजाउनुहोस् — H to honk!', 2);
      }
    }
  }

  updatePrompt() {
    const el = $('prompt');
    let txt = '';
    if (this.nextStop < this.route.stops.length) {
      const st = this.route.stops[this.nextStop];
      let ds = this.stopPos[this.nextStop] - this.s;
      const half = this.track.length / 2;
      if (ds < -half) ds += this.track.length;
      if (ds > half) ds -= this.track.length;
      if (Math.abs(ds) < 26 && this.speed < 1.2) txt = `🚏 ${st.ne} — press E to open the door`;
    }
    if (!txt) {
      const nearPump = this.pumpPos.some((ps) => {
        let ds = this.s - ps;
        const half = this.track.length / 2;
        if (ds < -half) ds += this.track.length;
        if (ds > half) ds -= this.track.length;
        return Math.abs(ds) < 22;
      });
      if (nearPump && this.fuel < 98 && this.speed < 1.2) txt = '⛽ Press F to refuel';
    }
    if (!txt) {
      for (const c of this.cows) {
        let ds = c.s - this.s;
        if (ds < -this.track.length / 2) ds += this.track.length;
        if (ds > this.track.length / 2) ds -= this.track.length;
        if (ds > 4 && ds < 40 && !c.moved) { txt = '🐄 Cow ahead — press H to honk!'; break; }
      }
    }
    if (txt) { if (el.textContent !== txt) el.textContent = txt; el.classList.add('on'); }
    else el.classList.remove('on');
  }

  showMsg(title, sub, secs = 2) {
    const el = $('msg');
    el.innerHTML = `${title}<small>${sub || ''}</small>`;
    el.classList.add('show');
    this.msgTimer = secs;
  }

  updateHUD(force) {
    const c = this.hudCache || (this.hudCache = {});
    const setTxt = (id, v) => { if (force || c[id] !== v) { c[id] = v; $(id).textContent = v; } };
    setTxt('money', fmt(this.money));
    setTxt('pax', String(this.pax));
    const fp = Math.round(this.fuel) + '%';
    if (force || c.fuel !== fp) { c.fuel = fp; $('fuelBar').style.width = this.fuel + '%'; $('fuelTxt').textContent = fp; }
    const flow = this.fuel < 25;
    if (force || c.flow !== flow) { c.flow = flow; $('fuelBar').style.background = flow ? '#ff5252' : '#69f0ae'; $('fuelPill').classList.toggle('low', flow); }
    const dmg = Math.round(this.damage) + '%';
    if (force || c.dmg !== dmg) { c.dmg = dmg; $('dmgBar').style.width = this.damage + '%'; $('dmgTxt').textContent = dmg; $('dmgPill').classList.toggle('high', this.damage > 60); }
    const t = Math.max(0, Math.ceil(this.timeLeft));
    setTxt('timer', Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'));
    const kmh = Math.round(this.speed * 3.6);
    setTxt('speedNum', String(kmh));
    $('needle').style.transform = `translate(-50%,-100%) rotate(${-120 + clamp(kmh / 80, 0, 1) * 240}deg)`;
    const gear = this.doorOpen ? 'DOOR' : (this.speed < 0.5 ? 'N' : (kmh < 20 ? '1' : kmh < 38 ? '2' : kmh < 58 ? '3' : '4'));
    setTxt('gearTxt', gear);
    if (this.nextStop < this.route.stops.length) {
      const st = this.route.stops[this.nextStop];
      let ds = this.stopPos[this.nextStop] - this.s;
      if (ds < 0) ds += this.track.length;
      const km = ds / this.track.length * this.route.km;
      setTxt('nextStopTxt', `${st.ne} • ${km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(0) + ' km'}`);
    } else setTxt('nextStopTxt', 'गन्तव्य! 🏁');
    const prog = clamp(this.s / this.track.length, 0, 1);
    if (force || c.prog !== prog) {
      c.prog = prog;
      $('routeFill').style.width = (prog * 100) + '%';
      $('busDot').style.left = (prog * 100) + '%';
    }
    const dots = document.querySelectorAll('.stopDot');
    dots.forEach((d, i) => {
      const key = 'd' + i + '_' + this.nextStop;
      if (!force && c[key]) return;
      c[key] = true;
      d.classList.toggle('done', i < this.nextStop);
      d.classList.toggle('next', i === this.nextStop);
    });
  }

  /* ------------------------------ visuals ------------------------------- */
  placeBus(dt, cameraOnly) {
    const t = this.track;
    const p = t.pointAt(this.s, this.x, this._p);
    if (!cameraOnly) {
      this.bus.position.copy(p);
      const head = t.headingAt(this.s);
      const targetYaw = head + this.steer * 0.09;
      // smooth yaw so curves don't snap
      let cur = this.bus.rotation.y;
      let diff = ((targetYaw - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.bus.rotation.y = cur + diff * Math.min(1, dt * 9);
      this.bus.rotation.z = -this.steer * 0.035;
      if (this.shake > 0) {
        this.bus.position.x += rand(-1, 1) * this.shake * 0.22;
        this.bus.position.y += rand(-1, 1) * this.shake * 0.12;
      }
      for (const w of this.wheels) w.rotation.x -= this.speed * dt / 0.52;
    }
  }

  updateCamera(dt) {
    const t = this.track;
    const cam = this.camera;
    const close = this.camMode === 1;
    const back = close ? 11.5 : 15.5;
    const height = close ? 3.6 : 5.4;
    const cs = Math.max(0, this.s - back);
    const ls = Math.min(t.length - 1, this.s + (close ? 12 : 18));
    const p = t.pointAt(cs, this.x * 0.85, this._p2);
    const look = t.pointAt(ls, this.x * 0.6, this._r);
    p.y += height;
    look.y += close ? 2.2 : 2.8;
    if (this._camInit !== true) { cam.position.copy(p); this._camInit = true; }
    const k = 1 - Math.exp(-dt * (this.state === 'playing' ? 7 : 2.4));
    cam.position.lerp(p, k);
    if (this.shake > 0) {
      cam.position.x += rand(-1, 1) * this.shake * 0.35;
      cam.position.y += rand(-1, 1) * this.shake * 0.22;
    }
    if (!this._lookAt) this._lookAt = new THREE.Vector3().copy(look);
    this._lookAt.lerp(look, Math.min(1, dt * 6));
    cam.lookAt(this._lookAt);
  }

  updateVisuals(dt) {
    this.placeBus(dt);
    // traffic instances
    const m = this._tm, q = this._tq, p = this._tp, sc = this._ts;
    for (const c of this.traffic) {
      this.track.pointAt(c.s, c.x, p);
      q.setFromAxisAngle(UP, this.track.headingAt(c.s));
      m.compose(p, q, sc);
      c.mesh.setMatrixAt(c.idx, m);
    }
    for (const id in this.trafficMeshes) this.trafficMeshes[id].instanceMatrix.needsUpdate = true;
    // cows
    this.cows.forEach((c, i) => {
      this.track.pointAt(c.s, c.x, p);
      q.setFromAxisAngle(UP, c.wob + (c.moved ? 0.5 : 0));
      m.compose(p, q, sc);
      this.cowMesh.setMatrixAt(i, m);
    });
    this.cowMesh.instanceMatrix.needsUpdate = true;
    // sky follows the camera so the dome never clips
    this.sky.position.copy(this.camera.position);
    // engine sound
    if (this.state === 'playing') this.setEngine(Math.min(1, this.speed / 22.2), true);
  }

  menuWander(dt) {
    // attract mode: drift along the road behind the start line
    this.s = (this.s + 6 * dt) % this.track.length;
    this.x = Math.sin(this.s * 0.05) * 1.4;
    this.bus.visible = false;
    this.updateTraffic(dt);
    this.updateVisuals(dt);
  }

  /**
   * Adaptive resolution: phones that can't hold ~40 fps get a smaller drawing buffer,
   * fast phones get the full (capped) device pixel ratio back. Keeps old hardware smooth.
   */
  adaptResolution(now) {
    if (!this.renderer || this.state !== 'playing') { this._lastT = now; return; }
    const prev = this._lastT;
    this._lastT = now;
    if (!prev) return;
    const ms = now - prev;
    if (ms <= 0 || ms > 120) return; // tab switch / hiccup: ignore
    this._avgMs = this._avgMs ? this._avgMs * 0.9 + ms * 0.1 : ms;
    this._adaptFrames = (this._adaptFrames || 0) + 1;
    if (this._adaptFrames < 90) return;
    this._adaptFrames = 0;
    const cur = this.dpr || this.maxDPR;
    let next = cur;
    if (this._avgMs > 25 && cur > 1) next = Math.max(1, +(cur - 0.25).toFixed(2));
    else if (this._avgMs < 13 && cur < this.maxDPR) next = Math.min(this.maxDPR, +(cur + 0.25).toFixed(2));
    if (Math.abs(next - cur) > 0.01) {
      this.dpr = next;
      this.renderer.setPixelRatio(next);
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.adaptResolution(nowMs());
    if (this.state === 'playing') {
      this.bus.visible = true;
      this.update(dt);
      this.updateVisuals(dt);
    } else if (this.state === 'menu') {
      this.menuWander(dt);
    } else if (this.state === 'ended') {
      this.bus.visible = true;
      this.updateVisuals(dt);
    }
    if (this._menuCam === undefined) this._menuCam = true;
    if (this.state === 'menu') {
      // slower, floating camera for the menu
      const t = this.track;
      const p = t.pointAt(Math.max(0, this.s - 14), this.x * 0.8, this._p2);
      p.y += 6.2 + Math.sin(this.elapsed * 0.3) * 0.5;
      if (!this._camInit) { this.camera.position.copy(p); this._camInit = true; }
      this.camera.position.lerp(p, 1 - Math.exp(-dt * 2.2));
      const look = t.pointAt(this.s + 20, 0, this._r);
      look.y += 3.2;
      if (!this._lookAt) this._lookAt = new THREE.Vector3().copy(look);
      this._lookAt.lerp(look, 1 - Math.exp(-dt * 2.4));
      this.camera.lookAt(this._lookAt);
      this.elapsed += dt;
    } else {
      this.updateCamera(dt);
    }
    this.sky.position.copy(this.camera.position);
    if (this.renderer) this.renderer.render(this.scene, this.camera);
  }
}

/* ------------------------------- bootstrap ------------------------------- */
function boot() {
  const canvas = $('game');
  const game = new Game(canvas);
  window.__GAME__ = game;
  window.__DEBUG = {
    game,
    tick(dt = 1 / 60) { game.update(dt); game.updateVisuals(dt); game.updateCamera(dt); }
  };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

export { Game, ROUTES, Track };
