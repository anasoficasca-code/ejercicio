import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { prismGeometry, obb } from './CityContext.js';
import { makeTileTexture } from './FacadeTextures.js';

/**
 * Church — la iglesia de la manzana vecina (lote catastral 007208001002, Calle 56 con Carrera 18),
 * frente al proyecto sobre la Calle 56. Catastro la registra como una construcción de 1 piso, así
 * que su volumen se reconstruye según Street View: nave en pañete beige con ventanales de arco de
 * medio punto y cubierta de teja a dos aguas, y torre campanario cuadrada (la construcción de
 * 5 pisos sobre la Calle 56) rematada en campanario con arcos y cubierta baja de teja.
 */
export class Church {
  constructor(scene, { nave, tower, textures }) {
    this.group = new THREE.Group();
    this.group.name = 'Iglesia';
    scene.add(this.group);
    const tile = makeTileTexture();
    const roofMat = new THREE.MeshStandardMaterial({ map: tile, roughness: 0.8, side: THREE.DoubleSide });
    const wall = new THREE.MeshStandardMaterial({ map: textures.iglesiaMuro, roughness: 0.92 });
    const wall2 = new THREE.MeshStandardMaterial({ map: textures.iglesiaMuro, roughness: 0.92, side: THREE.DoubleSide });
    const trim = new THREE.MeshStandardMaterial({ color: 0xefe8d8, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x232c38, roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide });
    const base = 0.16, wallH = 10.5;

    // --- nave
    const g = prismGeometry(nave.pts, base, base + wallH, { floorH: wallH, bayW: 4.2 });
    this.group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: textures.iglesiaNave, roughness: 0.92 })));
    const o = obb(nave.pts);
    const ridge = (o.w / 2) * Math.tan(THREE.MathUtils.degToRad(24));
    const roof = new THREE.Mesh(gableRoof(o.l + 1.2, o.w + 1.2, ridge), roofMat);
    roof.position.set(o.cx, base + wallH, o.cz);
    roof.rotation.y = -o.angle;
    this.group.add(roof);
    for (const s of [-1, 1]) {
      const tri = new THREE.Shape([new THREE.Vector2(-o.w / 2, 0), new THREE.Vector2(o.w / 2, 0), new THREE.Vector2(0, ridge)]);
      const gab = new THREE.Mesh(new THREE.ShapeGeometry(tri), wall2);
      gab.position.set(o.cx + Math.cos(o.angle) * s * o.l / 2, base + wallH, o.cz + Math.sin(o.angle) * s * o.l / 2);
      gab.rotation.y = -o.angle + Math.PI / 2;
      this.group.add(gab);
      const rose = new THREE.Mesh(new THREE.CircleGeometry(Math.min(1.6, ridge * 0.28), 24), dark);
      rose.position.copy(gab.position).add(new THREE.Vector3(Math.cos(o.angle) * s * 0.06, ridge * 0.4, Math.sin(o.angle) * s * 0.06));
      rose.rotation.y = gab.rotation.y;
      this.group.add(rose);
    }

    // --- torre: fuste en pañete, cornisa clara, campanario con arcos y cubierta baja de teja
    const t = obb(tower.pts);
    const shaftH = 14.5, belfryH = 4.2;
    this.group.add(new THREE.Mesh(prismGeometry(tower.pts, base, base + shaftH, { floorH: shaftH, bayW: 10 }), wall));
    const at = (lx, lz) => [t.cx + lx * Math.cos(t.angle) - lz * Math.sin(t.angle), t.cz + lx * Math.sin(t.angle) + lz * Math.cos(t.angle)];
    const boxAt = (w, h, d, mat, lx, y, lz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      const [x, z] = at(lx, lz);
      m.position.set(x, y + h / 2, z);
      m.rotation.y = -t.angle;
      this.group.add(m);
      return m;
    };
    const bl = t.l * 0.86, bw = t.w * 0.86, y1 = base + shaftH;
    boxAt(t.l + 0.5, 0.45, t.w + 0.5, trim, 0, y1, 0);                      // cornisa
    boxAt(bl, belfryH, bw, wall, 0, y1 + 0.45, 0);                            // cuerpo del campanario
    // dos vanos por cara
    for (const [ax, az, len] of [[1, 0, bw], [-1, 0, bw], [0, 1, bl], [0, -1, bl]]) {
      for (const k of [-0.25, 0.25]) {
        const off = ax ? [ax * (bl / 2 + 0.02), k * len] : [k * len, az * (bw / 2 + 0.02)];
        const vw = Math.min(0.9, len * 0.28), vh = belfryH * 0.62;
        boxAt(ax ? 0.12 : vw, vh, ax ? vw : 0.12, dark, off[0], y1 + 0.95, off[1]);
      }
    }
    boxAt(bl + 0.4, 0.35, bw + 0.4, trim, 0, y1 + 0.45 + belfryH, 0);         // cornisa alta
    const cap = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(bl, bw) / 2 + 0.2, 2.4, 4), roofMat);
    cap.position.set(t.cx, y1 + 0.8 + belfryH + 1.2, t.cz);
    cap.rotation.y = -t.angle + Math.PI / 4;
    this.group.add(cap);
    const topY = y1 + 0.8 + belfryH + 2.4;
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), dark);
    crossV.position.set(t.cx, topY + 0.7, t.cz);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), dark);
    crossH.position.set(t.cx, topY + 0.95, t.cz);
    crossH.rotation.y = -t.angle;
    this.group.add(crossV, crossH);

    this.group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

    const el = document.createElement('div');
    el.className = 'poi-pin';
    el.style.setProperty('--pin', '#b9a986');
    el.innerHTML = '<div class="poi-pin-card"><i></i><div><strong>Iglesia</strong><span>Frente al lote · Calle 56 con Carrera 18</span></div></div><div class="poi-pin-stem"></div>';
    const label = new CSS2DObject(el);
    label.position.set(t.cx, topY + 5, t.cz);
    label.center.set(0.5, 1);
    this.group.add(label);
    this.label = label;
  }
}

/** Cubierta a dos aguas centrada en el origen: largo sobre X, ancho sobre Z, cumbrera a `ridge` m. */
export function gableRoof(L, W, ridge) {
  const x = L / 2, z = W / 2;
  const v = [
    -x, 0, -z, x, 0, -z, x, ridge, 0, -x, 0, -z, x, ridge, 0, -x, ridge, 0,
    -x, 0, z, -x, ridge, 0, x, ridge, 0, -x, 0, z, x, ridge, 0, x, 0, z
  ];
  const slope = Math.hypot(z, ridge);
  const uv = [0, 0, L / 4, 0, L / 4, slope / 4, 0, 0, L / 4, slope / 4, 0, slope / 4,
    0, 0, 0, slope / 4, L / 4, slope / 4, 0, 0, L / 4, slope / 4, L / 4, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
