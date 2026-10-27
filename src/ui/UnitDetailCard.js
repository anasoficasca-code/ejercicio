import { store } from '../state/store.js';
import { fmtCOP } from '../geo.js';

/** Tarjeta flotante central con los atributos de la unidad seleccionada (misma UI del masterplan La Fontana). */
export class UnitDetailCard {
  constructor(container, { onOpenGallery }) {
    this.container = container;
    this.container.className = 'room-detail-card';
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('#btn-close-detail')) store.setState({ selectedUnitId: null });
      else if (e.target.closest('#btn-view-gallery')) onOpenGallery(store.getSelectedUnit());
    });
    store.subscribe(() => this.render());
  }

  render() {
    const u = store.getSelectedUnit();
    if (!u) { this.container.classList.remove('visible'); this._id = null; return; }
    if (u.id === this._id) return;
    this._id = u.id;
    const p = store.state.project;
    const apt = u.typology === 'Apartamento';
    this.container.innerHTML = `
      <button class="detail-close-btn" id="btn-close-detail">✕</button>
      <div class="detail-title">${u.title}</div>
      <div class="detail-subtitle">${p.ubicacion.direccion} · ${p.ubicacion.barrio}</div>
      <div class="detail-props">
        <div class="detail-prop-line"><span class="label">Piso:</span> ${u.floor} de ${p.cabida.pisos}</div>
        <div class="detail-prop-line"><span class="label">Tipología:</span> ${u.typology}</div>
        <div class="detail-prop-line"><span class="label">Área:</span> ${u.area.toLocaleString('es-CO')} m²${apt ? ' (área privada aprox.)' : ''}</div>
        <div class="detail-prop-line"><span class="label">Ubicación:</span> ${u.location}</div>
        <div class="detail-prop-line"><span class="label">Fachadas:</span> ${u.facades}</div>
        <div class="detail-prop-line"><span class="label">Altura libre:</span> ${u.height}</div>
        ${apt ? `<div class="detail-prop-line"><span class="label">Precio estimado:</span> ${fmtCOP(u.price)}</div>
        <div class="detail-prop-line dim">${u.area} m² × ${fmtCOP(p.cabida.precioVentaM2)}/m² (precio de venta del estudio)</div>` : `<div class="detail-prop-line"><span class="label">Programa:</span> ${p.distribucion.piso1.join(' · ')}</div>`}
      </div>
      ${apt ? `<div class="finish-row">${p.apartaestudio.acabados.map((a) => `<i title="${a.elemento}: ${a.detalle}" style="background:${a.color}"></i>`).join('')}<span>Acabados</span></div>` : ''}
      <div class="detail-actions">
        <button class="detail-gallery-btn" id="btn-view-gallery">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          ${apt ? 'Ver acabados y láminas del proyecto' : 'Ver zonas sociales'}
        </button>
      </div>`;
    this.container.classList.add('visible');
  }
}
