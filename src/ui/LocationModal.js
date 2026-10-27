import { distanceM, fmtDist } from '../geo.js';
import { TIPOS } from '../scene/PoiLayer.js';

/** Modal "Dónde estamos": mapa OpenStreetMap con el lote, el área de estudio y los puntos de interés. */
export class LocationModal {
  constructor({ project, puntos }) {
    this.project = project;
    this.puntos = puntos;
    const u = project.ubicacion;
    const origin = [u.lng, u.lat];
    const list = puntos.filter((p) => p.tipo !== 'proyecto')
      .map((p) => ({ ...p, d: distanceM(origin, p.lonlat) }))
      .sort((a, b) => a.d - b.d);
    this.modal = document.createElement('div');
    this.modal.className = 'umbra-modal-backdrop';
    this.modal.innerHTML = `
      <div class="umbra-modal-box">
        <div class="modal-header">
          <h3>Dónde estamos · ${u.direccion}</h3>
          <button class="icon-circle-btn" id="btn-close-location">✕</button>
        </div>
        <div class="modal-body">
          <div id="osm-map-container"></div>
          <div class="location-info-sidebar">
            <h4 style="font-size: 15px; font-weight: 600;">Lote 02 · ${u.barrio}, ${u.localidad}</h4>
            <div class="coord-badge">${u.lat.toFixed(6)}° N, ${u.lng.toFixed(6)}° W<br>Lote catastral ${u.loteCatastral} · ${u.upl}</div>
            <p class="side-text">${u.descripcion}</p>
            <div class="side-caption">Puntos de interés (distancia en línea recta)</div>
            <div class="poi-list">
              ${list.map((p) => `<div class="poi-item"><span><i class="dot" style="background:${TIPOS[p.tipo].color}"></i>${p.nombre}</span><strong style="color:#ff858d">${fmtDist(p.d)}</strong></div>`).join('')}
            </div>
            <div class="side-foot">Ubicaciones geocodificadas con la placa domiciliaria de Catastro Bogotá; las marcadas como aproximadas se ubicaron sobre el lote o corredor.</div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(this.modal);
    this.modal.querySelector('#btn-close-location').onclick = () => this.close();
    this.modal.onclick = (e) => { if (e.target === this.modal) this.close(); };
  }

  open() {
    this.modal.classList.add('open');
    const u = this.project.ubicacion;
    if (this.map || !window.L) { setTimeout(() => this.map?.invalidateSize(), 150); return; }
    setTimeout(() => {
      const L = window.L;
      this.map = L.map('osm-map-container').setView([u.lat, u.lng], 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(this.map);
      L.polygon(this.project.areaEstudio.lonlat.map(([lon, lat]) => [lat, lon]), { color: '#1e2a44', weight: 3, dashArray: '6 6', fillOpacity: 0.06 })
        .addTo(this.map).bindTooltip('Área de estudio');
      for (const p of this.puntos) {
        const color = TIPOS[p.tipo].color, main = p.tipo === 'proyecto';
        const icon = L.divIcon({
          className: 'custom-pin',
          html: `<div style="background:${color};width:${main ? 18 : 12}px;height:${main ? 18 : 12}px;border-radius:50%;border:${main ? 3 : 2}px solid #fff;box-shadow:0 0 ${main ? 14 : 6}px ${color}"></div>`,
          iconSize: [main ? 24 : 16, main ? 24 : 16], iconAnchor: [main ? 12 : 8, main ? 12 : 8]
        });
        const m = L.marker([p.lonlat[1], p.lonlat[0]], { icon }).addTo(this.map).bindPopup(`<b>${p.nombre}</b><br>${p.detalle}${p.aprox ? '<br><i>Ubicación aproximada</i>' : ''}`);
        if (main) m.openPopup();
      }
    }, 150);
  }

  close() { this.modal.classList.remove('open'); }
}
