import { store } from '../state/store.js';

/**
 * Recorrido guiado por Aurea: la cámara vuela de una parada a otra y cada parada trae su tarjeta con
 * foto, título y texto. Avanza solo (DWELL segundos por parada) o con las flechas del teclado y los botones.
 *
 * Las cámaras van en coordenadas de la planta del edificio (x hacia el oriente desde la esquina de la
 * Carrera 18, y altura, z hacia el sur desde la fachada de la Calle 56), así que siguen al edificio
 * aunque cambie su ubicación en el lote.
 */
export const STOPS = [
  {
    id: 'esquina', title: 'La esquina de la Calle 56 con Carrera 18', img: './assets/renders/esquina.jpg',
    text: 'Seis pisos con pañete blanco, dos franjas de ladrillo y balcones con baranda de vidrio. Antejardín de 3,50 m sobre las dos calles.',
    eye: [-27, 13, -25], target: [6, 8, 3], pin: [0, 2.6, 0], pinLabel: 'La esquina'
  },
  {
    id: 'fachada', title: 'Fachada sobre la Calle 56', img: './assets/renders/fachada.webp',
    text: 'Los apartamentos tipo A dan a la Calle 56 y a la Parroquia Divino Salvador. Cada uno tiene balcón con plantas.',
    eye: [38, 16, -22], target: [12, 9, 1]
  },
  {
    id: 'terraza', title: 'Terraza en la cubierta', img: './assets/brochure/terraza.jpg',
    text: 'Café lounge, zona BBQ con chimenea y gimnasio al aire libre a 18,60 m, con vista a los cerros.',
    eye: [-7, 33, -16], target: [13, 18.8, 7], pin: [14, 20.5, 7], pinLabel: 'Terraza'
  },
  {
    id: 'apartamento', title: 'Un piso tipo por dentro', img: './assets/brochure/interior.jpg',
    text: 'Cuatro apartamentos por piso alrededor del punto fijo: sala, comedor y cocina, dos alcobas, dos baños, ropas y depósito.',
    eye: [-13, 22, -15], target: [8, 6.6, 5], floor: 3
  },
  {
    id: 'lobby', title: 'Lobby y zonas sociales', img: './assets/brochure/lobby.jpg',
    text: 'En el primer piso: lobby de doble altura, salón social y café, sala de cine, gimnasio y bicicletero.',
    eye: [-15, 5.5, -14], target: [4, 1.6, 3], pin: [3, 3.2, 0], pinLabel: 'Lobby'
  },
  {
    id: 'parque', title: 'Patio con parque infantil', img: './assets/brochure/parque.jpg',
    text: 'Hacia el sur, del lado silencioso: césped, columpios y rodadero sobre piso de caucho, con bancas alrededor.',
    eye: [14, 26, 36], target: [7, 0, 18.5], pin: [5, 2.2, 18.6], pinLabel: 'Parque infantil'
  },
  {
    id: 'barrio', title: 'Galerías, Teusaquillo', img: './assets/renders/contexto.jpg',
    text: 'Casas de ladrillo y calles arborizadas, con comercio de barrio sobre las calles 53 y 57 y TransMilenio a pocas cuadras.',
    eye: [-150, 105, -125], target: [12, 4, 7]
  }
];

const DWELL = 9;

export class Tour {
  constructor({ scene }) {
    this.scene = scene;
    this.i = -1;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = document.createElement('section');
    el.className = 'tour-card';
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
      <figure class="tc-media"><img alt=""><figcaption class="tc-step"></figcaption></figure>
      <div class="tc-body">
        <h2 class="tc-title"></h2>
        <p class="tc-text"></p>
        <div class="tc-progress" aria-hidden="true">${STOPS.map(() => '<i><b></b></i>').join('')}</div>
        <div class="tc-actions">
          <button class="tc-btn" data-act="prev" aria-label="Parada anterior"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
          <button class="tc-btn" data-act="play" aria-label="Pausar"><svg viewBox="0 0 24 24" class="i-pause"><path d="M9 6v12M15 6v12"/></svg><svg viewBox="0 0 24 24" class="i-play"><path d="M8 5l11 7-11 7z"/></svg></button>
          <button class="tc-btn" data-act="next" aria-label="Siguiente parada"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
          <button class="tc-close" data-act="close">Terminar recorrido</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    this.el = el;
    this.bars = [...el.querySelectorAll('.tc-progress b')];
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'prev') this.go(this.i - 1);
      if (act === 'next') this.go(this.i + 1);
      if (act === 'play') this.toggle();
      if (act === 'close') this.stop();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.key === 'ArrowRight') this.go(this.i + 1);
      if (e.key === 'ArrowLeft') this.go(this.i - 1);
      if (e.key === 'Escape') this.stop();
    });
  }

  get active() { return this.i >= 0; }

  start(i = 0) {
    document.body.classList.add('is-touring');
    store.setState({ selectedUnitId: null, viewMode: 'exterior' });
    this.playing = !this.reduced;
    this.el.classList.toggle('paused', !this.playing);
    this.go(i);
  }

  stop() {
    if (!this.active) return;
    this._clearTimer();
    if (STOPS[this.i]?.floor) store.setState({ activeFloor: null });
    this.i = -1;
    this.el.classList.remove('show');
    document.body.classList.remove('is-touring');
    this.scene.applyViewMode('exterior');
    this.onStop?.();
  }

  toggle() {
    this.playing = !this.playing;
    this.el.classList.toggle('paused', !this.playing);
    if (this.playing) this._arm(); else this._clearTimer(true);
  }

  go(i) {
    if (i < 0 || i >= STOPS.length) { if (i >= STOPS.length) this.stop(); return; }
    const prev = STOPS[this.i], s = STOPS[i];
    if (prev?.floor && prev.floor !== s.floor) store.setState({ activeFloor: null });
    if (s.floor) store.setState({ activeFloor: s.floor, selectedUnitId: null, showUnitsOverlay: false });
    this.i = i;
    const b = this.scene.building;
    this.scene.flyTo(b.world(...s.eye), b.world(...s.target), this.reduced ? 0.01 : 2.4, 'power3.inOut');
    this._render(s, i);
    this._arm();
    this.onChange?.(s, i);
  }

  _render(s, i) {
    const el = this.el, g = window.gsap;
    const fill = () => {
      el.querySelector('.tc-media img').src = s.img;
      el.querySelector('.tc-media img').alt = s.title;
      el.querySelector('.tc-step').textContent = `${i + 1} de ${STOPS.length}`;
      el.querySelector('.tc-title').textContent = s.title;
      el.querySelector('.tc-text').textContent = s.text;
      this.bars.forEach((bar, k) => { bar.style.transition = 'none'; bar.style.transform = `scaleX(${k < i ? 1 : 0})`; });
    };
    if (!el.classList.contains('show') || !g || this.reduced) { fill(); el.classList.add('show'); return; }
    // la tarjeta cambia de parada: el texto sale hacia arriba y el nuevo entra desde abajo, la foto se funde
    const parts = el.querySelectorAll('.tc-title, .tc-text, .tc-step');
    g.timeline()
      .to(parts, { y: -10, opacity: 0, duration: 0.22, stagger: 0.03, ease: 'power2.in' })
      .to(el.querySelector('.tc-media img'), { opacity: 0, scale: 1.04, duration: 0.25 }, 0)
      .add(fill)
      .fromTo(el.querySelector('.tc-media img'), { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out' })
      .fromTo(parts, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power3.out' }, '<0.1');
  }

  _arm() {
    this._clearTimer();
    const bar = this.bars[this.i];
    if (!bar) return;
    if (!this.playing) return;
    // barra de progreso de la parada; al llenarse pasa a la siguiente
    requestAnimationFrame(() => {
      bar.style.transition = `transform ${DWELL}s linear`;
      bar.style.transform = 'scaleX(1)';
    });
    this.timer = setTimeout(() => this.go(this.i + 1), DWELL * 1000);
  }

  _clearTimer(freeze) {
    clearTimeout(this.timer);
    const bar = this.bars[this.i];
    if (freeze && bar) { const m = getComputedStyle(bar).transform; bar.style.transition = 'none'; bar.style.transform = m === 'none' ? 'scaleX(0)' : m; }
  }
}
