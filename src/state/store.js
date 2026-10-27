/**
 * Store reactivo del masterplan Apartaestudios Galerías.
 * Maneja unidades, filtros, capas urbanas, modo de vista 3D y pestaña activa del dock.
 */
export class MasterplanStore {
  constructor() {
    this.state = {
      project: null,                 // data/proyecto.json
      units: [],                     // apartaestudios y zonas comunes por piso
      showUnitsOverlay: true,        // "Mostrar apartaestudios 3D"
      activeFloor: null,             // filtro por piso (1..6)
      activeTypology: null,          // 'Apartamento' | 'Zona común'
      selectedUnitId: null,
      hoveredUnitId: null,
      activeTab: 'inmuebles',        // 'ubicacion' | 'urbanismo' | 'inmuebles' | 'mercado' | 'predios' | 'galeria'
      viewMode: 'exterior',          // 'exterior' | 'contexto' | 'top'
      cityTheme: 'realista',         // 'realista' | 'maqueta' | 'usos' | 'valor' | 'altura'
      layers: { estudio: true, servicios: true, competencia: true, predios: true, vias: true }
    };
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  setLayer(key, on) {
    this.setState({ layers: { ...this.state.layers, [key]: on } });
  }

  getFilteredUnits() {
    const { units, activeFloor, activeTypology } = this.state;
    return units.filter((u) => {
      if (activeFloor && u.floor !== activeFloor) return false;
      if (activeTypology && u.typology !== activeTypology) return false;
      return true;
    });
  }

  getSelectedUnit() {
    return this.state.units.find((u) => u.id === this.state.selectedUnitId) || null;
  }
}

export const store = new MasterplanStore();
