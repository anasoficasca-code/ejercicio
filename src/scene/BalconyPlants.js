import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * BalconyPlants — vegetación de los balcones (pisos 2 a 6), como en los renders de venta:
 *  · jardineras lineales junto a la baranda de vidrio con arbustos frondosos
 *  · materas grandes con palma areca en las esquinas
 *  · materas medianas con plantas de hoja ancha
 * Las hojas son tarjetas con el atlas de hojas de los árboles (assets/trees/leaves.webp) y todo se dibuja
 * con InstancedMesh: unas pocas llamadas de dibujo por piso.
 *
 * Coordenadas en metros en el marco de la planta de Revit (x oriente, z sur, y arriba).
 */

// celdas del atlas 3 × 3 (fila 0 arriba): rama de fresno, ramita de hoja ancha, fronda de palma
const CELL = { ash: [0, 0], broad: [1, 0], palm: [1, 1] };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Tarjeta de hoja: plano con la celda del atlas, base en el origen y punta hacia +y. */
function card(cell, w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h / 2, 0);
  const [c, r] = CELL[cell], uv = g.attributes.uv;
  const pad = 0.01;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (c + pad + uv.getX(i) * (1 - 2 * pad)) / 3, 1 - (r + 1) / 3 + (pad + uv.getY(i) * (1 - 2 * pad)) / 3);
  }
  return g;
}

/** Arbusto: ramitas en todas direcciones formando una copa redonda (ancho × alto aprox.). */
function bushGeo(w, h, seed, cells = ['broad', 'ash']) {
  const r = rng(seed), parts = [];
  const n = Math.round(46 * w);
  for (let i = 0; i < n; i++) {
    const k = i / n, sz = 0.42 + r() * 0.26;
    const g = card(cells[i % cells.length], sz, sz);
    // las de adentro más paradas y altas, las de afuera más abiertas: copa redonda y tupida
    g.rotateX(-(0.15 + k * 1.0 + r() * 0.35));
    g.rotateY(r() * Math.PI * 2);
    g.translate((r() - 0.5) * w * 0.9, (1 - k) * h * 0.4 + r() * 0.08, (r() - 0.5) * 0.3);
    parts.push(g);
  }
  return mergeGeometries(parts, false);
}

/** Palma areca en matera: frondas arqueadas que salen del centro. */
function palmGeo(height, seed) {
  const r = rng(seed), parts = [];
  for (let s = 0; s < 3; s++) {                      // tres tallos de distinta altura
    const top = height * (0.55 + 0.25 * s / 2), ox = (r() - 0.5) * 0.12, oz = (r() - 0.5) * 0.12;
    const stem = new THREE.CylinderGeometry(0.012, 0.018, top, 5);
    stem.translate(ox, top / 2, oz);
    parts.push({ g: stem, leaf: false });
    for (let i = 0; i < 9; i++) {
      // la celda de la palma es una fronda horizontal: se gira para que salga del tallo y se inclina
      const len = 0.95 + r() * 0.4, g = card('palm', len, len * 0.42);
      g.translate(len / 2, -len * 0.18, 0);          // la fronda va a lo largo de +x, con la base en el tallo
      g.rotateX(Math.PI / 2 + (r() - 0.5) * 0.6);    // hoja casi horizontal, con algo de giro
      g.rotateZ(0.35 + r() * 0.55);                  // sube y se arquea hacia afuera
      g.rotateY((i / 6) * Math.PI * 2 + r() * 0.6);
      g.translate(ox, top, oz);
      parts.push({ g, leaf: true });
    }
  }
  return {
    leaves: mergeGeometries(parts.filter((p) => p.leaf).map((p) => p.g), false),
    stems: mergeGeometries(parts.filter((p) => !p.leaf).map((p) => p.g), false)
  };
}

export class BalconyPlants {
  /**
   * @param floorGroups grupos de cada piso del edificio (índice 0 = piso 1)
   * @param floorH altura de entrepiso (m)
   */
  constructor(floorGroups, floorH) {
    const loader = new THREE.TextureLoader();
    const leafTex = loader.load('./assets/trees/leaves.webp');
    leafTex.colorSpace = THREE.SRGBColorSpace;
    leafTex.anisotropy = 8;
    const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, metalness: 0, envMapIntensity: 0.5 });
    const leafMatDeep = leafMat.clone(); leafMatDeep.color.setHex(0xb8d0a0);   // verde más profundo para las palmas
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x6b7a3e, roughness: 0.8 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0x3a3b3d, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.7 });   // fibrocemento gris grafito
    const potLight = new THREE.MeshStandardMaterial({ color: 0xd9d3c7, roughness: 0.7, envMapIntensity: 0.6 });                 // matera clara
    const troughMat = new THREE.MeshStandardMaterial({ color: 0xa8a39a, roughness: 0.8, envMapIntensity: 0.6 });  // jardinera de concreto claro
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x3b2c20, roughness: 1 });

    // geometrías base
    const bush = bushGeo(1.0, 0.85, 3);                 // tramo de 1 m de jardinera
    const shrub = bushGeo(0.7, 1.0, 9, ['broad', 'broad', 'ash']);      // planta de hoja ancha en matera mediana
    const palm = palmGeo(1.75, 5);
    const trough = new THREE.BoxGeometry(1, 0.42, 0.38); trough.translate(0, 0.21, 0);
    const troughSoil = new THREE.BoxGeometry(0.96, 0.02, 0.34); troughSoil.translate(0, 0.4, 0);
    const bigPot = new THREE.CylinderGeometry(0.27, 0.21, 0.55, 20); bigPot.translate(0, 0.275, 0);
    const midPot = new THREE.CylinderGeometry(0.2, 0.16, 0.42, 18); midPot.translate(0, 0.21, 0);

    // balcones de la planta tipo (leídos de las barandas de vidrio del modelo de Revit)
    //   y: nivel de piso terminado del balcón respecto al nivel del piso
    const B = [
      { y: -0.1, a: [-0.95, -1.12], b: [6.75, -1.12] },  // esquinero sobre la Calle 56
      { y: -0.14, a: [-1.12, -0.6], b: [-1.12, 2.75] },  // su ala sobre la Carrera 18
      { y: -0.1, a: [17.95, -1.12], b: [23.85, -1.12] }, // oriente sobre la Calle 56
      { y: -0.14, a: [-1.12, 8.45], b: [-1.12, 13.15] }  // occidental sobre la Carrera 18
    ];

    floorGroups.forEach((group, f) => {
      if (f === 0) return;                                   // el piso 1 no tiene balcones
      const r = rng(100 + f * 17);
      const lists = { trough: [], soil: [], bush: [], bigPot: [], palm: [], midPot: [], shrub: [], potLight: [] };
      const m4 = (x, y, z, ry = 0, s = 1, sy = s) => new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, sy, s));
      for (const bal of B) {
        const y = f * floorH + bal.y;
        const dx = bal.b[0] - bal.a[0], dz = bal.b[1] - bal.a[1], len = Math.hypot(dx, dz);
        const ux = dx / len, uz = dz / len, ry = -Math.atan2(dz, dx);
        const at = (t) => [bal.a[0] + ux * t, bal.a[1] + uz * t];
        // palma grande en un extremo (alterna de lado por piso) y matera mediana en el otro
        const palmEnd = (f + B.indexOf(bal)) % 2 === 0 ? 0.3 : len - 0.3;
        const otherEnd = palmEnd < 1 ? len - 0.25 : 0.25;
        const [px, pz] = at(palmEnd);
        lists.bigPot.push(m4(px, y, pz));
        lists.palm.push(m4(px, y + 0.5, pz, r() * 6.28, 0.9 + r() * 0.25));
        const [sx, sz] = at(otherEnd);
        const light = r() < 0.5;
        (light ? lists.potLight : lists.midPot).push(m4(sx, y, sz));
        lists.shrub.push(m4(sx, y + 0.38, sz, r() * 6.28, 0.9 + r() * 0.3));
        // jardinera continua entre las materas, en tramos de 1 m, con huecos de vez en cuando
        const t0 = Math.min(palmEnd, otherEnd) + 0.55, t1 = Math.max(palmEnd, otherEnd) - 0.5;
        for (let t = t0 + 0.5; t <= t1 - 0.5 + 1e-3; t += 1) {
          if (len > 5 && r() < 0.18) continue;               // un tramo libre para asomarse
          const [x, z] = at(t);
          lists.trough.push(m4(x, y, z, ry));
          lists.soil.push(m4(x, y, z, ry));
          lists.bush.push(m4(x, y + 0.38, z, ry + (r() < 0.5 ? 0 : Math.PI), 0.9 + r() * 0.25, 0.8 + r() * 0.45));
        }
      }
      const add = (geo, mat, list, shadow = true) => {
        if (!list.length) return;
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((mm, i) => im.setMatrixAt(i, mm));
        im.castShadow = shadow; im.receiveShadow = true;
        im.computeBoundingSphere();
        im.name = 'Plantas de balcón';
        group.add(im);
      };
      add(trough, troughMat, lists.trough);
      add(troughSoil, soilMat, lists.soil, false);
      add(bush, leafMat, lists.bush);
      add(bigPot, potMat, lists.bigPot);
      add(midPot, potMat, lists.midPot);
      add(midPot, potLight, lists.potLight);
      add(palm.leaves, leafMatDeep, lists.palm);
      add(palm.stems, stemMat, lists.palm, false);
      add(shrub, leafMat, lists.shrub);
    });
  }
}
