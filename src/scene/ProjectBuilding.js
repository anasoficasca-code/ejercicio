import * as THREE from 'three';
import { RealTrees } from './RealTrees.js';
import { bench, lamp, swingSet, slide, seesaw, bikeRack, bin, planter, bollard, hedge, place, car } from './ParkFurniture.js';

/**
 * ProjectBuilding — el proyecto sobre el englobe del Parqueadero Divino Salvador (cinco lotes catastrales,
 * ~1.105 m², esquina Calle 56 con Carrera 18).
 *
 * Norma: antejardín de 3,50 m sobre la Calle 56 y la Carrera 18 y aislamiento posterior de 3,00 m.
 * Volumen de 5 pisos de 3,00 m con la planta tipo de la lámina "Apartamentos": 25 × 14 m (350 m²),
 * punto fijo central de 52,57 m², 2 apartamentos tipo A de 78,75 m² sobre la Calle 56 y 2 tipo B de
 * 70 m² hacia el patio. Piso 1: lobby y zonas sociales; pisos 2 a 5: 16 apartamentos; cubierta: terraza.
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

const FLOOR_H = 3.0, SLAB = 0.22;
const PW = 25, PD = 14;                       // planta tipo 25 × 14 m
const CX0 = 8.85, CX1 = 16.15, CZ0 = 3.4, CZ1 = 10.6; // punto fijo 7,30 × 7,20 m = 52,6 m²
const ZS = 7.5;                                // división norte (tipo A) / sur (tipo B)

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

// cuadrantes de la planta tipo (coordenadas de la planta, x hacia el oriente, z hacia el fondo)
const Q = {
  NW: [[0, 0], [12.5, 0], [12.5, CZ0], [CX0, CZ0], [CX0, ZS], [0, ZS]],
  NE: [[12.5, 0], [PW, 0], [PW, ZS], [CX1, ZS], [CX1, CZ0], [12.5, CZ0]],
  SW: [[0, ZS], [CX0, ZS], [CX0, CZ1], [12.5, CZ1], [12.5, PD], [0, PD]],
  SE: [[12.5, CZ1], [CX1, CZ1], [CX1, ZS], [PW, ZS], [PW, PD], [12.5, PD]],
  CORE: [[CX0, CZ0], [CX1, CZ0], [CX1, CZ1], [CX0, CZ1]]
};

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
    this.ceilings = [];
    this.unitVolumes = [];
    this.units = [];
    this._buildSite();
    for (let i = 0; i < this.floors; i++) this._buildFloor(i);
    this._buildRoof();
    this._plantTrees();
    this.group.traverse((m) => { if (m.isMesh && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } });
    this.setCut(null);
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
    f.add(base);
    const ant = this.pa.antejardinM, back = this.pa.aislamientoPosteriorM;
    const xs = this.poly.map((p) => p[0]), zs = this.poly.map((p) => p[1]);
    const xMax = Math.max(...xs), zMax = Math.min(...this.poly.filter((p) => p[1] > 15).map((p) => p[1]));
    const g = (w, d, x, z, mat = M.grass, h = 0.06) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x + w / 2, h / 2, z + d / 2); m.receiveShadow = true; f.add(m); return m; };
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
  }

  /** Siembra los árboles 3D en coordenadas del mundo (requiere el marco ya ubicado). */
  _plantTrees() {
    this.group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const pts = this._treePts.map(([x, z, sp]) => { this.frame.localToWorld(v.set(x, 0, z)); return [v.x, v.y, v.z, sp]; });
    new RealTrees().plant(pts, this.group, { variants: 2 });
  }

  // ---------------------------------------------------------------- piso tipo
  _buildFloor(i) {
    const y0 = i * FLOOR_H, hIn = FLOOR_H - SLAB;
    const g = new THREE.Group();
    g.name = `Piso ${i + 1}`;
    this.plate.add(g);
    this.floorGroups.push(g);
    const plate = [[0, 0], [PW, 0], [PW, PD], [0, PD]];

    if (i === 0) { const s = new THREE.Mesh(prism(plate, SLAB), M.slab); s.position.y = -SLAB; g.add(s); }
    const fin = new THREE.Mesh(prism(inset(plate, 0.2), 0.02), M.floor);
    fin.position.y = y0 + 0.01;
    g.add(fin);
    const ceil = new THREE.Mesh(prism([[-0.3, -0.3], [PW + 0.3, -0.3], [PW + 0.3, PD + 0.3], [-0.3, PD + 0.3]], SLAB), M.slab);
    ceil.position.y = y0 + hIn;
    g.add(ceil);
    this.ceilings.push(ceil);

    // envolvente: vidrio de piso a techo con perfilería negra mate en las cuatro fachadas
    const side = (x0, z0, x1, z1) => {
      const l = Math.hypot(x1 - x0, z1 - z0), ang = -Math.atan2(z1 - z0, x1 - x0);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(l, hIn), M.glass);
      gl.position.set((x0 + x1) / 2, y0 + hIn / 2, (z0 + z1) / 2);
      gl.rotation.y = ang;
      gl.renderOrder = 3;
      g.add(gl);
      const n = Math.round(l / 1.4);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const mu = new THREE.Mesh(new THREE.BoxGeometry(0.07, hIn, 0.14), M.frame);
        mu.position.set(x0 + (x1 - x0) * t, y0 + hIn / 2, z0 + (z1 - z0) * t);
        mu.rotation.y = ang;
        g.add(mu);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(l, 0.06, 0.14), M.frame);
      rail.position.set((x0 + x1) / 2, y0 + 0.95, (z0 + z1) / 2);
      rail.rotation.y = ang;
      g.add(rail);
    };
    side(0, 0, PW, 0); side(PW, 0, PW, PD); side(PW, PD, 0, PD); side(0, PD, 0, 0);

    // punto fijo: muros en azul JMC, ascensores y escalera
    this.box(CX1 - CX0, hIn, 0.2, M.core, CX0, y0, CZ0, g);
    this.box(CX1 - CX0, hIn, 0.2, M.core, CX0, y0, CZ1 - 0.2, g);
    this.box(0.2, hIn, CZ1 - CZ0, M.core, CX0, y0, CZ0, g);
    this.box(0.2, hIn, CZ1 - CZ0, M.core, CX1 - 0.2, y0, CZ0, g);
    this.box(1.8, hIn, 1.9, M.core, CX0 + 0.4, y0, CZ0 + 0.4, g);
    this.box(1.8, hIn, 1.9, M.core, CX0 + 2.4, y0, CZ0 + 0.4, g);
    for (let s = 0; s < 9; s++) this.box(1.2, 0.17 * (s + 1), 0.28, M.slab, CX1 - 1.6, y0, CZ0 + 2.6 + s * 0.28, g);
    // muros divisorios entre apartamentos
    this.box(0.15, hIn, CZ0, M.white, 12.5 - 0.075, y0, 0, g);
    this.box(0.15, hIn, PD - CZ1, M.white, 12.5 - 0.075, y0, CZ1, g);
    this.box(CX0, hIn, 0.15, M.white, 0, y0, ZS - 0.075, g);
    this.box(PW - CX1, hIn, 0.15, M.white, CX1, y0, ZS - 0.075, g);

    const mk = (id, quad, flipX, flipZ, data) => {
      const poly = Q[quad];
      const vol = new THREE.Mesh(prism(inset(poly, 0.3), hIn - 0.14),
        new THREE.MeshBasicMaterial({ color: 0xd81e28, transparent: true, opacity: 0.16, depthWrite: false }));
      vol.position.y = y0 + 0.06;
      vol.userData.unitId = id;
      vol.renderOrder = 4;
      vol.add(new THREE.LineSegments(new THREE.EdgesGeometry(vol.geometry), new THREE.LineBasicMaterial({ color: 0xff5a5f, transparent: true, opacity: 0.8 })));
      g.add(vol);
      this.unitVolumes.push(vol);
      if (data.typology === 'Apartamento') this._furnish(g, y0, flipX, flipZ, flipZ ? PD - ZS : ZS);
      const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      this.units.push({ id, floor: i + 1, height: '2,78 m libres', ...data, worldCenter: () => vol.localToWorld(new THREE.Vector3(cx, hIn / 2, cz)) });
    };
    if (i === 0) {
      const zc = (title, quad, facades) => ({ typology: 'Zona común', title, facades, area: +area(Q[quad]).toFixed(1) });
      mk('lobby', 'NW', false, false, { ...zc('Lobby de acceso y bicicletero', 'NW', 'Calle 56 y Carrera 18'), location: 'Esquina Calle 56 con Carrera 18' });
      mk('salon', 'NE', true, false, { ...zc('Salón social y café lounge', 'NE', 'Calle 56'), location: 'Sobre la Calle 56' });
      mk('cine', 'SW', false, true, { ...zc('Sala de cine', 'SW', 'Carrera 18 y patio'), location: 'Hacia el patio' });
      mk('gym', 'SE', true, true, { ...zc('Gimnasio y salón de juegos', 'SE', 'Patio'), location: 'Hacia el patio' });
      this._groundFloor(g, y0);
    } else {
      const [A, B] = this.pa.tipologias;
      const apt = (t, n, loc, facades) => ({ typology: 'Apartamento', tipo: t.tipo, title: `Apartamento ${i + 1}0${n} · Tipo ${t.tipo}`, area: t.area, price: t.precio, location: loc, facades, espacios: t.espacios, lamina: t.lamina });
      mk(`${i + 1}01`, 'NW', false, false, apt(A, 1, 'Esquinero · Calle 56 con Carrera 18', 'Calle 56 (norte) y Carrera 18 (occidente)'));
      mk(`${i + 1}02`, 'NE', true, false, apt(A, 2, 'Sobre la Calle 56', 'Calle 56 (norte) y oriente'));
      mk(`${i + 1}03`, 'SW', false, true, apt(B, 3, 'Hacia el patio · Carrera 18', 'Patio (sur) y Carrera 18 (occidente)'));
      mk(`${i + 1}04`, 'SE', true, true, apt(B, 4, 'Hacia el patio', 'Patio (sur) y oriente'));
    }
  }

  /**
   * Amoblamiento de un apartamento de 3 alcobas (lámina "Tipología A / B"). Coordenadas locales: lx desde
   * la fachada lateral hacia el punto fijo (0 → 12,5), lz desde la fachada principal hacia adentro (0 → D).
   */
  _furnish(g, y0, flipX, flipZ, D) {
    const b = (w, h, d, mat, lx, y, lz) => this.box(w, h, d, mat, flipX ? PW - lx - w : lx, y0 + y, flipZ ? PD - lz - d : lz, g);
    const hp = 2.5, mid = Math.min(4.2, D * 0.56);
    // alcoba principal y alcoba 2 contra la fachada lateral
    b(0.1, hp, D, M.white, 4.0, 0, 0);
    b(4.0, hp, 0.1, M.white, 0, 0, mid);
    b(1.6, 0.48, 2.0, M.bed, 1.0, 0, 0.6);
    b(1.6, 1.0, 0.08, M.wood, 1.0, 0, 2.6);
    b(1.0, 0.45, 1.9, M.bed, 0.4, 0, mid + 0.4);
    b(0.6, 2.1, 1.6, M.wood, 3.3, 0, mid + 0.4);
    // alcoba 3 sobre la fachada principal y baños hacia el interior
    b(0.1, hp, 3.0, M.white, 6.9, 0, 0);
    b(2.9, hp, 0.1, M.white, 4.1, 0, 3.0);
    b(1.0, 0.45, 1.9, M.bed, 4.6, 0, 0.5);
    b(2.3, 0.02, 2.0, M.bath, 4.3, 0.02, D - 2.1);
    b(0.1, hp, 2.2, M.white, 6.6, 0, D - 2.2);
    b(0.55, 0.42, 0.7, M.quartz, 4.5, 0, D - 0.9);
    // sala sobre la fachada, comedor y cocina contra el punto fijo
    b(2.4, 0.42, 0.85, M.fabric, 8.6, 0, 0.6);
    b(0.9, 0.38, 0.55, M.wood, 9.4, 0, 1.8);
    b(1.4, 0.75, 0.9, M.wood, 7.2, 0, CZ0 + 0.5);
    b(0.65, 0.88, Math.max(1.2, D - CZ0 - 0.4), M.kitchen, CX0 - 0.75, 0, CZ0 + 0.2);
    b(0.66, 0.04, Math.max(1.2, D - CZ0 - 0.4), M.quartz, CX0 - 0.75, 0.88, CZ0 + 0.2);
  }

  _groundFloor(g, y0) {
    this.box(2.0, 1.0, 0.6, M.wood, 4.5, y0, 4.8, g);                          // recepción
    for (let k = 0; k < 6; k++) this.box(0.08, 1.1, 1.6, M.frame, 0.6 + k * 0.45, y0, 5.2, g); // bicicletero
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) this.box(0.8, 0.5, 0.7, M.fabric, 2 + c * 1.3, y0, 9 + r * 1.3, g); // cine
    this.box(5, 0.05, 0.1, M.frame, 1.5, y0 + 1.2, PD - 0.4, g);
    this.box(1.6, 0.75, 0.9, M.wood, 18, y0, 2, g); this.box(1.6, 0.75, 0.9, M.wood, 21, y0, 4, g);     // salón social
    this.box(1.8, 1.2, 0.8, M.kitchen, 19, y0, 10, g); this.box(1.8, 1.2, 0.8, M.kitchen, 22, y0, 11.5, g); // gimnasio
  }

  _buildRoof() {
    const y = this.floors * FLOOR_H;
    const r = new THREE.Group();
    r.name = 'Cubierta';
    this.plate.add(r);
    this.roof = r;
    this.box(PW + 0.6, 1.05, 0.15, M.slab, -0.3, y, -0.3, r);
    this.box(PW + 0.6, 1.05, 0.15, M.slab, -0.3, y, PD + 0.15, r);
    this.box(0.15, 1.05, PD + 0.6, M.slab, -0.3, y, -0.3, r);
    this.box(0.15, 1.05, PD + 0.6, M.slab, PW + 0.15, y, -0.3, r);
    this.box(CX1 - CX0, 2.8, CZ1 - CZ0, M.core, CX0, y, CZ0, r);            // sobrecubierta del punto fijo
    // terraza comunal: deck, pérgola, zona BBQ y jardineras
    this.box(PW - 2, 0.06, PD - 2, M.deck, 1, y, 1, r);
    const px0 = 17.2, px1 = PW - 1.4;
    for (const x of [px0, px1]) for (const z of [1.4, PD - 1.6]) this.box(0.15, 2.6, 0.15, M.frame, x, y, z, r);
    for (let x = px0; x <= px1; x += 0.6) this.box(0.08, 0.12, PD - 2.8, M.wood, x, y + 2.6, 1.4, r);
    this.box(1.8, 0.9, 0.6, M.kitchen, px0 + 1, y, PD - 2.2, r);
    for (const [x, z] of [[2, 2], [5, 2], [2, PD - 3], [5, PD - 3]]) this.box(1.2, 0.45, 1.2, M.fabric, x, y, z, r);
    for (const x of [3, 9, 15]) place(r, planter(4.5, 0.6), x, 1.0, 0, y);
  }

  // ---------------------------------------------------------------- interacción
  getUnitMeshes() { return this.unitVolumes; }

  /** Oculta los pisos por encima de `floor` y su losa para ver la planta (null = edificio completo). */
  setCut(floor) {
    this.cut = floor;
    this.floorGroups.forEach((g, i) => { g.visible = floor == null || i < floor; });
    this.ceilings.forEach((c, i) => { c.visible = floor == null || i < floor - 1; });
    this.roof.visible = floor == null;
  }

  setHighlight({ show, selectedId, hoveredId, filter }) {
    for (const v of this.unitVolumes) {
      const id = v.userData.unitId;
      const sel = id === selectedId, hov = id === hoveredId, inFilter = !filter || filter.has(id);
      v.visible = (show && inFilter) || sel;
      v.material.opacity = sel ? 0.3 : hov ? 0.34 : 0.16;
      v.material.color.setHex(sel ? 0xd81e28 : 0xe0484f);
      v.children[0].material.opacity = sel ? 1 : 0.7;
    }
  }

  center() { return this.plate.localToWorld(new THREE.Vector3(PW / 2, this.floors * FLOOR_H / 2, PD / 2)); }
}
