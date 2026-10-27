import * as THREE from 'three';

/**
 * Texturas de fachada generadas en canvas (sin descargas): cada tesela es un piso × una crujía
 * (~3,2 m × 2,9 m) con su ventana. Tipologías frecuentes en Teusaquillo / Galerías:
 *  · ladrillo  — ladrillo a la vista bogotano con ventana de marco blanco
 *  · pañete    — muro pañetado y pintado en tonos claros
 *  · concreto  — edificio contemporáneo con franjas de ventanería
 *  · iglesia   — ladrillo macizo sin ventanas (culatas)
 *  · iglesiaNave / iglesiaMuro — pañete beige de la iglesia frente al lote, con ventanales de medio punto
 */
export const BAY_W = 3.2;

function noise(ctx, w, h, amt) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function bricks(ctx, w, h, base, rowH = 9) {
  ctx.fillStyle = '#c9b8a3';
  ctx.fillRect(0, 0, w, h);
  const c = new THREE.Color(base);
  for (let y = 0, r = 0; y < h; y += rowH, r++) {
    for (let x = (r % 2) * -13; x < w; x += 26) {
      const k = 0.86 + Math.random() * 0.24;
      ctx.fillStyle = `rgb(${(c.r * 255 * k) | 0},${(c.g * 255 * k) | 0},${(c.b * 255 * k) | 0})`;
      ctx.fillRect(x + 1, y + 1, 24, rowH - 2);
    }
  }
}

function windowAt(ctx, x, y, w, h, frame, opts = {}) {
  ctx.fillStyle = frame;
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, opts.glassA || '#5d7387');
  g.addColorStop(0.55, opts.glassB || '#2b3846');
  g.addColorStop(1, opts.glassC || '#41566a');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = frame;
  ctx.fillRect(x + w / 2 - 2, y, 4, h);
  if (!opts.noTransom) ctx.fillRect(x, y + h * 0.28, w, 3);
  if (opts.sill) { ctx.fillStyle = opts.sill; ctx.fillRect(x - 8, y + h + 4, w + 16, 7); }
  // reflejo de cielo en la parte alta
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(x, y, w, h * 0.22);
}

function make(draw) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  draw(ctx, 256, 256);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeFacadeTextures() {
  return {
    ladrillo: make((ctx, w, h) => {
      bricks(ctx, w, h, '#9a4b33');
      noise(ctx, w, h, 14);
      windowAt(ctx, 70, 70, 116, 118, '#efe9df', { sill: '#d9d1c4' });
      ctx.fillStyle = 'rgba(60,30,20,0.25)';
      ctx.fillRect(0, 0, w, 10); // dintel / losa
    }),
    pañete: make((ctx, w, h) => {
      ctx.fillStyle = '#e6ddcc';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, 0, w, 12);
      windowAt(ctx, 64, 66, 128, 124, '#3a3f45', { sill: '#cfc6b6' });
    }),
    concreto: make((ctx, w, h) => {
      ctx.fillStyle = '#b8bbbd';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 12);
      ctx.fillStyle = '#9fa3a6';
      ctx.fillRect(0, 0, w, 26);
      windowAt(ctx, 14, 46, 228, 176, '#25292d', { noTransom: true, glassA: '#6f8aa1', glassB: '#33465a', glassC: '#58718a' });
    }),
    iglesia: make((ctx, w, h) => {
      bricks(ctx, w, h, '#a5553a', 8);
      noise(ctx, w, h, 16);
    }),
    // iglesia de Galerías (Street View): pañete beige, ventanales de arco de medio punto con marco claro
    iglesiaNave: make((ctx, w, h) => {
      ctx.fillStyle = '#d3c39f';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 12);
      ctx.fillStyle = '#b9a986';
      ctx.fillRect(0, h - 26, w, 26); // zócalo
      ctx.fillStyle = '#efe8d8';
      ctx.fillRect(0, 0, w, 8); // cornisa
      const cx = w / 2, ww = 46, top = 70, bot = h - 64;
      const arch = (r, y0, y1, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(cx - r, y1); ctx.lineTo(cx - r, y0); ctx.arc(cx, y0, r, Math.PI, 0); ctx.lineTo(cx + r, y1); ctx.fill(); };
      arch(ww / 2 + 7, top, bot + 7, '#f1ebdd');
      const g = ctx.createLinearGradient(0, top - ww / 2, 0, bot);
      g.addColorStop(0, '#46586e'); g.addColorStop(1, '#232c38');
      arch(ww / 2, top, bot, g);
      ctx.fillStyle = 'rgba(241,235,221,0.85)';
      ctx.fillRect(cx - 1.5, top - 10, 3, bot - top + 10);
      ctx.fillRect(cx - ww / 2, top + 40, ww, 3);
    }),
    iglesiaMuro: make((ctx, w, h) => {
      ctx.fillStyle = '#d3c39f';
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 12);
    })
  };
}

/** Tejado de barro (cubiertas inclinadas de la iglesia). */
export function makeTileTexture() {
  return make((ctx, w, h) => {
    ctx.fillStyle = '#8c3f26';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      for (let x = 0; x < w; x += 16) {
        const k = 0.8 + Math.random() * 0.3;
        ctx.fillStyle = `rgb(${(170 * k) | 0},${(78 * k) | 0},${(46 * k) | 0})`;
        ctx.beginPath();
        ctx.ellipse(x + 8, y + 10, 7, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, y, w, 2);
    }
  });
}
