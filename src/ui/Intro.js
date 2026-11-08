import * as THREE from 'three';

/** Lleva el control de la hora del día al valor que anima la intro. */
function syncSlider(h) {
  const input = document.getElementById('sky-hour'), label = document.getElementById('sky-hour-label');
  if (!input) return;
  input.value = h;
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60) % 60;
  label.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Intro de llegada al masterplan: la cámara baja desde lo alto de Galerías hasta la esquina de la Calle 56
 * con Carrera 18 mientras cae la tarde y se encienden los apartamentos; sobre la escena aparece la marca
 * Distrito Arboleda letra por letra. Termina con dos caminos: el recorrido guiado o explorar libremente.
 * Con "reducir movimiento" la cámara llega directo y el texto solo se funde.
 */
export class Intro {
  constructor({ scene, onTour, onExplore }) {
    this.scene = scene;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = document.createElement('section');
    el.className = 'aurea-intro';
    el.setAttribute('aria-label', 'Distrito Arboleda');
    el.innerHTML = `
      <div class="ai-shade"></div>
      <div class="ai-copy">
        <p class="ai-sub">Distrito</p>
        <h1 class="ai-word" aria-label="Distrito Arboleda">${[...'Arboleda'].map((c) => `<span class="ai-ch" aria-hidden="true">${c}</span>`).join('')}</h1>
        <p class="ai-line">Veinte apartamentos con balcón en Galerías, frente a la Parroquia Divino Salvador.</p>
        <div class="ai-actions">
          <button class="ai-btn primary" data-act="tour">Hacer el recorrido</button>
          <button class="ai-btn" data-act="explore">Explorar el edificio</button>
        </div>
      </div>
      <button class="ai-skip" data-act="explore">Saltar intro</button>`;
    document.body.appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act) this.finish(act === 'tour' ? onTour : onExplore);
    });
  }

  play() {
    const g = window.gsap, s = this.scene;
    document.body.classList.add('is-intro');
    if (!g || this.reduced) {
      this.el.classList.add('static');
      s.setHour(16.9);
      syncSlider(16.9);
      return;
    }
    const c = s.building.center();
    const home = s.home;
    // cámara: de una toma aérea alta sobre el barrio hasta la vista de la esquina
    const from = new THREE.Vector3(c.x - 330, 300, c.z - 260);
    s.camera.position.copy(from);
    s.controls.target.set(c.x, 0, c.z);
    s.controls.enabled = false;
    const hour = { h: 15.6 };
    // mientras la cámara baja, el edificio se arma piso por piso sobre el lote
    const started = performance.now();
    s.building.ready?.then(() => s.building.assemble({ delay: Math.max(0, 1.0 - (performance.now() - started) / 1000) }));
    this.tl = g.timeline({ onComplete: () => { s.controls.enabled = true; } })
      .to(s.camera.position, { x: home.pos.x, y: home.pos.y, z: home.pos.z, duration: 7.6, ease: 'power3.inOut' }, 0)
      .to(s.controls.target, { x: home.target.x, y: home.target.y, z: home.target.z, duration: 7.6, ease: 'power3.inOut' }, 0)
      .to(hour, { h: 16.9, duration: 5.2, ease: 'sine.inOut', onUpdate: () => { s.setHour(hour.h); syncSlider(hour.h); } }, 0.6)
      .fromTo(this.el.querySelectorAll('.ai-ch'), { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, stagger: 0.09, ease: 'expo.out' }, 0.5)
      .fromTo(this.el.querySelector('.ai-sub'), { opacity: 0, letterSpacing: '0.6em' }, { opacity: 1, letterSpacing: '0.32em', duration: 1.4, ease: 'power2.out' }, 1.2)
      .fromTo(this.el.querySelector('.ai-line'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 2.0)
      .fromTo(this.el.querySelectorAll('.ai-btn'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' }, 2.5);
  }

  finish(next) {
    if (this.done) return;
    this.done = true;
    const g = window.gsap, s = this.scene;
    // si se salta antes de tiempo, la cámara y la hora terminan su camino rápido
    if (this.tl && this.tl.progress() < 1) this.tl.timeScale(4);
    s.controls.enabled = true;
    const out = () => {
      this.el.remove();
      document.body.classList.remove('is-intro');
      this._revealUI();
      next?.();
    };
    if (!g || this.reduced) { out(); return; }
    g.timeline({ onComplete: out })
      .to(this.el.querySelectorAll('.ai-ch'), { yPercent: -60, opacity: 0, duration: 0.5, stagger: 0.04, ease: 'power2.in' })
      .to(this.el.querySelectorAll('.ai-sub, .ai-line, .ai-actions, .ai-skip'), { opacity: 0, duration: 0.35 }, 0)
      .to(this.el.querySelector('.ai-shade'), { opacity: 0, duration: 0.6 }, 0.2);
  }

  /** Los controles entran en orden: barra superior, panel lateral y dock. */
  _revealUI() {
    const g = window.gsap;
    if (!g || this.reduced) return;
    const parts = [
      ['.top-right-bar', { y: -24 }],
      ['.sky-time-control', { y: -24 }],
      ['.left-sidebar-wrapper', { x: -40 }],
      ['.bottom-dock-container', { y: 40 }]
    ];
    parts.forEach(([sel, from], k) => {
      const el = document.querySelector(sel);
      // solo se anima el eje del desplazamiento: así se conserva el centrado propio de cada barra
      const to = Object.fromEntries(Object.keys(from).map((a) => [a, 0]));
      if (el) g.fromTo(el, { opacity: 0, ...from }, { opacity: 1, ...to, duration: 0.8, delay: k * 0.09, ease: 'power3.out', clearProps: 'opacity,transform' });
    });
  }
}
