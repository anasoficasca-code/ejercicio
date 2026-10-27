/** Visor lightbox de las láminas del Canva "EJERCICIO PROFESIONAL 2", con filtros por tema. */
export class GalleryModal {
  constructor() {
    this.modal = document.createElement('div');
    this.modal.className = 'umbra-modal-backdrop';
    this.modal.innerHTML = `
      <div class="umbra-modal-box">
        <div class="modal-header">
          <h3 id="gallery-modal-title">Galería</h3>
          <div class="modal-filter-pills" id="gallery-filters"></div>
          <button class="icon-circle-btn" id="btn-close-gallery">✕</button>
        </div>
        <div class="modal-body">
          <div class="gallery-main-stage">
            <button class="gallery-nav prev" id="gallery-prev">‹</button>
            <img id="gallery-main-img" src="" alt="Vista previa"/>
            <button class="gallery-nav next" id="gallery-next">›</button>
            <div class="gallery-caption" id="gallery-caption"></div>
          </div>
          <div class="gallery-thumbs-sidebar" id="gallery-thumbs"></div>
        </div>
      </div>`;
    document.body.appendChild(this.modal);
    this.modal.querySelector('#btn-close-gallery').onclick = () => this.close();
    this.modal.onclick = (e) => { if (e.target === this.modal) this.close(); };
    this.modal.querySelector('#gallery-prev').onclick = () => this.step(-1);
    this.modal.querySelector('#gallery-next').onclick = () => this.step(1);
    window.addEventListener('keydown', (e) => {
      if (!this.modal.classList.contains('open')) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowRight') this.step(1);
      if (e.key === 'ArrowLeft') this.step(-1);
    });
  }

  /** items: [{ src, title, type }] */
  open(title, items = [], start = 0) {
    this.items = items;
    this.modal.querySelector('#gallery-modal-title').textContent = title;
    const types = [...new Set(items.map((i) => i.type))];
    const f = this.modal.querySelector('#gallery-filters');
    f.innerHTML = types.length > 1
      ? ['Todas', ...types].map((t, i) => `<button class="mode-pill-btn ${i ? '' : 'active'}" data-type="${i ? t : ''}">${t}</button>`).join('')
      : '';
    f.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      f.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      this.renderThumbs(b.dataset.type);
    }));
    this.modal.classList.add('open');
    this.renderThumbs('');
    this.select(start);
  }

  close() { this.modal.classList.remove('open'); }

  renderThumbs(type) {
    const c = this.modal.querySelector('#gallery-thumbs');
    this.visible = this.items.map((it, i) => i).filter((i) => !type || this.items[i].type === type);
    c.innerHTML = this.visible.map((i) => `
      <div class="gallery-thumb-item" data-idx="${i}">
        <img src="${this.items[i].src}" alt="${this.items[i].title}" loading="lazy"/>
        <div class="gallery-thumb-info"><strong>${this.items[i].title}</strong><span>${this.items[i].type}</span></div>
      </div>`).join('');
    c.querySelectorAll('.gallery-thumb-item').forEach((t) => (t.onclick = () => this.select(+t.dataset.idx)));
    if (this.visible.length && !this.visible.includes(this.idx)) this.select(this.visible[0]);
    else this._mark();
  }

  step(d) {
    const v = this.visible || [];
    const k = v.indexOf(this.idx);
    if (v.length) this.select(v[(k + d + v.length) % v.length]);
  }

  select(idx) {
    const it = this.items[idx];
    if (!it) return;
    this.idx = idx;
    this.modal.querySelector('#gallery-main-img').src = it.src;
    this.modal.querySelector('#gallery-caption').textContent = `${it.title} · ${it.type}`;
    this._mark();
  }

  _mark() {
    this.modal.querySelectorAll('.gallery-thumb-item').forEach((t) => {
      const on = +t.dataset.idx === this.idx;
      t.classList.toggle('active', on);
      if (on) t.scrollIntoView({ block: 'nearest' });
    });
  }
}
