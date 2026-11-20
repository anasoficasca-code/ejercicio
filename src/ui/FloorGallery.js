import { store } from '../state/store.js';
import { fmtCOP, fmtNum } from '../geo.js';

const R = './assets/renders/';
const imgs = (base, n) => Array.from({ length: n }, (_, k) => `${base}-${k + 1}.webp`);

// Precio por m² del estudio de mercado: sube $100.000 por cada piso desde el 2.
const M2 = (piso) => 12848000 + (piso - 2) * 100000;
const TIPOS = [
  { tipo: 'A', area: 78.75, aptos: ['01', '02'], donde: 'sobre la Calle 56' },
  { tipo: 'B', area: 70, aptos: ['03', '04'], donde: 'hacia el patio' }
];

/**
 * Zonas de cada nivel con sus fotos reales (assets/renders). `unit` es la unidad del modelo a la que lleva la
 * cámara al elegir la zona; `home` vuelve a la vista general del edificio.
 */
function zonesFor(key) {
  if (key === 'edificio') {
    return {
      eyebrow: 'Edificio completo', title: 'Distrito Arboleda',
      zones: [
        { title: 'Vista aérea', text: 'Seis pisos en la esquina de la Calle 56 con Carrera 18, frente a la Parroquia Divino Salvador.', photos: ['hf-aerea.webp'], home: true },
        { title: 'La esquina', text: 'Pañete blanco, franjas de ladrillo y balcones con baranda de vidrio sobre las dos calles.', photos: ['hf-esquina.webp', 'hf-lateral.webp'], home: true }
      ]
    };
  }
  if (key === 'terraza') {
    return {
      eyebrow: 'Cubierta · nivel 18,60 m', title: 'Terraza comunal', terrace: true,
      zones: [
        { title: 'Lounge y deck', text: 'Lounge, rincón de lectura y deck de yoga con vista a los cerros orientales.', photos: imgs('terraza', 4), terrace: true },
        { title: 'Zona BBQ', text: 'Asador y comedor al aire libre para reuniones de los residentes.', photos: imgs('bbq', 4), terrace: true }
      ]
    };
  }
  if (key === 1) {
    return {
      eyebrow: 'Piso 1 · zonas sociales', title: 'Lobby y zonas comunes',
      zones: [
        { title: 'Lobby', text: 'Recepción y sala de espera en la esquina de la Calle 56 con Carrera 18.', photos: ['lobby-recepcion.webp', 'lobby-sala.webp'], unit: 'lobby' },
        { title: 'Bicicletero', text: 'Bicicletero cubierto junto al acceso, con cupos para los residentes.', photos: imgs('bici', 4), unit: 'lobby' },
        { title: 'Restaurante con terraza', text: 'Restaurante sobre la Calle 56, con terraza al aire libre en el antejardín.', photos: [...imgs('rest-int', 4), ...imgs('rest-ext', 4)], unit: 'salon' },
        { title: 'Sala de cine', text: 'Sala de cine privada para los residentes, hacia el patio.', photos: imgs('cine', 4), unit: 'cine' },
        { title: 'Gimnasio', text: 'Gimnasio con ventanal al jardín del patio posterior.', photos: imgs('gym', 4), unit: 'gym' }
      ]
    };
  }
  const f = key;
  return {
    eyebrow: `Piso ${f} · 4 apartamentos`, title: `Apartamentos ${f}01 a ${f}04`,
    prices: TIPOS.map((t) => ({ ...t, precio: Math.round(t.area * M2(f)) })),
    zones: [
      { title: 'Sala y comedor', text: 'Sala y comedor integrados, con salida al balcón.', photos: ['sala-final.webp'], unit: `${f}01` },
      { title: 'Cocina', text: 'Cocina abierta hacia la sala, con barra y zona de ropas.', photos: ['cocina-final.webp'], unit: `${f}01` },
      { title: 'Alcobas', text: 'Alcoba principal y alcoba 2, con closet y buena luz natural.', photos: ['alcoba-hd.webp', ...imgs('alcoba', 4), 'alcoba-lift.webp'], unit: `${f}02` },
      { title: 'Baños', text: 'Dos baños con enchape claro y ducha en vidrio.', photos: ['bano-hd.webp', ...imgs('bano', 2)], unit: `${f}03` },
      { title: 'Planta tipo A', text: `78,75 m² · apartamentos ${f}01 y ${f}02, sobre la Calle 56.`, photos: ['planta-a-render.webp'], unit: `${f}01` },
      { title: 'Planta tipo B', text: `70 m² · apartamentos ${f}03 y ${f}04, hacia el patio.`, photos: ['planta-b-render.webp'], unit: `${f}03` }
    ]
  };
}

/**
 * Galería del piso elegido: panel de vidrio con las zonas del nivel (chips), la foto grande con flechas y
 * deslizamiento, título y descripción de la zona y miniaturas. Al cambiar de zona la cámara va a esa unidad.
 */
export class FloorGallery {
  constructor({ scene, onFullscreen }) {
    this.scene = scene;
    this.onFullscreen = onFullscreen;
    this.mobile = matchMedia('(max-width: 760px)');
    const el = document.createElement('section');
    el.className = 'floor-gallery';
    el.setAttribute('aria-label', 'Zonas del piso');
    el.setAttribute('aria-hidden', 'true');
    document.getElementById('app').appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => this._click(e));
    // deslizar con el dedo sobre la foto
    let x0 = null;
    el.addEventListener('touchstart', (e) => { if (e.target.closest('.fg-stage')) x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) this.go(this.i + (dx < 0 ? 1 : -1));
    });
    window.addEventListener('keydown', (e) => {
      if (!this.key || /input|textarea/i.test(e.target.tagName) || document.querySelector('.umbra-modal-backdrop.active, .umbra-modal-backdrop.open')) return;
      if (e.key === 'ArrowRight') this.go(this.i + 1);
      if (e.key === 'ArrowLeft') this.go(this.i - 1);
      if (e.key === 'Escape') this.close();
    });
    store.subscribe((s) => this._sync(s));
  }

  /** Mantiene la galería al día con el piso elegido en el panel (o la cierra al elegir una unidad). */
  _sync(s) {
    if (s.galleryKey !== this.key) { if (s.galleryKey == null) this._hide(); else this.open(s.galleryKey, this._nextZone || 0); }
    this._nextZone = 0;
    document.body.classList.toggle('has-floor-gallery', !!this.key && !s.selectedUnitId);
  }

  open(key, zone = 0) {
    const def = zonesFor(key);
    this.key = key;
    this.def = def;
    this.slides = def.zones.flatMap((z, zi) => z.photos.map((p) => ({ src: R + p, zi })));
    this.el.innerHTML = `
      <header class="fg-head">
        <div class="fg-titles">
          <p class="fg-eyebrow">${def.eyebrow}</p>
          <h2 class="fg-title">${def.title}</h2>
        </div>
        <button class="fg-icon" data-act="min" aria-label="Minimizar"><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button>
        <button class="fg-icon" data-act="close" aria-label="Cerrar galería"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </header>
      <div class="fg-body">
        ${def.prices ? `<div class="fg-prices">${def.prices.map((t) => `
          <div><span>Tipo ${t.tipo} · ${fmtNum(t.area, t.area % 1 ? 2 : 0)} m²</span><strong>${fmtCOP(t.precio)}</strong><em>Aptos ${t.aptos.map((a) => key + a).join(' y ')} · ${t.donde}</em></div>`).join('')}
        </div>` : ''}
        <div class="fg-chips" role="tablist">${def.zones.map((z, k) => `<button role="tab" data-zone="${k}">${z.title}</button>`).join('')}</div>
        <figure class="fg-stage">
          <img class="fg-img" alt="" decoding="async" />
          <button class="fg-nav prev" data-act="prev" aria-label="Foto anterior"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
          <button class="fg-nav next" data-act="next" aria-label="Foto siguiente"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
          <span class="fg-count"></span>
          <button class="fg-full" data-act="full" aria-label="Ver en pantalla completa"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
        </figure>
        <div class="fg-caption"><h3 class="fg-zone"></h3><p class="fg-text"></p></div>
        <div class="fg-thumbs">${this.slides.map((s, k) => `<button data-i="${k}" aria-label="Foto ${k + 1}"><img src="${s.src}" alt="" loading="lazy" decoding="async" /></button>`).join('')}</div>
      </div>`;
    this.el.classList.remove('min');
    this.el.classList.add('show');
    this.el.setAttribute('aria-hidden', 'false');
    this.i = -1;
    this.go(this.slides.findIndex((s) => s.zi === zone), { camera: false });
    // en celular el panel lateral se recoge para que se vean el piso y la galería
    if (this.mobile.matches && !document.getElementById('left-sidebar-wrapper')?.classList.contains('collapsed')) document.getElementById('sidebar-tab')?.click();
    if (def.terrace) setTimeout(() => this.scene.focusTerrace?.(), 0);
    if (store.state.galleryKey !== key) store.setState({ galleryKey: key });
    const g = window.gsap;
    if (g && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      g.fromTo(this.el, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', clearProps: 'opacity,transform' });
    }
  }

  /** Lleva la galería a la zona de una unidad (desde la tarjeta de la unidad). */
  openForUnit(u) {
    const key = u.floor;
    const z = zonesFor(key).zones.findIndex((z) => z.unit === u.id);
    this._nextZone = Math.max(0, z);
    if (this.key === key) this.open(key, this._nextZone);
    store.setState({ selectedUnitId: null, activeFloor: u.floor, galleryKey: key });
  }

  go(i, { camera = true } = {}) {
    const n = this.slides.length;
    i = ((i % n) + n) % n;
    const prevZone = this.slides[this.i]?.zi;
    this.i = i;
    const s = this.slides[i], z = this.def.zones[s.zi];
    const img = this.el.querySelector('.fg-img');
    img.classList.remove('in');
    img.onload = () => img.classList.add('in');
    img.src = s.src;
    img.alt = `${this.def.title} · ${z.title}`;
    if (img.complete) img.classList.add('in');
    this.el.querySelector('.fg-zone').textContent = z.title;
    this.el.querySelector('.fg-text').textContent = z.text;
    this.el.querySelector('.fg-count').textContent = `${i + 1} / ${n}`;
    this.el.querySelectorAll('[data-zone]').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.zone === s.zi)));
    this.el.querySelectorAll('.fg-thumbs [data-i]').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
    this.el.querySelector(`.fg-thumbs [data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    this.el.querySelector(`[data-zone="${s.zi}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    // precarga la siguiente
    const nx = this.slides[(i + 1) % n]; if (nx) { const p = new Image(); p.src = nx.src; }
    if (camera && prevZone !== s.zi) this._focusZone(z);
  }

  _focusZone(z) {
    if (z.home) { this.scene.applyViewMode('exterior'); return; }
    if (z.terrace) { this.scene.focusTerrace?.(); return; }
    if (z.unit) {
      this.scene.focusUnit(z.unit);
      store.setState({ hoveredUnitId: z.unit });   // resalta la unidad de esa zona
    }
  }

  _click(e) {
    const t = e.target.closest('[data-act],[data-zone],[data-i]');
    if (!t) return;
    if (t.dataset.zone != null) { this.go(this.slides.findIndex((s) => s.zi === +t.dataset.zone)); return; }
    if (t.dataset.i != null) { this.go(+t.dataset.i); return; }
    const a = t.dataset.act;
    if (a === 'prev') this.go(this.i - 1);
    if (a === 'next') this.go(this.i + 1);
    if (a === 'min') this.el.classList.toggle('min');
    if (a === 'close') this.close();
    if (a === 'full') this.onFullscreen?.(`${this.def.eyebrow} · ${this.def.title}`, this.slides.map((s) => ({ src: s.src, title: this.def.title, type: this.def.zones[s.zi].title })), this.i);
  }

  close() { store.setState({ galleryKey: null }); }

  _hide() {
    this.key = null;
    this.el.classList.remove('show');
    this.el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-floor-gallery');
  }
}
