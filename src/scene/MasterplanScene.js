import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SkyEnvironment } from './SkyEnvironment.js';
import { PostFX } from './PostFX.js';
import { applyWind, windUniforms } from './Wind.js';
import { CityContext } from './CityContext.js';
import { ProjectBuilding } from './ProjectBuilding.js';
import { setNight } from './BuildingMaterials.js';
import { Traffic } from './Traffic.js';
import { PoiLayer } from './PoiLayer.js';
import { store } from '../state/store.js';
import { RoomPhoto } from '../ui/RoomPhoto.js';

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
    // mañana: sol bajo y tibio; mediodía: luz neutra un poco más contenida (no se quema el pañete blanco)
    const morning = ss(5.9, 6.7, hour) * (1 - ss(8.3, 9.6, hour));
    const noon = ss(10.4, 11.4, hour) * (1 - ss(13.6, 14.6, hour));
    this.sun.color.lerp(this._goldenTint ||= new THREE.Color(1.0, 0.6, 0.32), golden * 0.55);
    this.sun.color.lerp(this._morningTint ||= new THREE.Color(1.0, 0.8, 0.62), morning * 0.4);
    this.sun.intensity *= 1 + golden * 0.45 + morning * 0.15;
    // luz de relleno del cielo un poco más alta: las sombras quedan algo más suaves
    this._hemiBase = 0.46 * (1 - golden * 0.3) * (1 + morning * 0.1);
    this.hemi.intensity = this._hemiBase * (this._cut ? 1.6 : 1);   // planta abierta: más luz de cielo adentro
    this._baseExposure ??= this.renderer.toneMappingExposure;
    this.renderer.toneMappingExposure = this._baseExposure * (1 + golden * 0.08 + morning * 0.05 - noon * 0.05);
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
    const near = THREE.MathUtils.clamp(dist * 0.012, 0.06, 30);   // adentro de un apartamento la cámara queda cerca
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
    this.building.parkCars(this.traffic);   // fuera del carril de los carros que circulan
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
      if (this._hemiBase != null) this.hemi.intensity = this._hemiBase * (cut ? 1.6 : 1);
    }

    if (s.viewMode !== this._mode) { this._mode = s.viewMode; this.applyViewMode(s.viewMode); }
    // cada filtro del panel lleva la cámara a lo que muestra: el piso elegido, las zonas comunes del piso 1,
    // el edificio completo, o el barrio con las capas que se encienden
    if (!sel && s.viewMode === 'exterior') {
      if (s.activeFloor !== this._floorF) { this._floorF = s.activeFloor; if (s.activeFloor) this.focusFloor(s.activeFloor); else if (this._seen) this.applyViewMode('exterior'); }
      if (s.activeTypology !== this._typoF) {
        this._typoF = s.activeTypology;
        if (s.activeTypology === 'Zona común') this.focusFloor(1);
        else if (s.activeTypology === 'Apartamento' && !s.activeFloor) this.applyViewMode('exterior');
      }
    }
    const on = (k) => s.layers[k] && !(this._layersSeen || {})[k];
    if (this._seen && (on('servicios') || on('competencia') || on('estudio'))) store.setState({ viewMode: 'contexto' });
    else if (this._seen && on('predios')) this.focusPoint(0, 0, 420);
    this._layersSeen = { ...s.layers };
    this._seen = true;
    if (s.selectedUnitId !== this._sel) { this._sel = s.selectedUnitId; this.hideRoomPhoto(); if (sel) this.focusUnit(sel.id); }
    // vista interior (cocina o habitación) de la unidad elegida
    const iv = sel && s.interiorUnit === sel.id ? s.interiorView : null;
    if (iv !== this._iv) {
      const was = this._iv;
      this._iv = iv;
      if (!!iv !== !!was) { this.building.setInterior(!!iv); this._setWalk(!!iv); }
      if (iv) this.viewInterior(sel, iv);
      else if (was && sel) { this._clearSpots(); this.hideRoomPhoto(); this.focusUnit(sel.id); }
      else if (was) { this._clearSpots(); this.hideRoomPhoto(); }
    }
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

  /**
   * Compila todos los materiales antes de la intro (con el mobiliario visible un momento), para que la
   * llegada no se trabe compilando shaders cuando aparecen los pisos.
   */
  async precompile() {
    const b = this.building;
    b.aptFurniture.forEach((m) => { m.visible = true; });
    b.floorGroups.forEach((g) => { g.visible = true; });
    b.roof.visible = true;
    try { await (this.renderer.compileAsync ? this.renderer.compileAsync(this.scene, this.camera) : this.renderer.compile(this.scene, this.camera)); } catch (e) { console.warn('precompilación', e); }
    b.aptFurniture.forEach((m) => { m.visible = false; });
  }

  /**
   * Recorrido por dentro (como un tour 360°): la cámara llega a la altura de los ojos al cuarto `kind`.
   * El punto de giro queda a 25 cm delante de la cámara, así arrastrar hace mirar alrededor en el sitio.
   * Desde lejos (planta) el viaje es más largo; entre cuartos es un paso corto.
   */
  viewInterior(unit, kind) {
    const room = this.building.interiorCamera(unit, kind);
    const dir = room.target.clone().sub(room.pos).normalize();
    const look = room.pos.clone().addScaledVector(dir, 0.25);
    const far = this.camera.position.distanceTo(room.pos) > 6;
    this.flyTo(room.pos, look, far ? 2.4 : 1.3, far ? 'power3.inOut' : 'power2.inOut');
    this.building.moveInteriorLight(room.pos);
    this._showSpots(unit, kind);
    // al llegar, el render final del cuarto a pantalla completa (si lo hay); si no, queda el 3D
    this.showRoomPhoto(kind, (far ? 2.4 : 1.3) * 1000 - 300);
  }

  /** Render a pantalla completa (sala, cocina, alcoba, lobby, restaurante). */
  showRoomPhoto(key, delay = 0) {
    this.photo ??= new RoomPhoto(document.getElementById('app'));
    return this.photo.show(key, { delay });
  }

  hideRoomPhoto() { this.photo?.hide(); }

  /** Modo caminar: sin zoom ni desplazamiento, giro suave en el sitio y se puede mirar arriba y abajo. */
  _setWalk(on) {
    const c = this.controls;
    if (on) {
      this._orbitPrefs ??= { min: c.minDistance, max: c.maxDistance, zoom: c.enableZoom, pan: c.enablePan, rot: c.rotateSpeed, minP: c.minPolarAngle, maxP: c.maxPolarAngle };
      Object.assign(c, { minDistance: 0.05, maxDistance: 0.6, enableZoom: false, enablePan: false, rotateSpeed: 0.45, minPolarAngle: 0.35, maxPolarAngle: Math.PI - 0.45 });
    } else if (this._orbitPrefs) {
      const p = this._orbitPrefs;
      Object.assign(c, { minDistance: p.min, maxDistance: p.max, enableZoom: p.zoom, enablePan: p.pan, rotateSpeed: p.rot, minPolarAngle: p.minP, maxPolarAngle: p.maxP });
    }
    document.body.classList.toggle('is-walking', on);
    // lente abierta adentro (como una foto 360°) y la de siempre afuera, con transición
    const fov = on ? 72 : 42, g = window.gsap, cam = this.camera;
    if (g) g.to(cam, { fov, duration: 1.6, ease: 'power2.inOut', onUpdate: () => cam.updateProjectionMatrix() });
    else { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  /** Marcadores blancos sobre el piso de cada cuarto (menos el actual): un clic lleva a ese cuarto. */
  _showSpots(unit, current) {
    this._clearSpots();
    this._spots = this.building.unitRooms(unit).filter((r) => r.key !== current).map((r) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'walk-spot';
      el.innerHTML = `<i aria-hidden="true"></i><span>${r.label}</span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); store.setState({ interiorView: r.key, interiorUnit: unit.id }); });
      const o = new CSS2DObject(el);
      o.position.copy(r.floorPoint);
      this.scene.add(o);
      return o;
    });
  }

  /**
   * Cada 250 ms: un marcador se muestra solo si desde la cámara se ve su punto del piso (sin muro en medio),
   * como en los tours 360°, donde solo se señalan los cuartos a la vista.
   */
  _updateSpots() {
    if (!this._spots?.length) return;
    const now = performance.now();
    if (now - (this._spotT || 0) < 250) return;
    this._spotT = now;
    const b = this.building, g = b.floorGroups[(b.cut ?? 1) - 1];
    if (!g) return;
    this._walls ??= new Map();
    if (!this._walls.has(g)) {
      const list = [];
      // muros y losas tapan; las puertas no (las del modelo están cerradas y se "pasa" a través de ellas)
      const DOORS = new Set(['764633', 'd29f5f']);
      g.traverse((m) => { if (m.isMesh && m.userData.layer === 'arquitectura' && !m.material.transparent && !DOORS.has(m.userData.hex)) list.push(m); });
      this._walls.set(g, list);
    }
    const walls = this._walls.get(g), cam = this.camera.position, ray = this.raycaster, p = new THREE.Vector3();
    for (const o of this._spots) {
      p.copy(o.position).y += 0.35;
      const d = p.distanceTo(cam);
      ray.set(cam, p.clone().sub(cam).normalize());
      ray.far = d - 0.25;
      const blocked = ray.intersectObjects(walls, false).length > 0;
      o.element.classList.toggle('behind', blocked);
      o.element.classList.toggle('hidden', d > 11);
    }
    ray.far = Infinity;
  }

  _clearSpots() {
    (this._spots || []).forEach((o) => { o.element.remove(); this.scene.remove(o); });
    this._spots = [];
  }

  /** Vista de un piso abierto: la cámara baja al nivel del piso mirando la planta desde arriba en diagonal. */
  focusFloor(f) {
    const c = this.building.center(), y = (f - 1) * 3.1;
    const back = this.camera.position.clone().sub(this.controls.target).setY(0).normalize();
    if (back.lengthSq() < 0.1) back.set(-0.7, 0, -0.7);
    this.flyTo(c.clone().addScaledVector(back, 30).setY(y + 26), c.clone().setY(y), 1.4);
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
    // con el 360 abierto tapando todo, la ciudad no se dibuja (el visor usa la GPU)
    if (this.photo?.covering) return;
    this._adapt(dt);
    this._updateSpots();
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
