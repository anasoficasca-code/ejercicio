import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * ParkFurniture — mobiliario urbano y de parque en 3D (medidas reales, en metros) para el patio,
 * los antejardines y los andenes del proyecto: bancas, luminarias, columpios, rodadero, balancín,
 * bicicleteros, canecas, materas y bolardos. Los carros parqueados usan los modelos GLB del
 * masterplan Hotel La Fontana (assets/models, con autorización).
 */
const M = {
  wood: new THREE.MeshStandardMaterial({ color: 0x9a6b43, roughness: 0.65 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.4, metalness: 0.7 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xa9adb2, roughness: 0.3, metalness: 0.85 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xc9c4ba, roughness: 0.9 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc8402f, roughness: 0.5 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xe0a92e, roughness: 0.5 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.5 }),
  green: new THREE.MeshStandardMaterial({ color: 0x3f6f3a, roughness: 0.8 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 }),
  shrub: new THREE.MeshStandardMaterial({ color: 0x4d7d3d, roughness: 0.9 }),
  light: new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe4a8, emissiveIntensity: 0.6, roughness: 0.3 }),
  rope: new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.6, metalness: 0.4 })
};

const box = (g, w, h, d, mat, x, y, z, ry = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  g.add(m);
  return m;
};
const cyl = (g, r, h, mat, x, y, z, seg = 12, rt = r) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, r, h, seg), mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
};
/** Tubo recto entre dos puntos. */
const tube = (g, a, b, r, mat) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), 10), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.add(m);
  return m;
};

/** Banca de listones de madera con patas metálicas y espaldar (1,8 m). */
export function bench() {
  const g = new THREE.Group();
  for (const x of [-0.75, 0.75]) {
    box(g, 0.06, 0.42, 0.5, M.metal, x, 0.21, 0);
    box(g, 0.06, 0.5, 0.06, M.metal, x, 0.67, 0.22);
  }
  for (let k = 0; k < 4; k++) box(g, 1.8, 0.04, 0.09, M.wood, 0, 0.44, -0.18 + k * 0.12);
  for (let k = 0; k < 3; k++) box(g, 1.8, 0.09, 0.035, M.wood, 0, 0.58 + k * 0.13, 0.25);
  return g;
}

/** Luminaria peatonal de 4 m con brazo y luminaria LED. */
export function lamp() {
  const g = new THREE.Group();
  cyl(g, 0.09, 0.3, M.concrete, 0, 0.15, 0, 12, 0.12);
  cyl(g, 0.055, 4.0, M.metal, 0, 2.15, 0, 10, 0.045);
  tube(g, [0, 4.1, 0], [0.55, 4.18, 0], 0.03, M.metal);
  box(g, 0.5, 0.08, 0.22, M.metal, 0.75, 4.18, 0);
  box(g, 0.44, 0.02, 0.18, M.light, 0.75, 4.13, 0);
  return g;
}

/** Columpio doble de estructura en A. */
export function swingSet() {
  const g = new THREE.Group();
  const w = 3.2, h = 2.4;
  for (const x of [-w / 2, w / 2]) {
    tube(g, [x, 0, -0.9], [x, h, 0], 0.05, M.blue);
    tube(g, [x, 0, 0.9], [x, h, 0], 0.05, M.blue);
  }
  tube(g, [-w / 2, h, 0], [w / 2, h, 0], 0.06, M.blue);
  for (const x of [-0.75, 0.75]) {
    tube(g, [x - 0.22, h, 0], [x - 0.22, 0.5, 0], 0.012, M.rope);
    tube(g, [x + 0.22, h, 0], [x + 0.22, 0.5, 0], 0.012, M.rope);
    box(g, 0.5, 0.05, 0.2, M.red, x, 0.48, 0);
  }
  return g;
}

/** Torre con techo, escalera y rodadero. */
export function slide() {
  const g = new THREE.Group();
  const p = 1.2;
  for (const x of [-0.6, 0.6]) for (const z of [-0.6, 0.6]) cyl(g, 0.05, 2.6, M.yellow, x, 1.3, z, 10);
  box(g, 1.3, 0.08, 1.3, M.wood, 0, p, 0);
  for (const s of [-1, 1]) box(g, 1.3, 0.5, 0.04, M.wood, 0, p + 0.3, s * 0.63);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.7, 4), M.red);
  roof.position.set(0, 2.95, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  for (let k = 0; k < 5; k++) box(g, 0.5, 0.04, 0.12, M.metal, -0.95 - k * 0.12, 0.22 + k * 0.24, 0); // escalera
  tube(g, [-0.95, 0, -0.28], [-1.55, 1.25, -0.28], 0.025, M.metal);
  tube(g, [-0.95, 0, 0.28], [-1.55, 1.25, 0.28], 0.025, M.metal);
  const s = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.55), M.blue);
  s.position.set(1.85, 0.72, 0);
  s.rotation.z = -0.5;
  g.add(s);
  for (const z of [-0.3, 0.3]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.04), M.blue);
    w.position.set(1.85, 0.8, z);
    w.rotation.z = -0.5;
    g.add(w);
  }
  return g;
}

/** Balancín. */
export function seesaw() {
  const g = new THREE.Group();
  box(g, 0.25, 0.45, 0.35, M.metal, 0, 0.22, 0);
  const b = box(g, 3.0, 0.06, 0.25, M.yellow, 0, 0.5, 0);
  b.rotation.z = 0.12;
  for (const x of [-1.3, 1.3]) tube(g, [x, 0.5 + x * 0.12, -0.15], [x, 0.75 + x * 0.12, -0.15], 0.02, M.metal);
  return g;
}

/** Bicicletero en U invertida (5 puestos). */
export function bikeRack() {
  const g = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const x = -1.6 + k * 0.8;
    tube(g, [x, 0, -0.35], [x, 0.75, -0.35], 0.025, M.steel);
    tube(g, [x, 0, 0.35], [x, 0.75, 0.35], 0.025, M.steel);
    tube(g, [x, 0.75, -0.35], [x, 0.75, 0.35], 0.025, M.steel);
  }
  return g;
}

/** Caneca de reciclaje doble. */
export function bin() {
  const g = new THREE.Group();
  cyl(g, 0.04, 0.9, M.metal, 0, 0.45, 0, 8);
  cyl(g, 0.2, 0.55, M.green, -0.24, 0.55, 0, 14);
  cyl(g, 0.2, 0.55, M.metal, 0.24, 0.55, 0, 14);
  return g;
}

/** Matera de concreto con arbusto. */
export function planter(w = 1.6, d = 0.6) {
  const g = new THREE.Group();
  box(g, w, 0.5, d, M.concrete, 0, 0.25, 0);
  box(g, w - 0.1, 0.05, d - 0.1, M.soil, 0, 0.5, 0);
  const n = Math.max(1, Math.round(w / 0.6));
  for (let k = 0; k < n; k++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.shrub);
    s.position.set(-w / 2 + (k + 0.5) * (w / n), 0.68, 0);
    s.scale.set(1, 0.8, d / 0.7);
    g.add(s);
  }
  return g;
}

/** Bolardo de concreto. */
export function bollard() {
  const g = new THREE.Group();
  cyl(g, 0.11, 0.8, M.concrete, 0, 0.4, 0, 12, 0.1);
  return g;
}

/** Seto bajo (cerramiento verde de los antejardines). */
export function hedge(len) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.7), M.shrub);
  m.position.y = 0.45;
  g.add(m);
  return g;
}

/** Ubica un objeto en `parent` en (x, z) con giro `ry` y le activa sombras. */
export function place(parent, obj, x, z, ry = 0, y = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  parent.add(obj);
  return obj;
}

const loader = new GLTFLoader();
const cache = {};
/** Carro parqueado (sedan / suv / taxi) con el eje largo del modelo sobre `ry`. */
export function car(parent, kind, x, z, ry, y = 0) {
  const url = `./assets/models/${kind}.glb`;
  (cache[url] ||= loader.loadAsync(url).catch(() => null)).then((gltf) => {
    if (!gltf) return;
    const o = gltf.scene.clone(true);
    place(parent, o, x, z, ry, y);
  });
}
