import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { SkyEnvironment } from './SkyEnvironment.js';
import { PostFX } from './PostFX.js';
import { applyWind, windUniforms } from './Wind.js';
import { CityContext } from './CityContext.js';
import { ProjectBuilding } from './ProjectBuilding.js';
import { setNight } from './BuildingMaterials.js';
import { Traffic } from './Traffic.js';
import { PoiLayer } from './PoiLayer.js';
import { store } from '../state/store.js';

/**
 * MasterplanScene — motor Three.js del masterplan, con el mismo cielo (atmósfera + nubes volumétricas),
 * posproceso y viento del masterplan Hotel La Fontana: contexto urbano real de Catastro, el edificio
 * del proyecto y raycasting de unidades.
 */
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
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;   // ver render(): un cuadro de cada dos
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.setSize(w, h);
    this.labels.domElement.className = 'labels-layer';
    container.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 90000);
    this.clock = new THREE.Clock();
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
    try { this.postfx = new PostFX(this.renderer, this.scene, this.camera, container); } catch (e) { console.warn('PostFX desactivado', e); }
    if (this.postfx) this.renderer.setPixelRatio(this.postfx.maxPixelRatio);
    if (this.postfx?.low && this.skyEnv?.cloudMaterial) this.skyEnv.cloudMaterial.uniforms.uSteps.value = 16;
    this.renderer.setAnimationLoop(() => this.render());
  }

  // ---------------------------------------------------------------- cielo y sol
  _setupSky() {
    this.scene.fog = new THREE.Fog(0xc9d6e4, 220, 1400);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x928677, 0.4);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfffaed, 3.1);
    this.sun.castShadow = true;
    const ms = this.mobile ? 2048 : 4096;
    this.sun.shadow.mapSize.set(ms, ms);
    this.sun.shadow.normalBias = 0.018;
    this.sun.shadow.radius = 3;
    this.sun.shadow.bias = -0.00008;
    const c = this.sun.shadow.camera;
    c.left = -95; c.right = 95; c.top = 95; c.bottom = -95; c.near = 10; c.far = 320;
    this.scene.add(this.sun, this.sun.target);
    this.skyEnv = new SkyEnvironment(this.renderer, this.scene, this.sun, this.hemi);
    this.skyEnv.farGround.visible = false; // el suelo real lo pone CityContext
  }

  setHour(hour) {
    this.skyEnv.setHour(hour);
    // las luces se encienden con el ocaso (y siguen encendidas antes del amanecer)
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const night = Math.max(ss(17.1, 18.0, hour), 1 - ss(5.9, 6.5, hour));
    // hora dorada (como en los renders): sol más cálido y fuerte, cielo de relleno más tenue
    const golden = ss(15.4, 16.5, hour) * (1 - ss(17.35, 17.85, hour));
    this.sun.color.lerp(this._goldenTint ||= new THREE.Color(1.0, 0.6, 0.32), golden * 0.55);
    this.sun.intensity *= 1 + golden * 0.45;
    this._hemiBase = 0.4 * (1 - golden * 0.3);
    this.hemi.intensity = this._hemiBase * (this._cut ? 2.6 : 1);   // planta abierta: más luz de cielo adentro
    this._baseExposure ??= this.renderer.toneMappingExposure;
    this.renderer.toneMappingExposure = this._baseExposure * (1 + golden * 0.08);
    // en la hora dorada los apartamentos y los bañadores de fachada se encienden antes que la calle
    const dusk = Math.max(night, ss(16.3, 17.2, hour) * 0.85);
    setNight(dusk);
    this.building?.setNight(dusk);
    this.city?.setNight(night);
    this.traffic?.setNight(night);
    this._night = night;
    this._dusk = dusk;
    if (this.reflectionCamera) {
      clearTimeout(this.reflectionTimer);
      this.reflectionTimer = setTimeout(() => this.captureFacadeReflections(), 450);
    }
  }

  /** Niebla y plano cercano según la distancia de la cámara; el cielo y las nubes la siguen. */
  _updateRange() {
    const cam = this.camera, dist = cam.position.distanceTo(this.controls.target);
    const near = THREE.MathUtils.clamp(dist * 0.012, 0.3, 30);
    if (Math.abs(near - cam.near) > 0.02 * cam.near) { cam.near = near; cam.updateProjectionMatrix(); }
    // bruma de altura (perspectiva aérea): los Cerros y el fondo se aclaran como en las fotos de dron
    this.scene.fog.near = 120 + dist * 0.6;
    this.scene.fog.far = 3200 + dist * 4;
    this.skyEnv.sky?.position.copy(cam.position);
    this.skyEnv.clouds?.position.copy(cam.position);
  }

  // ---------------------------------------------------------------- datos
  async loadData() {
    const get = (p) => fetch(p).then((r) => { if (!r.ok) throw new Error(p); return r.json(); });
    const [project, construcciones, manzanas, lotes, predios, puntos, andenes, vias] = await Promise.all([
      get('./data/proyecto.json'),
      get('./data/geometry/construcciones.json'),
      get('./data/geometry/manzanas.json'),
      get('./data/geometry/lotes.json'),
      get('./data/geometry/predios.json'),
      get('./data/geometry/puntos.json'),
      get('./data/geometry/andenes.json').catch(() => null),
      get('./data/geometry/vias.json').catch(() => null)
    ]);
    this.data = { project, construcciones, manzanas, lotes, predios, puntos, andenes };

    const lot = predios.p.find((p) => p.id === 'englobe');
    this.city = new CityContext(this.scene, { renderer: this.renderer, data: this.data, project, mobile: this.mobile });
    this.building = new ProjectBuilding(this.scene, { lot, project });
    this.building.setNight(this._dusk ?? 0);
    // tráfico sobre las calles reales: carros en movimiento, semáforos y cebras
    if (vias) { try { this.traffic = new Traffic(this.scene, vias, { mobile: this.mobile, andenes }); this.traffic.setNight(this._night || 0); } catch (e) { console.warn('tráfico', e); } }
    this.pois = new PoiLayer(this.scene, {
      puntos: puntos.p, predios: predios.p, project, competencia: project.competencia,
      onPick: (p) => this.onPick?.(p)
    });
    await this.building.ready;
    const c = this.building.center();
    this.home = { target: new THREE.Vector3(c.x, 7, c.z), pos: new THREE.Vector3(c.x - 44, 31, c.z - 47) };
    this.controls.target.copy(this.home.target);
    this.camera.position.copy(this.home.pos);
    this.sun.target.position.copy(c);
    this.city.ready.then(() => {
      const target = new THREE.WebGLCubeRenderTarget(this.mobile ? 64 : 128, { type: THREE.HalfFloatType });
      this.reflectionCamera = new THREE.CubeCamera(0.5, 5000, target);
      this.captureFacadeReflections();
      this.building.group.traverse(mesh => {
        const material = mesh.material;
        if (material?.isMeshPhysicalMaterial || material?.metalness > 0.5) {
          material.envMap = target.texture;
          material.needsUpdate = true;
        }
      });
    }).catch(error => console.warn('Reflejos del entorno', error));

    this._mode = store.state.viewMode; // la cámara ya está en la vista inicial
    store.setState({ project, units: this.building.units.map(({ worldCenter, ...u }) => u) });
    return this.data;
  }

  // Capture the surrounding blocks at window height for glass and anodized metal.
  captureFacadeReflections() {
    const group = this.building.group;
    const visible = group.visible;
    group.visible = false;
    try {
      this.reflectionCamera.position.copy(this.building.center());
      this.reflectionCamera.update(this.renderer, this.scene);
    } finally {
      group.visible = visible;
    }
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
    if (cut !== this._cut) {
      this._cut = cut;
      this.building.setCut(cut);
      if (this._hemiBase != null) this.hemi.intensity = this._hemiBase * (cut ? 2.6 : 1);
    }

    if (s.viewMode !== this._mode) { this._mode = s.viewMode; this.applyViewMode(s.viewMode); }
    if (s.selectedUnitId !== this._sel) { this._sel = s.selectedUnitId; if (sel) this.focusUnit(sel.id); }
    this.pois.setCompact(s.viewMode === 'exterior' && !!sel);
  }

  flyTo(pos, target, dur = 1.6, ease = 'power2.inOut') {
    const g = window.gsap;
    if (!g) { this.camera.position.copy(pos); this.controls.target.copy(target); return; }
    g.killTweensOf(this.camera.position);
    g.killTweensOf(this.controls.target);
    g.to(this.camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: dur, ease });
    g.to(this.controls.target, { x: target.x, y: target.y, z: target.z, duration: dur, ease });
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
      this.tooltip.innerHTML = `<strong>${u.title}</strong> · ${u.typology === 'Apartamento' ? `${u.area.toLocaleString('es-CO')} m²` : u.typology}`;
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
    this.postfx?.setSize(w, h);
  }

  /**
   * Calidad adaptable: si el cuadro tarda más de ~24 ms (menos de 42 fps) durante 2 s, baja la
   * resolución un escalón; en el último escalón apaga la oclusión ambiental. Nunca sube de nuevo
   * para no oscilar.
   */
  _adapt(dt) {
    const a = (this._perf ||= { t: 0, n: 0, sum: 0, pr: null, warm: 0 });
    // los primeros segundos después de cargar no cuentan: se están subiendo texturas a la GPU
    if (!this.home || (a.warm += dt) < 10) return;
    a.t += dt; a.n++; a.sum += dt;
    if (a.t < 2) return;
    const avg = a.sum / a.n;
    a.t = a.n = a.sum = 0;
    if (avg < 0.024 || document.hidden) return;
    a.pr ??= this.renderer.getPixelRatio();
    if (a.pr > 0.9) {
      a.pr = Math.max(0.85, a.pr - 0.2);
      this.renderer.setPixelRatio(a.pr);
      this.postfx?.setPixelRatio(a.pr);
      this.onResize();
    } else if (this.postfx?.ao?.enabled) {
      this.postfx.ao.enabled = false;
    }
  }

  render() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this._adapt(dt);
    // las sombras se recalculan un cuadro de cada dos (el sol y casi todo el barrio están quietos)
    this._frame = (this._frame || 0) + 1;
    this.renderer.shadowMap.needsUpdate = this._frame % 2 === 0;
    this.skyEnv.update(dt);
    this.controls.update();
    this._updateRange();
    windUniforms.uWindTime.value += dt;
    if (this.city?.trees && !this._cityWind) { applyWind(this.city.trees.material, { amp: 1.2, from: 2.0, to: 10 }); this._cityWind = true; }
    this.traffic?.update(dt);
    if (this.postfx) this.postfx.render(dt); else this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
}
