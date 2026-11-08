import * as THREE from 'three';
import { RealTrees } from './RealTrees.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { architectureMaterial, boxUV, windowMaterials } from './BuildingMaterials.js';
import { interiorMaterial, withOakFloor } from './InteriorMaterials.js';
import { applyPBR, SURFACES } from './PBRSurfaces.js';
import { BalconyPlants } from './BalconyPlants.js';
import { bench, lamp, bikeRack, bin, planter, bollard, hedge, place, car, gardenBed, shrub, bistroSet, parasol, awning, stringLights, lightPost, setRestaurantNight } from './ParkFurniture.js';

/**
 * ProjectBuilding — el proyecto sobre el englobe del Parqueadero Divino Salvador (cinco lotes catastrales,
 * ~1.105 m², esquina Calle 56 con Carrera 18).
 *
 * El edificio es el modelo de Revit (ejercicio2.rvt) exportado con scripts/build-revit-model.py: muros,
 * losas, fachada en ladrillo, ventanería, puertas, escaleras, barandas y mobiliario. Planta de
 * 24,84 × 14,00 m, 6 pisos de 3,10 m: piso 1 con lobby y zonas sociales, pisos 2 a 6 con 4 apartamentos
 * cada uno (20 en total) alrededor del punto fijo central, y terraza en la cubierta.
 * El resto del lote queda como antejardines, patio con parque infantil y rampa al sótano.
 */
const M = {
  slab: new THREE.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 0.7 }),
  plaster: new THREE.MeshStandardMaterial({ color: 0xe4dfd6, roughness: 0.9 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x8aa2b8, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }),
  frame: new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.45, metalness: 0.5 }),
  core: new THREE.MeshStandardMaterial({ color: 0x1e2a44, roughness: 0.55, metalness: 0.15 }),
  floor: new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.6 }),
  white: new THREE.MeshStandardMaterial({ color: 0xefebe3, roughness: 0.85 }),
  kitchen: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5 }),
  quartz: new THREE.MeshStandardMaterial({ color: 0xf4f3f0, roughness: 0.3 }),
  bath: new THREE.MeshStandardMaterial({ color: 0xb9bcbf, roughness: 0.35 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0x8b8f94, roughness: 0.95 }),
  bed: new THREE.MeshStandardMaterial({ color: 0xebe7e0, roughness: 0.95 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.7 }),
  deck: new THREE.MeshStandardMaterial({ color: 0x9c7552, roughness: 0.8 }),
  paving: new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 0.9 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x6f8f4e, roughness: 1 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 1 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x4a4b4e, roughness: 0.95 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.9, flatShading: true }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 })
};

// suelos del lote con texturas fotogramétricas reales (Poly Haven, ya incluidas en assets/textures/pbr)
applyPBR(M.grass, SURFACES.GRASS, { metersPerTile: 3, tint: 0xd8e6c8, macro: { strength: 0.3 } });
applyPBR(M.paving, SURFACES.CONCRETE_PAVEMENT, { metersPerTile: 2.4, tint: 0xf2eee6 });
applyPBR(M.asphalt, SURFACES.ASPHALT, { metersPerTile: 4 });

/** Coordenadas UV en metros sobre el plano del suelo (x, z) para que las texturas queden a escala real. */
function groundUV(mesh) {
  const p = mesh.geometry.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) + mesh.position.x; uv[i * 2 + 1] = p.getZ(i) + mesh.position.z; }
  mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return mesh;
}

const FLOOR_H = 3.1;                           // niveles de Revit: 0,00 · 3,10 · 6,20 … terraza 18,60
const PW = 24.84, PD = 14.0;                   // planta de Revit: Carrera 18 → oriente, Calle 56 → fondo
// punto fijo y medianeros de la planta tipo de Revit (metros desde la esquina Calle 56 / Carrera 18)
const CX0 = 9.41, CX1 = 15.26, CZ0 = 4.44, CZ1 = 9.52;
const XAC = 12.14, XBD = 12.30, ZS = 7.83;     // medianero A/C, medianero B/D y división Calle 56 / patio
const MODEL = './assets/models/edificio-revit';
const TEMPLATE_FLOOR = 2;                      // el mobiliario del piso 3 se repite en los pisos 2 a 6

const area = (p) => Math.abs(p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0) / 2);

function prism(poly, h) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

function inset(poly, d) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz) || 1; return [x - ((x - cx) / l) * d, z - ((z - cz) / l) * d]; });
}

// apartamentos de la planta tipo de Revit (x hacia el oriente, z hacia el fondo)
const Q = {
  NW: [[0, 0], [XAC, 0], [XAC, CZ0], [CX0, CZ0], [CX0, ZS], [0, ZS]],
  NE: [[XAC, 0], [PW, 0], [PW, ZS], [CX1, ZS], [CX1, CZ0], [XAC, CZ0]],
  SW: [[0, ZS], [CX0, ZS], [CX0, CZ1], [XBD, CZ1], [XBD, PD], [0, PD]],
  SE: [[XBD, CZ1], [CX1, CZ1], [CX1, ZS], [PW, ZS], [PW, PD], [XBD, PD]],
  CORE: [[CX0, CZ0], [CX1, CZ0], [CX1, CZ1], [CX0, CZ1]]
};

// los colores de sombreado de Revit en tonos de acabado: pañete blanco, concreto claro, perfilería
const TONE = { '808080': 0xe8e3da, '95c4ee': 0xf1eee8, 'b4b4b4': 0xd9d6d0, 'f9f9f9': 0xf2f0eb, 'c0c0c0': 0xcfccc6, '7f7f7f': 0xbab6ae };
const revitMaterials = new Map();
function revitMaterial(hex, glass) {
  if (glass) return M.glass;
  const key = hex.slice(1).toLowerCase();
  if (!revitMaterials.has(key)) {
    const color = TONE[key] ?? parseInt(key, 16);
    revitMaterials.set(key, new THREE.MeshStandardMaterial({ color, roughness: key === '82482d' ? 0.92 : 0.75, metalness: 0, side: THREE.DoubleSide }));
  }
  return revitMaterials.get(key);
}

export class ProjectBuilding {
  constructor(scene, { lot, project }) {
    this.scene = scene;
    this.project = project;
    this.pa = project.proyectoActual;
    this.group = new THREE.Group();
    this.group.name = 'Proyecto · englobe Parqueadero Divino Salvador';
    scene.add(this.group);

    // --- marco local: X sobre el lindero de la Calle 56, Z hacia el fondo del lote ---------
    const pts = lot.pts.map(([x, z]) => new THREE.Vector2(x, z));
    let north = 0, best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const score = (a.y + b.y) / 2 - a.distanceTo(b) * 0.2; // el lindero largo y más al norte
      if (score < best) { best = score; north = i; }
    }
    let B = pts[north], C = pts[(north + 1) % pts.length];
    if (B.x > C.x) [B, C] = [C, B];
    const u = C.clone().sub(B).normalize();
    const v = new THREE.Vector2(-u.y, u.x);
    this.frame = new THREE.Group();
    this.frame.position.set(B.x, 0.18, B.y);
    this.frame.rotation.y = Math.atan2(-u.y, u.x);
    this.group.add(this.frame);
    this.poly = pts.map((p) => { const d = p.clone().sub(B); return [d.dot(u), d.dot(v)]; });
    this.lotArea = area(this.poly);

    // planta retirada 3,50 m de las dos vías (el lindero occidental casi no se inclina)
    const ant = this.pa.antejardinM;
    const westX = Math.max(...this.poly.filter((p) => p[0] < 5).map((p) => p[0]));
    this.ox = Math.max(0, westX) + ant;
    this.oz = ant;
    this.floors = this.pa.pisos;
    this.plate = new THREE.Group();
    this.plate.position.set(this.ox, 0, this.oz);
    this.frame.add(this.plate);

    this.floorGroups = [];
    this.aptFurniture = [];
    this.unitVolumes = [];
    this.units = [];
    this._buildSite();
    for (let i = 0; i < this.floors; i++) this._buildFloor(i);
    this.balconyPlants = new BalconyPlants(this.floorGroups, FLOOR_H);
    this._buildDecor();
    this.roof = new THREE.Group();
    this.roof.name = 'Cubierta';
    this.plate.add(this.roof);
    this._plantTrees();
    this.group.traverse((m) => { if (m.isMesh && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } });
    this.setCut(null);
    this.ready = this._loadRevit().catch((e) => console.error('Modelo de Revit', e));
    this._buildWindows().catch((e) => console.error('Ventanales', e));
  }

  /**
   * Ventanales de fachada (assets/models/ventanas.json, de scripts/build-windows.py): sobre cada ventana del
   * modelo de Revit va un ventanal de 2,4 m de alto y hasta 2,3 m de ancho, con marco de aluminio negro,
   * divisiones verticales, travesaño, alfajía de piedra y vidrio con reflejo (de noche se enciende).
   * Se funden en una malla por material y por piso para que el corte por piso los oculte con el resto.
   */
  async _buildWindows() {
    const { ventanas } = await fetch('./assets/models/ventanas.json').then((r) => r.json());
    const mats = windowMaterials();
    const parts = new Map();                     // `${piso}|frame|glass|sill` -> geometrías
    const push = (floor, kind, g) => { const k = `${floor}|${kind}`; if (!parts.has(k)) parts.set(k, []); parts.get(k).push(g); };
    const T = 0.06, D = 0.09;                    // sección del perfil y profundidad del marco (m)
    for (const w of ventanas) {
      const c = w.c / 1000, half = w.w / 2000, y0 = w.y0 / 1000, y1 = w.y1 / 1000, face = w.face / 1000;
      const out = w.f === 'N' || w.f === 'W' ? -1 : 1;           // hacia afuera del edificio
      const alongX = w.f === 'N' || w.f === 'S';
      // caja en coordenadas (a lo largo, altura, hacia afuera desde el plano de fachada)
      const box = (a0, a1, h0, h1, o0, o1) => {
        const g = new THREE.BoxGeometry(alongX ? a1 - a0 : o1 - o0, h1 - h0, alongX ? o1 - o0 : a1 - a0);
        const ca = (a0 + a1) / 2, co = face + out * (o0 + o1) / 2;
        g.translate(alongX ? ca : co, (h0 + h1) / 2, alongX ? co : ca);
        return g;
      };
      const a0 = c - half, a1 = c + half, h = y1 - y0;
      push(w.piso, 'glass', box(a0 + T, a1 - T, y0 + T, y1 - T, 0.025, 0.035));
      // marco perimetral
      push(w.piso, 'frame', box(a0, a1, y1 - T, y1, 0, D));
      push(w.piso, 'frame', box(a0, a1, y0, y0 + T, 0, D));
      push(w.piso, 'frame', box(a0, a0 + T, y0, y1, 0, D));
      push(w.piso, 'frame', box(a1 - T, a1, y0, y1, 0, D));
      // divisiones verticales cada ~0,8 m y travesaño a la altura de la puerta-ventana
      const n = Math.max(2, Math.round((a1 - a0) / 0.8));
      for (let k = 1; k < n; k++) { const x = a0 + (a1 - a0) * k / n; push(w.piso, 'frame', box(x - T / 2, x + T / 2, y0, y1, 0.01, D * 0.8)); }
      const yt = y0 + h * 0.82;
      push(w.piso, 'frame', box(a0, a1, yt - T / 2, yt + T / 2, 0.01, D * 0.8));
      // alfajía de piedra que sobresale bajo el ventanal
      push(w.piso, 'sill', box(a0 - 0.05, a1 + 0.05, y0 - 0.05, y0, 0, 0.16));
    }
    for (const [k, geos] of parts) {
      const [floor, kind] = k.split('|');
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), mats[kind]);
      geos.forEach((g) => g.dispose());
      mesh.name = `Ventanales · ${kind}`;
      mesh.castShadow = kind !== 'glass';
      mesh.receiveShadow = kind !== 'glass';
      if (kind === 'glass') mesh.renderOrder = 3;
      this.floorGroups[+floor]?.add(mesh);
    }
  }

  /**
   * Carga el modelo de Revit: cada malla trae el piso (0 = piso 1 … 6 = cubierta), el color del material y
   * la capa. Las posiciones vienen en milímetros (Int16) en el marco de la planta, por eso la escala 0,001.
   */
  async _loadRevit() {
    const [manifest, bin] = await Promise.all([
      fetch(`${MODEL}.json`).then((r) => r.json()),
      fetch(`${MODEL}.bin`).then((r) => r.arrayBuffer())
    ]);
    for (const m of manifest.mallas) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Int16BufferAttribute(new Int16Array(bin, m.position, m.vertices * 3), 3));
      const nb = new THREE.InterleavedBuffer(new Int8Array(bin, m.normal, m.vertices * 4), 4);
      g.setAttribute('normal', new THREE.InterleavedBufferAttribute(nb, 3, 0, true));
      g.setIndex(new THREE.BufferAttribute(m.index32 ? new Uint32Array(bin, m.index, m.indices) : new Uint16Array(bin, m.index, m.indices), 1));
      g.computeBoundingSphere();
      const arq = m.layer === 'arquitectura';
      const real = arq ? architectureMaterial(m.color, m.glass) : interiorMaterial(m.color, m.mat, m.glass);
      let mat = real || revitMaterial(m.color, m.glass);
      // losas: piso de roble en las caras que miran hacia arriba (apartamentos y balcones, no la terraza).
      // Copia propia sin el relieve mineral, para que la madera se vea lisa.
      if (arq && !m.glass && m.floor < this.floors && /^#(95c4ee|c0c0c0|f7f7ef|787878|7f7f7f)$/i.test(m.color)) {
        this._oakMats ||= new Map();
        if (!this._oakMats.has(mat)) this._oakMats.set(mat, withOakFloor(Object.assign(mat.clone(), { normalMap: null, roughnessMap: null, roughness: 0.5 })));
        mat = this._oakMats.get(mat);
      }
      if (mat.map || mat.normalMap || mat.bumpMap) {
        g.setAttribute('uv', new THREE.BufferAttribute(boxUV(new Int16Array(bin, m.position, m.vertices * 3), new Int8Array(bin, m.normal, m.vertices * 4), m.vertices), 2));
      }
      const put = (floor, dy) => {
        const mesh = new THREE.Mesh(g, mat);
        mesh.userData.hex = m.color.slice(1).toLowerCase();
        mesh.userData.layer = m.layer;
        mesh.scale.setScalar(0.001);
        mesh.position.y = dy;
        mesh.castShadow = !m.glass;
        mesh.receiveShadow = !m.glass;
        if (m.glass) mesh.renderOrder = m.color.toLowerCase() === '#0080c0' ? 4 : 3;
        (floor >= this.floors ? this.roof : this.floorGroups[floor]).add(mesh);
        // los muebles de los apartamentos solo se dibujan en el piso que se abre (ver setCut)
        if (m.layer === 'mobiliario' && floor >= 1 && floor < this.floors) { mesh.userData.floorIndex = floor; this.aptFurniture.push(mesh); }
      };
      if (m.layer === 'mobiliario' && m.floor === TEMPLATE_FLOOR) {
        for (let f = 1; f < this.floors; f++) put(f, (f - TEMPLATE_FLOOR) * FLOOR_H);
      } else {
        put(m.floor, 0);
      }
    }
    this.revitTriangles = manifest.triangulos;
    this.setCut(this.cut);
  }

  box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x + w / 2, y + h / 2, z + d / 2);
    (parent || this.plate).add(m);
    return m;
  }

  // ---------------------------------------------------------------- lote: antejardines, patio, rampa
  _buildSite() {
    const f = this.frame;
    const base = new THREE.Mesh(prism(this.poly, 0.04), M.paving);
    base.position.y = -0.04;
    base.receiveShadow = true;
    groundUV(base);
    f.add(base);
    const ant = this.pa.antejardinM, back = this.pa.aislamientoPosteriorM;
    const xs = this.poly.map((p) => p[0]), zs = this.poly.map((p) => p[1]);
    const xMax = Math.max(...xs), zMax = Math.min(...this.poly.filter((p) => p[1] > 15).map((p) => p[1]));
    const g = (w, d, x, z, mat = M.grass, h = 0.06) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x + w / 2, h / 2, z + d / 2); m.receiveShadow = true; groundUV(m); f.add(m); return m; };
    // antejardines verdes sobre la Calle 56 y la Carrera 18, con el acceso peatonal al lobby
    g(this.ox + 2.5 - 1.2, ant - 0.4, 0.2, 0.2);
    g(12.0 - 5.5, ant - 0.4, this.ox + 5.5, 0.2);                                   // hasta donde empieza el restaurante
    if (xMax - (this.ox + PW) > 0.8) g(xMax - (this.ox + PW) - 0.5, ant - 0.4, this.ox + PW + 0.1, 0.2);
    g(ant - 0.4, zMax - ant - 0.4, Math.max(0, this.ox - ant) + 0.2, ant);
    this._buildRestaurant();
    // patio posterior: jardín de césped con sendero de piedra, canteros plantados y bancas
    const pz = this.oz + PD + 0.6;
    g(PW - 2, zMax - pz - back + 2.2, this.ox + 1, pz, M.grass);
    g(1.4, zMax - pz - back + 1.4, this.ox + 9.5, pz + 0.4, M.paving, 0.08);           // sendero hacia el fondo
    g(PW - 4, 1.2, this.ox + 2, pz + 3.6, M.paving, 0.08);                             // sendero transversal
    // canteros de jardín: arbustos de varios lóbulos, pastos ornamentales y flores (antes, materas con esferas)
    for (const [x, z, w, d, s] of [[this.ox + 2.2, pz + 5.8, 5, 1.5, 3], [this.ox + 12.5, pz + 5.8, 6, 1.5, 5], [this.ox + 19.5, pz + 0.7, 4.5, 1.4, 7],
      [this.ox + 1.2, pz + 0.7, 3.2, 1.2, 9], [this.ox + 11.2, pz + 0.7, 1.8, 2.6, 11]]) {
      place(f, gardenBed(w, d, s), x + w / 2, z + d / 2, 0, 0.05);
    }
    for (const x of [this.ox + 3.5, this.ox + 6.5]) place(f, bench(), x, pz + 3.0, 0);
    // bancas, luminarias y canecas alrededor del patio
    for (const x of [this.ox + 13.5, this.ox + 17.5, this.ox + 21.5]) place(f, bench(), x, pz + 1.4, Math.PI);
    for (const x of [this.ox + 12, this.ox + 19.5]) place(f, lamp(), x, pz + 7.2, -Math.PI / 2);
    place(f, lamp(), this.ox - 1.2, this.oz + 2, Math.PI);
    place(f, lamp(), this.ox + PW + 0.8, this.oz - 1.2, 0);
    place(f, bin(), this.ox + 15.5, pz + 1.2, 0);
    place(f, bin(), this.ox + 1.6, 1.0, 0);
    // acceso: materas, bicicletero de visitantes y bolardos en el antejardín de la esquina
    place(f, planter(2.2, 0.7), this.ox + 1.1, 1.3, 0);
    place(f, planter(2.2, 0.7), this.ox + 6.0, 1.3, 0);
    place(f, bikeRack(), this.ox + 10.5, 1.4, 0);
    for (const x of [this.ox + 2.4, this.ox + 3.2, this.ox + 4.0]) place(f, bollard(), x, 0.4);
    // setos bajos de cerramiento sobre los antejardines (con el acceso peatonal y vehicular libres)
    place(f, hedge(this.ox + 0.4), (this.ox + 0.4) / 2, 0.45);
    place(f, hedge(zMax - ant - 2), Math.max(0, this.ox - ant) + 0.45, ant + 1 + (zMax - ant - 2) / 2, Math.PI / 2);
    // rampa al sótano de parqueaderos (44 cupos + 9 de visitantes según la lámina) sobre el costado oriental
    const rx = this.ox + PW + 1.5;
    g(Math.min(4.2, xMax - rx - 0.5), zMax - ant - 1, rx, ant + 0.5, M.asphalt, 0.05);
    // carros parqueados sobre la Calle 56 y la Carrera 18: se ubican cuando existe el tráfico (parkCars),
    // corridos hacia el andén si invadían el carril por donde pasan los carros en movimiento
    const west = Math.min(...this.poly.filter((p) => p[1] < 25).map((p) => p[0]));
    this._parked = [['sedan', 7, -3.9, Math.PI / 2], ['taxi', 13.5, -3.9, Math.PI / 2], ['suv', 20, -3.9, -Math.PI / 2],
      ['sedan', west - 3.9, 12, 0], ['suv', west - 3.9, 19, Math.PI]];
    // arborización con los árboles 3D del masterplan La Fontana: andenes, antejardines y patio
    this._treePts = [];
    const tree = (x, z, sp) => this._treePts.push([x, z, sp]);
    for (const x of [4, 10.5, 17, 23.5, 30]) if (x < xMax - 2) tree(x, -1.3, 'ash');
    for (const z of [6, 14, 22]) tree(west - 1.3, z, 'ash');
    tree(this.ox - ant / 2, ant + 3, 'celtis'); tree(this.ox - ant / 2, ant + 11, 'celtis');
    for (const x of [this.ox + 14, this.ox + 19.5, this.ox + 23]) tree(x, pz + 5.5, 'euc');
    for (const x of [this.ox + 3, this.ox + 8]) tree(x, pz + 6.8, 'celtis');            // sombra sobre las bancas del jardín
    this._buildFacadeLights();
  }

  /**
   * Bañadores de luz cálida al pie de las fachadas de la Calle 56 y la Carrera 18 (como en los renders
   * al atardecer): una luminaria de piso en el antejardín y el abanico de luz que sube por el muro.
   * Se encienden con setNight().
   */
  _buildFacadeLights() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(32, 128, 2, 32, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 128);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    this.washMat = new THREE.MeshBasicMaterial({ map, color: 0xffb36a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.fixtureMat = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.5, metalness: 0.4, emissive: 0xffc27a, emissiveIntensity: 0 });
    const washG = new THREE.PlaneGeometry(1.7, 3.6); washG.translate(0, 1.8, 0);
    const fixG = new THREE.CylinderGeometry(0.07, 0.09, 0.1, 10); fixG.translate(0, 0.05, 0);
    const lights = new THREE.Group();
    lights.name = 'Bañadores de fachada';
    const add = (x, z, rotY) => {
      const w = new THREE.Mesh(washG, this.washMat);
      w.position.set(x, 0.02, z);
      w.rotation.y = rotY;
      w.renderOrder = 5;
      const f = new THREE.Mesh(fixG, this.fixtureMat);
      f.position.set(x + Math.sin(rotY) * 0.35, 0, z + Math.cos(rotY) * 0.35); // en el antejardín, frente al muro
      lights.add(w, f);
    };
    for (let x = 1.4; x < PW; x += 3.1) add(x, -0.09, Math.PI);       // fachada de la Calle 56 (mira al norte)
    for (let z = 1.4; z < PD; z += 3.1) add(-0.09, z, -Math.PI / 2);  // fachada de la Carrera 18 (mira al occidente)
    this.plate.add(lights);
  }

  /**
   * Restaurante del piso 1 sobre la Calle 56 (antes salón social) con terraza en el antejardín: deck de
   * madera, doce mesas bistró de mármol con sillas de ratán, parasoles crema, toldo verde sobre la fachada,
   * materas en el borde del andén y guirnaldas de bombillos que se encienden al atardecer.
   */
  _buildRestaurant() {
    const f = this.frame, ox = this.ox, z0 = 0.25, z1 = this.oz - 0.15, x0 = ox + 12.3, x1 = ox + PW;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.07, z1 - z0), M.deck);
    deck.position.set((x0 + x1) / 2, 0.035, (z0 + z1) / 2);
    deck.receiveShadow = true;
    groundUV(deck);
    f.add(deck);
    const rows = [z0 + 0.85, z0 + 2.25];
    for (let k = 0; k < 6; k++) {
      const x = x0 + 1.1 + k * 2.1;
      if (x > x1 - 0.8) break;
      rows.forEach((z, j) => place(f, bistroSet(2), x, z, (k + j) % 2 ? Math.PI / 2 : 0, 0.07));
      if (k % 2 === 0) place(f, parasol(), x, rows[0], 0, 0.07);
    }
    place(f, awning(x1 - x0, 1.6), (x0 + x1) / 2, this.oz, 0);
    // guirnaldas en zigzag entre los postes del borde y la fachada (por encima del toldo)
    const posts = [];
    for (let x = x0 + 0.2; x <= x1 + 0.01; x += (x1 - x0 - 0.4) / 3) posts.push(x);
    posts.forEach((x) => place(f, lightPost(), x, 0.18));
    for (let i = 0; i < posts.length - 1; i++) {
      const xm = (posts[i] + posts[i + 1]) / 2;
      f.add(stringLights([posts[i], 3.05, 0.18], [xm, 3.0, this.oz - 0.05], 0.35, 9));
      f.add(stringLights([xm, 3.0, this.oz - 0.05], [posts[i + 1], 3.05, 0.18], 0.35, 9));
      f.add(stringLights([posts[i], 3.05, 0.18], [posts[i + 1], 3.05, 0.18], 0.4, 12));
      place(f, planter(Math.min(2.6, posts[i + 1] - posts[i] - 0.6), 0.42, 20 + i), xm, 0.24, 0, 0.0);
    }
    // arbustos a la entrada del restaurante (junto al bicicletero)
    place(f, shrub(0.38, 77), x0 - 0.4, 0.6);
  }

  /**
   * Carros parqueados junto al lote: cada uno se corre hacia el andén lo necesario para quedar fuera del
   * carril de los carros en movimiento (Traffic.roadClearance); si no cabe, no se dibuja.
   */
  parkCars(traffic) {
    if (this._parkedDone) return;
    this._parkedDone = true;
    this.group.updateMatrixWorld(true);
    const w = new THREE.Vector3();
    for (const [kind, x, z, ry] of this._parked || []) {
      this.frame.localToWorld(w.set(x, 0, z));
      const c = traffic?.roadClearance(w.x, w.z);
      if (c && c.d < c.need) {
        const push = c.need - c.d;
        if (push > 2.6) continue;                          // tendría que subirse al andén: se omite
        w.x += c.nx * push; w.z += c.nz * push;
      }
      const p = this.frame.worldToLocal(w.clone());
      car(this.frame, kind, p.x, p.z, ry, -0.34);
    }
  }

  /** 0 de día, 1 de noche: bañadores de fachada y luminarias de piso. */
  setNight(v) {
    setRestaurantNight(v);
    if (!this.washMat) return;
    this.washMat.opacity = v * 0.5;
    this.fixtureMat.emissiveIntensity = v * 5;
  }

  /** Punto en coordenadas de la planta (x oriente, y altura, z sur desde la esquina) llevado al mundo. */
  world(x, y, z) {
    this.group.updateMatrixWorld(true);
    return this.plate.localToWorld(new THREE.Vector3(x, y, z));
  }

  /** Siembra los árboles 3D en coordenadas del mundo (requiere el marco ya ubicado). */
  _plantTrees() {
    this.group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const pts = this._treePts.map(([x, z, sp]) => { this.frame.localToWorld(v.set(x, 0, z)); return [v.x, v.y, v.z, sp]; });
    new RealTrees().plant(pts, this.group, { variants: 2 });
  }

  // ---------------------------------------------------------------- unidades por piso
  /** Grupo del piso (la geometría llega del modelo de Revit) y volúmenes seleccionables de sus unidades. */
  _buildFloor(i) {
    const y0 = i * FLOOR_H, hIn = FLOOR_H - 0.2;
    const g = new THREE.Group();
    g.name = `Piso ${i + 1}`;
    this.plate.add(g);
    this.floorGroups.push(g);

    const mk = (id, quad, data) => {
      const poly = Q[quad];
      const vol = new THREE.Mesh(prism(inset(poly, 0.3), hIn - 0.14),
        new THREE.MeshBasicMaterial({ color: 0x2a63ad, transparent: true, opacity: 0.16, depthWrite: false }));
      vol.position.y = y0 + 0.06;
      vol.userData.unitId = id;
      vol.renderOrder = 4;
      vol.add(new THREE.LineSegments(new THREE.EdgesGeometry(vol.geometry), new THREE.LineBasicMaterial({ color: 0x8fb4dc, transparent: true, opacity: 0.8 })));
      g.add(vol);
      this.unitVolumes.push(vol);
      const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      this.units.push({ id, floor: i + 1, height: '2,90 m libres', ...data, worldCenter: () => vol.localToWorld(new THREE.Vector3(cx, hIn / 2, cz)) });
    };
    if (i === 0) {
      const zc = (title, quad, facades) => ({ typology: 'Zona común', title, facades, area: +area(Q[quad]).toFixed(1) });
      mk('lobby', 'NW', { ...zc('Lobby de acceso y bicicletero', 'NW', 'Calle 56 y Carrera 18'), location: 'Esquina Calle 56 con Carrera 18' });
      mk('salon', 'NE', { ...zc('Restaurante con terraza', 'NE', 'Calle 56'), location: 'Sobre la Calle 56 · terraza en el antejardín' });
      mk('cine', 'SW', { ...zc('Sala de cine', 'SW', 'Carrera 18 y patio'), location: 'Hacia el patio' });
      mk('gym', 'SE', { ...zc('Gimnasio y salón de juegos', 'SE', 'Patio'), location: 'Hacia el patio' });
    } else {
      const [A, B] = this.pa.tipologias;
      const apt = (t, n, loc, facades) => ({ typology: 'Apartamento', tipo: t.tipo, title: `Apartamento ${i + 1}0${n} · Tipo ${t.tipo}`, area: t.area, price: t.precio, location: loc, facades, espacios: t.espacios, lamina: t.lamina });
      mk(`${i + 1}01`, 'NW', apt(A, 1, 'Esquinero · Calle 56 con Carrera 18', 'Calle 56 (norte) y Carrera 18 (occidente)'));
      mk(`${i + 1}02`, 'NE', apt(A, 2, 'Sobre la Calle 56', 'Calle 56 (norte) y oriente'));
      mk(`${i + 1}03`, 'SW', apt(B, 3, 'Hacia el patio · Carrera 18', 'Patio (sur) y Carrera 18 (occidente)'));
      mk(`${i + 1}04`, 'SE', apt(B, 4, 'Hacia el patio', 'Patio (sur) y oriente'));
    }
  }

  // ---------------------------------------------------------------- interacción
  getUnitMeshes() { return this.unitVolumes; }

  /**
   * Oculta los pisos por encima de `floor` para ver la planta (null = edificio completo). Cada grupo trae
   * la losa de su propio nivel, así que al ocultar el de arriba el piso elegido queda destapado.
   */
  setCut(floor) {
    const prev = this.cut;
    this.cut = floor;
    const g = window.gsap, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const layers = [...this.floorGroups, this.roof];
    const shows = (i) => (i < this.floors ? floor == null || i < floor : floor == null);
    if (!g || reduced || prev === undefined || this._assembling) {
      layers.forEach((l, i) => { l.visible = shows(i); l.position.y = 0; });
    } else {
      // los pisos que se van se levantan en abanico y desaparecen; los que vuelven bajan a su sitio
      const leaving = layers.filter((l, i) => l.visible && !shows(i));
      const coming = layers.filter((l, i) => !l.visible && shows(i));
      g.killTweensOf(layers.map((l) => l.position));
      leaving.forEach((l, k) => g.to(l.position, {
        y: 7 + k * 2.2, duration: 0.55, delay: (leaving.length - 1 - k) * 0.05, ease: 'power2.in',
        onComplete: () => { l.visible = false; l.position.y = 0; }
      }));
      coming.forEach((l, k) => {
        l.visible = true;
        g.fromTo(l.position, { y: 6 + k * 1.6 }, { y: 0, duration: 0.7, delay: 0.08 * k, ease: 'power3.out' });
      });
      layers.forEach((l, i) => { if (shows(i) && !coming.includes(l)) { l.visible = true; l.position.y = 0; } });
    }
    for (const m of this.aptFurniture) m.visible = floor != null && m.userData.floorIndex === floor - 1;
    // luz cálida de interior sobre el piso abierto (siempre en la escena para no recompilar materiales)
    if (!this.interiorLight) {
      this.interiorLight = new THREE.PointLight(0xffe0b5, 0, 34, 1);
      this.plate.add(this.interiorLight);
    }
    this.interiorLight.intensity = floor != null ? 140 : 0;
    if (floor != null) this.interiorLight.position.set(PW / 2, (floor - 1) * FLOOR_H + 2.6, PD / 2);
  }

  /**
   * Tapetes y matas de los apartamentos (pisos 2 a 6), como en los renders de venta: tapete crema bajo la
   * sala y la cama principal y una mata en matera junto al ventanal de la sala. Solo se ven en el piso abierto.
   */
  _buildDecor() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d8ccb8'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '245,238,226' : '170,155,132'},0.35)`; ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 2); }
    ctx.strokeStyle = 'rgba(140,120,96,0.6)'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, 236, 236);
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    const rugMat = new THREE.MeshStandardMaterial({ map, roughness: 1 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0xd9d2c6, roughness: 0.7 });
    // [x0, z0, x1, z1] de los tapetes y (x, z) de la mata para A y B; C y D son su espejo
    const A = { rugs: [[1.0, 0.35, 5.1, 2.45], [8.7, 0.6, 10.8, 2.7]], plant: [0.6, 0.6] };
    const B = { rugs: [[1.1, 11.4, 5.4, 13.6], [9.0, 11.7, 11.0, 13.7]], plant: [0.6, 13.4] };
    const mir = (o) => ({ rugs: o.rugs.map(([x0, z0, x1, z1]) => [PW - x1, z0, PW - x0, z1]), plant: [PW - o.plant[0], o.plant[1]] });
    for (let f = 1; f < this.floors; f++) {
      const y = f * FLOOR_H - 0.13;                         // sobre la losa (su cara superior queda 14 cm bajo el nivel)
      for (const apt of [A, B, mir(A), mir(B)]) {
        for (const [x0, z0, x1, z1] of apt.rugs) {
          const rug = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.012, z1 - z0), rugMat);
          rug.position.set((x0 + x1) / 2, y + 0.006, (z0 + z1) / 2);
          rug.receiveShadow = true;
          this.floorGroups[f].add(rug);
          rug.userData.floorIndex = f; this.aptFurniture.push(rug);
        }
        const pot = new THREE.Group();
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.42, 16), potMat);
        p.position.y = 0.21; pot.add(p);
        const s = shrub(0.32, f * 7 + Math.round(apt.plant[0])); s.position.y = 0.42; s.scale.set(1, 1.5, 1); pot.add(s);
        pot.position.set(apt.plant[0], y, apt.plant[1]);
        pot.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
        this.floorGroups[f].add(pot);
        pot.userData.floorIndex = f; this.aptFurniture.push(pot);
      }
    }
  }

  /**
   * Cámara a la altura de los ojos dentro de un apartamento: 'cocina' (desde la sala hacia la cocina y el
   * comedor) o 'habitacion' (desde la puerta hacia la cama principal). Coordenadas de la planta de Revit.
   */
  interiorCamera(unit, kind) {
    const n = +String(unit.id).slice(-1);                  // x01 A · x02 C · x03 B · x04 D
    const VIEWS = {
      // la habitación se mira desde la franja libre entre el ventanal y el clóset (el baño privado ocupa la otra esquina)
      A: { cocina: [[4.6, 1.0], [0.6, 5.6]], habitacion: [[11.75, 0.55], [8.6, 1.65]] },
      B: { cocina: [[4.8, 13.4], [1.0, 8.8]], habitacion: [[11.9, 13.55], [8.8, 12.7]] }
    };
    const v = VIEWS[n === 1 || n === 2 ? 'A' : 'B'][kind];
    const mx = (x) => (n === 2 || n === 4 ? PW - x : x);
    const y0 = (unit.floor - 1) * FLOOR_H;
    return {
      pos: this.world(mx(v[0][0]), y0 + 1.5, v[0][1]),
      target: this.world(mx(v[1][0]), y0 + (kind === 'cocina' ? 1.0 : 0.55), v[1][1])
    };
  }

  /** Dentro de un apartamento se ocultan los volúmenes de selección (teñirían toda la vista). */
  setInterior(on) {
    this._interior = on;
    for (const v of this.unitVolumes) { v.material.visible = !on && v.material.visible; v.children[0].material.visible = !on && v.children[0].material.visible; }
  }

  /**
   * El edificio se arma piso por piso (para la llegada de la intro): cada piso cae desde arriba sobre el
   * anterior y al final la cubierta con la pérgola. Devuelve la línea de tiempo de GSAP.
   */
  assemble({ delay = 0, step = 0.62 } = {}) {
    const g = window.gsap;
    if (!g || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const layers = [...this.floorGroups, this.roof];
    this._assembling = true;
    layers.forEach((l) => { l.visible = false; l.position.y = 0; });
    const tl = g.timeline({ delay, onComplete: () => { this._assembling = false; this.setCut(this.cut ?? null); } });
    layers.forEach((l, i) => {
      tl.call(() => { l.visible = true; }, null, i * step)
        .fromTo(l.position, { y: 14 }, { y: 0, duration: 1.5, ease: 'power3.out' }, i * step);
    });
    return tl;
  }

  setHighlight({ show, selectedId, hoveredId, filter }) {
    for (const v of this.unitVolumes) {
      const id = v.userData.unitId;
      const sel = id === selectedId, hov = id === hoveredId, inFilter = !filter || filter.has(id);
      // con el resaltado apagado las unidades siguen siendo clicables (invisibles) y se ven solo al pasar
      // el cursor, al seleccionarlas o al filtrar; así el edificio se ve como un render, sin el tinte rojo
      v.visible = inFilter || sel;
      const touring = document.body.classList.contains('is-touring');
      const shown = !this._interior && (sel || hov || (inFilter && (show || (!!filter && !touring))));
      v.material.visible = shown;
      v.children[0].material.visible = shown;
      // la unidad elegida casi sin tinte: el borde la marca y el interior se ve con sus acabados reales
      v.material.opacity = sel ? 0.05 : hov ? 0.34 : 0.16;
      v.material.color.setHex(sel ? 0x1f4f8f : 0x3a78c2);
      v.children[0].material.opacity = sel ? 1 : 0.7;
    }
  }

  center() { return this.plate.localToWorld(new THREE.Vector3(PW / 2, this.floors * FLOOR_H / 2, PD / 2)); }
}
