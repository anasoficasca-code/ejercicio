import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

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

/** Follaje de seto podado: hojas pequeñas en verdes variados, con huecos oscuros entre ellas (canvas, sin descargas). */
let foliage = null;
function foliageMaps() {
  if (foliage) return foliage;
  const N = 256, mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return [c, c.getContext('2d')]; };
  const [c, ctx] = mk(), [hc, hctx] = mk();
  ctx.fillStyle = '#1f3517'; ctx.fillRect(0, 0, N, N);
  hctx.fillStyle = '#000'; hctx.fillRect(0, 0, N, N);
  let s = 99; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 2600; i++) {
    const x = r() * N, y = r() * N, a = r() * Math.PI, l = 3 + r() * 4, w = 1.6 + r() * 1.8, k = r();
    const g = (60 + k * 70) | 0, rr = (g * (0.45 + r() * 0.2)) | 0, bb = (g * (0.3 + r() * 0.15)) | 0;
    for (const [dx, dy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) {
      ctx.fillStyle = `rgb(${rr},${g},${bb})`; ctx.beginPath(); ctx.ellipse(x + dx, y + dy, l, w, a, 0, Math.PI * 2); ctx.fill();
      const v = (90 + k * 165) | 0; hctx.fillStyle = `rgb(${v},${v},${v})`; hctx.beginPath(); hctx.ellipse(x + dx, y + dy, l, w, a, 0, Math.PI * 2); hctx.fill();
    }
  }
  const h = hctx.getImageData(0, 0, N, N).data, out = hctx.createImageData(N, N), d = out.data;
  const H = (x, y) => h[(((y + N) % N) * N + ((x + N) % N)) * 4] / 255;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 3, dy = (H(x, y + 1) - H(x, y - 1)) * 3, l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  hctx.putImageData(out, 0, 0);
  const t = (cv, srgb) => { const x = new THREE.CanvasTexture(cv); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(1.5, 1.5); x.anisotropy = 8; x.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return x; };
  foliage = new THREE.MeshStandardMaterial({ map: t(c, true), normalMap: t(hc, false), normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.85, envMapIntensity: 0.4 });
  return foliage;
}

/** Seto bajo podado (cerramiento verde de los antejardines): volumen con bultos irregulares y follaje. */
export function hedge(len) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(len, 0.9, 0.7, Math.max(2, Math.round(len * 4)), 4, 3);
  const p = geo.attributes.position, uv = geo.attributes.uv, n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // bultos suaves y aristas redondeadas, como un seto podado a mano
    const bump = 0.05 * Math.sin(x * 3.1 + z * 5.3) * Math.cos(y * 4.7 + x * 1.7) + 0.03 * Math.sin(x * 9.2 - y * 6.1);
    n.set(x / (len / 2 + 1e-3), y / 0.45, z / 0.35);
    const corner = Math.max(0, Math.min(Math.abs(n.y), Math.max(Math.abs(n.x), Math.abs(n.z))) - 0.7) * 0.25;
    const k = y > -0.44 ? 1 : 0;
    p.setXYZ(i, x * (1 - corner * 0.02), y - corner * 0.3 * Math.sign(y) * k, z + (z > 0 ? 1 : -1) * (bump - corner * 0.3) * k);
    if (y > 0.44) p.setY(i, 0.45 + bump * 0.8);
    uv.setXY(i, (x + z) * 1.0, y + z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, foliageMaps());
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
    const o = SkeletonUtils.clone(gltf.scene); // los modelos traen esqueleto: clone() normal los deja en el origen
    o.scale.setScalar(0.92);
    place(parent, o, x, z, ry, y);
  });
}
