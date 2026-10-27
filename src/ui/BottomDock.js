import { store } from '../state/store.js';

const ICONS = {
  ubicacion: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  urbanismo: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  inmuebles: '<path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/>',
  mercado: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
  predios: '<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/>',
  galeria: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'
};
const TABS = [
  ['ubicacion', 'Dónde estamos'],
  ['urbanismo', 'Urbanismo'],
  ['inmuebles', 'Apartaestudios'],
  ['mercado', 'Mercado'],
  ['predios', 'Predios'],
  ['galeria', 'Galería']
];

/** Dock inferior de navegación (misma UI del masterplan La Fontana) con la marca JMC. */
export class BottomDock {
  constructor(container, { onTabClick }) {
    this.container = container;
    this.container.className = 'bottom-dock-container';
    this.container.innerHTML = `
      <div class="dock-collapse-handle" id="btn-toggle-dock">▼</div>
      <div class="bottom-dock">
        <div class="jmc-dock-brand">
          <img src="./assets/branding/jmc-logo.png" alt="JMC Arquitectura" class="jmc-dock-avatar" />
          <div class="jmc-dock-meta">
            <strong class="jmc-dock-name">JMC ARQUITECTURA</strong>
            <span class="jmc-dock-sub">EJERCICIO PROFESIONAL 2</span>
          </div>
        </div>
        ${TABS.map(([k, l]) => `<button class="dock-tab-btn" data-tab="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">${ICONS[k]}</svg>${l}</button>`).join('')}
      </div>`;
    this.container.querySelectorAll('.dock-tab-btn').forEach((btn) => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        if (tab === 'urbanismo' || tab === 'inmuebles') store.setState({ activeTab: tab });
        onTabClick(tab);
      };
    });
    const handle = this.container.querySelector('#btn-toggle-dock');
    handle.onclick = () => {
      const dock = this.container.querySelector('.bottom-dock');
      const hidden = dock.style.display === 'none';
      dock.style.display = hidden ? 'flex' : 'none';
      handle.textContent = hidden ? '▼' : '▲';
    };
    store.subscribe((s) => {
      this.container.querySelectorAll('.dock-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === s.activeTab));
    });
  }
}
