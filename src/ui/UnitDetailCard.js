import { store } from '../state/store.js';
import { fmtCOP } from '../geo.js';

/** Tarjeta flotante central con los atributos de la unidad seleccionada (misma UI del masterplan La Fontana). */
export class UnitDetailCard {
  constructor(container, { onOpenGallery }) {
    this.container = container;
    this.container.className = 'room-detail-card';
    this.container.addEventListener('click', (e) => {
      const iv = e.target.closest('[data-iv]'), ph = e.target.closest('[data-photo]');
      if (ph) window.__masterplan?.showRoomPhoto(ph.dataset.photo);
      else if (iv) store.setState({ interiorView: iv.dataset.iv || null, interiorUnit: store.state.selectedUnitId });
      else if (e.target.closest('#btn-close-detail')) store.setState({ selectedUnitId: null, interiorView: null });
      else if (e.target.closest('#btn-view-gallery')) onOpenGallery(store.getSelectedUnit());
    });
    store.subscribe(() => this.render());
  }

  /** Marca la vista actual (planta o recorrido, y el cuarto en que está la persona) sin rehacer la tarjeta. */
  syncViews(u) {
    const s = store.state, cur = s.interiorUnit === u.id ? s.interiorView || '' : '';
    this.container.querySelectorAll('.view-seg [data-iv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.iv === '' ? !cur : !!cur)));
    this.container.querySelectorAll('.room-chips [data-iv]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.iv === cur)));
    this.container.classList.toggle('is-interior', !!cur);
  }

  render() {
    const u = store.getSelectedUnit();
    if (!u) { this.container.classList.remove('visible'); this._id = null; return; }
    if (u.id === this._id) { this.syncViews(u); return; }
    this._id = u.id;
    const p = store.state.project;
    const apt = u.typology === 'Apartamento';
    this.container.innerHTML = `
      <button class="detail-close-btn" id="btn-close-detail">✕</button>
      <div class="detail-title">${u.title}</div>
      <div class="detail-subtitle">${p.ubicacion.direccion} · ${p.ubicacion.barrio}</div>
      ${apt ? `<div class="view-seg" role="group" aria-label="Recorrer el apartamento">
        <button data-iv="" aria-pressed="true">Planta</button>
        <button data-iv="sala" aria-pressed="false">Recorrer por dentro</button>
      </div>
      <div class="room-chips" role="group" aria-label="Cuartos del apartamento">
        ${[['sala', 'Sala'], ['cocina', 'Cocina'], ['habitacion', 'Alcoba principal'], ['alcoba2', 'Alcoba 2'], ['bano', 'Baño'], ['entrada', 'Entrada']]
          .map(([k, l]) => `<button data-iv="${k}" aria-pressed="false">${l}</button>`).join('')}
        <p class="walk-hint">Arrastra para mirar alrededor · toca un punto blanco del piso para caminar</p>
      </div>` : u.id === 'lobby' ? `<div class="view-seg" role="group" aria-label="Ver el lobby">
        <button data-photo="lobby">Recepción</button><button data-photo="lobby2">Sala de espera</button>
      </div>` : u.id === 'salon' ? `<div class="view-seg" role="group" aria-label="Ver el restaurante">
        <button data-photo="salon">Ver el restaurante</button><button data-photo="lobby2">Ver el lobby</button>
      </div>` : ''}
      <div class="detail-props">
        <div class="detail-prop-line"><span class="label">Piso:</span> ${u.floor} de ${p.proyectoActual.pisos}</div>
        <div class="detail-prop-line"><span class="label">Tipología:</span> ${u.typology}</div>
        <div class="detail-prop-line"><span class="label">Área:</span> ${u.area.toLocaleString('es-CO')} m²${apt ? ` (tipología ${u.tipo})` : ''}</div>
        <div class="detail-prop-line"><span class="label">Ubicación:</span> ${u.location}</div>
        <div class="detail-prop-line"><span class="label">Fachadas:</span> ${u.facades}</div>
        <div class="detail-prop-line"><span class="label">Altura libre:</span> ${u.height}</div>
        ${apt ? `<div class="detail-prop-line"><span class="label">Precio:</span> <span class="price-val">${fmtCOP(u.price)}</span></div>
        <div class="detail-prop-line dim">${u.espacios}</div>` : `<div class="detail-prop-line"><span class="label">Piso 1:</span> ${p.proyectoActual.piso1.join(' · ')}</div>`}
      </div>
      ${apt ? `<div class="finish-row">${p.apartaestudio.acabados.map((a) => `<i title="${a.elemento}: ${a.detalle}" style="background:${a.color}"></i>`).join('')}<span>Acabados</span></div>` : ''}
      <div class="detail-actions">
        <button class="detail-gallery-btn" id="btn-view-gallery">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          ${apt ? 'Ver acabados y láminas del proyecto' : 'Ver zonas sociales'}
        </button>
      </div>`;
    this.container.classList.add('visible');
    this.syncViews(u);
    // el precio cuenta hasta su valor al abrir la unidad
    const pv = this.container.querySelector('.price-val'), g = window.gsap;
    if (pv && g && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const n = { v: u.price * 0.6 };
      g.to(n, { v: u.price, duration: 1.1, ease: 'power3.out', onUpdate: () => { pv.textContent = fmtCOP(Math.round(n.v / 1e5) * 1e5); }, onComplete: () => { pv.textContent = fmtCOP(u.price); } });
    }
  }
}
