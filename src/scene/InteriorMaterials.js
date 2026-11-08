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

/** Piso laminado de roble claro: tablas de 1,20 × 0,19 m con juntas y tono variable. Tesela de 2,4 m. */
function oakPlanks() {
  const r = rng(91);
  const map = canvasTex(1024, 1024, (ctx, w, h) => {
    const rows = 12, rowH = h / rows;
    for (let j = 0; j < rows; j++) {
      const off = (j % 3) * (w / 6);
      for (let k = -1; k < 3; k++) {
        const x = off + k * (w / 2), tone = 0.86 + r() * 0.2;
        ctx.fillStyle = `rgb(${Math.round(201 * tone)},${Math.round(165 * tone)},${Math.round(124 * tone)})`;
        ctx.fillRect(x, j * rowH, w / 2, rowH);
        for (let s = 0; s < 22; s++) {
          ctx.strokeStyle = `rgba(110,74,40,${0.05 + r() * 0.08})`;
          ctx.lineWidth = 0.6 + r() * 1.6;
          const y = j * rowH + r() * rowH;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let q = 0; q <= w / 2; q += 24) ctx.lineTo(x + q, y + Math.sin(q / 50 + s) * 1.6);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(70,48,28,0.55)';
        ctx.fillRect(x, j * rowH, 2, rowH);
      }
      ctx.fillStyle = 'rgba(70,48,28,0.5)';
      ctx.fillRect(0, j * rowH, w, 2);
    }
  }, true, 1 / 2.4);
  return map;
}

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
  const m = lib[kind](c);
  lib.cache.set(key, m);
  return m;
}

/** Piso de roble para las caras horizontales hacia arriba de las losas (dentro de los apartamentos). */
let oak = null;
export function withOakFloor(material, maxY = 18300) {
  oak ??= oakPlanks();
  if (material.userData.oak) return material;
  material.userData.oak = true;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.tOak = { value: oak };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOakP; varying float vOakUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOakP = position; vOakUp = normal.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tOak; varying vec3 vOakP; varying float vOakUp;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vOakUp > 0.9 && vOakP.y < ${maxY.toFixed(1)}) {
          vec3 oakC = texture2D(tOak, vOakP.xz * 0.001 / 2.4).rgb;
          diffuseColor.rgb = oakC;   // la textura es sRGB: WebGL2 ya la entrega en lineal
        }`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${key ? key() : ''}_oak`;
  material.needsUpdate = true;
  return material;
}
