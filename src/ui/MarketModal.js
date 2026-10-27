import { distanceM, fmtCOP, fmtDist, fmtMillones } from '../geo.js';

/** Modal "Estudio de mercado": proyectos de la competencia, comparativo de precio por m² y perfil del comprador. */
export class MarketModal {
  constructor({ project, puntos, onShow, onLamina }) {
    const u = project.ubicacion, origin = [u.lng, u.lat];
    const comp = project.competencia.map((c) => {
      const pt = puntos.find((p) => p.id === c.id);
      return { ...c, pt, d: pt ? distanceM(origin, pt.lonlat) : null, m2: c.precioM2Detalle ?? c.precioM2 };
    });
    const avg = comp.reduce((s, c) => s + c.m2, 0) / comp.length;
    const own = project.cabida.precioVentaM2;
    const bars = [...comp.map((c) => ({ label: c.nombre, v: c.m2, note: c.precioM2Detalle ? 'lámina 12' : '' })), { label: 'Proyecto · Lote 02', v: own, own: true }]
      .sort((a, b) => b.v - a.v);
    const max = Math.max(...bars.map((b) => b.v));

    this.modal = document.createElement('div');
    this.modal.className = 'umbra-modal-backdrop';
    this.modal.innerHTML = `
      <div class="umbra-modal-box">
        <div class="modal-header">
          <h3>Estudio de mercado · Teusaquillo</h3>
          <button class="icon-circle-btn" data-close>✕</button>
        </div>
        <div class="modal-scroll">
          <div class="market-grid">
            ${comp.map((c) => `
              <article class="market-card">
                <div class="market-photo" style="background-image:url(./assets/fotos/${c.id}.jpg)"><span>${c.n}</span></div>
                <div class="market-body">
                  <h4>${c.nombre}</h4>
                  <div class="market-addr">${c.direccion}${c.d ? ` · a ${fmtDist(c.d)}` : ''}</div>
                  <div class="kv"><span>Estrato</span><strong>${c.estrato}</strong></div>
                  <div class="kv"><span>Constructora</span><strong>${c.constructora}</strong></div>
                  <div class="kv"><span>Área promedio</span><strong>${c.areaRangoM2 ? `${c.areaRangoM2.join(' – ').replace(/\./g, ',')} m²` : `${c.areaPromedioM2} m²`}</strong></div>
                  <div class="kv"><span>Precio promedio</span><strong>${fmtCOP(c.precioPromedio)}</strong></div>
                  <div class="kv"><span>Precio por m²</span><strong>${fmtCOP(c.precioM2)}</strong></div>
                  <p>${c.detalle}</p>
                  ${c.nota ? `<p class="warn">${c.nota}</p>` : ''}
                  <div class="market-actions">
                    ${c.pt ? `<button class="mode-pill-btn" data-show="${c.id}">Ver en 3D</button>` : ''}
                    <button class="mode-pill-btn" data-lamina="${c.lamina}">Ver lámina</button>
                  </div>
                </div>
              </article>`).join('')}
          </div>

          <section class="report-section">
            <h4>Precio por m² · comparativo</h4>
            <div class="bars">
              ${bars.map((b) => `<div class="bar-row ${b.own ? 'own' : ''}"><span>${b.label}${b.note ? ` <em>(${b.note})</em>` : ''}</span><div class="bar"><i style="width:${(b.v / max) * 100}%"></i></div><strong>${fmtMillones(b.v)}</strong></div>`).join('')}
            </div>
            <p class="side-text">Promedio de los cuatro proyectos: <strong>${fmtMillones(avg)}/m²</strong>. El precio de venta del estudio para el Lote 02 (${fmtCOP(own)}/m²) queda <strong>${Math.round((1 - own / avg) * 100)} % por debajo</strong> de ese promedio. Un apartaestudio de 35 m² saldría en ${fmtCOP(own * 35)}.</p>
          </section>

          <section class="report-section">
            <h4>¿Quién va a vivir?</h4>
            <div class="profile-grid">
              ${project.perfil.map((p) => `<div class="profile-card"><strong>${p.grupo}</strong><span>${p.edad}</span><p>${p.texto}</p></div>`).join('')}
            </div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(this.modal);
    this.modal.querySelector('[data-close]').onclick = () => this.close();
    this.modal.onclick = (e) => { if (e.target === this.modal) this.close(); };
    this.modal.querySelectorAll('[data-show]').forEach((b) => (b.onclick = () => { this.close(); onShow(comp.find((c) => c.id === b.dataset.show).pt); }));
    this.modal.querySelectorAll('[data-lamina]').forEach((b) => (b.onclick = () => onLamina(+b.dataset.lamina)));
  }

  open() { this.modal.classList.add('open'); }
  close() { this.modal.classList.remove('open'); }
}
