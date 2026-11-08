import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * Puntos de interés sobre el edificio (terraza, lobby, parque infantil, la esquina): un pin con pulso que
 * al tocarlo lleva el recorrido a esa parada. Se ocultan durante la intro, en el recorrido y al abrir
 * un apartamento, para no tapar el edificio.
 */
export class Hotspots {
  constructor(building, stops, { onPick }) {
    this.items = [];
    stops.forEach((s, i) => {
      if (!s.pin) return;
      const el = document.createElement('button');
      el.className = 'hotspot';
      el.type = 'button';
      el.innerHTML = `<span class="hs-dot"></span><span class="hs-label">${s.pinLabel}</span>`;
      el.setAttribute('aria-label', `Ver ${s.title}`);
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => { e.stopPropagation(); onPick(i); });
      const o = new CSS2DObject(el);
      const [x, y, z] = s.pin;
      o.position.set(x, y, z);
      building.plate.add(o);
      this.items.push({ o, el });
    });
  }

  setVisible(v) {
    for (const { o, el } of this.items) { o.visible = v; el.classList.toggle('on', v); }
  }
}
