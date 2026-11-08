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
    const listKey = JSON.stringify([mode, s.activeFloor, s.activeTypology]);
    el.innerHTML = mode === 'urbanismo' ? this.urbanismo(s) : this.inmuebles(s);
    el.querySelector('.sidebar-body').scrollTop = scroll;
    this.bind(el);
    this.animate(el, listKey !== this._listKey);
    this._listKey = listKey;
  }

  /**
   * Movimiento que responde a lo que hizo la persona: las cifras cuentan la primera vez que se ve el panel
   * y la lista de unidades entra escalonada cuando cambia el filtro (no al seleccionar una unidad).
   */
  animate(el, listChanged) {
    const g = window.gsap;
    if (!g || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!this._counted) {
      const stats = el.querySelectorAll('[data-count]');
      if (stats.length) {
        this._counted = true;
        stats.forEach((n, k) => {
          const to = +n.dataset.count, dec = +(n.dataset.dec || 0), pre = n.dataset.prefix || '', suf = n.dataset.suffix || '';
          const o = { v: 0 };
          g.to(o, { v: to, duration: 1.6, delay: 0.15 + k * 0.12, ease: 'power3.out', onUpdate: () => { n.textContent = pre + fmtNum(o.v, dec) + suf; } });
        });
      }
    }
    if (listChanged) {
      g.fromTo(el.querySelectorAll('.jmc-room-card'), { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.025, ease: 'power3.out', clearProps: 'opacity,transform' });
      const active = el.querySelector('.arb-level.active');
      if (active) g.fromTo(active, { '--glow': 0 }, { '--glow': 1, duration: 0.6, ease: 'power2.out' });
    }
  }

  // ---------------------------------------------------------------- apartaestudios
  inmuebles(s) {
    const floors = [...new Set(s.units.map((u) => u.floor))].sort((a, b) => b - a);
    const typos = [...new Set(s.units.map((u) => u.typology))];
    const list = store.getFilteredUnits();
    const apts = s.units.filter((u) => u.typology === 'Apartamento');
    const nApts = apts.length;
    const pa = s.project.proyectoActual;
    const minPrice = Math.min(...pa.tipologias.map((t) => t.precio));
    const perFloor = (f) => s.units.filter((u) => u.floor === f && u.typology === 'Apartamento').length;
    return `
      <div class="sidebar-header-controls">
        <div class="arb-stats" aria-label="Datos del proyecto">
          <div><strong data-count="${nApts}">${nApts}</strong><span>apartamentos</span></div>
          <div><strong data-count="${pa.pisos}">${pa.pisos}</strong><span>pisos</span></div>
          <div><strong data-count="${Math.max(...pa.tipologias.map((t) => t.area))}" data-dec="2">${fmtNum(Math.max(...pa.tipologias.map((t) => t.area)), 2)}</strong><span>m² el más grande</span></div>
          <div><strong data-count="${Math.round(minPrice / 1e6)}" data-prefix="$" data-suffix=" M">$${Math.round(minPrice / 1e6)} M</strong><span>desde</span></div>
        </div>
        <div class="toggle-row">
          <div class="umbra-switch ${s.showUnitsOverlay ? 'on' : ''}" data-action="toggle-units"><div class="umbra-switch-knob"></div></div>
          <span class="toggle-label">Mostrar apartamentos 3D</span>
        </div>
      </div>
      <div class="sidebar-body">
        <div class="filter-section">
          <div class="filter-section-label">Elige un piso</div>
          <div class="arb-section" role="group" aria-label="Pisos del edificio">
            <button class="arb-level roof ${!s.activeFloor ? 'all' : ''}" data-floor="" aria-pressed="${!s.activeFloor}">
              <span class="arb-level-name">Edificio completo</span><span class="arb-level-meta">terraza comunal</span>
            </button>
            ${floors.map((f) => `
              <button class="arb-level ${s.activeFloor === f ? 'active' : ''} ${!s.activeFloor ? 'all' : ''}" data-floor="${f}" aria-pressed="${s.activeFloor === f}" style="--i:${f}">
                <span class="arb-level-name">Piso ${f}</span>
                <span class="arb-level-meta">${f === 1 ? 'lobby y zonas sociales' : `${perFloor(f)} apartamentos`}</span>
              </button>`).join('')}
            <span class="arb-ground" aria-hidden="true"></span>
          </div>
        </div>
        <div class="filter-section">
          <div class="filter-section-label">Unidades (${nApts} apartamentos · tipo A 78,75 m² y tipo B 70 m²)</div>
          <div class="jmc-room-stack">
            ${list.map((u) => `
              <div class="jmc-room-card ${s.selectedUnitId === u.id ? 'active' : ''}" data-id="${u.id}">
                <div class="jmc-room-main">
                  <span class="jmc-room-title">${u.typology === 'Apartamento' ? `Apto ${u.id}` : u.title}</span>
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
    const themes = [['realista', 'Realista'], ['maqueta', 'Maqueta'], ['usos', 'Usos del suelo'], ['valor', 'Valor del suelo'], ['altura', 'Altura media']];
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
          ${layer('predios', 'Predios evaluados (01 y 03)', '#8fb4dc')}
          ${layer('vias', 'Nombres de vías')}
        </div>
        <div class="filter-section">
          <div class="filter-section-label">Vista del contexto</div>
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
