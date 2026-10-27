import * as THREE from 'three';
import { LON0, LAT0, MLON, MLAT, toLocal } from '../geo.js';

/**
 * CityContext — contexto urbano real de Galerías / Teusaquillo a partir de Catastro Bogotá:
 *  · ~7.400 construcciones (huella + número de pisos + altura) extruidas en una sola malla.
 *  · Manzanas con uso predominante, altura media y valor de referencia del suelo (temas de color).
 *  · Lotes catastrales alrededor del proyecto (trama predial) y los predios evaluados 01 y 03.
 *  · Ortofoto real (Esri World Imagery) en el suelo; si no carga, queda un suelo neutro.
 *  · Área de estudio (Calles 53–60 · Carreras 14–24) como cinta y cortina translúcida.
 */
const IMG = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/';

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

/**
 * Extruye muchos polígonos en una sola geometría (muros + cubierta) con color por vértice.
 * Devuelve la geometría y, por polígono, el rango de vértices para recolorear sin reconstruir.
 */
function extrudeMany(items, getH, getY0 = () => 0) {
  const pos = [], nor = [], ranges = [];
  for (const it of items) {
    let p = it.pts;
    if (p.length < 3) continue;
    if (signedArea(p) > 0) p = [...p].reverse(); // horario en (x, z) → normal exterior = (−dz, dx)
    const h = getH(it), y0 = getY0(it), y1 = y0 + h;
    const start = pos.length / 3;
    for (let i = 0; i < p.length; i++) {
      const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length];
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l, nz = dx / l;
      pos.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y0, az, bx, y1, bz, ax, y1, az);
      for (let k = 0; k < 6; k++) nor.push(nx, 0, nz);
    }
    const wallEnd = pos.length / 3;
    const tris = THREE.ShapeUtils.triangulateShape(p.map(([x, z]) => new THREE.Vector2(x, z)), []);
    for (const [a, b, c] of tris) {
      const A = p[a], B = p[b], C = p[c];
      const cy = (B[1] - A[1]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[1] - A[1]);
      const order = cy >= 0 ? [A, B, C] : [A, C, B];
      for (const q of order) { pos.push(q[0], y1, q[1]); nor.push(0, 1, 0); }
    }
    ranges.push({ it, start, wallEnd, end: pos.length / 3, h });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  return { geometry: g, ranges };
}

function paint(geometry, ranges, colorOf, roofShade = 0.92) {
  const col = geometry.attributes.color.array, c = new THREE.Color(), r = new THREE.Color();
  for (const rg of ranges) {
    c.set(colorOf(rg.it, rg.h));
    r.copy(c).multiplyScalar(roofShade);
    for (let v = rg.start; v < rg.end; v++) {
      const s = v < rg.wallEnd ? c : r;
      col[v * 3] = s.r; col[v * 3 + 1] = s.g; col[v * 3 + 2] = s.b;
    }
  }
  geometry.attributes.color.needsUpdate = true;
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
    this.theme = 'maqueta';
    this.mzByCode = new Map(data.manzanas.m.map((m) => [m.id, m]));
    this.studyArea = project.areaEstudio.lonlat.map(([lon, lat]) => toLocal(lon, lat));

    this._buildGround();
    this._buildManzanas();
    this._buildBuildings();
    this._buildLotes();
    this._buildStudyArea();
    this._buildPredios();
    this.setTheme('maqueta');
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

  async _loadOrtho() {
    const z = 17, half = 980;
    const lonA = LON0 - half / MLON, lonB = LON0 + half / MLON, latN = LAT0 + half / MLAT, latS = LAT0 - half / MLAT;
    const tx0 = Math.floor(tileX(lonA, z)), tx1 = Math.floor(tileX(lonB, z));
    const ty0 = Math.floor(tileY(latN, z)), ty1 = Math.floor(tileY(latS, z));
    const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
    const cv = document.createElement('canvas');
    cv.width = nx * 256; cv.height = ny * 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#8f8c85';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const jobs = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) jobs.push([i, j]);
    let ok = 0, k = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (k < jobs.length) {
        const [i, j] = jobs[k++];
        const img = await loadImg(`${IMG}${z}/${ty0 + j}/${tx0 + i}`);
        if (img) { ctx.drawImage(img, i * 256, j * 256); ok++; }
      }
    }));
    if (!ok) return; // sin ortofoto: el suelo neutro se queda
    const [x0, zN] = toLocal(tile2lon(tx0, z), tile2lat(ty0, z));
    const [x1, zS] = toLocal(tile2lon(tx1 + 1, z), tile2lat(ty1 + 1, z));
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const g = new THREE.PlaneGeometry(x1 - x0, zS - zN);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (zN + zS) / 2);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, color: 0xdedede }));
    mesh.position.y = -0.02;
    mesh.receiveShadow = true;
    mesh.name = 'Ortofoto';
    this.group.add(mesh);
    this.ortho = mesh;
  }

  // ---------------------------------------------------------------- manzanas
  _buildManzanas() {
    const { geometry, ranges } = extrudeMany(this.data.manzanas.m, () => 0.16);
    this.mzRanges = ranges;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.manzanas = new THREE.Mesh(geometry, mat);
    this.manzanas.receiveShadow = true;
    this.manzanas.name = 'Manzanas';
    this.group.add(this.manzanas);
  }

  // ---------------------------------------------------------------- construcciones
  _buildBuildings() {
    const bs = this.data.construcciones.b;
    const { geometry, ranges } = extrudeMany(bs, (b) => b.h, () => 0.16);
    this.bRanges = ranges;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
    this.buildings = new THREE.Mesh(geometry, mat);
    this.buildings.castShadow = true;
    this.buildings.receiveShadow = true;
    this.buildings.name = 'Construcciones Catastro';
    this.group.add(this.buildings);

    // Aristas de maqueta solo en el entorno inmediato (las lejanas saturan la imagen).
    const near = bs.filter((b) => Math.hypot(...centroid(b.pts)) < 230);
    const { geometry: ng } = extrudeMany(near, (b) => b.h, () => 0.16);
    const edges = new THREE.EdgesGeometry(ng, 30);
    this.edges = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x8c877d, transparent: true, opacity: 0.35 }));
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
      if (p.id === 'lote-02') continue; // el lote 02 lo dibuja el proyecto
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
    const sat = theme === 'satelite';
    const tinted = ['usos', 'valor', 'altura'].includes(theme);
    this.manzanas.visible = !sat;
    paint(this.manzanas.geometry, this.mzRanges, (m) => this._mzColor(m), 1);
    const mix = new THREE.Color(), base = new THREE.Color(MAQUETA_BLD);
    paint(this.buildings.geometry, this.bRanges, (b, h) => {
      if (tinted) return mix.set(this._mzColor(this.mzByCode.get(b.l?.slice(0, 9)))).lerp(base, 0.35).getHex();
      // maqueta: blanco cálido que se enfría apenas con la altura
      return mix.copy(base).lerp(new THREE.Color('#dfe3e8'), Math.min(1, h / 40)).getHex();
    });
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
    const lotMz = this.mzByCode.get(this.project.ubicacion.manzanaCatastral);
    return {
      manzanas: inside.length,
      usos,
      vrefMediana: v.length ? v[Math.floor(v.length / 2)] : null,
      alturaMedia: a.length ? a.reduce((s, x) => s + x, 0) / a.length : null,
      manzanaLote: lotMz,
      construcciones: this.data.construcciones.b.length
    };
  }
}
