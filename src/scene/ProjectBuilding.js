import * as THREE from 'three';
import { RealTrees } from './RealTrees.js';
import { architectureMaterial, boxUV } from './BuildingMaterials.js';
import { applyPBR, SURFACES } from './PBRSurfaces.js';
import { BalconyPlants } from './BalconyPlants.js';
import { bench, lamp, swingSet, slide, seesaw, bikeRack, bin, planter, bollard, hedge, place, car } from './ParkFurniture.js';

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
    this.unitVolumes = [];
    this.units = [];
    this._buildSite();
    for (let i = 0; i < this.floors; i++) this._buildFloor(i);
    this.balconyPlants = new BalconyPlants(this.floorGroups, FLOOR_H);
    this.roof = new THREE.Group();
    this.roof.name = 'Cubierta';
    this.plate.add(this.roof);
    this._plantTrees();
    this.group.traverse((m) => { if (m.isMesh && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } });
    this.setCut(null);
    this.ready = this._loadRevit().catch((e) => console.error('Modelo de Revit', e));
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
      const real = m.layer === 'arquitectura' ? architectureMaterial(m.color, m.glass) : null;
      const mat = real || revitMaterial(m.color, m.glass);
      if (mat.map || mat.normalMap) {
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
      };
      if (m.layer === 'mobiliario' && m.floor === TEMPLATE_FLOOR) {
        for (let f = 1; f < this.floors; f++) put(f, (f - TEMPLATE_FLOOR) * FLOOR_H);
      } else {
        put(m.floor, 0);
      }
    }
    this.revitTriangles = manifest.triangulos;
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
    g(xMax - (this.ox + 5.5) - 0.4, ant - 0.4, this.ox + 5.5, 0.2);
    g(ant - 0.4, zMax - ant - 0.4, Math.max(0, this.ox - ant) + 0.2, ant);
    // patio posterior con parque infantil y franja verde de aislamiento
    const pz = this.oz + PD + 0.6;
    g(PW - 2, zMax - pz - back + 2.2, this.ox + 1, pz, M.grass);
    g(9, 6.5, this.ox + 2.5, pz + 1.0, M.rubber, 0.08);
    // parque infantil: columpios, rodadero y balancín sobre piso de caucho
    const px = this.ox + 7, pzz = pz + 4.2;
    place(f, swingSet(), px - 2.6, pzz, 0);
    place(f, slide(), px + 1.4, pzz - 1.2, Math.PI);
    place(f, seesaw(), px + 1.2, pzz + 1.8, 0);
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
    place(f, hedge(xMax - (this.ox + 13) - 7), this.ox + 13 + (xMax - (this.ox + 13) - 7) / 2, 0.45);
    place(f, hedge(zMax - ant - 2), Math.max(0, this.ox - ant) + 0.45, ant + 1 + (zMax - ant - 2) / 2, Math.PI / 2);
    // rampa al sótano de parqueaderos (44 cupos + 9 de visitantes según la lámina) sobre el costado oriental
    const rx = this.ox + PW + 1.5;
    g(Math.min(4.2, xMax - rx - 0.5), zMax - ant - 1, rx, ant + 0.5, M.asphalt, 0.05);
    // carros parqueados sobre la Calle 56 y la Carrera 18 (modelos del masterplan La Fontana)
    const west = Math.min(...this.poly.filter((p) => p[1] < 25).map((p) => p[0]));
    car(f, 'sedan', 7, -3.9, Math.PI / 2, -0.34);
    car(f, 'taxi', 13.5, -3.9, Math.PI / 2, -0.34);
    car(f, 'suv', 20, -3.9, -Math.PI / 2, -0.34);
    car(f, 'sedan', west - 3.9, 12, 0, -0.34);
    car(f, 'suv', west - 3.9, 19, Math.PI, -0.34);
    // arborización con los árboles 3D del masterplan La Fontana: andenes, antejardines y patio
    this._treePts = [];
    const tree = (x, z, sp) => this._treePts.push([x, z, sp]);
    for (const x of [4, 10.5, 17, 23.5, 30]) if (x < xMax - 2) tree(x, -1.3, 'ash');
    for (const z of [6, 14, 22]) tree(west - 1.3, z, 'ash');
    tree(this.ox - ant / 2, ant + 3, 'celtis'); tree(this.ox - ant / 2, ant + 11, 'celtis');
    for (const x of [this.ox + 14, this.ox + 19.5, this.ox + 23]) tree(x, pz + 5.5, 'euc');
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

  /** 0 de día, 1 de noche: bañadores de fachada y luminarias de piso. */
  setNight(v) {
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
        new THREE.MeshBasicMaterial({ color: 0xd81e28, transparent: true, opacity: 0.16, depthWrite: false }));
      vol.position.y = y0 + 0.06;
      vol.userData.unitId = id;
      vol.renderOrder = 4;
      vol.add(new THREE.LineSegments(new THREE.EdgesGeometry(vol.geometry), new THREE.LineBasicMaterial({ color: 0xff5a5f, transparent: true, opacity: 0.8 })));
      g.add(vol);
      this.unitVolumes.push(vol);
      const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      this.units.push({ id, floor: i + 1, height: '2,90 m libres', ...data, worldCenter: () => vol.localToWorld(new THREE.Vector3(cx, hIn / 2, cz)) });
    };
    if (i === 0) {
      const zc = (title, quad, facades) => ({ typology: 'Zona común', title, facades, area: +area(Q[quad]).toFixed(1) });
      mk('lobby', 'NW', { ...zc('Lobby de acceso y bicicletero', 'NW', 'Calle 56 y Carrera 18'), location: 'Esquina Calle 56 con Carrera 18' });
      mk('salon', 'NE', { ...zc('Salón social y café lounge', 'NE', 'Calle 56'), location: 'Sobre la Calle 56' });
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
    this.cut = floor;
    this.floorGroups.forEach((g, i) => { g.visible = floor == null || i < floor; });
    this.roof.visible = floor == null;
  }

  setHighlight({ show, selectedId, hoveredId, filter }) {
    for (const v of this.unitVolumes) {
      const id = v.userData.unitId;
      const sel = id === selectedId, hov = id === hoveredId, inFilter = !filter || filter.has(id);
      // con el resaltado apagado las unidades siguen siendo clicables (invisibles) y se ven solo al pasar
      // el cursor, al seleccionarlas o al filtrar; así el edificio se ve como un render, sin el tinte rojo
      v.visible = inFilter || sel;
      const shown = sel || hov || (inFilter && (show || !!filter));
      v.material.visible = shown;
      v.children[0].material.visible = shown;
      v.material.opacity = sel ? 0.3 : hov ? 0.34 : 0.16;
      v.material.color.setHex(sel ? 0xd81e28 : 0xe0484f);
      v.children[0].material.opacity = sel ? 1 : 0.7;
    }
  }

  center() { return this.plate.localToWorld(new THREE.Vector3(PW / 2, this.floors * FLOOR_H / 2, PD / 2)); }
}
