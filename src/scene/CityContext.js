import * as THREE from 'three';
import { LON0, LAT0, MLON, MLAT, toLocal } from '../geo.js';
import { makeFacadeTextures, BAY_W } from './FacadeTextures.js';
import { Church } from './Church.js';

/**
 * CityContext — contexto urbano real de Galerías / Teusaquillo a partir de Catastro Bogotá:
 *  · ~7.400 construcciones (huella + número de pisos + altura) con fachadas realistas de ladrillo,
 *    pañete o concreto y ventanas por piso; las cubiertas toman la ortofoto real.
 *  · La iglesia frente al lote (Calle 56 con Carrera 18) reconstruida con nave, cubierta y torre.
 *  · Manzanas con uso predominante, altura media y valor de referencia del suelo (temas de color).
 *  · Lotes catastrales alrededor del proyecto (trama predial) y los predios evaluados 01 y 03.
 *  · Ortofoto real (Esri World Imagery) en el suelo; si no carga, quedan las manzanas como andén.
 *  · Área de estudio (Calles 53–60 · Carreras 14–24) como cinta y cortina translúcida.
 */
const IMG = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';
const CHURCH_LOT = '007208001002';
const BASE_Y = 0.16;

export const USOS = {
  RESIDENCIAL: { label: 'Residencial', color: '#f1d54a' },
  'COMERCIO Y OFICINAS': { label: 'Comercio y oficinas', color: '#e5869d' },
  DOTACIONAL: { label: 'Dotacional', color: '#5d9be0' },
  OTROS: { label: 'Otros', color: '#b9b3a8' },
  BODEGAS: { label: 'Bodegas', color: '#a0705a' },
  'DEPOSITOS Y PARQUEADEROS': { label: 'Depósitos y parqueaderos', color: '#8a8d93' }
};
const VALOR_BINS = [
  { max: 3.5e6, label: '< $3,5 M/m²', color: '#f5ecdb' },
  { max: 4.5e6, label: '$3,5 – 4,5 M/m²', color: '#ead0a0' },
  { max: 5.5e6, label: '$4,5 – 5,5 M/m²', color: '#d9a964' },
  { max: 7e6, label: '$5,5 – 7 M/m²', color: '#c07f39' },
  { max: Infinity, label: '> $7 M/m²', color: '#8f531c' }
];
const ALTURA_BINS = [
  { max: 2, label: '1 – 2 pisos', color: '#e6eef6' },
  { max: 3, label: '2 – 3 pisos', color: '#bad0e7' },
  { max: 4, label: '3 – 4 pisos', color: '#86acd4' },
  { max: 6, label: '4 – 6 pisos', color: '#4f82b9' },
  { max: Infinity, label: 'Más de 6 pisos', color: '#24578f' }
];
const SIN_DATO = '#d6d1c7';
const MAQUETA_MZ = '#e3ded4';
const MAQUETA_BLD = '#f3f0ea';
const ANDEN = '#cbc5b9';
const STYLES = ['ladrillo', 'pañete', 'concreto'];
const ROOF_TINTS = ['#8f8a83', '#a39d94', '#7d4a37', '#9a9590', '#b0aaa0'];
// variación de color por edificio (multiplica la textura de fachada)
const WALL_TINTS = [
  ['#ffffff', '#f2e6de', '#e8d8cd', '#fff1e6', '#ddc9bd'],
  ['#ffffff', '#f4ead7', '#e9dcc4', '#dde5e8', '#f2e0cc', '#e0d3bd', '#f5f0e6'],
  ['#ffffff', '#e8eaec', '#d9dcde', '#eceae4']
];

const tileX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const tileY = (lat, z) => ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
const tile2lon = (x, z) => (x / 2 ** z) * 360 - 180;
const tile2lat = (y, z) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 2 ** z));

function loadImg(url) {
  return new Promise((res) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = url;
  });
}

function signedArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return a / 2;
}

export function pointInPolygon([x, z], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const centroid = (p) => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };

/** Rectángulo orientado mínimo: centro, largo (l), ancho (w) y ángulo del eje largo en el plano (x, z). */
export function obb(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), ux = Math.cos(ang), uz = Math.sin(ang);
    const us = pts.map(([x, z]) => x * ux + z * uz), vs = pts.map(([x, z]) => -x * uz + z * ux);
    const l = Math.max(...us) - Math.min(...us), w = Math.max(...vs) - Math.min(...vs);
    if (!best || l * w < best.area) {
      const mu = (Math.max(...us) + Math.min(...us)) / 2, mv = (Math.max(...vs) + Math.min(...vs)) / 2;
      best = { area: l * w, l, w, angle: ang, cx: mu * ux - mv * uz, cz: mu * uz + mv * ux };
    }
  }
  if (best.w > best.l) { [best.l, best.w] = [best.w, best.l]; best.angle += Math.PI / 2; }
  return best;
}

/**
 * Muros + cubierta de un polígono extruido, con UV de fachada (u en crujías, v en pisos) y
 * UV de cubierta opcional (`roofUV(x, z)` → [u, v]). Devuelve arreglos para fusionar.
 */
function prismArrays(pts, y0, y1, { floorH = 2.9, bayW = BAY_W, roofUV } = {}) {
  let p = pts;
  if (signedArea(p) > 0) p = [...p].reverse(); // horario en (x, z) → normal exterior = (−dz, dx)
  const W = { pos: [], nor: [], uv: [] }, R = { pos: [], nor: [], uv: [] };
  const vTop = (y1 - y0) / floorH;
  for (let i = 0; i < p.length; i++) {
    const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length];
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l;
    const uMax = l < 1.6 ? l / bayW : Math.max(1, Math.round(l / bayW)); // crujías enteras en cada muro
    W.pos.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y0, az, bx, y1, bz, ax, y1, az);
    W.uv.push(0, 0, uMax, 0, uMax, vTop, 0, 0, uMax, vTop, 0, vTop);
    for (let k = 0; k < 6; k++) W.nor.push(nx, 0, nz);
  }
  const tris = THREE.ShapeUtils.triangulateShape(p.map(([x, z]) => new THREE.Vector2(x, z)), []);
  for (const [a, b, c] of tris) {
    const A = p[a], B = p[b], C = p[c];
    const cy = (B[1] - A[1]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[1] - A[1]);
    for (const q of cy >= 0 ? [A, B, C] : [A, C, B]) {
      R.pos.push(q[0], y1, q[1]); R.nor.push(0, 1, 0);
      R.uv.push(...(roofUV ? roofUV(q[0], q[1]) : [q[0] / 4, q[1] / 4]));
    }
  }
  return { W, R };
}

/** Geometría de un solo prisma (muros + cubierta) — la usa la iglesia. */
export function prismGeometry(pts, y0, y1, opts) {
  const { W, R } = prismArrays(pts, y0, y1, opts);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...W.pos, ...R.pos], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([...W.nor, ...R.nor], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([...W.uv, ...R.uv], 2));
  return g;
}

export class CityContext {
  constructor(scene, { renderer, data, project }) {
    this.scene = scene;
    this.renderer = renderer;
    this.data = data;
    this.project = project;
    this.group = new THREE.Group();
    this.group.name = 'CityContext';
    scene.add(this.group);
    this.theme = 'realista';
    this.mzByCode = new Map(data.manzanas.m.map((m) => [m.id, m]));
    this.studyArea = project.areaEstudio.lonlat.map(([lon, lat]) => toLocal(lon, lat));
    this.textures = makeFacadeTextures();
    this.orthoPlan = this._planOrtho();

    this._buildGround();
    this._buildManzanas();
    this._buildBuildings();
    this._buildLotes();
    this._buildStudyArea();
    this._buildPredios();
    this.setTheme('realista');
    this.stats = this._studyStats();
    this.ready = this._loadOrtho();
  }

  // ---------------------------------------------------------------- suelo + ortofoto
  _buildGround() {
    const g = new THREE.PlaneGeometry(9000, 9000);
    g.rotateX(-Math.PI / 2);
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x77756f, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(g, this.groundMat);
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    ground.name = 'Suelo';
    this.group.add(ground);
  }

  _planOrtho() {
    const z = 17, half = 980;
    const tx0 = Math.floor(tileX(LON0 - half / MLON, z)), tx1 = Math.floor(tileX(LON0 + half / MLON, z));
    const ty0 = Math.floor(tileY(LAT0 + half / MLAT, z)), ty1 = Math.floor(tileY(LAT0 - half / MLAT, z));
    const [x0, zN] = toLocal(tile2lon(tx0, z), tile2lat(ty0, z));
    const [x1, zS] = toLocal(tile2lon(tx1 + 1, z), tile2lat(ty1 + 1, z));
    return { z, tx0, ty0, nx: tx1 - tx0 + 1, ny: ty1 - ty0 + 1, x0, x1, zN, zS };
  }

  /** UV de la ortofoto para un punto local (las cubiertas usan la foto real de su techo). */
  orthoUV(x, z) {
    const o = this.orthoPlan;
    return [(x - o.x0) / (o.x1 - o.x0), 1 - (z - o.zN) / (o.zS - o.zN)];
  }

  async _loadOrtho() {
    const o = this.orthoPlan;
    const cv = document.createElement('canvas');
    cv.width = o.nx * 256; cv.height = o.ny * 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#8f8c85';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const jobs = [];
    for (let j = 0; j < o.ny; j++) for (let i = 0; i < o.nx; i++) jobs.push([i, j]);
    let ok = 0, k = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (k < jobs.length) {
        const [i, j] = jobs[k++];
        const img = await loadImg(`${IMG}${o.z}/${o.ty0 + j}/${o.tx0 + i}`);
        if (img) { ctx.drawImage(img, i * 256, j * 256); ok++; }
      }
    }));
    if (!ok) return; // sin ortofoto: quedan las manzanas como andén
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const g = new THREE.PlaneGeometry(o.x1 - o.x0, o.zS - o.zN);
    g.rotateX(-Math.PI / 2);
    g.translate((o.x0 + o.x1) / 2, 0, (o.zN + o.zS) / 2);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, color: 0xdedede }));
    mesh.position.y = -0.02;
    mesh.receiveShadow = true;
    mesh.name = 'Ortofoto';
    this.group.add(mesh);
    this.ortho = mesh;
    this.orthoTex = tex;
    this.setTheme(this.theme);
  }

  // ---------------------------------------------------------------- manzanas
  _buildManzanas() {
    const pos = [], nor = [], ranges = [];
    for (const m of this.data.manzanas.m) {
      if (m.pts.length < 3) continue;
      const { W, R } = prismArrays(m.pts, 0, BASE_Y);
      const start = pos.length / 3;
      pos.push(...W.pos, ...R.pos); nor.push(...W.nor, ...R.nor);
      ranges.push({ it: m, parts: [[start, pos.length / 3]] });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    this.mzRanges = ranges;
    this.manzanas = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    this.manzanas.receiveShadow = true;
    this.manzanas.name = 'Manzanas';
    this.group.add(this.manzanas);
  }

  // ---------------------------------------------------------------- construcciones
  _buildBuildings() {
    const all = this.data.construcciones.b;
    const churchParts = all.filter((b) => b.l === CHURCH_LOT);
    const area = (b) => Math.abs(signedArea(b.pts));
    const nave = churchParts.reduce((a, b) => (area(b) > area(a) ? b : a), churchParts[0]);
    const tower = churchParts.filter((b) => b !== nave).reduce((a, b) => (b.p > a.p ? b : a), churchParts[0]);
    const bs = all.filter((b) => b !== nave && b !== tower);
    if (nave && tower) this.church = new Church(this.group, { nave, tower, textures: this.textures });

    // un bloque de vértices por estilo de fachada + uno para cubiertas (grupos de material)
    const parts = [...STYLES, 'roof'].map(() => ({ pos: [], nor: [], uv: [] }));
    const recs = [];
    for (const b of bs) {
      const floors = Math.max(1, b.p);
      const h = Math.max(b.h, floors * 2.8);
      const r = hash(b.l + b.pts[0][0]);
      const style = floors >= 5 ? (r < 0.55 ? 2 : 1) : floors >= 3 ? (r < 0.55 ? 0 : r < 0.9 ? 1 : 2) : (r < 0.6 ? 0 : 1);
      const { W, R } = prismArrays(b.pts, BASE_Y, BASE_Y + h, { floorH: h / floors, roofUV: (x, z) => this.orthoUV(x, z) });
      const w = parts[style], rf = parts[3];
      const ws = w.pos.length / 3; w.pos.push(...W.pos); w.nor.push(...W.nor); w.uv.push(...W.uv);
      const rs = rf.pos.length / 3; rf.pos.push(...R.pos); rf.nor.push(...R.nor); rf.uv.push(...R.uv);
      recs.push({ b, h, style, w: [ws, w.pos.length / 3], r: [rs, rf.pos.length / 3], roofTint: ROOF_TINTS[Math.floor(r * 997) % ROOF_TINTS.length], wallTint: WALL_TINTS[style][Math.floor(r * 7919) % WALL_TINTS[style].length] });
    }
    const n = parts.reduce((s, pt) => s + pt.pos.length / 3, 0);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), g = new THREE.BufferGeometry();
    const offs = [];
    let at = 0;
    parts.forEach((pt, i) => {
      offs[i] = at;
      pos.set(pt.pos, at * 3); nor.set(pt.nor, at * 3); uv.set(pt.uv, at * 2);
      g.addGroup(at, pt.pos.length / 3, i);
      at += pt.pos.length / 3;
    });
    this.bRanges = recs.map((rc) => ({
      it: rc.b, h: rc.h, roofTint: rc.roofTint, wallTint: rc.wallTint,
      walls: [offs[rc.style] + rc.w[0], offs[rc.style] + rc.w[1]],
      roof: [offs[3] + rc.r[0], offs[3] + rc.r[1]]
    }));
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    this.wallMats = STYLES.map((s) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: s === 'concreto' ? 0.6 : 0.88, metalness: 0, envMapIntensity: 0.7 }));
    this.roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
    this.buildings = new THREE.Mesh(g, [...this.wallMats, this.roofMat]);
    this.buildings.castShadow = true;
    this.buildings.receiveShadow = true;
    this.buildings.name = 'Construcciones Catastro';
    this.group.add(this.buildings);

    // aristas de maqueta en el entorno inmediato (solo en el tema "Maqueta")
    const near = bs.filter((b) => Math.hypot(...centroid(b.pts)) < 230);
    const ep = [];
    for (const b of near) {
      const h = Math.max(b.h, Math.max(1, b.p) * 2.8) + BASE_Y;
      for (let i = 0; i < b.pts.length; i++) {
        const [ax, az] = b.pts[i], [bx, bz] = b.pts[(i + 1) % b.pts.length];
        ep.push(ax, h, az, bx, h, bz, ax, BASE_Y, az, ax, h, az);
      }
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
    this.edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x8c877d, transparent: true, opacity: 0.35 }));
    this.group.add(this.edges);
  }

  // ---------------------------------------------------------------- trama predial
  _buildLotes() {
    const pos = [];
    for (const l of this.data.lotes.l) {
      const p = l.pts;
      for (let i = 0; i < p.length; i++) {
        const q = p[(i + 1) % p.length];
        pos.push(p[i][0], 0.2, p[i][1], q[0], 0.2, q[1]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.lotes = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x7d776b, transparent: true, opacity: 0.45 }));
    this.lotes.name = 'Lotes Catastro';
    this.group.add(this.lotes);
  }

  // ---------------------------------------------------------------- área de estudio
  _buildStudyArea() {
    const p = this.studyArea, H = 22, W = 3.2;
    const g = new THREE.Group();
    g.name = 'Área de estudio';
    const rib = [], cur = [], alpha = [];
    for (let i = 0; i < p.length; i++) {
      const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length];
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), nx = (-dz / l) * W / 2, nz = (dx / l) * W / 2;
      rib.push(ax - nx, 0.45, az - nz, bx - nx, 0.45, bz - nz, bx + nx, 0.45, bz + nz, ax - nx, 0.45, az - nz, bx + nx, 0.45, bz + nz, ax + nx, 0.45, az + nz);
      cur.push(ax, 0.4, az, bx, 0.4, bz, bx, H, bz, ax, 0.4, az, bx, H, bz, ax, H, az);
      alpha.push(1, 1, 0, 1, 0, 0);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rib, 3));
    const ribbon = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x1e2a44, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cur, 3));
    cg.setAttribute('a', new THREE.Float32BufferAttribute(alpha, 1));
    const curtain = new THREE.Mesh(cg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { color: { value: new THREE.Color(0x2b4a86) } },
      vertexShader: 'attribute float a; varying float vA; void main(){ vA = a; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color, 0.42 * vA * vA); }'
    }));
    curtain.renderOrder = 2;
    g.add(ribbon, curtain);
    this.group.add(g);
    this.studyGroup = g;
  }

  // ---------------------------------------------------------------- predios evaluados 01 y 03
  _buildPredios() {
    this.prediosGroup = new THREE.Group();
    this.prediosGroup.name = 'Predios evaluados';
    for (const p of this.data.predios.p) {
      if (p.id === 'lote-02') continue; // el lote 02 lo ocupa el proyecto
      const shape = new THREE.Shape(p.pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: 9, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc8a46e, transparent: true, opacity: 0.38, depthWrite: false, roughness: 0.6 }));
      m.position.y = 0.2;
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x9a6f35 }));
      e.position.y = 0.2;
      this.prediosGroup.add(m, e);
    }
    this.group.add(this.prediosGroup);
  }

  // ---------------------------------------------------------------- temas y capas
  static legend(theme) {
    if (theme === 'usos') return Object.values(USOS);
    if (theme === 'valor') return VALOR_BINS;
    if (theme === 'altura') return ALTURA_BINS;
    return [];
  }

  _mzColor(mz) {
    if (!mz) return SIN_DATO;
    if (this.theme === 'usos') return USOS[mz.uso]?.color || SIN_DATO;
    if (this.theme === 'valor') return mz.vref ? VALOR_BINS.find((b) => mz.vref < b.max).color : SIN_DATO;
    if (this.theme === 'altura') return mz.alt ? ALTURA_BINS.find((b) => mz.alt <= b.max).color : SIN_DATO;
    return this.theme === 'realista' ? ANDEN : MAQUETA_MZ;
  }

  setTheme(theme) {
    this.theme = theme;
    const real = theme === 'realista';
    const tinted = ['usos', 'valor', 'altura'].includes(theme);
    STYLES.forEach((s, i) => { this.wallMats[i].map = real ? this.textures[s] : null; this.wallMats[i].needsUpdate = true; });
    this.roofMat.map = real && this.orthoTex ? this.orthoTex : null;
    this.roofMat.needsUpdate = true;
    this.manzanas.visible = !(real && this.ortho);
    this.edges.visible = theme === 'maqueta';

    const set = (col, [a, b], c) => { for (let v = a; v < b; v++) { col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b; } };
    const mc = this.manzanas.geometry.attributes.color, c = new THREE.Color();
    for (const r of this.mzRanges) set(mc.array, r.parts[0], c.set(this._mzColor(r.it)));
    mc.needsUpdate = true;

    const bc = this.buildings.geometry.attributes.color, base = new THREE.Color(MAQUETA_BLD), cool = new THREE.Color('#dfe3e8'), w = new THREE.Color(1, 1, 1);
    for (const r of this.bRanges) {
      if (real) {
        set(bc.array, r.walls, c.set(r.wallTint));
        set(bc.array, r.roof, this.orthoTex ? w : c.set(r.roofTint));
      } else if (tinted) {
        c.set(this._mzColor(this.mzByCode.get(r.it.l?.slice(0, 9)))).lerp(base, 0.35);
        set(bc.array, r.walls, c);
        set(bc.array, r.roof, c.multiplyScalar(0.92));
      } else {
        c.copy(base).lerp(cool, Math.min(1, r.h / 40)); // maqueta: blanco cálido que se enfría con la altura
        set(bc.array, r.walls, c);
        set(bc.array, r.roof, c.multiplyScalar(0.92));
      }
    }
    bc.needsUpdate = true;
  }

  setLayer(key, on) {
    if (key === 'estudio') this.studyGroup.visible = on;
    if (key === 'predios') this.prediosGroup.visible = on;
  }

  /** Estadísticas de las manzanas cuyo centroide cae dentro del área de estudio. */
  _studyStats() {
    const inside = this.data.manzanas.m.filter((m) => pointInPolygon(centroid(m.pts), this.studyArea));
    const usos = {};
    for (const m of inside) usos[m.uso || 'SIN DATO'] = (usos[m.uso || 'SIN DATO'] || 0) + 1;
    const v = inside.map((m) => m.vref).filter(Boolean).sort((a, b) => a - b);
    const a = inside.map((m) => m.alt).filter(Boolean);
    return {
      manzanas: inside.length,
      usos,
      vrefMediana: v.length ? v[Math.floor(v.length / 2)] : null,
      alturaMedia: a.length ? a.reduce((s, x) => s + x, 0) / a.length : null,
      manzanaLote: this.mzByCode.get(this.project.ubicacion.manzanaCatastral),
      construcciones: this.data.construcciones.b.length
    };
  }
}
