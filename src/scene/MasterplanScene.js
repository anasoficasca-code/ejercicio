import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { CityContext } from './CityContext.js';
import { ProjectBuilding } from './ProjectBuilding.js';
import { PoiLayer } from './PoiLayer.js';
import { store } from '../state/store.js';

/**
 * MasterplanScene — motor Three.js del masterplan: cielo físico con el sol real de Bogotá según la
 * hora, sombras, contexto urbano de Catastro, el edificio del proyecto y raycasting de unidades.
 */
const LAT = 4.6439 * Math.PI / 180;
const DECL = -13 * Math.PI / 180; // finales de octubre

export function sunDirection(hour) {
  const H = (hour - 12) * 15 * Math.PI / 180;
  const el = Math.asin(Math.sin(LAT) * Math.sin(DECL) + Math.cos(LAT) * Math.cos(DECL) * Math.cos(H));
  const az = Math.atan2(-Math.cos(DECL) * Math.sin(H), Math.sin(DECL) * Math.cos(LAT) - Math.cos(DECL) * Math.sin(LAT) * Math.cos(H));
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

export class MasterplanScene {
  constructor(container) {
    this.container = container;
    this.mobile = matchMedia('(max-width: 760px)').matches;
    const w = container.clientWidth, h = container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.5 : 1.75));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.62;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.setSize(w, h);
    this.labels.domElement.className = 'labels-layer';
    container.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 12000);
    this.camera.position.set(-62, 40, -58);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 3200;
    this.controls.target.set(0, 8, 0);

    this._setupSky();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'hover-room-tooltip';
    document.body.appendChild(this.tooltip);

    window.addEventListener('resize', () => this.onResize());
    this._bindPointer();
    store.subscribe((s) => this.onState(s));
    this.renderer.setAnimationLoop(() => this.render());
  }

  // ---------------------------------------------------------------- cielo y sol
  _setupSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(20000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;
    this.scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight(0xdfe9f5, 0x8a8170, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048);
    const c = this.sun.shadow.camera;
    c.left = -120; c.right = 120; c.top = 120; c.bottom = -120; c.near = 10; c.far = 900;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.fog = new THREE.Fog(0xcdd7e2, 1400, 6500);
    this.setHour(10.5);
  }

  setHour(hour) {
    const d = sunDirection(hour);
    this.sky.material.uniforms.sunPosition.value.copy(d);
    const day = THREE.MathUtils.smoothstep(d.y, -0.02, 0.25);
    this.sun.position.copy(d).multiplyScalar(400);
    this.sun.intensity = 0.2 + 2.6 * day;
    this.sun.color.setHSL(0.09, 0.55 - 0.35 * day, 0.62 + 0.3 * day);
    this.hemi.intensity = 0.35 + 0.65 * day;
    this.scene.fog.color.setHSL(0.58, 0.25, 0.45 + 0.38 * day);
    // entorno PBR a partir del cielo (se regenera con la hora)
    clearTimeout(this._envT);
    this._envT = setTimeout(() => {
      const tmp = new THREE.Scene();
      const sky = this.sky.clone();
      tmp.add(sky);
      this.env?.dispose();
      this.env = this.pmrem.fromScene(tmp, 0.02).texture;
      this.scene.environment = this.env;
    }, 60);
  }

  // ---------------------------------------------------------------- datos
  async loadData() {
    const get = (p) => fetch(p).then((r) => { if (!r.ok) throw new Error(p); return r.json(); });
    const [project, construcciones, manzanas, lotes, predios, puntos] = await Promise.all([
      get('./data/proyecto.json'),
      get('./data/geometry/construcciones.json'),
      get('./data/geometry/manzanas.json'),
      get('./data/geometry/lotes.json'),
      get('./data/geometry/predios.json'),
      get('./data/geometry/puntos.json')
    ]);
    this.data = { project, construcciones, manzanas, lotes, predios, puntos };

    const lot = predios.p.find((p) => p.id === 'lote-02');
    this.city = new CityContext(this.scene, { renderer: this.renderer, data: this.data, project });
    this.building = new ProjectBuilding(this.scene, { lot, project });
    this.pois = new PoiLayer(this.scene, {
      puntos: puntos.p, predios: predios.p, project, competencia: project.competencia,
      onPick: (p) => this.onPick?.(p)
    });
    const c = this.building.center();
    this.home = { target: new THREE.Vector3(c.x, 7, c.z), pos: new THREE.Vector3(c.x - 52, 34, c.z - 50) };
    this.controls.target.copy(this.home.target);
    this.camera.position.copy(this.home.pos);
    this.sun.target.position.copy(c);

    this._mode = store.state.viewMode; // la cámara ya está en la vista inicial
    store.setState({ project, units: this.building.units.map(({ worldCenter, ...u }) => u) });
    return this.data;
  }

  // ---------------------------------------------------------------- estado → escena
  onState(s) {
    if (!this.building) return;
    const filtered = (s.activeFloor || s.activeTypology) ? new Set(store.getFilteredUnits().map((u) => u.id)) : null;
    this.building.setHighlight({ show: s.showUnitsOverlay, selectedId: s.selectedUnitId, hoveredId: s.hoveredUnitId, filter: filtered });

    if (s.cityTheme !== this._theme) { this._theme = s.cityTheme; this.city.setTheme(s.cityTheme); }
    for (const k of ['estudio', 'predios']) this.city.setLayer(k, s.layers[k]);
    this.pois.setLayer('servicios', s.layers.servicios);
    this.pois.setLayer('competencia', s.layers.competencia);
    this.pois.setLayer('predios', s.layers.predios);
    this.pois.setLayer('vias', s.layers.vias);

    const sel = store.getSelectedUnit();
    const cut = sel ? sel.floor : (s.activeFloor || null);
    if (cut !== this._cut) { this._cut = cut; this.building.setCut(cut); }

    if (s.viewMode !== this._mode) { this._mode = s.viewMode; this.applyViewMode(s.viewMode); }
    if (s.selectedUnitId !== this._sel) { this._sel = s.selectedUnitId; if (sel) this.focusUnit(sel.id); }
    this.pois.setCompact(s.viewMode === 'exterior' && !!sel);
  }

  flyTo(pos, target, dur = 1.6) {
    const g = window.gsap;
    if (!g) { this.camera.position.copy(pos); this.controls.target.copy(target); return; }
    g.killTweensOf(this.camera.position);
    g.killTweensOf(this.controls.target);
    g.to(this.camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: dur, ease: 'power2.inOut' });
    g.to(this.controls.target, { x: target.x, y: target.y, z: target.z, duration: dur, ease: 'power2.inOut' });
  }

  applyViewMode(mode) {
    if (!this.home) return;
    const c = this.building.center();
    this.controls.maxPolarAngle = mode === 'top' ? 0.001 : Math.PI * 0.48;
    if (mode === 'exterior') this.flyTo(this.home.pos, this.home.target);
    if (mode === 'top') this.flyTo(new THREE.Vector3(c.x, 95, c.z + 0.01), new THREE.Vector3(c.x, 0, c.z));
    if (mode === 'contexto') {
      const a = this.city.studyArea;
      const t = new THREE.Vector3(a.reduce((s, p) => s + p[0], 0) / a.length, 0, a.reduce((s, p) => s + p[1], 0) / a.length);
      this.flyTo(new THREE.Vector3(t.x + 120, 760, t.z + 820), t, 2);
    }
  }

  focusUnit(id) {
    const u = this.building.units.find((k) => k.id === id);
    if (!u) return;
    const p = u.worldCenter();
    const back = this.camera.position.clone().sub(this.controls.target).setY(0).normalize();
    if (back.lengthSq() < 0.1) back.set(-0.7, 0, -0.7);
    this.flyTo(p.clone().addScaledVector(back, 26).setY(p.y + 22), p.clone().setY(p.y - 1), 1.3);
  }

  focusPoint(x, z, dist = 260) {
    this.flyTo(new THREE.Vector3(x - dist * 0.55, dist * 0.75, z - dist * 0.55), new THREE.Vector3(x, 0, z), 1.6);
  }

  // ---------------------------------------------------------------- interacción
  _bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointermove', (e) => this._hover(e));
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const id = this._pick(e);
      if (id) store.setState({ selectedUnitId: id, activeTab: 'inmuebles' });
    });
  }

  _pick(e) {
    if (!this.building) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.building.getUnitMeshes().filter((m) => m.visible && m.parent.visible), false)[0];
    return hit?.object.userData.unitId || null;
  }

  _hover(e) {
    if (e.buttons) return;
    const id = this._pick(e);
    if (id !== store.state.hoveredUnitId) store.setState({ hoveredUnitId: id });
    const u = id && store.state.units.find((k) => k.id === id);
    this.tooltip.classList.toggle('show', !!u);
    this.renderer.domElement.style.cursor = u ? 'pointer' : '';
    if (u) {
      this.tooltip.innerHTML = `<strong>${u.title}</strong> · ${u.typology === 'Apartaestudio' ? `${u.area} m²` : u.typology}`;
      this.tooltip.style.left = `${e.clientX + 14}px`;
      this.tooltip.style.top = `${e.clientY + 12}px`;
    }
  }

  onResize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
}
