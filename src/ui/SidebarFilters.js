import { store } from '../state/store.js';
import { CityContext, USOS } from '../scene/CityContext.js';
import { TIPOS } from '../scene/PoiLayer.js';
import { fmtMillones, fmtNum } from '../geo.js';

/**
 * Panel lateral izquierdo. Con la pestaña "Urbanismo" muestra las capas del contexto (área de estudio,
 * usos del suelo, valor del suelo, alturas, servicios); con las demás, los apartaestudios por piso.
 */
export class SidebarFilters {
  constructor(container, { onSelectUnit, getStats }) {
    this.container = container;
    this.onSelectUnit = onSelectUnit;
    this.getStats = getStats;
    this.container.innerHTML = `
      <div class="left-sidebar">
        <button class="sidebar-close-btn" id="btn-collapse-sidebar" title="Ocultar panel">✕</button>
        <div class="sidebar-brand-header">
          <img src="./assets/branding/jmc-logo.png" alt="JMC Arquitectura" class="jmc-sidebar-logo" />
          <div class="jmc-brand-info">
            <div class="jmc-brand-name">JMC ARQUITECTURA</div>
            <div class="jmc-brand-project">GALERÍAS · CALLE 56 # 17-53</div>
          </div>
        </div>
        <div id="sidebar-content" class="sidebar-content"></div>
        <div class="sidebar-collapse-tab" id="sidebar-tab" title="Mostrar/Ocultar">‹</div>
      </div>`;
    const tab = this.container.querySelector('#sidebar-tab');
    const toggle = () => {
      this.container.classList.toggle('collapsed');
      tab.textContent = this.container.classList.contains('collapsed') ? '›' : '‹';
    };
    this.container.querySelector('#btn-collapse-sidebar').onclick = toggle;
    tab.onclick = toggle;
    if (matchMedia('(max-width: 760px)').matches) toggle(); // en celular el panel arranca oculto
    store.subscribe(() => this.render());
  }

  render() {
    const s = store.state;
    if (!s.project) return;
    const mode = s.activeTab === 'urbanismo' ? 'urbanismo' : 'inmuebles';
    const key = JSON.stringify([mode, s.activeFloor, s.activeTypology, s.selectedUnitId, s.showUnitsOverlay, s.cityTheme, s.layers]);
    if (key === this._key) return;
    this._key = key;
    const el = this.container.querySelector('#sidebar-content');
    const scroll = el.querySelector('.sidebar-body')?.scrollTop || 0;
    el.innerHTML = mode === 'urbanismo' ? this.urbanismo(s) : this.inmuebles(s);
    el.querySelector('.sidebar-body').scrollTop = scroll;
    this.bind(el);
  }

  // ---------------------------------------------------------------- apartaestudios
  inmuebles(s) {
    const floors = [...new Set(s.units.map((u) => u.floor))];
    const typos = [...new Set(s.units.map((u) => u.typology))];
    const list = store.getFilteredUnits();
    const nApts = s.units.filter((u) => u.typology === 'Apartaestudio').length;
    return `
      <div class="sidebar-header-controls">
        <div class="toggle-row">
          <div class="umbra-switch ${s.showUnitsOverlay ? 'on' : ''}" data-action="toggle-units"><div class="umbra-switch-knob"></div></div>
          <span class="toggle-label">Mostrar apartaestudios 3D</span>
        </div>
      </div>
      <div class="sidebar-body">
        <div class="filter-section">
          <div class="filter-section-label">Filtrar por piso</div>
          <div class="jmc-pill-stack">
            <button class="jmc-pill-btn ${!s.activeFloor ? 'active' : ''}" data-floor="">Todos</button>
            ${floors.map((f) => `<button class="jmc-pill-btn ${s.activeFloor === f ? 'active' : ''}" data-floor="${f}">Piso ${f}</button>`).join('')}
          </div>
        </div>
        <div class="filter-section">
          <div class="filter-section-label">Unidades (${nApts} apartaestudios de 35 m²)</div>
          <div class="jmc-room-stack">
            ${list.map((u) => `
              <div class="jmc-room-card ${s.selectedUnitId === u.id ? 'active' : ''}" data-id="${u.id}">
                <div class="jmc-room-main">
                  <span class="jmc-room-title">${u.typology === 'Apartaestudio' ? `Apto ${u.id}` : u.title}</span>
                  <span class="jmc-room-type">Piso ${u.floor} · ${u.location.split(' · ')[0].split(' sobre')[0]}</span>
                </div>
                <div class="jmc-room-badge">${u.area} m²</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="filter-section">
          <div class="filter-section-label">Tipologías</div>
          <div class="filter-grid-2">
            <button class="jmc-pill-btn ${!s.activeTypology ? 'active' : ''}" data-typo="" style="grid-column: span 2">Todas</button>
            ${typos.map((t) => `<button class="jmc-pill-btn ${s.activeTypology === t ? 'active' : ''}" data-typo="${t}">${t}</button>`).join('')}
          </div>
        </div>
        <div class="sidebar-note">${s.project.distribucion.nota}</div>
      </div>`;
  }

  // ---------------------------------------------------------------- urbanismo
  urbanismo(s) {
    const st = this.getStats();
    const themes = [['maqueta', 'Maqueta'], ['satelite', 'Satélite'], ['usos', 'Usos del suelo'], ['valor', 'Valor del suelo'], ['altura', 'Altura media']];
    const legend = CityContext.legend(s.cityTheme);
    const layer = (k, label, color) => `
      <div class="toggle-row layer-row">
        <div class="umbra-switch ${s.layers[k] ? 'on' : ''}" data-layer="${k}"><div class="umbra-switch-knob"></div></div>
        <span class="toggle-label">${color ? `<i class="dot" style="background:${color}"></i>` : ''}${label}</span>
      </div>`;
    const usos = Object.entries(st.usos).sort((a, b) => b[1] - a[1]);
    const mz = st.manzanaLote;
    return `
      <div class="sidebar-body">
        <div class="filter-section">
          <div class="filter-section-label">Capas del contexto</div>
          ${layer('estudio', 'Área de estudio · Calles 53–60 / Cras 14–24', '#2b4a86')}
          ${layer('servicios', 'Servicios y equipamientos', TIPOS.educacion.color)}
          ${layer('competencia', 'Proyectos de la competencia', TIPOS.competencia.color)}
          ${layer('predios', 'Predios evaluados (01 y 03)', '#c8a46e')}
          ${layer('vias', 'Nombres de vías')}
        </div>
        <div class="filter-section">
          <div class="filter-section-label">Colorear manzanas por</div>
          <div class="filter-grid-2">
            ${themes.map(([k, l]) => `<button class="jmc-pill-btn ${s.cityTheme === k ? 'active' : ''}" data-theme="${k}">${l}</button>`).join('')}
          </div>
          ${legend.length ? `<div class="legend">${legend.map((b) => `<div><i style="background:${b.color}"></i>${b.label}</div>`).join('')}</div>` : ''}
        </div>
        <div class="filter-section">
          <div class="filter-section-label">Área de estudio · Catastro Bogotá</div>
          <div class="kv"><span>Manzanas</span><strong>${st.manzanas}</strong></div>
          ${usos.map(([k, n]) => `<div class="kv"><span><i class="dot" style="background:${USOS[k]?.color || '#999'}"></i>${USOS[k]?.label || 'Sin dato'}</span><strong>${Math.round((n / st.manzanas) * 100)} %</strong></div>`).join('')}
          ${st.vrefMediana ? `<div class="kv"><span>Valor de referencia del suelo (mediana)</span><strong>${fmtMillones(st.vrefMediana)}/m²</strong></div>` : ''}
          ${st.alturaMedia ? `<div class="kv"><span>Altura media ponderada</span><strong>${fmtNum(st.alturaMedia, 1)} pisos</strong></div>` : ''}
        </div>
        ${mz ? `<div class="filter-section">
          <div class="filter-section-label">Manzana del lote · ${mz.id}</div>
          <div class="kv"><span>Uso predominante</span><strong>${USOS[mz.uso]?.label || '—'}</strong></div>
          <div class="kv"><span>Altura media</span><strong>${mz.alt ?? '—'} pisos</strong></div>
          <div class="kv"><span>Valor de referencia</span><strong>${mz.vref ? fmtMillones(mz.vref) + '/m²' : '—'}</strong></div>
        </div>` : ''}
        <div class="filter-section">
          <div class="filter-section-label">Conectividad</div>
          ${s.project.conectividad.map((c) => `<p class="side-text"><strong>${c.titulo}.</strong> ${c.texto}</p>`).join('')}
        </div>
        <div class="filter-section">
          <div class="filter-section-label">Usos del suelo</div>
          ${s.project.usosSuelo.map((c) => `<p class="side-text"><strong>${c.titulo}.</strong> ${c.texto}</p>`).join('')}
        </div>
        <div class="sidebar-note">Fuente: Catastro Bogotá (UAECD) · construcciones, lotes, manzanas, uso predominante, altura media y valor de referencia por manzana. ${st.construcciones.toLocaleString('es-CO')} construcciones en el modelo.</div>
      </div>`;
  }

  bind(el) {
    el.querySelector('[data-action="toggle-units"]')?.addEventListener('click', () => store.setState({ showUnitsOverlay: !store.state.showUnitsOverlay }));
    el.querySelectorAll('[data-floor]').forEach((b) => (b.onclick = () => store.setState({ activeFloor: b.dataset.floor ? +b.dataset.floor : null, selectedUnitId: null })));
    el.querySelectorAll('[data-typo]').forEach((b) => (b.onclick = () => store.setState({ activeTypology: b.dataset.typo || null })));
    el.querySelectorAll('.jmc-room-card').forEach((c) => (c.onclick = () => this.onSelectUnit(c.dataset.id)));
    el.querySelectorAll('[data-layer]').forEach((b) => (b.onclick = () => store.setLayer(b.dataset.layer, !store.state.layers[b.dataset.layer])));
    el.querySelectorAll('[data-theme]').forEach((b) => (b.onclick = () => store.setState({ cityTheme: b.dataset.theme })));
  }
}
