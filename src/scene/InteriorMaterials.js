import * as THREE from 'three';

/**
 * InteriorMaterials — acabados del mobiliario de Revit según el nombre de su material: tela con trama,
 * madera con veta, porcelana brillante, metal cepillado, piedra pulida y lacas. Las texturas se dibujan en
 * canvas (sin descargas) y se aplican con las coordenadas por proyección de caja en metros (boxUV).
 * También el piso de roble de los apartamentos.
 */

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function canvasTex(w, h, draw, srgb = true, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.repeat.set(repeat, repeat);
  return t;
}

/** Veta de madera clara (gris = intensidad; el color lo pone el material). Tesela de 1 m. */
function woodGrain(seed) {
  const r = rng(seed);
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = r() * h, a = 0.04 + r() * 0.1, wob = 2 + r() * 6;
      ctx.strokeStyle = `rgba(${r() < 0.5 ? 60 : 255},${r() < 0.5 ? 50 : 245},40,${a})`;
      ctx.lineWidth = 0.6 + r() * 2.2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / (40 + r() * 60) + i) * wob);
      ctx.stroke();
    }
  });
}

/** Piso de nogal: tablas de 1,20 × 0,19 m con juntas, veta y tono variable (como los renders). Tesela de 2,4 m. */
function oakPlanks() {
  const r = rng(91);
  const map = canvasTex(1024, 1024, (ctx, w, h) => {
    const rows = 12, rowH = h / rows;
    for (let j = 0; j < rows; j++) {
      const off = (j % 3) * (w / 6);
      for (let k = -1; k < 3; k++) {
        const x = off + k * (w / 2), tone = 0.82 + r() * 0.26;
        ctx.fillStyle = `rgb(${Math.round(112 * tone)},${Math.round(70 * tone)},${Math.round(44 * tone)})`;
        ctx.fillRect(x, j * rowH, w / 2, rowH);
        for (let s = 0; s < 22; s++) {
          ctx.strokeStyle = `rgba(${r() < 0.5 ? '52,30,16' : '150,100,62'},${0.06 + r() * 0.1})`;
          ctx.lineWidth = 0.6 + r() * 1.6;
          const y = j * rowH + r() * rowH;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let q = 0; q <= w / 2; q += 24) ctx.lineTo(x + q, y + Math.sin(q / 50 + s) * 1.6);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(30,18,10,0.6)';
        ctx.fillRect(x, j * rowH, 2, rowH);
      }
      ctx.fillStyle = 'rgba(30,18,10,0.55)';
      ctx.fillRect(0, j * rowH, w, 2);
    }
  }, true, 1 / 2.4);
  return map;
}

/** Porcelanato claro tipo travertino (baños, pasillos, ropas y punto fijo): piezas de 60 × 60 cm. Tesela de 1,2 m. */
function lightTiles() {
  const r = rng(57);
  return canvasTex(512, 512, (ctx, w, h) => {
    const n = 2, s = w / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const t = 0.94 + r() * 0.08;
      ctx.fillStyle = `rgb(${Math.round(226 * t)},${Math.round(216 * t)},${Math.round(200 * t)})`;
      ctx.fillRect(i * s, j * s, s, s);
      for (let k = 0; k < 90; k++) {               // poros y vetas suaves del travertino
        ctx.fillStyle = `rgba(${r() < 0.5 ? '180,166,144' : '245,238,226'},${0.1 + r() * 0.2})`;
        ctx.fillRect(i * s + r() * s, j * s + r() * s, 2 + r() * 14, 1 + r() * 2);
      }
    }
    ctx.fillStyle = 'rgba(150,138,120,0.7)';
    for (let k = 0; k <= n; k++) { ctx.fillRect(k * s - 1, 0, 2, h); ctx.fillRect(0, k * s - 1, w, 2); }
  }, true, 1 / 1.2);
}

/**
 * Zonas de piso claro en la planta tipo (metros desde la esquina Calle 56 / Carrera 18, x oriente, z sur):
 * baños, ropas, depósitos y pasillos de los apartamentos A y B (de Revit) y sus espejos C y D, más el punto fijo.
 */
const PW = 24.84;
const ZONES_A = [[3.04, 5.15, 4.23, 7.75], [4.34, 5.15, 6.23, 7.75], [6.34, 5.15, 7.73, 7.75], [10.24, 2.5, 12.06, 4.36], [2.98, 3.9, 9.41, 5.1], [7.78, 5.1, 9.41, 7.83]];
const ZONES_B = [[4.44, 7.91, 5.83, 9.34], [5.94, 7.91, 7.93, 9.34], [8.04, 7.91, 9.33, 9.34], [10.64, 11.05, 12.22, 12.54], [4.38, 9.4, 12.3, 11.0]];
const mirror = ([x0, z0, x1, z1]) => [PW - x1, z0, PW - x0, z1];
export const FLOOR_ZONES = [...ZONES_A, ...ZONES_B, ...ZONES_A.map(mirror), ...ZONES_B.map(mirror), [9.41, 4.44, 15.26, 9.52]];

/** Trama de tela (relieve): urdimbre y trama finas. Tesela de 0,25 m. */
function fabricBump() {
  const r = rng(7);
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { ctx.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.08})`; ctx.fillRect(0, y, w, 2); }
    for (let x = 0; x < w; x += 4) { ctx.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.08})`; ctx.fillRect(x, 0, 2, h); }
  }, false, 4);
}

let lib = null;
function build() {
  const wood = woodGrain(13), fabric = fabricBump();
  return {
    wood: (c) => new THREE.MeshStandardMaterial({ color: c, map: wood, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }),
    fabric: (c) => new THREE.MeshPhysicalMaterial({ color: c, bumpMap: fabric, bumpScale: 0.6, roughness: 0.95, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.3), side: THREE.DoubleSide }),
    leather: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0, side: THREE.DoubleSide }),
    porcelain: (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
    metal: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.92, side: THREE.DoubleSide }),
    stone: (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, clearcoat: 0.4, clearcoatRoughness: 0.2, side: THREE.DoubleSide }),
    lacquer: (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.25, side: THREE.DoubleSide }),
    plant: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide }),
    plain: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdfe8ea, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
    cache: new Map()
  };
}

const RULES = [
  [/glass|vidrio/i, 'glass'],
  [/finsa-cabinets|cabinets-pro|larder|pro base/i, 'wood'],          // gabinetes de cocina: frentes de nogal
  [/leather|cuero/i, 'leather'],
  [/fabric|textil|textile|linen|lino|polyester|seat|lyris|carpet|tapete|cushion|cojin|bed|cama|sofa|couch|lana|wool/i, 'fabric'],
  [/porcel|ceram|sanitary|toilet|lavamanos|basin|vitreous/i, 'porcelain'],
  [/chrome|cromo|steel|acero|stainless|alumin|metal|alloy|brass|lat[oó]n/i, 'metal'],
  [/quartz|cuarzo|marble|m[aá]rmol|carrara|salvatori|worktop|fintop|granit|stone|piedra|concrete/i, 'stone'],
  [/wood|madera|oak|roble|teak|pine|pino|abedul|birch|brich|walnut|nogal|veneer|laminate|fawn|cypress|table|mesa/i, 'wood'],
  [/veg|leaf|hoja|plant|ficus|stalk|stem/i, 'plant'],
  [/black|negro|graphite|grafito|paint|lacquer|laca|plastic|pl[aá]stico/i, 'lacquer']
];

/** Material realista para una malla de mobiliario (color de Revit + nombre de su material). */
export function interiorMaterial(hex, name = '', glass = false) {
  lib ??= build();
  if (glass) return lib.glass;
  const key = `${hex}|${name}`;
  if (lib.cache.has(key)) return lib.cache.get(key);
  const kind = (RULES.find(([re]) => re.test(name)) || [null, 'plain'])[1];
  if (kind === 'glass') return lib.glass;
  let c = new THREE.Color(hex);
  // los grises puros de Revit ("por defecto") se leen como plástico barato: un blanco hueso cálido
  if (kind === 'plain' && Math.abs(c.r - c.g) < 0.02 && Math.abs(c.g - c.b) < 0.02 && c.r > 0.55) c = new THREE.Color(0xe9e4dc);
  // paleta de los renders de venta: nogal, tela crema, cuero café y mármol cálido
  const luma = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
  if (kind === 'wood') c = new THREE.Color(0x4a2b18).multiplyScalar(0.9 + 0.2 * Math.min(1, luma));
  if (kind === 'fabric' && luma < 0.8) c = new THREE.Color(luma < 0.25 ? 0x4a3f36 : 0xe2d6c3);
  if (kind === 'leather') c = new THREE.Color(0x6a4430);
  if (kind === 'stone') c = new THREE.Color(0xebe3d5);
  const m = lib[kind](c);
  lib.cache.set(key, m);
  return m;
}

/**
 * Piso de las caras horizontales hacia arriba de las losas (dentro de los apartamentos): nogal en salas,
 * comedores y alcobas; porcelanato claro en las zonas de FLOOR_ZONES (baños, pasillos, ropas, punto fijo).
 */
let oak = null, tiles = null;
const zoneVecs = FLOOR_ZONES.map(([x0, z0, x1, z1]) => new THREE.Vector4(x0, z0, x1, z1));
export function withOakFloor(material, maxY = 18300) {
  oak ??= oakPlanks();
  tiles ??= lightTiles();
  if (material.userData.oak) return material;
  material.userData.oak = true;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.tOak = { value: oak };
    sh.uniforms.tTile = { value: tiles };
    sh.uniforms.uZones = { value: zoneVecs };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOakP; varying float vOakUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOakP = position; vOakUp = normal.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D tOak, tTile; uniform vec4 uZones[${zoneVecs.length}]; varying vec3 vOakP; varying float vOakUp;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vOakUp > 0.9 && vOakP.y < ${maxY.toFixed(1)}) {
          vec2 pm = vOakP.xz * 0.001;
          float light = 0.0;
          for (int i = 0; i < ${zoneVecs.length}; i++) {
            vec4 z = uZones[i];
            light = max(light, step(z.x, pm.x) * step(pm.x, z.z) * step(z.y, pm.y) * step(pm.y, z.w));
          }
          // las texturas son sRGB: WebGL2 ya las entrega en lineal
          diffuseColor.rgb = mix(texture2D(tOak, pm / 2.4).rgb, texture2D(tTile, pm / 1.2).rgb, light);
        }`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${key ? key() : ''}_oak`;
  material.needsUpdate = true;
  return material;
}
