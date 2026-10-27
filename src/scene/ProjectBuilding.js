import * as THREE from 'three';

/**
 * ProjectBuilding — cabida arquitectónica sobre el lote 02 (Calle 56 # 17-53, esquina Carrera 18).
 *
 * El volumen sale del lote catastral real: se toma el lindero sobre la Calle 56 como eje X local y la
 * perpendicular hacia el fondo como eje Z, y se retira el antejardín de 3,50 m de ambas vías.
 * 6 pisos de 3,00 m (18,00 m), huella ≈ 15,1 × 6,9 m, fachadas acristaladas sobre las dos calles,
 * culatas de empate sobre los colindantes (no se exigen aislamientos) y punto fijo central.
 *
 * Esquema de unidades: piso 1 = lobby y bicicletero (esquina) + punto fijo + apartaestudio 101;
 * pisos 2–6 = apartaestudio esquinero (x01) + punto fijo + apartaestudio medianero (x02) → 11 unidades.
 */
const M = {
  slab: new THREE.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 0.7 }),
  plaster: new THREE.MeshStandardMaterial({ color: 0xe4dfd6, roughness: 0.9 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x8aa2b8, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, envMapIntensity: 1.4, depthWrite: false }),
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
  grass: new THREE.MeshStandardMaterial({ color: 0x6f8f4e, roughness: 1 }),
  paving: new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.9, flatShading: true }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 })
};

const FLOOR_H = 3.0, SLAB = 0.22;

export class ProjectBuilding {
  constructor(scene, { lot, project }) {
    this.scene = scene;
    this.project = project;
    const cab = project.cabida;
    this.group = new THREE.Group();
    this.group.name = 'Proyecto · Lote 02';
    scene.add(this.group);

    // --- marco local alineado con el lote ------------------------------------------------
    const pts = lot.pts.map(([x, z]) => new THREE.Vector2(x, z));
    let north = 0, best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const mz = (pts[i].y + pts[(i + 1) % pts.length].y) / 2;
      if (mz < best) { best = mz; north = i; }
    }
    let B = pts[north], C = pts[(north + 1) % pts.length];
    if (B.x > C.x) [B, C] = [C, B];
    const u = C.clone().sub(B).normalize();
    const v = new THREE.Vector2(-u.y, u.x); // perpendicular hacia el fondo (sur)
    const depthLot = Math.max(...pts.map((p) => p.clone().sub(B).dot(v)));
    const lenLot = B.distanceTo(C);
    const ant = project.normaPredio.antejardinM;
    this.L = Math.min(cab.huellaLargoM, lenLot - ant);
    this.D = Math.min(cab.huellaFondoM, depthLot - ant);
    this.W = cab.areaUnidadM2 / this.D;         // ancho de un apartaestudio de 35 m²
    this.floors = cab.pisos;

    this.frame = new THREE.Group();
    const o = B.clone().addScaledVector(u, ant).addScaledVector(v, ant);
    this.frame.position.set(o.x, 0.18, o.y);
    this.frame.rotation.y = Math.atan2(-u.y, u.x);
    this.group.add(this.frame);
    this.lotLocal = pts.map((p) => { const d = p.clone().sub(o); return [d.dot(u), d.dot(v)]; });

    this.floorGroups = [];
    this.ceilings = [];
    this.unitVolumes = [];
    this.units = [];
    this._buildSite(ant);
    for (let i = 0; i < this.floors; i++) this._buildFloor(i);
    this._buildRoof();
    this.group.traverse((m) => { if (m.isMesh && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } });
    this.setCut(null);
  }

  box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x + w / 2, y + h / 2, z + d / 2);
    (parent || this.frame).add(m);
    return m;
  }

  // ---------------------------------------------------------------- lote y antejardín
  _buildSite(ant) {
    const shape = new THREE.Shape(this.lotLocal.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    const grass = new THREE.Mesh(g, M.grass);
    grass.position.y = 0.02;
    this.frame.add(grass);
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(this.lotLocal.map(([x, z]) => new THREE.Vector3(x, 0.06, z))),
      new THREE.LineBasicMaterial({ color: 0xd81e28 }));
    this.frame.add(edge);
    // acceso peatonal al lobby (esquina, desde la Calle 56) y andén interior
    this.box(2.2, 0.05, ant, M.paving, 1.2, 0.02, -ant);
    this.box(this.L + ant, 0.04, 0.9, M.paving, -ant, 0.02, -0.9);
    // arborización del antejardín
    const tree = (x, z, s = 1) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.13 * s, 2.4 * s, 6), M.bark);
      t.position.set(x, 1.2 * s, z);
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25 * s, 0), M.leaf);
      c.position.set(x, 2.9 * s, z);
      c.scale.y = 0.85;
      this.frame.add(t, c);
    };
    tree(6.2, -2.2); tree(10.4, -2.2, 0.9); tree(14.2, -2.2); tree(-2.2, 3.6, 0.95);
    for (const [x, z] of [[4.2, -0.5], [8.4, -0.5], [12.4, -0.5], [-0.5, 1.6], [-0.5, 5.4]]) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), M.leaf);
      s.position.set(x, 0.35, z);
      this.frame.add(s);
    }
  }

  // ---------------------------------------------------------------- piso tipo
  _buildFloor(i) {
    const { L, D, W } = this;
    const y0 = i * FLOOR_H, hIn = FLOOR_H - SLAB;
    const g = new THREE.Group();
    g.name = `Piso ${i + 1}`;
    this.frame.add(g);
    this.floorGroups.push(g);

    if (i === 0) this.box(L + 0.24, SLAB, D + 0.24, M.slab, -0.12, -SLAB, -0.12, g);
    // piso acabado
    this.box(L - 0.4, 0.02, D - 0.4, M.floor, 0.2, 0.01 + y0, 0.2, g);
    // losa superior (cielo de este piso)
    const ceil = this.box(L + 0.24, SLAB, D + 0.24, M.slab, -0.12, y0 + hIn, -0.12, g);
    this.ceilings.push(ceil);

    // culatas de empate (oriente y fondo)
    this.box(0.2, hIn, D, M.plaster, L - 0.2, y0, 0, g);
    this.box(L, hIn, 0.2, M.plaster, 0, y0, D - 0.2, g);

    // fachadas: vidrio de piso a techo con perfilería negra mate; punto fijo en panel azul JMC
    const core0 = W, core1 = L - W;
    const facadeX = (x0, x1) => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, hIn), M.glass);
      glass.position.set((x0 + x1) / 2, y0 + hIn / 2, 0.06);
      glass.rotation.y = Math.PI;
      glass.renderOrder = 3;
      g.add(glass);
      const n = Math.max(2, Math.round((x1 - x0) / 1.3));
      for (let k = 0; k <= n; k++) this.box(0.06, hIn, 0.12, M.frame, x0 + ((x1 - x0) * k) / n - 0.03, y0, 0, g);
      this.box(x1 - x0, 0.06, 0.12, M.frame, x0, y0 + 0.95, 0, g);
    };
    facadeX(0, core0);
    facadeX(core1, L);
    this.box(core1 - core0, hIn, 0.18, M.core, core0, y0, 0, g);
    this.box(0.5, hIn - 0.5, 0.05, M.glass, (core0 + core1) / 2 - 0.25, y0 + 0.25, -0.03, g);
    // fachada sobre la Carrera 18 (lado occidental, x = 0)
    const gw = new THREE.Mesh(new THREE.PlaneGeometry(D, hIn), M.glass);
    gw.position.set(0.06, y0 + hIn / 2, D / 2);
    gw.rotation.y = -Math.PI / 2;
    gw.renderOrder = 3;
    g.add(gw);
    const nW = Math.round(D / 1.3);
    for (let k = 0; k <= nW; k++) this.box(0.12, hIn, 0.06, M.frame, 0, y0, (D * k) / nW - 0.03, g);
    this.box(0.12, 0.06, D, M.frame, 0, y0 + 0.95, 0, g);

    // punto fijo: escalera + ascensor
    this.box(0.15, hIn, D - 0.2, M.plaster, core0, y0, 0.18, g);
    this.box(0.15, hIn, D - 0.2, M.plaster, core1 - 0.15, y0, 0.18, g);
    this.box(1.6, hIn, 1.7, M.core, core0 + 0.35, y0, D - 1.95, g);
    for (let s = 0; s < 9; s++) this.box(1.1, 0.17 * (s + 1), 0.28, M.slab, core1 - 1.35, y0, 1.0 + s * 0.28, g);

    // unidades
    const mk = (id, x0, mirror, data) => {
      const vol = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, hIn - 0.12, D - 0.4),
        new THREE.MeshBasicMaterial({ color: 0xd81e28, transparent: true, opacity: 0.22, depthWrite: false }));
      vol.position.set(x0 + W / 2, y0 + hIn / 2, D / 2);
      vol.userData.unitId = id;
      vol.renderOrder = 4;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(vol.geometry), new THREE.LineBasicMaterial({ color: 0xff5a5f, transparent: true, opacity: 0.8 }));
      vol.add(edges);
      g.add(vol);
      this.unitVolumes.push(vol);
      if (data.typology === 'Apartaestudio') this._furnish(g, x0, y0, mirror);
      this.units.push({ id, floor: i + 1, ...data, worldCenter: () => vol.getWorldPosition(new THREE.Vector3()) });
    };
    const price = this.project.cabida.precioVentaM2 * this.project.cabida.areaUnidadM2;
    const base = { area: this.project.cabida.areaUnidadM2, price, height: '2,78 m libres' };
    if (i === 0) {
      mk('lobby', 0, false, { typology: 'Zona común', title: 'Lobby y bicicletero', location: 'Esquina Calle 56 con Carrera 18', facades: 'Calle 56 y Carrera 18', area: +(W * D).toFixed(1), height: '2,78 m libres' });
      this._lobby(g, y0);
      mk('101', core1, true, { ...base, typology: 'Apartaestudio', title: 'Apartaestudio 101', location: 'Medianero sobre la Calle 56', facades: 'Calle 56 (norte)' });
    } else {
      mk(`${i + 1}01`, 0, false, { ...base, typology: 'Apartaestudio', title: `Apartaestudio ${i + 1}01`, location: 'Esquinero · Calle 56 con Carrera 18', facades: 'Calle 56 (norte) y Carrera 18 (occidente)' });
      mk(`${i + 1}02`, core1, true, { ...base, typology: 'Apartaestudio', title: `Apartaestudio ${i + 1}02`, location: 'Medianero sobre la Calle 56', facades: 'Calle 56 (norte)' });
    }
  }

  /** Amoblamiento del apartaestudio de 35 m² según la lámina "El apartaestudio". */
  _furnish(g, x0, y0, mirror) {
    const { W, D } = this;
    const at = (x, w) => (mirror ? x0 + W - x - w : x0 + x);
    const b = (w, h, d, mat, x, y, z) => this.box(w, h, d, mat, at(x, w), y0 + y, z, g);
    // baño (porcelanato gris) en el fondo
    b(2.0, 2.4, 0.08, M.white, 0.15, 0, D - 2.45);
    b(0.08, 2.4, 2.25, M.white, 2.15, 0, D - 2.45);
    b(1.9, 0.02, 2.15, M.bath, 0.2, 0.02, D - 2.4);
    b(0.55, 0.42, 0.7, M.quartz, 0.35, 0, D - 1.0);
    // cocina abierta: muebles grafito y mesón de cuarzo blanco contra el fondo
    b(W - 2.6, 0.88, 0.62, M.kitchen, 2.35, 0, D - 0.82);
    b(W - 2.6, 0.04, 0.64, M.quartz, 2.35, 0.88, D - 0.83);
    b(W - 2.6, 0.7, 0.35, M.kitchen, 2.35, 1.55, D - 0.55);
    // cama doble
    b(1.5, 0.45, 2.0, M.bed, 0.25, 0, 2.15);
    b(1.5, 0.95, 0.08, M.wood, 0.25, 0, 4.1);
    // sofá y mesa auxiliar
    b(0.8, 0.42, 1.8, M.fabric, W - 1.15, 0, 2.2);
    b(0.55, 0.38, 0.55, M.wood, W - 2.05, 0, 2.85);
    // zona de trabajo junto a la ventana
    b(1.3, 0.04, 0.6, M.floor, 1.9, 0.74, 0.35);
    b(0.06, 0.74, 0.6, M.kitchen, 1.92, 0, 0.35);
    b(0.06, 0.74, 0.6, M.kitchen, 3.12, 0, 0.35);
    b(0.48, 0.48, 0.48, M.fabric, 2.3, 0, 1.05);
  }

  _lobby(g, y0) {
    const { W, D } = this;
    this.box(1.8, 1.0, 0.6, M.wood, 1.4, y0, D - 1.2, g);       // recepción
    this.box(1.6, 0.42, 0.8, M.fabric, 0.6, y0, 2.0, g);        // sala de espera
    for (let k = 0; k < 4; k++) this.box(0.08, 1.1, 1.6, M.frame, W - 0.6 - k * 0.45, y0, 3.2, g); // bicicletero
  }

  _buildRoof() {
    const { L, D, W } = this;
    const y = this.floors * FLOOR_H;
    const r = new THREE.Group();
    r.name = 'Cubierta';
    this.frame.add(r);
    this.roof = r;
    this.box(L + 0.24, 1.0, 0.15, M.slab, -0.12, y, -0.12, r);
    this.box(L + 0.24, 1.0, 0.15, M.slab, -0.12, y, D - 0.03, r);
    this.box(0.15, 1.0, D + 0.24, M.slab, -0.12, y, -0.12, r);
    this.box(0.15, 1.0, D + 0.24, M.slab, L - 0.03, y, -0.12, r);
    this.box(2.3, 2.6, 2.4, M.core, W + 0.2, y, D - 2.7, r); // sobrecubierta del ascensor
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
      v.visible = show && inFilter || sel;
      v.material.opacity = sel ? 0.3 : hov ? 0.34 : 0.16;
      v.material.color.setHex(sel ? 0xd81e28 : 0xe0484f);
      v.children[0].material.opacity = sel ? 1 : 0.7;
    }
  }

  center() { return this.frame.localToWorld(new THREE.Vector3(this.L / 2, this.floors * FLOOR_H / 2, this.D / 2)); }
}
