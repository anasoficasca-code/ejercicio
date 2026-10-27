import * as THREE from 'three';
import { makeFacadeTextures } from './FacadeTextures.js';

/**
 * ProjectBuilding — el edificio del proyecto sobre TODO el lote 02 (Calle 56 # 17-53, esquina Carrera 18).
 *
 * La huella es el polígono catastral completo del lote (194 m²), sin retrocesos: el volumen llega a
 * los linderos sobre la Calle 56 y la Carrera 18 (fachadas acristaladas) y empata con los vecinos
 * (culatas). 6 pisos de 3,00 m. Cada piso se divide con cortes perpendiculares a la Calle 56 en:
 * unidad esquinera (Calle 56 con Carrera 18) · punto fijo central · unidad medianera (Calle 56).
 * Piso 1: lobby y bicicletero en la esquina + unidad 101 → 11 unidades en total.
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
  leaf: new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.9, flatShading: true }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 })
};

const FLOOR_H = 3.0, SLAB = 0.22, CORE_W = 4.2;

const area = (p) => Math.abs(p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0) / 2);

/** Recorta un polígono [x, z] a la franja x0 ≤ x ≤ x1 (Sutherland–Hodgman). */
function clipX(poly, x0, x1) {
  const cut = (pts, keep, xc) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ia = keep(a[0]), ib = keep(b[0]);
      if (ia) out.push(a);
      if (ia !== ib) { const t = (xc - a[0]) / (b[0] - a[0]); out.push([xc, a[1] + t * (b[1] - a[1])]); }
    }
    return out;
  };
  return cut(cut(poly, (x) => x >= x0, x0), (x) => x <= x1, x1);
}

/** Encoge un polígono hacia su centroide `d` metros (aprox.), para volúmenes interiores. */
function inset(poly, d) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz) || 1; return [x - ((x - cx) / l) * d, z - ((z - cz) / l) * d]; });
}

/** Prisma vertical a partir de un polígono local [x, z]. */
function prism(poly, h) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

export class ProjectBuilding {
  constructor(scene, { lot, project }) {
    this.scene = scene;
    this.project = project;
    this.group = new THREE.Group();
    this.group.name = 'Proyecto · Lote 02';
    scene.add(this.group);

    // --- marco local: X sobre el lindero de la Calle 56, Z hacia el fondo del lote ---------
    const pts = lot.pts.map(([x, z]) => new THREE.Vector2(x, z));
    let north = 0, best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const mz = (pts[i].y + pts[(i + 1) % pts.length].y) / 2;
      if (mz < best) { best = mz; north = i; }
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
    const xs = this.poly.map((p) => p[0]), zs = this.poly.map((p) => p[1]);
    this.xMin = Math.min(...xs); this.xMax = Math.max(...xs);
    this.D = Math.max(...zs);
    this.floors = project.cabida.pisos;
    this.lotArea = area(this.poly);
    // fachadas a la calle: el lindero norte (Calle 56) y el lindero occidental (Carrera 18)
    this.streetEdges = new Set();
    this.poly.forEach((p, i) => {
      const q = this.poly[(i + 1) % this.poly.length];
      const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      if (Math.abs(mid[1]) < 1.5 || mid[0] < this.xMin + 2.5) this.streetEdges.add(i);
    });
    const span = this.xMax - this.xMin;
    this.xa = this.xMin + (span - CORE_W) / 2;
    this.xb = this.xa + CORE_W;
    this.unitWest = clipX(this.poly, this.xMin, this.xa);
    this.unitEast = clipX(this.poly, this.xb, this.xMax);

    this.floorGroups = [];
    this.ceilings = [];
    this.unitVolumes = [];
    this.units = [];
    this._buildSite();
    for (let i = 0; i < this.floors; i++) this._buildFloor(i);
    this._buildRoof();
    this.group.traverse((m) => { if (m.isMesh && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } });
    this.setCut(null);
  }

  /** Culata de empate en ladrillo a la vista (un material por muro, con la textura a escala real). */
  _culata(k, a, b) {
    this._culatas ||= {};
    if (!this._culatas[k]) {
      const t = (this._tex ||= makeFacadeTextures()).iglesia.clone();
      t.needsUpdate = true;
      t.repeat.set(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.4, FLOOR_H / 2.4);
      this._culatas[k] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    }
    return this._culatas[k];
  }

  box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x + w / 2, y + h / 2, z + d / 2);
    (parent || this.frame).add(m);
    return m;
  }

  /** Elemento lineal sobre el segmento a→b (muro, vidrio, perfil), desplazado `off` hacia el interior. */
  along(a, b, y, h, t, mat, parent, off = t / 2) {
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(l, h, t), mat);
    const cx = (this.xMin + this.xMax) / 2, cz = this.D / 2;
    let nx = -dz / l, nz = dx / l;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if ((cx - mx) * nx + (cz - mz) * nz < 0) { nx = -nx; nz = -nz; }
    m.position.set(mx + nx * off, y + h / 2, mz + nz * off);
    m.rotation.y = -Math.atan2(dz, dx);
    (parent || this.frame).add(m);
    return m;
  }

  // ---------------------------------------------------------------- andén y arborización
  _buildSite() {
    const apron = this.box(this.xMax - this.xMin + 4, 0.04, 2.6, M.paving, this.xMin - 2.6, -0.02, -2.6);
    apron.receiveShadow = true;
    this.box(2.6, 0.04, this.D + 2.6, M.paving, this.xMin - 2.6, -0.02, -2.6).receiveShadow = true;
    const tree = (x, z, s = 1) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 3 * s, 6), M.bark);
      t.position.set(x, 1.5 * s, z);
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 * s, 1), M.leaf);
      c.position.set(x, 3.5 * s, z);
      c.scale.y = 0.85;
      this.frame.add(t, c);
    };
    tree(4.5, -1.6); tree(10.5, -1.6, 0.9); tree(16, -1.6); tree(this.xMin - 1.6, 6.5, 0.95);
  }

  // ---------------------------------------------------------------- piso tipo
  _buildFloor(i) {
    const y0 = i * FLOOR_H, hIn = FLOOR_H - SLAB;
    const g = new THREE.Group();
    g.name = `Piso ${i + 1}`;
    this.frame.add(g);
    this.floorGroups.push(g);

    if (i === 0) { const s = new THREE.Mesh(prism(this.poly, SLAB), M.slab); s.position.y = -SLAB; g.add(s); }
    const fin = new THREE.Mesh(prism(inset(this.poly, 0.25), 0.02), M.floor);
    fin.position.y = y0 + 0.01;
    g.add(fin);
    const ceil = new THREE.Mesh(prism(this.poly, SLAB), M.slab);
    ceil.position.y = y0 + hIn;
    g.add(ceil);
    this.ceilings.push(ceil);

    // envolvente: vidrio + perfilería sobre las calles, culatas de empate contra los vecinos
    this.poly.forEach((a, k) => {
      const b = this.poly[(k + 1) % this.poly.length];
      if (!this.streetEdges.has(k)) { this.along(a, b, y0, FLOOR_H, 0.2, this._culata(k, a, b), g); return; }
      const glass = this.along(a, b, y0, hIn, 0.04, M.glass, g, 0.08);
      glass.renderOrder = 3;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(l / 1.3));
      for (let s = 0; s <= n; s++) {
        const t = s / n, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const dir = [(b[0] - a[0]) / l * 0.03, (b[1] - a[1]) / l * 0.03];
        this.along([p[0] - dir[0], p[1] - dir[1]], [p[0] + dir[0], p[1] + dir[1]], y0, hIn, 0.14, M.frame, g, 0.07);
      }
      this.along(a, b, y0 + 0.95, 0.06, 0.14, M.frame, g, 0.07);
    });
    // punto fijo: panel azul JMC sobre la Calle 56, escalera y ascensor
    // (el lindero de la Calle 56 es z = 0 en el marco local)
    this.along([this.xa, 0], [this.xb, 0], y0, hIn, 0.2, M.core, g, 0.12);
    this.box(0.5, hIn - 0.5, 0.05, M.glass, (this.xa + this.xb) / 2 - 0.25, y0 + 0.25, -0.02, g);
    const coreD = this.D - 0.4;
    this.box(0.15, hIn, coreD, M.plaster, this.xa, y0, 0.2, g);
    this.box(0.15, hIn, coreD, M.plaster, this.xb - 0.15, y0, 0.2, g);
    this.box(1.8, hIn, 1.9, M.core, this.xa + 0.35, y0, this.D - 2.6, g);
    for (let s = 0; s < 9; s++) this.box(1.2, 0.17 * (s + 1), 0.28, M.slab, this.xb - 1.45, y0, 1.2 + s * 0.28, g);

    const price = this.project.cabida.precioVentaM2;
    const mk = (id, poly, east, data) => {
      const vol = new THREE.Mesh(prism(inset(poly, 0.3), hIn - 0.14),
        new THREE.MeshBasicMaterial({ color: 0xd81e28, transparent: true, opacity: 0.16, depthWrite: false }));
      vol.position.y = y0 + 0.06;
      vol.userData.unitId = id;
      vol.renderOrder = 4;
      vol.add(new THREE.LineSegments(new THREE.EdgesGeometry(vol.geometry), new THREE.LineBasicMaterial({ color: 0xff5a5f, transparent: true, opacity: 0.8 })));
      g.add(vol);
      this.unitVolumes.push(vol);
      const a = +area(poly).toFixed(1);
      if (data.typology === 'Apartamento') this._furnish(g, poly, y0, east);
      this.units.push({ id, floor: i + 1, area: a, price: data.typology === 'Apartamento' ? a * price : null, height: '2,78 m libres', ...data,
        worldCenter: () => vol.localToWorld(new THREE.Vector3(...[poly.reduce((s, p) => s + p[0], 0) / poly.length, hIn / 2, poly.reduce((s, p) => s + p[1], 0) / poly.length])) });
    };
    if (i === 0) {
      mk('lobby', this.unitWest, false, { typology: 'Zona común', title: 'Lobby y bicicletero', location: 'Esquina Calle 56 con Carrera 18', facades: 'Calle 56 y Carrera 18' });
      this._lobby(g, y0);
      mk('101', this.unitEast, true, { typology: 'Apartamento', title: 'Apartamento 101', location: 'Medianero sobre la Calle 56', facades: 'Calle 56 (norte)' });
    } else {
      mk(`${i + 1}01`, this.unitWest, false, { typology: 'Apartamento', title: `Apartamento ${i + 1}01`, location: 'Esquinero · Calle 56 con Carrera 18', facades: 'Calle 56 (norte) y Carrera 18 (occidente)' });
      mk(`${i + 1}02`, this.unitEast, true, { typology: 'Apartamento', title: `Apartamento ${i + 1}02`, location: 'Medianero sobre la Calle 56', facades: 'Calle 56 (norte)' });
    }
  }

  /** Amoblamiento de una unidad de ~75 m²: sala-comedor a la fachada, cocina, alcoba y baño al fondo. */
  _furnish(g, poly, y0, east) {
    const xs = poly.map((p) => p[0]), x0 = Math.max(...xs.slice().sort((a, b) => a - b).slice(0, 2)), x1 = Math.min(...xs.slice().sort((a, b) => b - a).slice(0, 2));
    const W = x1 - x0 - 0.5, D = this.D, left = x0 + 0.25;
    const at = (x, w) => (east ? left + x : left + W - x - w); // x medido desde el punto fijo
    const b = (w, h, d, mat, x, y, z) => this.box(w, h, d, mat, at(x, w), y0 + y, z, g);
    const back = D - 4.2; // alcoba al fondo
    b(W, 2.5, 0.1, M.white, 0, 0, back);                     // muro de la alcoba
    b(0.1, 2.5, 2.4, M.white, 2.3, 0, D - 2.6);              // baño
    b(2.1, 0.02, 2.2, M.bath, 0.15, 0.02, D - 2.5);
    b(0.55, 0.42, 0.7, M.quartz, 0.3, 0, D - 1.1);
    b(1.6, 0.48, 2.0, M.bed, W - 2.7, 0, back + 0.6);        // cama doble
    b(1.6, 1.0, 0.08, M.wood, W - 2.7, 0, back + 2.55);
    b(0.6, 2.1, 1.6, M.wood, W - 0.75, 0, back + 2.3);        // clóset
    const kl = Math.max(1.5, back - 3.3);
    b(0.65, 0.88, kl, M.kitchen, 0.1, 0, 3.0);                // cocina contra el punto fijo
    b(0.66, 0.04, kl, M.quartz, 0.1, 0.88, 3.0);
    b(2.4, 0.42, 0.85, M.fabric, W - 3.2, 0, 0.9);            // sala junto a la ventana
    b(0.9, 0.38, 0.55, M.wood, W - 2.45, 0, 2.0);
    b(1.4, 0.75, 0.85, M.wood, 1.2, 0, 1.0);                  // comedor
    b(1.3, 0.04, 0.6, M.floor, W - 1.6, 0.74, back - 1.1);    // zona de trabajo
    b(0.48, 0.48, 0.48, M.fabric, W - 1.2, 0, back - 1.8);
  }

  _lobby(g, y0) {
    this.box(1.8, 1.0, 0.6, M.wood, this.xMin + 2.2, y0, this.D - 1.6, g);       // recepción
    this.box(1.8, 0.42, 0.8, M.fabric, this.xMin + 2.6, y0, 2.2, g);             // sala de espera
    for (let k = 0; k < 6; k++) this.box(0.08, 1.1, 1.6, M.frame, this.xa - 0.6 - k * 0.45, y0, 4.2, g); // bicicletero
  }

  _buildRoof() {
    const y = this.floors * FLOOR_H;
    const r = new THREE.Group();
    r.name = 'Cubierta';
    this.frame.add(r);
    this.roof = r;
    this.poly.forEach((a, k) => this.along(a, this.poly[(k + 1) % this.poly.length], y, 1.05, 0.15, M.slab, r));
    this.box(2.3, 2.6, 2.4, M.core, this.xa + 0.1, y, this.D - 3.0, r);           // sobrecubierta del ascensor
    // terraza comunal (zona BBQ / café lounge): deck, pérgola y jardineras
    const deck = new THREE.Mesh(prism(inset(this.unitEast, 0.6), 0.06), M.deck);
    deck.position.y = y;
    r.add(deck);
    const ex0 = this.xb + 0.8, ex1 = this.xMax - 1.6;
    for (const x of [ex0, ex1]) for (const z of [1.2, this.D - 1.8]) this.box(0.15, 2.6, 0.15, M.frame, x, y, z, r);
    for (let x = ex0; x <= ex1; x += 0.6) this.box(0.08, 0.12, this.D - 2.85, M.wood, x, y + 2.6, 1.2, r);
    this.box(0.5, 0.5, this.D - 2, M.leaf, this.xMax - 1.0, y, 1.0, r);
    this.box(1.6, 0.9, 0.6, M.kitchen, ex0 + 0.4, y, this.D - 1.5, r);           // BBQ
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

  center() { return this.frame.localToWorld(new THREE.Vector3((this.xMin + this.xMax) / 2, this.floors * FLOOR_H / 2, this.D / 2)); }
}
