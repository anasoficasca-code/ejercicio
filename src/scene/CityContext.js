import * as THREE from 'three';
import { LON0, LAT0, MLON, MLAT, toLocal } from '../geo.js';
import { makeTreeImpostors, RealTrees } from './RealTrees.js';
import { load as loadPBR } from './PBRSurfaces.js';
import { makeFacadeTextures, makeTileTexture, BAY_W } from './FacadeTextures.js';
import { Church } from './Church.js';

/**
 * CityContext — contexto real de Galerías / Teusaquillo con la misma técnica del masterplan
 * Hotel La Fontana (suelo, relieve, fachadas y arbolado tomados de ese repositorio, con autorización):
 *  · Suelo en niveles de detalle: ortofoto real (Esri) lejos; cerca, césped / asfalto / adoquín
 *    fotogramétricos (Poly Haven) usando la ortofoto como máscara.
 *  · Relieve real (Terrarium DEM): los Cerros Orientales en el horizonte.
 *  · ~7.400 construcciones de Catastro Bogotá: cubierta con la propia ortofoto y fachada con la
 *    paleta bogotana (ladrillo, pañete, gris) y ventanas por piso, dibujadas en el shader.
 *  · Arbolado detectado en la ortofoto: árboles 3D cerca del proyecto, impostores lejos.
 *  · La iglesia frente al lote (Calle 56 con Carrera 18) reconstruida con nave, cubierta y torre.
 *  · Manzanas con uso, altura y valor del suelo (temas), trama predial, predios y área de estudio.
 */
const CHURCH_LOT = '007208001002';
const BASE_Y = 0.16;
const DX = 0, DZ = 0; // el origen ya es el lote; no hace falta alinear con un modelo Revit
const IMG = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
const FLAT_R0 = 420, FLAT_R1 = 950; // dentro de FLAT_R0 el suelo es plano (calles modeladas)

const tileX = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const tileY = (lat, z) => ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
const tile2lon = (x, z) => (x / 2 ** z) * 360 - 180;
const tile2lat = (y, z) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / 2 ** z));
const lx = (lon) => (lon - LON0) * MLON + DX;
const lz = (lat) => -(lat - LAT0) * MLAT + DZ;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function loadImg(url) {
  return new Promise((res) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.decoding = 'async';
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = url;
  });
}

async function pool(items, n, fn) {
  let k = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (k < items.length) { const it = items[k++]; await fn(it); } }));
}

/** Mosaico de teselas XYZ que cubre el cuadrado local [-half, half]² (más el desfase de alineación). */
function planMosaic(z, half) {
  const lonA = LON0 + (-half - DX) / MLON, lonB = LON0 + (half - DX) / MLON;
  const latN = LAT0 - (-half - DZ) / MLAT, latS = LAT0 - (half - DZ) / MLAT;
  const tx0 = Math.floor(tileX(lonA, z)), tx1 = Math.floor(tileX(lonB, z));
  const ty0 = Math.floor(tileY(latN, z)), ty1 = Math.floor(tileY(latS, z));
  const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
  return {
    z, tx0, ty0, nx, ny,
    x0: lx(tile2lon(tx0, z)), x1: lx(tile2lon(tx1 + 1, z)),
    zN: lz(tile2lat(ty0, z)), zS: lz(tile2lat(ty1 + 1, z))
  };
}

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
  constructor(scene, { renderer, data, project, mobile = false }) {
    this.scene = scene;
    this.renderer = renderer;
    this.mobile = mobile;
    this.data = data;
    this.project = project;
    this.group = new THREE.Group();
    this.group.name = 'CityContext';
    scene.add(this.group);
    this.h0 = 0;
    this.dem = null;
    this.levels = [];
    this.theme = 'realista';
    this.mzByCode = new Map(data.manzanas.m.map((m) => [m.id, m]));
    this.studyArea = project.areaEstudio.lonlat.map(([lon, lat]) => toLocal(lon, lat));
    this.textures = makeFacadeTextures();

    // la iglesia sale del lote catastral vecino: nave (la construcción más grande) y torre (la de más pisos)
    const all = data.construcciones.b;
    const parts = all.filter((b) => b.l === CHURCH_LOT);
    const area = (b) => Math.abs(signedArea(b.pts));
    const nave = parts.length ? parts.reduce((a, b) => (area(b) > area(a) ? b : a)) : null;
    const tower = parts.filter((b) => b !== nave).reduce((a, b) => (!a || b.p > a.p ? b : a), null);
    if (nave && tower) this.church = new Church(this.group, { nave, tower, textures: this.textures });
    this.buildingList = all.filter((b) => b !== nave && b !== tower);

    this._buildManzanas();
    this._buildLotes();
    this._buildStudyArea();
    this._buildPredios();
    this.stats = this._studyStats();
    this.ready = this._init();
  }

  /** Altura del terreno (m, relativa al lote) en coordenadas locales. */
  heightAt(x, z) {
    const r = Math.hypot(x, z);
    if (!this.dem || r < FLAT_R0) return 0;
    return smooth(FLAT_R0, FLAT_R1, r) * Math.max(-40, this._demSample(x, z) - this.h0);
  }

  _demSample(x, z) {
    const d = this.dem;
    const u = ((x - d.x0) / (d.x1 - d.x0)) * (d.w - 1), v = ((z - d.zN) / (d.zS - d.zN)) * (d.h - 1);
    const i = Math.max(0, Math.min(d.w - 2, Math.floor(u))), j = Math.max(0, Math.min(d.h - 2, Math.floor(v)));
    const fu = Math.min(1, Math.max(0, u - i)), fv = Math.min(1, Math.max(0, v - j));
    const a = d.data[j * d.w + i], b = d.data[j * d.w + i + 1], c = d.data[(j + 1) * d.w + i], e = d.data[(j + 1) * d.w + i + 1];
    return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + e * fu) * fv;
  }

  async _loadDEM() {
    const m = planMosaic(11, 26000);
    const cv = document.createElement('canvas');
    cv.width = m.nx * 256; cv.height = m.ny * 256;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const jobs = [];
    for (let j = 0; j < m.ny; j++) for (let i = 0; i < m.nx; i++) jobs.push([i, j]);
    await pool(jobs, 8, async ([i, j]) => {
      const img = await loadImg(`${DEM}${m.z}/${m.tx0 + i}/${m.ty0 + j}.png`);
      if (img) ctx.drawImage(img, i * 256, j * 256);
    });
    const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const data = new Float32Array(cv.width * cv.height);
    for (let k = 0; k < data.length; k++) data[k] = px[k * 4] * 256 + px[k * 4 + 1] + px[k * 4 + 2] / 256 - 32768;
    this.dem = { ...m, w: cv.width, h: cv.height, data };
    this.h0 = this._demSample(0, 0);
  }

  _makeLevel(z, half, segs, y, opts = {}) {
    const m = planMosaic(z, half);
    const cv = document.createElement('canvas');
    cv.width = m.nx * 256; cv.height = m.ny * 256;
    const ctx = cv.getContext('2d', { willReadFrequently: !!opts.keepPixels });
    ctx.fillStyle = '#6f6c62';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy()) : 4;

    const w = m.x1 - m.x0, d = m.zS - m.zN;
    const geo = new THREE.PlaneGeometry(w, d, segs, segs);
    geo.rotateX(-Math.PI / 2);
    geo.translate((m.x0 + m.x1) / 2, 0, (m.zN + m.zS) / 2);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.94, metalness: 0, color: 0xffffff, envMapIntensity: 0.25 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.receiveShadow = !!opts.shadow;
    mesh.renderOrder = -0.5;
    this.group.add(mesh);
    const level = { ...m, half, canvas: cv, ctx, tex, mesh, geo, y };
    this.levels.push(level);
    return level;
  }

  /** Nivel lejano: ortofoto real (contexto urbano y montaña), con un recorte donde está el nivel cercano. */
  _photoMat(level, H) {
    const mat = level.mesh.material;
    mat.map = level.tex; mat.color.setHex(0xe4e4e4); mat.roughness = 1;
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vCtxW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCtxW = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vCtxW;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nif (abs(vCtxW.x - ${H.cx.toFixed(2)}) < ${H.hx.toFixed(2)} && abs(vCtxW.y - ${H.cz.toFixed(2)}) < ${H.hz.toFixed(2)}) discard;`);
    };
    mat.customProgramCacheKey = () => `ctxhole_${H.cx.toFixed(1)}_${H.cz.toFixed(1)}_${H.hx.toFixed(1)}_${H.hz.toFixed(1)}`;
    mat.needsUpdate = true;
  }

  /**
   * Suelo realista: césped / asfalto / concreto PBR a escala real. La ortofoto se lee muy desenfocada
   * solo como máscara (verde → césped; gris oscuro → asfalto; gris claro → concreto), así el trazado de
   * parques y calles de Bogotá es el real pero no se ve ninguna foto pixelada.
   */
  _groundMat(level, H) {
    if (!CityContext._gtex) {
      CityContext._gtex = { g: loadPBR('leafy_grass', 'diff', true), a: loadPBR('asphalt_02', 'diff', true), c: loadPBR('concrete_pavement', 'diff', true) };
    }
    const T = CityContext._gtex;
    const mat = level.mesh.material;
    const uni = {
      tSat: { value: level.tex }, uSatB: { value: new THREE.Vector4(level.x0, level.zN, level.x1 - level.x0, level.zS - level.zN) },
      tGrass: { value: T.g }, tAsph: { value: T.a }, tConc: { value: T.c }
    };
    const holeGLSL = H ? `if (abs(vGW.x - ${H.cx.toFixed(2)}) < ${H.hx.toFixed(2)} && abs(vGW.z - ${H.cz.toFixed(2)}) < ${H.hz.toFixed(2)}) discard;` : '';
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vGW;
        uniform sampler2D tSat, tGrass, tAsph, tConc; uniform vec4 uSatB;`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${holeGLSL}`)
        .replace('#include <map_fragment>', `
          vec2 w = vGW.xz;
          vec2 st = (w - uSatB.xy) / uSatB.zw; st.y = 1.0 - st.y;
          vec3 s = texture2D(tSat, st, 0.6).rgb;               // calco del trazado real (sin desenfoque)
          float gr = (s.g - max(s.r, s.b)) / max(s.g, 0.015);
          float veg = smoothstep(0.09, 0.15, gr);
          float lum = dot(s, vec3(0.3, 0.59, 0.11));
          float dist = length(vGW - cameraPosition);
          float far = smoothstep(260.0, 1400.0, dist);
          mat2 R = mat2(0.7986, -0.6018, 0.6018, 0.7986);
          // promedios (último nivel de mipmap) para la lejanía: sin repetición ni moiré
          vec3 gAvg = texture2D(tGrass, vec2(0.5), 14.0).rgb, aAvg = texture2D(tAsph, vec2(0.5), 14.0).rgb, cAvg = texture2D(tConc, vec2(0.5), 14.0).rgb;
          vec3 grass = gAvg, asph = aAvg, conc = cAvg;
          if (far < 0.999) {
            float mx = smoothstep(0.35, 0.65, texture2D(tGrass, w / 61.0).g / max(gAvg.g * 2.0, 0.01));
            grass = mix(texture2D(tGrass, w / 2.4).rgb, texture2D(tGrass, R * w / 3.7 + 0.31).rgb, mx);
            grass *= mix(0.82, 1.12, texture2D(tConc, R * w / 83.0).r / max(cAvg.r * 2.0, 0.01));
            asph = mix(texture2D(tAsph, w / 4.5).rgb, texture2D(tAsph, R * w / 6.9 + 0.5).rgb, 0.5);
            conc = mix(texture2D(tConc, w / 2.2).rgb, texture2D(tConc, R * w / 2.9 + 0.4).rgb, 0.0);
            grass = mix(grass, gAvg, far); asph = mix(asph, aAvg, far); conc = mix(conc, cAvg, far);
          }
          // el parque se tiñe levemente con el verde real (zonas secas / sombreadas)
          // césped uniforme (sin manchas de la foto)
          // todo lo que no es zona verde es adoquín (en espiga); el asfalto de las vías ya está modelado
          // adoquín gris de concreto (espiga) para andenes, plazoletas y patios; asfalto donde la foto es oscura
          conc = mix(vec3(dot(conc, vec3(0.3, 0.59, 0.11))), conc, 0.22) * 1.15;
          vec3 paved = mix(asph, conc, smoothstep(0.055, 0.085, lum));
          vec3 ground = mix(paved, grass, veg);
          // borde exterior: se funde con la ortofoto del nivel lejano (sin costura)
          vec2 eb = min(st, 1.0 - st) * uSatB.zw;
          float edge = 1.0 - smoothstep(20.0, 180.0, min(eb.x, eb.y));
          ground = mix(ground, texture2D(tSat, st).rgb * 0.9, edge);
          diffuseColor.rgb *= ground;
        `);
    };
    mat.customProgramCacheKey = () => `ground_${H ? `${H.cx.toFixed(1)}_${H.cz.toFixed(1)}_${H.hx.toFixed(1)}` : 'full'}`;
    mat.needsUpdate = true;
  }

  _applyHeights(level) {
    const pos = level.geo.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setY(k, this.heightAt(pos.getX(k), pos.getZ(k)));
    pos.needsUpdate = true;
    level.geo.computeVertexNormals();
    level.geo.computeBoundingSphere();
  }

  async _fillLevel(level) {
    const jobs = [];
    const c = [(level.nx - 1) / 2, (level.ny - 1) / 2];
    for (let j = 0; j < level.ny; j++) for (let i = 0; i < level.nx; i++) jobs.push([i, j]);
    jobs.sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1]));
    let n = 0;
    await pool(jobs, 10, async ([i, j]) => {
      const img = await loadImg(`${IMG}${level.z}/${level.ty0 + j}/${level.tx0 + i}`);
      if (img) level.ctx.drawImage(img, i * 256, j * 256);
      if (++n % 12 === 0) level.tex.needsUpdate = true;
    });
    level.tex.needsUpdate = true;
  }

  async _init() {
    const mob = this.mobile;
    // niveles de detalle (del más lejano al más cercano), cada uno un poco más abajo para evitar z-fighting
    const L3 = this._makeLevel(12, 22000, mob ? 96 : 160, -3.0);
    const L2 = this._makeLevel(15, mob ? 2400 : 3200, mob ? 96 : 140, -1.2);
    const L1 = this._makeLevel(mob ? 17 : 18, mob ? 650 : 900, 90, -0.45, { keepPixels: true, shadow: true });
    const L0 = mob ? null : this._makeLevel(19, 340, 40, -0.16, { shadow: true });
    const hole = (L) => ({ cx: (L.x0 + L.x1) / 2, cz: (L.zN + L.zS) / 2, hx: (L.x1 - L.x0) / 2 - 1, hz: (L.zS - L.zN) / 2 - 1 });
    this._photoMat(L3, hole(L2)); this._photoMat(L2, hole(L1));
    this._groundMat(L1, L0 ? hole(L0) : null); if (L0) this._groundMat(L0, null);
    const far3 = this._fillLevel(L3);
    const near = Promise.all([L0 && this._fillLevel(L0), this._fillLevel(L1)]);
    const far2 = near.then(() => this._fillLevel(L2));
    try { await this._loadDEM(); } catch (e) { console.warn('DEM no disponible', e); }
    [L3, L2, L1, L0].forEach((L) => L && this._applyHeights(L));
    this._buildBuildings(this.buildingList, L0 || L1, L1, L2);
    this.setTheme(this.theme);
    await near;
    try { this._buildTileRoofs(L1); } catch (e) { console.warn('cubiertas de teja', e); }
    try { this._buildTrees(L1); } catch (e) { console.warn('árboles satelitales', e); }
    await Promise.all([far2, far3]);
    this.levels.forEach((L) => { L.ctx = null; });
  }

  _buildBuildings(list, A, B, C) {
    const pos = [], nor = [], uv = [], cen = [], seed = [];
    this.bRanges = [];
    for (const r of list) {
      const h = Math.max(r.h, Math.max(1, r.p) * 2.8);
      const pts = r.pts.map((p) => [p[0], p[1]]);
      const start = pos.length / 3;
      // orientación antihoraria vista desde arriba (en XZ con Z al sur)
      let ar = 0;
      for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; ar += p[0] * q[1] - q[0] * p[1]; }
      if (ar > 0) pts.reverse();
      let cx = 0, cz = 0; pts.forEach((p) => { cx += p[0]; cz += p[1]; }); cx /= pts.length; cz /= pts.length;
      const g = this.heightAt(cx, cz);
      const y0 = g - 1.5, y1 = g + h;
      // muros
      let per = 0;
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k], q = pts[(k + 1) % pts.length];
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (L < 0.05) continue;
        const nx = (q[1] - p[1]) / L, nz = -(q[0] - p[0]) / L;
        const quad = [[p, y0, per], [q, y0, per + L], [q, y1, per + L], [p, y0, per], [q, y1, per + L], [p, y1, per]];
        for (const [pp, yy, uu] of quad) {
          pos.push(pp[0], yy, pp[1]); nor.push(nx, 0, nz); uv.push(uu, yy - g); cen.push(cx, cz);
        }
        per += L;
      }
      // cubierta plana
      try {
        const contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
        const tris = THREE.ShapeUtils.triangulateShape(contour, []);
        for (const t of tris) {
          for (const idx of [t[0], t[2], t[1]]) {
            const p = pts[idx];
            pos.push(p[0], y1, p[1]); nor.push(0, 1, 0); uv.push(-1, -1); cen.push(cx, cz);
          }
        }
      } catch (e) { /* polígono degenerado */ }
      const sd = r.l === CHURCH_LOT ? 0.7 : hash(`${r.l}${r.pts[0][0]}`); // semilla estable (paleta, ventanas); el convento va en crema
      for (let k = start; k < pos.length / 3; k++) seed.push(sd);
      this.bRanges.push({ it: r, h, start, end: pos.length / 3 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aCenter', new THREE.Float32BufferAttribute(cen, 2));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
    geo.computeBoundingSphere();

    const bounds = (L) => new THREE.Vector4(L.x0, L.zN, L.x1 - L.x0, L.zS - L.zN);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0, envMapIntensity: 0.5, vertexColors: true });
    const uni = {
      tSatA: { value: A.tex }, uSatA: { value: bounds(A) },
      tSatB: { value: B.tex }, uSatB: { value: bounds(B) },
      tSatC: { value: C.tex }, uSatC: { value: bounds(C) },
      uFlat: { value: 0 } // 1 = temas de color (maqueta, usos, valor, altura): solo el color por vértice
    };
    this.bUniforms = uni;
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uni);
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aCenter;\nattribute float aSeed;\nvarying vec2 vCen;\nvarying vec3 vCW;\nvarying vec2 vFac;\nvarying float vUp;\nvarying float vSeed;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCen = aCenter;\nvSeed = aSeed;\nvFac = uv;\nvUp = normal.y;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec2 vCen; varying vec3 vCW; varying vec2 vFac; varying float vUp; varying float vSeed;
          uniform sampler2D tSatA, tSatB, tSatC; uniform vec4 uSatA, uSatB, uSatC; uniform float uFlat;
          float hsh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
          vec2 satUV(vec4 b, vec2 w){ vec2 t = (w - b.xy) / b.zw; return vec2(t.x, 1.0 - t.y); }
          bool inside(vec2 t){ return t.x > 0.002 && t.x < 0.998 && t.y > 0.002 && t.y < 0.998; }
          vec3 sat(vec2 w, float bias){
            vec2 a = satUV(uSatA, w); if (inside(a)) return texture2D(tSatA, a, bias).rgb;
            vec2 b = satUV(uSatB, w); if (inside(b)) return texture2D(tSatB, b, bias).rgb;
            return texture2D(tSatC, satUV(uSatC, w), bias).rgb;
          }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          float rnd = vSeed;
          float facRough = 0.0;
          if (uFlat > 0.5) {
            // tema plano: el color lo pone el atributo de vértice
          } else if (vUp > 0.5) {
            // cubierta: la propia ortofoto (con el relieve de la foto) + un toque de contraste
            vec3 c = sat(vCW.xz, 0.0);
            diffuseColor.rgb *= pow(c, vec3(1.08)) * 1.08;
          } else {
            // fachada: paleta bogotana (ladrillo, pañete crema, gris) teñida con el color de su cubierta
            vec3 roofC = sat(vCen, 4.0);
            vec3 brick = vec3(0.56, 0.27, 0.17), cream = vec3(0.80, 0.76, 0.68), grey = vec3(0.66, 0.66, 0.65);
            vec3 base = rnd < 0.55 ? brick : (rnd < 0.82 ? cream : grey);
            base = mix(base, roofC * 0.9, 0.25) * (0.85 + 0.3 * fract(vSeed * 13.17 + 0.37));
            float fh = 2.75 + 0.35 * fract(vSeed * 29.31 + 0.71), cw = 2.6 + 1.2 * fract(vSeed * 47.73 + 0.13);
            float fy = fract(vFac.y / fh), fx = fract(vFac.x / cw);
            vec2 fw = fwidth(vFac);
            float aa = smoothstep(0.18, 0.5, max(fw.x / cw, fw.y / fh)); // a distancia: color medio (sin moiré)
            float win = step(0.25, fx) * step(fx, 0.75) * step(0.36, fy) * step(fy, 0.82) * step(1.2, vFac.y);
            float lit = step(0.95, hsh(floor(vec2(vFac.x / cw, vFac.y / fh)) + vec2(vSeed * 91.7, vSeed * 17.3)));
            vec3 glass = mix(vec3(0.06, 0.075, 0.09), vec3(0.24, 0.27, 0.3), 0.3 * hsh(floor(vec2(vFac.x / cw, vFac.y / fh)) + vec2(vSeed * 91.7, vSeed * 17.3))) + lit * vec3(0.08, 0.07, 0.04);
            float band = step(fract(vFac.y / fh), 0.06) * 0.25;
            diffuseColor.rgb = mix(mix(base * (1.0 - band), glass, win), mix(base, vec3(0.16, 0.18, 0.2), 0.2), aa);
            facRough = mix(win, 0.25, aa);
          }`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.18, facRough);');
    };
    this.buildings = new THREE.Mesh(geo, mat);
    this.buildings.castShadow = true;
    this.buildings.receiveShadow = true;
    this.group.add(this.buildings);
  }

  /**
   * Cubiertas de teja: en Galerías / Teusaquillo las casas de 1 a 3 pisos tienen techo de barro a dos o
   * cuatro aguas. Donde la ortofoto muestra teja (rojizo / naranja) sobre una casa baja y rectangular,
   * se le pone una cubierta inclinada con textura de teja. Sin ortofoto no se agrega nada.
   */
  _buildTileRoofs(L) {
    if (!L.ctx) return;
    const W = L.canvas.width, H = L.canvas.height;
    const px = L.ctx.getImageData(0, 0, W, H).data;
    const sample = (x, z) => {
      const u = Math.floor(((x - L.x0) / (L.x1 - L.x0)) * W), v = Math.floor(((z - L.zN) / (L.zS - L.zN)) * H);
      let r = 0, g = 0, b = 0, n = 0;
      for (let dv = -2; dv <= 2; dv++) for (let du = -2; du <= 2; du++) {
        const uu = u + du, vv = v + dv;
        if (uu < 0 || vv < 0 || uu >= W || vv >= H) continue;
        const i = (vv * W + uu) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      }
      return n ? [r / n, g / n, b / n] : null;
    };
    const pos = [], uv = [], col = [];
    const c = new THREE.Color();
    for (const rg of this.bRanges || []) {
      const b = rg.it;
      if (b.p > 3 || b.l === CHURCH_LOT) continue;
      const [cx, cz] = centroid(b.pts);
      if (Math.hypot(cx, cz) > 650 || Math.hypot(cx, cz) < 14) continue;
      const o = obb(b.pts), ar = Math.abs(signedArea(b.pts));
      if (ar < 35 || ar > 420 || ar / (o.l * o.w) < 0.72) continue;
      const s = sample(cx, cz);
      if (!s) continue;
      const [r, g, bl] = s;
      if (!(r > 90 && r > g * 1.16 && r > bl * 1.35)) continue; // teja de barro en la foto
      const y = this.heightAt(cx, cz) + rg.h, rh = Math.min(3.2, o.w * 0.32);
      const hx = o.l / 2 + 0.35, hz = o.w / 2 + 0.35, ridge = Math.max(0, hx - hz * 0.9);
      const ux = Math.cos(o.angle), uz = Math.sin(o.angle), vx = -uz, vz = ux;
      const P = (a, bb, yy) => [o.cx + a * ux + bb * vx, yy, o.cz + a * uz + bb * vz];
      const e = [P(-hx, -hz, y), P(hx, -hz, y), P(hx, hz, y), P(-hx, hz, y)], t0 = P(-ridge, 0, y + rh), t1 = P(ridge, 0, y + rh);
      const faces = [[e[0], e[1], t1, t0], [e[2], e[3], t0, t1], [e[1], e[2], t1], [e[3], e[0], t0]]; // cuatro aguas
      c.setRGB(r / 255, g / 255, bl / 255, THREE.SRGBColorSpace).multiplyScalar(1.35).lerp(new THREE.Color(0.92, 0.86, 0.8), 0.45); // tono de la foto sobre la textura de teja
      for (const f of faces) {
        const tris = f.length === 4 ? [[f[0], f[1], f[2]], [f[0], f[2], f[3]]] : [f];
        for (const tri of tris) for (const q of tri) { pos.push(...q); uv.push((q[0] + q[2]) / 3.2, q[1] / 1.6); col.push(c.r, c.g, c.b); }
      }
    }
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const tex = makeTileTexture();
    this.tileRoofs = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
    this.tileRoofs.castShadow = !this.mobile;
    this.tileRoofs.receiveShadow = true;
    this.tileRoofs.name = 'Cubiertas de teja';
    this.tileRoofs.visible = this.theme === 'realista';
    this.group.add(this.tileRoofs);
  }

  /** Árboles a partir de la ortofoto: píxeles verdes, oscuros y con textura (copas, no césped). */




  /** Árboles a partir de la ortofoto: manchas verdes, oscuras y con textura (copas, no césped). */
  _buildTrees(L) {
    if (!L.ctx) return;
    const W = L.canvas.width, H = L.canvas.height;
    const px = L.ctx.getImageData(0, 0, W, H).data;
    const mpp = (L.x1 - L.x0) / W;
    // Menos ejemplares y mayor separación: el fondo conserva la lectura del barrio y no
    // compite con los árboles 3D detallados junto al hotel.
    const step = this.mobile ? 12 : 9.5;
    const max = this.mobile ? 850 : 3200;
    const greenAt = (u, v) => {
      if (u < 0 || v < 0 || u >= W || v >= H) return false;
      const i = (v * W + u) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
      return g - r > 9 && g - b > 12 && g > 24 && g < 165;
    };
    const lum = (i) => 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
    const rand = (x, z, seed = 0) => {
      const v = Math.sin(x * 12.9898 + z * 78.233 + seed * 37.719) * 43758.5453;
      return v - Math.floor(v);
    };
    const pts = [], near = [];
    for (let z = L.zN + 5; z < L.zS - 5; z += step) {
      for (let x = L.x0 + 5; x < L.x1 - 5; x += step) {
        const jx = x + (rand(x, z, 1) - 0.5) * step * 0.55;
        const jz = z + (rand(x, z, 2) - 0.5) * step * 0.55;
        const dc = Math.hypot(jx, jz);
        if (dc < 22) continue; // el lote del proyecto y su esquina quedan despejados
        const u = Math.floor((jx - L.x0) / mpp), v = Math.floor((jz - L.zN) / mpp);
        if (u < 5 || v < 5 || u >= W - 5 || v >= H - 5) continue;

        // Aceptar manchas vegetales, no píxeles verdes aislados de cubiertas o señalización.
        let greenNeighbors = 0;
        for (let dv = -4; dv <= 4; dv += 2) {
          for (let du = -4; du <= 4; du += 2) {
            if (greenAt(u + du, v + dv)) greenNeighbors++;
          }
        }
        if (greenNeighbors < 7) continue;
        const i = (v * W + u) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
        let s = 0, s2 = 0, n = 0;
        for (let dv = -3; dv <= 3; dv += 2) for (let du = -3; du <= 3; du += 2) {
          const value = lum(((v + dv) * W + u + du) * 4);
          s += value; s2 += value * value; n++;
        }
        const sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
        if (sd < 7) continue;
        if (dc < 245) { near.push([jx, this.heightAt(jx, jz), jz]); continue; } // cerca: árbol 3D
        pts.push([jx, jz, r, g, b, rand(x, z, 3), rand(x, z, 4), rand(x, z, 5)]);
        if (pts.length >= max) break;
      }
      if (pts.length >= max) break;
    }
    if (near.length) {
      this.nearTrees = new THREE.Group();
      this.nearTrees.name = 'Arbolado cercano';
      new RealTrees().plant(near, this.nearTrees, { mix: ['ash', 'ash', 'celtis', 'euc', 'pine'], variants: 2, shadows: !this.mobile });
      this.group.add(this.nearTrees);
    }
    if (!pts.length) return;

    // Arboleda de la ciudad: la imagen real del fresno (SKPTrees) girada siempre hacia la cámara,
    // teñida suavemente con el color de la ortofoto (2 triángulos por árbol).
    const crowns = makeTreeImpostors(pts.length);
    const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(), position = new THREE.Vector3(), color = new THREE.Color();
    const white = new THREE.Color(1, 1, 1);
    pts.forEach(([x, z, r, g, b, variation, widthVariation, hueVariation], k) => {
      const groundY = this.heightAt(x, z);
      const h = 6.5 + variation * 6 + widthVariation * 2;
      matrix.compose(position.set(x, groundY - 0.1, z), rotation, scale.set(h * (0.9 + hueVariation * 0.3), h, 1));
      crowns.setMatrixAt(k, matrix);
      color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace).multiplyScalar(2.2);
      crowns.setColorAt(k, white.clone().lerp(color, 0.3));
    });
    crowns.castShadow = false;
    crowns.receiveShadow = false;
    this.group.add(crowns);
    this.trees = crowns;
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
      if (p.id === 'lote-02' || p.id === 'englobe') continue; // el lote del proyecto lo ocupa el edificio
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
    return MAQUETA_MZ;
  }

  setTheme(theme) {
    this.theme = theme;
    const real = theme === 'realista';
    const tinted = ['usos', 'valor', 'altura'].includes(theme);
    this.manzanas.visible = !real; // en "Realista" el suelo es la ortofoto con texturas reales
    const set = (col, [a, b], c) => { for (let v = a; v < b; v++) { col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b; } };
    const mc = this.manzanas.geometry.attributes.color, c = new THREE.Color();
    for (const r of this.mzRanges) set(mc.array, r.parts[0], c.set(this._mzColor(r.it)));
    mc.needsUpdate = true;
    if (!this.bRanges) return; // las construcciones llegan cuando termina de cargar el relieve

    this.bUniforms.uFlat.value = real ? 0 : 1;
    if (this.tileRoofs) this.tileRoofs.visible = real;
    const bc = this.buildings.geometry.attributes.color, base = new THREE.Color(MAQUETA_BLD), cool = new THREE.Color('#dfe3e8'), w = new THREE.Color(1, 1, 1);
    for (const r of this.bRanges) {
      if (real) c.copy(w);
      else if (tinted) c.set(this._mzColor(this.mzByCode.get(r.it.l?.slice(0, 9)))).lerp(base, 0.35);
      else c.copy(base).lerp(cool, Math.min(1, r.h / 40)); // maqueta: blanco cálido que se enfría con la altura
      set(bc.array, [r.start, r.end], c);
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
