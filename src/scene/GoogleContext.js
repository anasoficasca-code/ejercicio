import * as THREE from 'three';
import { LON0, LAT0 } from '../geo.js';
import { GOOGLE_KEY } from '../google-key.js';

/**
 * GoogleContext — el barrio real como contexto del masterplan: Google Photorealistic 3D Tiles (Map Tiles API)
 * cargados con 3d-tiles-renderer en la misma escena. Cada edificio, techo, calle y árbol de Galerías trae su
 * foto real; el edificio del proyecto (modelo de Revit) va encima, sobre el lote.
 *  · La malla se alinea con el origen de la escena (LON0, LAT0): x = este, y = arriba, z = sur.
 *  · La altura del suelo se calibra sola con rayos sobre las calles junto al lote.
 *  · Dentro del lote se recorta lo que Google levanta (carros y árboles del parqueadero actual).
 *  · La foto ya trae su luz: de noche se oscurece y se enfría con uLight.
 * Sin llave (src/google-key.js) o si Google no responde, la escena sigue con el contexto propio (CityContext).
 */
export class GoogleContext {
  static get enabled() { return !!GOOGLE_KEY; }

  constructor(scene, { camera, renderer, mobile = false }) {
    this.scene = scene; this.camera = camera; this.renderer = renderer; this.mobile = mobile;
    this.ok = false; this.shown = false; this.errors = 0;
    this.uniforms = {
      uLight: { value: new THREE.Vector3(1, 1, 1) },
      uLotInv: { value: new THREE.Matrix4() },
      uLotBox: { value: new THREE.Vector4(0, 0, 0, 0) },
      uLotOn: { value: 0 }
    };
    this.dy = 0; this._calibN = 0; this._t = 0;
    this.ready = this._init().catch((e) => { console.warn('Contexto de Google', e); return false; });
  }

  async _init() {
    if (!GOOGLE_KEY) return false;
    const [TR, PL, { DRACOLoader }] = await Promise.all([
      import('3d-tiles-renderer'), import('3d-tiles-renderer/plugins'), import('three/addons/loaders/DRACOLoader.js')
    ]);
    const draco = new DRACOLoader().setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/');
    const tiles = new TR.TilesRenderer();
    tiles.registerPlugin(new PL.GoogleCloudAuthPlugin({ apiToken: GOOGLE_KEY, autoRefreshToken: true }));
    tiles.registerPlugin(new PL.GLTFExtensionsPlugin({ dracoLoader: draco }));
    tiles.setCamera(this.camera);
    tiles.setResolutionFromRenderer(this.camera, this.renderer);
    this.errTarget = this.mobile ? 14 : 5;      // menor = más nítido y más descarga
    tiles.errorTarget = 40;                      // empieza grueso (aparece rápido) y se afina por etapas
    tiles.addEventListener('load-error', (e) => { this.errors++; if (this.errors < 3) console.warn('tesela de Google', e?.error?.message || e?.url); });
    tiles.addEventListener('load-model', ({ scene }) => scene.traverse((m) => { if (m.isMesh) this._patch(m.material); }));
    tiles.group.matrixAutoUpdate = false;
    // ECEF -> escena. El marco este-norte-arriba en el origen, bajado a la altura del suelo de Galerías
    const D2R = Math.PI / 180, frame = new THREE.Matrix4();
    TR.WGS84_ELLIPSOID.getEastNorthUpFrame(LAT0 * D2R, LON0 * D2R, frame);
    this.base = new THREE.Matrix4().makeRotationX(-Math.PI / 2).multiply(frame.invert());
    this.h0 = 2575;                              // altura elipsoidal aproximada; se corrige con _calibrate
    this.tiles = tiles;
    this._place();
    tiles.group.visible = false;
    this.scene.add(tiles.group);
    this.ray = new THREE.Raycaster();
    this.ray.firstHitOnly = true;
    this.ok = true;
    return true;
  }

  _place() {
    if (!this.base || !this.tiles) return;
    const g = this.tiles.group;
    g.matrix.copy(new THREE.Matrix4().makeTranslation(0, -this.h0 + this.dy, 0).multiply(this.base));
    g.matrixWorldNeedsUpdate = true;
    g.updateMatrixWorld(true);
  }

  _patch(mat) {
    if (!mat || mat.userData.gctx) return;
    mat.userData.gctx = true;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGW; uniform vec3 uLight; uniform mat4 uLotInv; uniform vec4 uLotBox; uniform float uLotOn;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          if (uLotOn > 0.5 && vGW.y > 0.45) { vec3 q = (uLotInv * vec4(vGW, 1.0)).xyz; if (q.x > uLotBox.x && q.x < uLotBox.z && q.z > uLotBox.y && q.z < uLotBox.w) discard; }`)
        .replace('#include <opaque_fragment>', `{
          vec3 c = max(outgoingLight - vec3(0.022, 0.026, 0.034), 0.0);          // quita la bruma de la foto aérea
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = max(mix(vec3(l), c, 1.16), 0.0);                                   // un poco más de color
          c = pow(c / 0.18, vec3(1.06)) * 0.18 * 1.12;                           // contraste y brillo
          outgoingLight = c * uLight;
        }
        #include <opaque_fragment>`);
    };
    mat.needsUpdate = true;
  }

  /** Recorte del lote: marco del edificio (mundo -> lote) y caja en ese marco [minx, minz, maxx, maxz]. */
  setLot(frameObj, poly) {
    frameObj.updateMatrixWorld(true);
    this.uniforms.uLotInv.value.copy(frameObj.matrixWorld).invert();
    const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    this.uniforms.uLotBox.value.set(x0 - 0.2, z0 - 0.2, x1 + 0.2, z1 + 0.2);
    this.uniforms.uLotOn.value = 1;
    // puntos sobre las dos calles junto al lote, para medir a qué altura queda el asfalto de la foto
    this.probe = [[x0 - 7, (z0 + z1) / 2], [(x0 + x1) / 2, z0 - 7], [x0 - 7, z0 - 7], [x1 - 4, z0 - 7], [x0 - 7, z1 - 4]]
      .map(([x, z]) => frameObj.localToWorld(new THREE.Vector3(x, 0, z)));
  }

  /** Luz de la foto según la hora: de día tal cual; al atardecer cálida; de noche oscura y azulada. */
  setNight(night, dusk = night) {
    const d = Math.min(1, Math.max(0, dusk)), n = Math.min(1, Math.max(0, night));
    this.uniforms.uLight.value.set(1, 1, 1).lerp(new THREE.Vector3(0.86, 0.72, 0.6), d).lerp(new THREE.Vector3(0.2, 0.24, 0.36), n);
  }

  setVisible(v) { this.want = v; if (this.tiles) this.tiles.group.visible = v && this.shown; }

  _calibrate() {
    if (!this.probe || !this.tiles) return;
    const ys = [];
    for (const p of this.probe) {
      this.ray.set(new THREE.Vector3(p.x, 400, p.z), new THREE.Vector3(0, -1, 0));
      const hit = this.ray.intersectObject(this.tiles.group, true)[0];
      if (hit) ys.push(hit.point.y);
    }
    if (ys.length < 3) return;
    ys.sort((a, b) => a - b);
    const err = ys[Math.floor(ys.length / 2)] - 0.02;   // mediana (ignora un carro o un árbol bajo algún rayo); el asfalto queda a ras
    if (Math.abs(err) > 0.04) { this.dy -= err; this._place(); }
    this._calibN++;
  }

  /** Cada cuadro. Devuelve true cuando la malla ya se muestra. */
  update(dt) {
    const t = this.tiles;
    if (!t) return false;
    this.camera.updateMatrixWorld();
    t.setResolutionFromRenderer(this.camera, this.renderer);
    t.update();
    this._t += dt;
    const idle = t.stats.downloading === 0 && t.stats.parsing === 0;
    if (idle && t.stats.visible > 3) {
      if (t.errorTarget > this.errTarget) t.errorTarget = Math.max(this.errTarget, Math.round(t.errorTarget * 0.6));
      if (!this.shown) { this._calibrate(); this.shown = true; t.group.visible = this.want !== false; this.onShow?.(); }
    }
    if (this.shown && this._calibN < 6 && this._t > 1.5) { this._t = 0; this._calibrate(); }
    return this.shown;
  }

  attribution() {
    try {
      const s = this.tiles.getAttributions().filter((a) => a.type === 'string').map((a) => a.value).join(' · ');
      return /^google/i.test(s) ? s : 'Google' + (s ? ' · ' + s : '');
    } catch (e) { return 'Google'; }
  }
}
