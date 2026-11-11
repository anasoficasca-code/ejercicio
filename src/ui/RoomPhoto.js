/**
 * Render a pantalla completa de un cuarto durante el recorrido por dentro.
 * La foto es más ancha que la pantalla: arrastrar (o el giroscopio no; solo puntero y teclado) la desplaza
 * a los lados, como mirar alrededor. "Ver en el modelo 3D" la cierra y deja el 3D navegable.
 */
const R = './assets/renders/';
export const ROOM_PHOTOS = {
  sala: { src: R + 'sala-final.webp', title: 'Sala y comedor', text: 'Abiertos al balcón con ventanales de piso a techo' },
  cocina: { src: R + 'cocina-final.webp', title: 'Cocina abierta', text: 'Isla de piedra, nogal y vista a los cerros' },
  habitacion: { src: R + 'habitacion.webp', title: 'Alcoba principal', text: 'Ventanal sobre los árboles, baño privado y clóset' },
  lobby: { src: R + 'lobby-recepcion.webp', title: 'Lobby', text: 'Recepción de piedra, listones de madera y ventanal a la calle' },
  lobby2: { src: R + 'lobby-sala.webp', title: 'Lobby', text: 'Sala de espera junto a los ascensores' },
  salon: { src: R + 'restaurante.webp', title: 'Restaurante con terraza', text: 'Primer piso, sobre la Calle 56' }
};

export class RoomPhoto {
  constructor(host) {
    this.el = document.createElement('section');
    this.el.className = 'room-photo';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <div class="rp-img" role="img"></div>
      <div class="rp-cap"><b></b><span></span></div>
      <p class="rp-hint">Arrastra para mirar a los lados</p>
      <button type="button" class="rp-3d">Ver en el modelo 3D</button>`;
    host.appendChild(this.el);
    this.img = this.el.querySelector('.rp-img');
    this.x = 0.5;
    this.onClose = null;
    this.el.querySelector('.rp-3d').addEventListener('click', () => { this.hide(); this.onClose?.(); });
    // arrastrar para desplazar la foto a los lados
    let down = null;
    this.img.addEventListener('pointerdown', (e) => { down = { x: e.clientX, p: this.x }; this.img.setPointerCapture(e.pointerId); this._stopDrift(); });
    this.img.addEventListener('pointermove', (e) => {
      if (!down) return;
      this.setX(down.p - (e.clientX - down.x) / this.img.clientWidth * 0.9);
    });
    const up = () => { down = null; };
    this.img.addEventListener('pointerup', up);
    this.img.addEventListener('pointercancel', up);
    this.img.tabIndex = 0;
    this.img.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.setX(this.x - 0.08);
      else if (e.key === 'ArrowRight') this.setX(this.x + 0.08);
    });
  }

  setX(v) {
    this.x = Math.min(1, Math.max(0, v));
    this.img.style.backgroundPosition = `${(this.x * 100).toFixed(2)}% 50%`;
  }

  /** Abre la foto del cuarto `key` (si no hay foto, no hace nada y devuelve false). */
  show(key, { delay = 0 } = {}) {
    const p = ROOM_PHOTOS[key];
    if (!p) { this.hide(); return false; }
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      this.img.style.backgroundImage = `url("${p.src}")`;
      this.img.setAttribute('aria-label', `${p.title}: ${p.text}`);
      this.el.querySelector('.rp-cap b').textContent = p.title;
      this.el.querySelector('.rp-cap span').textContent = p.text;
      this.setX(0.5);
      this.el.classList.add('on');
      this.el.setAttribute('aria-hidden', 'false');
      document.body.classList.add('has-room-photo');
      this._drift();
    }, delay);
    return true;
  }

  hide() {
    clearTimeout(this._t);
    this._stopDrift();
    this.el.classList.remove('on');
    this.el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-room-photo');
  }

  /** Paneo lento automático (como un video) hasta que la persona toque la foto. */
  _drift() {
    this._stopDrift();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap) return;
    this.setX(0.15);
    const o = { v: 0.15 };
    this._tw = window.gsap.to(o, { v: 0.85, duration: 14, ease: 'sine.inOut', yoyo: true, repeat: -1, onUpdate: () => this.setX(o.v) });
  }

  _stopDrift() { this._tw?.kill(); this._tw = null; }
}
