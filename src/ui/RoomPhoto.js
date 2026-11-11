import * as THREE from 'three';

/**
 * Vista 360° de un cuarto durante el recorrido por dentro (panorámicas equirrectangulares 2:1).
 * Arrastrar gira la vista en todas las direcciones, la rueda o el pellizco acercan, las flechas del teclado
 * también giran. Mientras nadie toca, la vista gira despacio. "Ver en el modelo 3D" cierra el visor.
 * Si el navegador no tiene WebGL se muestra la foto plana a pantalla completa.
 */
const P = './assets/pano/';
export const ROOM_PHOTOS = {
  sala: { pano: P + 'cocina-sala.jpg', yaw: 115, title: 'Sala y comedor', text: 'Abiertos al balcón con ventanales de piso a techo' },
  cocina: { pano: P + 'cocina-sala.jpg', yaw: -60, title: 'Cocina abierta', text: 'Isla de mármol, nogal y comedor junto al balcón' },
  habitacion: { pano: P + 'habitacion.jpg', yaw: 0, title: 'Alcoba principal', text: 'Ventanal sobre los árboles, clóset de nogal' },
  alcoba2: { pano: P + 'habitacion.jpg', yaw: 60, title: 'Alcoba', text: 'Piso de madera clara y ventanal a la calle' },
  lobby: { pano: P + 'lobby.jpg', yaw: 0, title: 'Lobby', text: 'Recepción, sala de espera y ascensores' },
  lobby2: { pano: P + 'lobby.jpg', yaw: 120, title: 'Lobby', text: 'Sala de espera junto al ventanal' },
  salon: { pano: P + 'restaurante.jpg', yaw: 0, title: 'Restaurante con terraza', text: 'Primer piso, sobre la Calle 56' }
};

export class RoomPhoto {
  constructor(host) {
    this.el = document.createElement('section');
    this.el.className = 'room-photo';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <div class="rp-view" tabindex="0" role="img"></div>
      <div class="rp-badge" aria-hidden="true">360°</div>
      <div class="rp-cap"><b></b><span></span></div>
      <p class="rp-hint">Arrastra para mirar a tu alrededor</p>
      <button type="button" class="rp-3d">Ver en el modelo 3D</button>`;
    host.appendChild(this.el);
    this.view = this.el.querySelector('.rp-view');
    this.onClose = null;
    this.covering = false;
    this.el.querySelector('.rp-3d').addEventListener('click', () => { this.hide(); this.onClose?.(); });
    this.lon = 0; this.lat = 0; this.fov = 75; this.auto = true;
    this.textures = new Map();
    this._initGL();
    this._bindInput();
  }

  _initGL() {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) { this.renderer = null; return; }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.view.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov, 1, 0.1, 100);
    const geo = new THREE.SphereGeometry(50, 96, 64);
    geo.scale(-1, 1, 1);                                      // se ve por dentro
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.scene.add(new THREE.Mesh(geo, this.mat));
    addEventListener('resize', () => this._resize());
  }

  _bindInput() {
    const v = this.view, pts = new Map();
    let last = null, pinch = 0;
    v.addEventListener('pointerdown', (e) => {
      v.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      last = [e.clientX, e.clientY]; pinch = 0; this.auto = false;
    });
    v.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) {                                   // pellizco: acercar / alejar
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) this.setFov(this.fov * pinch / d);
        pinch = d; return;
      }
      const k = this.fov / v.clientHeight;                    // grados por pixel según el zoom
      this.lon -= (e.clientX - last[0]) * k;
      this.lat += (e.clientY - last[1]) * k;
      last = [e.clientX, e.clientY];
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = 0; if (pts.size === 1) last = [...pts.values()][0]; };
    v.addEventListener('pointerup', up);
    v.addEventListener('pointercancel', up);
    v.addEventListener('wheel', (e) => { e.preventDefault(); this.auto = false; this.setFov(this.fov + e.deltaY * 0.04); }, { passive: false });
    v.addEventListener('keydown', (e) => {
      const m = { ArrowLeft: [-6, 0], ArrowRight: [6, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
      if (m) { e.preventDefault(); this.auto = false; this.lon += m[0]; this.lat += m[1]; }
      else if (e.key === '+' || e.key === '=') this.setFov(this.fov - 5);
      else if (e.key === '-') this.setFov(this.fov + 5);
      else if (e.key === 'Escape') { this.hide(); this.onClose?.(); }
    });
  }

  setFov(f) { this.fov = Math.min(105, Math.max(35, f)); }

  _resize() {
    if (!this.renderer || !this.covering) return;
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // en celular (vertical) la lente se abre un poco más para no sentirse encerrado
    this.camera.updateProjectionMatrix();
  }

  _texture(src) {
    if (!this.textures.has(src)) {
      this.textures.set(src, new Promise((res, rej) => new THREE.TextureLoader().load(src, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
        res(t);
      }, undefined, rej)));
    }
    return this.textures.get(src);
  }

  _loop() {
    if (!this.covering) return;
    const now = performance.now(), dt = Math.min(0.05, (now - (this._t0 || now)) / 1000);
    this._t0 = now;
    if (this.auto && !matchMedia('(prefers-reduced-motion: reduce)').matches) this.lon += dt * 2.2;
    this.lat = Math.max(-80, Math.min(80, this.lat));
    const phi = THREE.MathUtils.degToRad(90 - this.lat), th = THREE.MathUtils.degToRad(this.lon);
    this.camera.fov += (this.fov - this.camera.fov) * 0.15;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
    this.renderer.render(this.scene, this.camera);
    this._raf = requestAnimationFrame(() => this._loop());
  }

  /** Abre la vista 360 del cuarto `key` (si no hay, no hace nada y devuelve false). */
  show(key, { delay = 0 } = {}) {
    const p = ROOM_PHOTOS[key];
    if (!p) { this.hide(); return false; }
    clearTimeout(this._tm);
    const token = (this._token = (this._token || 0) + 1);
    const ready = this.renderer ? this._texture(p.pano) : Promise.resolve(null);
    this._tm = setTimeout(() => ready.then((tex) => {
      if (token !== this._token) return;
      this.el.querySelector('.rp-cap b').textContent = p.title;
      this.el.querySelector('.rp-cap span').textContent = p.text;
      this.view.setAttribute('aria-label', `Vista 360 de ${p.title}: ${p.text}. Usa las flechas para girar.`);
      if (tex) {
        this.mat.map = tex; this.mat.needsUpdate = true;
        this.lon = 180 + p.yaw;                               // yaw 0 = centro de la panorámica this.lat = -2; this.fov = innerWidth < innerHeight ? 95 : 72; this.camera.fov = this.fov + 18;
        this.auto = true;
        this.el.classList.remove('flat');
      } else {
        this.view.style.backgroundImage = `url("${p.pano}")`;
        this.el.classList.add('flat');
      }
      const was = this.covering;
      this.covering = true;
      this._resize();
      this.el.classList.add('on');
      this.el.setAttribute('aria-hidden', 'false');
      document.body.classList.add('has-room-photo');
      if (!was && this.renderer) { this._t0 = 0; this._loop(); }
    }).catch(() => {}), delay);
    return true;
  }

  hide() {
    clearTimeout(this._tm);
    this._token = (this._token || 0) + 1;
    cancelAnimationFrame(this._raf);
    this.covering = false;
    this.el.classList.remove('on');
    this.el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-room-photo');
  }
}
