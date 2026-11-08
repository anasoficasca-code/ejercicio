import { MasterplanScene } from './scene/MasterplanScene.js';
import { SidebarFilters } from './ui/SidebarFilters.js';
import { UnitDetailCard } from './ui/UnitDetailCard.js';
import { BottomDock } from './ui/BottomDock.js';
import { GalleryModal } from './ui/GalleryModal.js';
import { LocationModal } from './ui/LocationModal.js';
import { MarketModal } from './ui/MarketModal.js';
import { PrediosModal } from './ui/PrediosModal.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { Intro } from './ui/Intro.js';
import { Tour, STOPS } from './ui/Tour.js';
import { Hotspots } from './scene/Hotspots.js';
import { store } from './state/store.js';

const lamina = (n) => `./assets/canva/lamina-${String(n).padStart(2, '0')}.jpg`;

class App {
  constructor() {
    this.loading = new LoadingScreen();
    this.loading.set(0.05, 'Cargando el contexto de Catastro Bogotá…');
    this.scene = new MasterplanScene(document.getElementById('canvas-container'));
    this.scene.onPick = (p) => this.onPick(p);
    window.__masterplan = this.scene;
    this.gallery = new GalleryModal();
    this.setupTopBar();

    this.scene.loadData().then(async (data) => {
      const { project, puntos } = data;
      this.loading.set(0.55, 'Armando el edificio y las capas urbanas…');
      this.laminas = project.galeria.map((g) => ({ src: lamina(g.lamina), title: `${String(g.lamina).padStart(2, '0')} · ${g.titulo}`, type: g.tipo, n: g.lamina }));
      this.location = new LocationModal({ project, puntos: puntos.p });
      this.market = new MarketModal({ project, puntos: puntos.p, onShow: (pt) => this.scene.focusPoint(pt.xz[0], pt.xz[1], 220), onLamina: (n) => this.openLamina(n) });
      this.predios = new PrediosModal({ project, onShow: (id) => this.showPredio(id), onLamina: (n) => this.openLamina(n) });
      this.sidebar = new SidebarFilters(document.getElementById('left-sidebar-wrapper'), {
        onSelectUnit: (id) => store.setState({ selectedUnitId: id, viewMode: 'exterior' }),
        getStats: () => this.scene.city.stats
      });
      this.detail = new UnitDetailCard(document.getElementById('room-detail-container'), { onOpenGallery: (u) => this.openUnitGallery(u) });
      this.dock = new BottomDock(document.getElementById('bottom-dock-container'), { onTabClick: (t) => this.handleTabClick(t) });
      store.setState({ activeTab: 'inmuebles' });
      // recorrido guiado y puntos de interés sobre el edificio
      this.tour = new Tour({ scene: this.scene });
      this.hotspots = new Hotspots(this.scene.building, STOPS, { onPick: (i) => this.tour.start(i) });
      const syncPins = () => {
        const s = store.state;
        this.hotspots.setVisible(!document.body.classList.contains('is-intro') && !this.tour.active && s.viewMode === 'exterior' && !s.selectedUnitId && !s.activeFloor);
      };
      store.subscribe(syncPins);
      this.tour.onStop = syncPins;
      this.tour.onChange = syncPins;
      this.loading.set(0.8, 'Descargando la ortofoto…');
      await Promise.race([this.scene.city.ready, new Promise((r) => setTimeout(r, 7000))]);
      const hour = document.getElementById('sky-hour');
      this.scene.setHour(parseFloat(hour.value));
      this.loading.done();
      // llegada: la cámara baja sobre Galerías hasta la esquina mientras se encienden las luces de la tarde
      this.intro = new Intro({
        scene: this.scene,
        onTour: () => { syncPins(); this.tour.start(0); },
        onExplore: () => syncPins()
      });
      syncPins();
      this.intro.play();
    }).catch((e) => {
      console.error(e);
      this.loading.set(1, 'No se pudieron cargar los datos. Abre el sitio desde un servidor web (GitHub Pages o npx serve).');
    });
  }

  setupTopBar() {
    document.querySelectorAll('.mode-pill-btn[data-mode]').forEach((btn) => {
      btn.onclick = () => store.setState({ viewMode: btn.dataset.mode, ...(btn.dataset.mode === 'contexto' ? { selectedUnitId: null } : {}) });
    });
    store.subscribe((s) => document.querySelectorAll('.mode-pill-btn[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === s.viewMode)));
    document.getElementById('btn-laminas').onclick = () => this.gallery.open('Láminas · Ejercicio Profesional 2', this.laminas || []);
    document.getElementById('btn-tour').onclick = () => this.tour?.start(0);

    const hour = document.getElementById('sky-hour'), label = document.getElementById('sky-hour-label');
    const night = document.getElementById('btn-night');
    const show = (h) => {
      const hh = Math.floor(h), mm = Math.round((h - hh) * 60) % 60;
      label.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const dark = h >= 17.9;
      night.setAttribute('aria-pressed', String(dark));
      document.body.classList.toggle('is-night', dark);
    };
    let raf = null;
    hour.addEventListener('input', () => {
      show(parseFloat(hour.value));
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; this.scene.setHour(parseFloat(hour.value)); });
    });
    // noche ↔ tarde: la luz cambia en 2,4 s y se van encendiendo apartamentos, bañadores y calle
    night.onclick = () => {
      const g = window.gsap, from = parseFloat(hour.value), to = from >= 17.9 ? 16.9 : 18.15;
      const apply = (h) => { hour.value = h; show(h); this.scene.setHour(h); };
      if (!g || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(to); return; }
      const o = { h: from };
      g.killTweensOf(this._sky ||= {});
      this._sky = o;
      g.to(o, { h: to, duration: 2.4, ease: 'sine.inOut', onUpdate: () => apply(o.h) });
    };
  }

  handleTabClick(tab) {
    if (tab === 'ubicacion') this.location.open();
    else if (tab === 'urbanismo') store.setState({ viewMode: 'contexto', selectedUnitId: null });
    else if (tab === 'inmuebles') store.setState({ viewMode: 'exterior' });
    else if (tab === 'mercado') this.market.open();
    else if (tab === 'predios') this.predios.open();
    else if (tab === 'galeria') this.gallery.open('Láminas · Ejercicio Profesional 2', this.laminas);
  }

  openLamina(n) {
    this.gallery.open('Láminas · Ejercicio Profesional 2', this.laminas, this.laminas.findIndex((l) => l.n === n));
  }

  openUnitGallery(u) {
    const pick = u.typology === 'Apartamento' ? [u.lamina, 26, 25, u.tipo === 'A' ? 28 : 27, 35] : [30, 31, 32, 33, 34, 22, 29];
    this.gallery.open(`Galería · ${u.title}`, pick.map((n) => this.laminas.find((l) => l.n === n)));
  }

  showPredio(id) {
    if (id === 'lote-02') { store.setState({ viewMode: 'exterior', selectedUnitId: null }); this.scene.applyViewMode('exterior'); return; }
    const l = this.scene.data.predios.p.find((p) => p.id === id);
    const c = l.pts.reduce((s, q) => [s[0] + q[0] / l.pts.length, s[1] + q[1] / l.pts.length], [0, 0]);
    store.setLayer('predios', true);
    this.scene.focusPoint(c[0], c[1], 140);
  }

  onPick(p) {
    if (p.tipo === 'competencia') this.market.open();
    else if (p.tipo === 'predio') this.predios.open();
    else if (p.tipo === 'proyecto') store.setState({ viewMode: 'exterior', activeTab: 'inmuebles' });
    else this.scene.focusPoint(p.xz[0], p.xz[1], 200);
  }
}

window.addEventListener('DOMContentLoaded', () => { window.__masterplanApp = new App(); });
