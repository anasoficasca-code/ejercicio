import { fmtCOP, fmtNum } from '../geo.js';

const dots = (n) => '●'.repeat(n) + '○'.repeat(5 - n);

/** Modal "Predios": los tres lotes evaluados, la matriz de decisión, la norma del lote 02 y la cabida. */
export class PrediosModal {
  constructor({ project, onShow, onLamina }) {
    const { predios, matriz, normaPredio: n, cabida: c } = project;
    const rows = [['Comercio', 'comercio'], ['Educación', 'educacion'], ['Salud', 'salud'], ['Transporte', 'transporte'], ['Recreación y cultura', 'recreacion']];
    this.modal = document.createElement('div');
    this.modal.className = 'umbra-modal-backdrop';
    this.modal.innerHTML = `
      <div class="umbra-modal-box">
        <div class="modal-header">
          <h3>Análisis de predios · Galerías</h3>
          <button class="icon-circle-btn" data-close>✕</button>
        </div>
        <div class="modal-scroll">
          <div class="lot-grid">
            ${predios.map((p) => `
              <article class="lot-card ${p.seleccionado ? 'selected' : ''}">
                <div class="lot-photo" style="background-image:url(./assets/fotos/${p.id}.jpg)"></div>
                <div class="market-body">
                  <div class="lot-tag">${p.nombre}</div>
                  <h4>${p.direccion}</h4>
                  <div class="market-addr">${p.sector}</div>
                  <div class="kv"><span>Área del terreno</span><strong>${fmtNum(p.areaM2)} m²</strong></div>
                  <div class="kv"><span>Valor del lote</span><strong>${fmtCOP(p.valor)}</strong></div>
                  <div class="kv"><span>Valor por m² de lote</span><strong>${fmtCOP(p.valorM2)}</strong></div>
                  <div class="kv"><span>Meta de m² vendibles</span><strong>${fmtNum(p.metaVendibleM2)} m²</strong></div>
                  <p>${p.nota}</p>
                  <div class="market-actions"><button class="mode-pill-btn" data-show="${p.id}">Ver en 3D</button></div>
                </div>
              </article>`).join('')}
          </div>
          <p class="side-foot">${project.metaVendibleNota}</p>

          <section class="report-section">
            <h4>${matriz.titulo} <small>${matriz.subtitulo}</small></h4>
            <table class="matrix">
              <thead><tr><th>Criterio</th>${matriz.columnas.map((t, i) => `<th class="${i === 1 ? 'hl' : ''}">${t}</th>`).join('')}</tr></thead>
              <tbody>
                ${matriz.criterios.map((k) => `<tr><td><strong>${k.criterio}</strong><span>${k.ayuda}</span></td>${k.p.map((v, i) => `<td class="dots ${i === 1 ? 'hl' : ''}">${dots(v)}</td>`).join('')}</tr>`).join('')}
                <tr class="total"><td>Puntaje total</td>${matriz.totales.map((t, i) => `<td class="${i === 1 ? 'hl' : ''}">${t} / 35</td>`).join('')}</tr>
              </tbody>
            </table>
            <p class="side-text">${matriz.conclusion}</p>
          </section>

          <section class="report-section">
            <h4>Servicios cercanos</h4>
            <table class="matrix services">
              <thead><tr><th></th>${predios.map((p) => `<th class="${p.seleccionado ? 'hl' : ''}">${p.nombre}<br><span>${p.direccion}</span></th>`).join('')}</tr></thead>
              <tbody>${rows.map(([l, k]) => `<tr><td><strong>${l}</strong></td>${predios.map((p) => `<td class="${p.seleccionado ? 'hl' : ''}">${p[k]}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
          </section>

          <section class="report-section">
            <h4>Norma del predio <small>Calle 56 # 17-53 · ${project.ubicacion.upl} · lote catastral ${project.ubicacion.loteCatastral}</small></h4>
            <div class="norm-grid">
              <div><span>Tratamiento</span><strong>${n.tratamiento}</strong><em>Código de edificabilidad ${n.codigoEdificabilidad}</em></div>
              <div><span>Antejardín</span><strong>${fmtNum(n.antejardinM)} m</strong><em>Sobre la Calle 56 y la Carrera 18</em></div>
              <div><span>Aislamiento posterior</span><strong>No se exige</strong><em>Lote esquinero (Anexo 5)</em></div>
              <div><span>Patrimonio</span><strong>No es BIC</strong><em>Admite demolición y obra nueva</em></div>
            </div>
            <div class="kv"><span>Área y forma</span><strong>${n.areaForma}</strong></div>
            <div class="kv"><span>Uso actual</span><strong>${n.usoActual}</strong></div>
            <div class="kv"><span>Área de actividad</span><strong>${n.areaActividad}</strong></div>
            <div class="kv"><span>Aislamientos laterales</span><strong>${n.aislamientosLaterales}</strong></div>
            <div class="kv"><span>Sótanos</span><strong>${n.sotanos}</strong></div>
            <div class="kv"><span>Norma aplicable</span><strong>${n.normaAplicable}</strong></div>
            <p class="side-foot">Fuentes: ${n.fuentes}.</p>
          </section>

          <section class="report-section">
            <h4>Cabida arquitectónica</h4>
            <div class="norm-grid">
              <div><span>Huella por piso</span><strong>${fmtNum(c.huellaM2)} m²</strong><em>${fmtNum(c.huellaLargoM)} × ${fmtNum(c.huellaFondoM)} m</em></div>
              <div><span>Volumen</span><strong>${c.pisos} pisos</strong><em>${fmtNum(c.alturaPisoM)} m por piso · ${fmtNum(c.alturaTotalM)} m de altura</em></div>
              <div><span>Área construida</span><strong>${fmtNum(c.areaConstruidaM2)} m²</strong><em>IO ${fmtNum(c.indiceOcupacion)} · IC ${fmtNum(c.indiceConstruccion)}</em></div>
              <div><span>Ventas estimadas</span><strong>${fmtCOP(c.ventasEstimadas)}</strong><em>${c.unidades} apartaestudios de ${c.areaUnidadM2} m² · ${fmtNum(c.areaVendibleM2)} m² vendibles</em></div>
            </div>
            <div class="market-actions"><button class="mode-pill-btn" data-lamina="20">Ver lámina de cabida</button><button class="mode-pill-btn" data-lamina="21">Ver planta y corte</button></div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(this.modal);
    this.modal.querySelector('[data-close]').onclick = () => this.close();
    this.modal.onclick = (e) => { if (e.target === this.modal) this.close(); };
    this.modal.querySelectorAll('[data-show]').forEach((b) => (b.onclick = () => { this.close(); onShow(b.dataset.show); }));
    this.modal.querySelectorAll('[data-lamina]').forEach((b) => (b.onclick = () => onLamina(+b.dataset.lamina)));
  }

  open() { this.modal.classList.add('open'); }
  close() { this.modal.classList.remove('open'); }
}
