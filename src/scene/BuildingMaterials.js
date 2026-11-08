import * as THREE from 'three';

/**
 * BuildingMaterials — acabados "de render" para el modelo de Revit.
 *
 * El modelo llega sin coordenadas de textura (solo posiciones y normales), así que `boxUV` le pone
 * coordenadas por proyección de caja en metros: cada cara toma el plano según su orientación y las
 * texturas quedan a escala real (un ladrillo mide 25 × 7,5 cm en cualquier fachada).
 *
 * Las texturas se dibujan en canvas (sin descargas) con su mapa de relieve y de rugosidad:
 *  · ladrillo tolete bogotano con junta, piezas de tono variable y grano de arcilla
 *  · pañete de fachada con manchas grandes y chorreaduras leves de lluvia
 *  · concreto de losas y cubierta
 * El vidrio usa reflexión de Fresnel: de frente deja ver el interior en penumbra y de lado refleja el cielo.
 */

// ------------------------------------------------------------------ utilidades de canvas
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

function tex(c, srgb, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.repeat.copy(repeat);
  return t;
}

/** Ruido de valor suave y periódico (se repite sin costura en el tamaño del canvas). */
function valueNoise(w, h, cells, rand) {
  const g = Array.from({ length: cells * cells }, rand);
  const at = (x, y) => g[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = (x / w) * cells, fy = (y / h) * cells, ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  }
  return out;
}

function fbm(w, h, rand, octaves = [[4, 0.5], [8, 0.25], [16, 0.15], [32, 0.1]]) {
  const out = new Float32Array(w * h);
  for (const [cells, amp] of octaves) {
    const n = valueNoise(w, h, cells, rand);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
  }
  return out;
}

/** Mapa normal (convención OpenGL) a partir de un campo de alturas 0..1. */
function normalMap(height, w, h, strength) {
  const [c, ctx] = canvas(w, h);
  const img = ctx.createImageData(w, h), d = img.data;
  const H = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(values, w, h) {
  const [c, ctx] = canvas(w, h);
  const img = ctx.createImageData(w, h), d = img.data;
  for (let i = 0; i < w * h; i++) { const v = Math.max(0, Math.min(255, values[i] * 255)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------------ ladrillo
/** Tesela de 1,00 × 0,60 m: 4 ladrillos de 25 cm por 8 hiladas de 7,5 cm, trabados a media pieza. */
function brickMaps() {
  const W = 1024, H = 624, cols = 4, rows = 8, bw = W / cols, bh = H / rows, joint = 4;
  const rand = rng(7);
  const grain = fbm(W, H, rng(11), [[16, 0.4], [64, 0.35], [128, 0.25]]);
  const blotch = fbm(W, H, rng(12), [[3, 0.6], [6, 0.4]]);
  const col = new Float32Array(W * H * 3), hgt = new Float32Array(W * H), rough = new Float32Array(W * H);
  // fondo: junta de mortero gris
  for (let i = 0; i < W * H; i++) { const g = 0.62 + grain[i] * 0.08; col[i * 3] = g; col[i * 3 + 1] = g * 0.96; col[i * 3 + 2] = g * 0.9; hgt[i] = 0.25 + grain[i] * 0.05; rough[i] = 0.95; }
  // paleta de arcilla cocida de la sabana: naranja rojizo, algunas piezas más quemadas y otras más claras
  const tones = [[0.62, 0.29, 0.17], [0.56, 0.25, 0.15], [0.68, 0.34, 0.2], [0.5, 0.22, 0.14], [0.6, 0.31, 0.2], [0.45, 0.2, 0.13]];
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw / 2;
    for (let k = -1; k < cols; k++) {
      const x0 = Math.round(k * bw + off), y0 = Math.round(r * bh);
      const t = tones[Math.floor(rand() * tones.length)], kk = 0.88 + rand() * 0.22, burnt = rand() < 0.12;
      const bulge = 0.75 + rand() * 0.15;
      for (let y = y0 + joint; y < y0 + bh - joint + 1; y++) for (let x = x0 + joint; x < x0 + bw - joint + 1; x++) {
        const xx = ((x % W) + W) % W, yy = ((y % H) + H) % H, i = yy * W + xx;
        // borde de la pieza un poco más oscuro (arista quemada) y cara con grano
        const ex = Math.min(x - x0 - joint, x0 + bw - joint - x), ey = Math.min(y - y0 - joint, y0 + bh - joint - y);
        const edge = Math.min(1, Math.min(ex, ey) / 5);
        const g = grain[i] - 0.5, b = blotch[i] - 0.5;
        let m = kk * (0.86 + 0.14 * edge) * (1 + g * 0.35 + b * 0.18);
        if (burnt) m *= 0.72;
        col[i * 3] = t[0] * m; col[i * 3 + 1] = t[1] * m; col[i * 3 + 2] = t[2] * m * (burnt ? 1.1 : 1);
        hgt[i] = bulge * (0.85 + 0.15 * edge) + g * 0.12;
        rough[i] = 0.82 + g * 0.2;
      }
    }
  }
  const [c, ctx] = canvas(W, H);
  const img = ctx.createImageData(W, H), d = img.data;
  for (let i = 0; i < W * H; i++) { d[i * 4] = Math.min(255, col[i * 3] * 255); d[i * 4 + 1] = Math.min(255, col[i * 3 + 1] * 255); d[i * 4 + 2] = Math.min(255, col[i * 3 + 2] * 255); d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  const rep = new THREE.Vector2(1 / 1.0, 1 / 0.6);
  return { map: tex(c, true, rep), normalMap: tex(normalMap(hgt, W, H, 5), false, rep), roughnessMap: tex(grayCanvas(rough, W, H), false, rep) };
}

// ------------------------------------------------------------------ pañete / concreto
/** Superficie mineral: `metres` de tesela, color base, manchas grandes, chorreaduras y grano fino. */
function mineralMaps({ seed, metres, base, blotchAmt, streaks, grainAmt, bump }) {
  const N = 512;
  const big = fbm(N, N, rng(seed), [[2, 0.55], [4, 0.3], [8, 0.15]]);
  const fine = fbm(N, N, rng(seed + 1), [[64, 0.5], [128, 0.5]]);
  const pores = fbm(N, N, rng(seed + 2), [[32, 0.5], [96, 0.5]]);
  const streak = new Float32Array(N);
  if (streaks) { const r = rng(seed + 3); const s = valueNoise(N, 1, 48, r); for (let x = 0; x < N; x++) streak[x] = Math.max(0, s[x] - 0.55) * 2.2; }
  const col = new Float32Array(N * N), hgt = new Float32Array(N * N), rough = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    // chorreadura: más marcada arriba de cada tesela (bajo los antepechos) y se desvanece hacia abajo
    const st = streak[x] * streaks * (0.35 + 0.65 * (1 - y / N));
    col[i] = 1 + (big[i] - 0.5) * blotchAmt + (fine[i] - 0.5) * grainAmt - st;
    hgt[i] = fine[i] * 0.7 + pores[i] * 0.3;
    rough[i] = 0.86 + (fine[i] - 0.5) * 0.12 - st * 0.3;
  }
  const [c, ctx] = canvas(N, N);
  const img = ctx.createImageData(N, N), d = img.data, b = new THREE.Color().setHex(base, THREE.LinearSRGBColorSpace); // componentes tal cual del hex (sRGB)
  for (let i = 0; i < N * N; i++) { const v = col[i]; d[i * 4] = Math.min(255, b.r * v * 255); d[i * 4 + 1] = Math.min(255, b.g * v * 255); d[i * 4 + 2] = Math.min(255, b.b * v * 255); d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  const rep = new THREE.Vector2(1 / metres, 1 / metres);
  return { map: tex(c, true, rep), normalMap: tex(normalMap(hgt, N, N, bump), false, rep), roughnessMap: tex(grayCanvas(rough, N, N), false, rep) };
}

// ------------------------------------------------------------------ vidrio con Fresnel
// 0 de día, 1 de noche: lo mueve setNight() según la hora del sol
const glowUniform = { value: 0 };
export function setNight(v) { glowUniform.value = v; }

function fresnelGlass({ color, base, edge, rough = 0.02, env = 1.6, lit = 0.6 }) {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0, ior: 1.52, specularIntensity: 1, envMapIntensity: env,
    transparent: true, opacity: base, depthWrite: false, side: THREE.DoubleSide
  });
  m.userData.glow = glowUniform;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uEdge = { value: edge };
    sh.uniforms.uGlow = glowUniform;
    sh.uniforms.uLit = { value: lit };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlassW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGlassW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uEdge, uGlow, uLit;\nvarying vec3 vGlassW;\nfloat glassHash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // al anochecer se encienden las luces de algunos apartamentos (cálidas, cada ventana con su tono)
        vec3 wcell = floor(vec3(vGlassW.x / 3.0, vGlassW.y / 3.1, vGlassW.z / 3.0));
        float on = step(1.0 - uLit, glassHash(wcell)) * uGlow;
        vec3 warm = mix(vec3(1.0, 0.68, 0.36), vec3(1.0, 0.82, 0.58), glassHash(wcell + 7.0));
        totalEmissiveRadiance += warm * warm * on * 0.75;`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float fres = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 4.0);
        gl_FragColor.a = max(mix(opacity, uEdge, fres), on * 0.92);`);
  };
  m.customProgramCacheKey = () => `fresnelGlass_${base}_${edge}`;
  return m;
}

// ------------------------------------------------------------------ catálogo por color de Revit
let cache = null;
function build() {
  const brick = brickMaps();
  const stucco = mineralMaps({ seed: 21, metres: 3.2, base: 0xf1ebe1, blotchAmt: 0.08, streaks: 0.05, grainAmt: 0.06, bump: 1.6 });
  const concrete = mineralMaps({ seed: 31, metres: 2.4, base: 0xc9c6c0, blotchAmt: 0.14, streaks: 0.1, grainAmt: 0.1, bump: 2.2 });
  const paint = mineralMaps({ seed: 41, metres: 2.0, base: 0xf3f1ec, blotchAmt: 0.03, streaks: 0.02, grainAmt: 0.025, bump: 0.8 });
  const std = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, metalness: 0, ...o });
  const brickMat = std({ ...brick, color: 0xffffff, roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 0.5 });
  const brickDark = std({ ...brick, color: 0xd8c4b8, roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 0.5 });
  const stuccoMat = std({ ...stucco, color: 0xffffff, roughness: 1, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 0.6 });
  const concreteMat = std({ ...concrete, color: 0xffffff, roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 0.5 });
  const slabEdge = std({ ...paint, color: 0xf6f4f0, roughness: 0.9, normalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: 0.6 });
  const whitePaint = std({ ...paint, color: 0xffffff, roughness: 0.92, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.5 });
  // perfilería de aluminio anodizado bronce (el tono madera de Revit) y metal de barandas
  const bronze = std({ color: 0x4a3b2c, metalness: 0.75, roughness: 0.38, envMapIntensity: 1.1 });
  const bronzeLight = std({ color: 0x6a5440, metalness: 0.7, roughness: 0.4, envMapIntensity: 1.1 });
  const steel = std({ color: 0xc9ccd0, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.2 });
  const darkMetal = std({ color: 0x2c2e31, metalness: 0.6, roughness: 0.45, envMapIntensity: 1 });
  // ventanería: vidrio laminado con leve tinte; barandas: vidrio templado claro
  const windowGlass = fresnelGlass({ color: 0xadb9bb, base: 0.38, edge: 0.92, env: 1.2 });
  const railGlass = fresnelGlass({ color: 0xe4eeeb, base: 0.10, edge: 0.55, env: 1.0, lit: 0 });
  const grass = std({ color: 0x5f7f3e, roughness: 1 });
  return {
    glass: { '0a64f4': windowGlass, '0080c0': railGlass },
    byHex: {
      '82482d': brickMat, '764633': brickDark, '52321d': brickDark,
      'd2c8aa': stuccoMat, 'ded08b': stuccoMat,
      '95c4ee': slabEdge, 'f7f7ef': slabEdge, 'f7f7f7': slabEdge,
      'f9f9f9': whitePaint, 'ffffff': whitePaint,
      '808080': concreteMat, 'c0c0c0': concreteMat, '7f7f7f': concreteMat, '787878': concreteMat,
      '977b4c': bronze, 'e0b27e': bronzeLight, 'd29f5f': bronzeLight, '39301e': bronze,
      'ecefef': steel, 'b4b4b4': steel, '505050': darkMetal,
      '85b22c': grass
    }
  };
}

/** Material realista para un color de Revit de la capa de arquitectura (null = usar el de siempre). */
export function architectureMaterial(hex, glass) {
  cache ??= build();
  const key = hex.replace('#', '').toLowerCase();
  if (glass) return cache.glass[key] || cache.glass['0a64f4'];
  return cache.byHex[key] || null;
}

/**
 * Coordenadas UV por proyección de caja, en metros. Las posiciones del modelo vienen en milímetros y
 * cada vértice ya está partido por la normal de su cara, así que no hay costuras raras.
 */
export function boxUV(positions, normals, count) {
  const uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3] * 0.001, y = positions[i * 3 + 1] * 0.001, z = positions[i * 3 + 2] * 0.001;
    const nx = normals[i * 4], ny = normals[i * 4 + 1], nz = normals[i * 4 + 2];
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; }               // losas y cubiertas
    else if (ax >= az) { u = nx > 0 ? -z : z; v = y; }       // fachadas oriente / occidente
    else { u = nz > 0 ? x : -x; v = y; }                     // fachadas norte / sur
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  return uv;
}
