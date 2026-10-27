import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { prismGeometry, obb } from './CityContext.js';
import { makeTileTexture } from './FacadeTextures.js';

/**
 * Church — la iglesia de la manzana vecina (lote catastral 007208001002, Calle 56 con Carrera 18),
 * frente al proyecto sobre la Calle 56. Catastro la registra como una construcción de 1 piso,
 * así que su volumen se reconstruye: nave de muros altos en ladrillo con cubierta a dos aguas
 * sobre la huella real y torre campanario (la construcción de 5 pisos sobre la Calle 56) con chapitel.
 */
export class Church {
  constructor(scene, { nave, tower, textures }) {
    this.group = new THREE.Group();
    this.group.name = 'Iglesia';
    scene.add(this.group);
    const brick = new THREE.MeshStandardMaterial({ map: textures.iglesia, roughness: 0.9 });
    const tile = makeTileTexture();
    const roofMat = new THREE.MeshStandardMaterial({ map: tile, roughness: 0.8, side: THREE.DoubleSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d2128, roughness: 0.3, metalness: 0.2 });
    const stone = new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.8 });
    const brick2 = new THREE.MeshStandardMaterial({ map: textures.iglesia, roughness: 0.9, side: THREE.DoubleSide });
    const dark2 = new THREE.MeshStandardMaterial({ color: 0x1d2128, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide });
    const base = 0.16, wallH = 11;

    // --- nave
    const g = prismGeometry(nave.pts, base, base + wallH, { floorH: wallH, bayW: 4.5 });
    const naveMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: textures.iglesiaNave, roughness: 0.9 }));
    this.group.add(naveMesh);
    const o = obb(nave.pts);
    const pitch = Math.tan(THREE.MathUtils.degToRad(26));
    const ridge = (o.w / 2) * pitch;
    const roofGeo = gableRoof(o.l + 1.2, o.w + 1.2, ridge);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(o.cx, base + wallH, o.cz);
    roof.rotation.y = -o.angle;
    this.group.add(roof);
    // hastiales en ladrillo con rosetón (los ventanales de la nave van en la textura del muro)
    for (const s of [-1, 1]) {
      const tri = new THREE.Shape([new THREE.Vector2(-o.w / 2, 0), new THREE.Vector2(o.w / 2, 0), new THREE.Vector2(0, ridge)]);
      const gab = new THREE.Mesh(new THREE.ShapeGeometry(tri), brick2);
      gab.position.set(o.cx + Math.cos(o.angle) * s * o.l / 2, base + wallH, o.cz + Math.sin(o.angle) * s * o.l / 2);
      gab.rotation.y = -o.angle + Math.PI / 2;
      this.group.add(gab);
      const rose = new THREE.Mesh(new THREE.CircleGeometry(Math.min(2.2, ridge * 0.3), 24), dark2);
      rose.position.copy(gab.position).add(new THREE.Vector3(Math.cos(o.angle) * s * 0.06, ridge * 0.38, Math.sin(o.angle) * s * 0.06));
      rose.rotation.y = gab.rotation.y;
      this.group.add(rose);
    }

    // --- torre campanario
    const towerH = 24;
    const tg = prismGeometry(tower.pts, base, base + towerH, { floorH: 4, bayW: 3.2 });
    this.group.add(new THREE.Mesh(tg, brick));
    const t = obb(tower.pts);
    const r = Math.max(t.l, t.w) / 2;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ext = dx ? t.l / 2 : t.w / 2;
      const op = new THREE.Mesh(new THREE.BoxGeometry(dx ? 0.3 : 1.6, 3.2, dx ? 1.6 : 0.3), dark);
      const lx = dx * (ext + 0.05), lz = dz * (ext + 0.05);
      op.position.set(t.cx + lx * Math.cos(t.angle) - lz * Math.sin(t.angle), base + towerH - 3.2, t.cz + lx * Math.sin(t.angle) + lz * Math.cos(t.angle));
      op.rotation.y = -t.angle;
      this.group.add(op);
    }
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(t.l + 0.6, 0.5, t.w + 0.6), stone);
    cornice.position.set(t.cx, base + towerH + 0.25, t.cz);
    cornice.rotation.y = -t.angle;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(r * 1.05, 9, 4), roofMat);
    spire.position.set(t.cx, base + towerH + 0.5 + 4.5, t.cz);
    spire.rotation.y = -t.angle + Math.PI / 4;
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), dark);
    crossV.position.set(t.cx, base + towerH + 10.4, t.cz);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.18), dark);
    crossH.position.set(t.cx, base + towerH + 10.8, t.cz);
    crossH.rotation.y = -t.angle;
    this.group.add(cornice, spire, crossV, crossH);

    this.group.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

    const el = document.createElement('div');
    el.className = 'poi-pin';
    el.style.setProperty('--pin', '#a5553a');
    el.innerHTML = '<div class="poi-pin-card"><i></i><div><strong>Iglesia</strong><span>Frente al lote · Calle 56 con Carrera 18</span></div></div><div class="poi-pin-stem"></div>';
    const label = new CSS2DObject(el);
    label.position.set(t.cx, base + towerH + 14, t.cz);
    label.center.set(0.5, 1);
    this.group.add(label);
    this.label = label;
  }
}

/** Cubierta a dos aguas centrada en el origen: largo sobre X, ancho sobre Z, cumbrera a `ridge` m. */
function gableRoof(L, W, ridge) {
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
