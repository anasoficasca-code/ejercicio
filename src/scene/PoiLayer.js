import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { distanceM, fmtDist, fmtMillones } from '../geo.js';

/**
 * PoiLayer — etiquetas HTML ancladas a la escena: servicios y equipamientos, proyectos de la
 * competencia, predios evaluados, el proyecto y los nombres de las vías principales.
 * Las posiciones vienen de data/geometry/puntos.json (geocodificadas con placas de Catastro).
 */
export const TIPOS = {
  proyecto: { label: 'Proyecto', color: '#d81e28' },
  competencia: { label: 'Competencia', color: '#c8a46e' },
  comercio: { label: 'Comercio', color: '#e5869d' },
  educacion: { label: 'Educación', color: '#5d9be0' },
  salud: { label: 'Salud', color: '#3fb68b' },
  recreacion: { label: 'Recreación y cultura', color: '#9b7be0' },
  transporte: { label: 'Transporte', color: '#e0a03a' }
};

// Ejes viales: posiciones locales tomadas de placas domiciliarias sobre cada vía.
const VIAS = [
  ['Calle 56', 24, -11],
  ['Carrera 18', -17, 20],
  ['Calle 57', 150, -52],
  ['Av. Caracas · Cra 14', 412, 70],
  ['Av. Calle 53', -90, 300],
  ['Av. Carrera 24', -518, 90],
  ['Calle 60', 80, -432],
  ['Av. NQS · Cra 30', -1050, -150]
];

export class PoiLayer {
  constructor(scene, { puntos, predios, project, competencia, onPick }) {
    this.group = new THREE.Group();
    this.group.name = 'Etiquetas';
    scene.add(this.group);
    this.byLayer = { servicios: [], competencia: [], predios: [], vias: [], proyecto: [] };
    const origin = [project.ubicacion.lng, project.ubicacion.lat];

    for (const p of puntos) {
      const t = TIPOS[p.tipo];
      if (p.tipo === 'proyecto') continue;
      const d = distanceM(origin, p.lonlat);
      let extra = fmtDist(d);
      if (p.tipo === 'competencia') {
        const c = competencia.find((k) => k.id === p.id);
        if (c) extra = `${fmtMillones(c.precioM2)}/m² · ${fmtDist(d)}`;
      }
      const el = this._pin(p.nombre, extra, t.color, p.tipo === 'competencia' ? 'poi-pin comp' : 'poi-pin');
      el.onclick = () => onPick?.(p);
      this._add(el, p.xz[0], p.tipo === 'competencia' ? 26 : 14, p.xz[1], p.tipo === 'competencia' ? 'competencia' : 'servicios');
    }

    for (const l of predios) {
      if (l.id === 'lote-02') continue;
      const info = project.predios.find((k) => k.id === l.id);
      const c = l.pts.reduce((s, q) => [s[0] + q[0] / l.pts.length, s[1] + q[1] / l.pts.length], [0, 0]);
      const el = this._pin(info.nombre, `${info.direccion} · ${info.areaM2.toLocaleString('es-CO')} m²`, '#c8a46e', 'poi-pin lote');
      el.onclick = () => onPick?.({ tipo: 'predio', id: l.id });
      this._add(el, c[0], 16, c[1], 'predios');
    }

    const pj = document.createElement('div');
    pj.className = 'project-tag';
    pj.innerHTML = `<img src="./assets/branding/jmc-logo.png" alt=""><div><strong>Lote 02 · Calle 56 # 17-53</strong><span>11 apartaestudios · 6 pisos</span></div>`;
    pj.onclick = () => onPick?.({ tipo: 'proyecto' });
    this._add(pj, 0, 27, 0, 'proyecto');

    for (const [name, x, z] of VIAS) {
      const el = document.createElement('div');
      el.className = 'street-tag';
      el.textContent = name;
      this._add(el, x, 1.5, z, 'vias');
    }
  }

  _pin(title, sub, color, cls) {
    const el = document.createElement('div');
    el.className = cls;
    el.style.setProperty('--pin', color);
    el.innerHTML = `<div class="poi-pin-card"><i></i><div><strong>${title}</strong><span>${sub}</span></div></div><div class="poi-pin-stem"></div>`;
    return el;
  }

  _add(el, x, y, z, layer) {
    const o = new CSS2DObject(el);
    o.position.set(x, y, z);
    o.center.set(0.5, 1);
    this.group.add(o);
    this.byLayer[layer].push(o);
  }

  setLayer(layer, on) {
    for (const o of this.byLayer[layer] || []) o.visible = on;
  }

  /** En planta y cortes las etiquetas lejanas estorban: se pueden apagar todas menos el proyecto. */
  setCompact(on) {
    for (const [k, list] of Object.entries(this.byLayer)) if (k !== 'proyecto') for (const o of list) o.element.classList.toggle('dim', on);
  }
}
