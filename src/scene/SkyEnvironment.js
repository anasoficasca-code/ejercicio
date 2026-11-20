// Módulo tomado del masterplan Hotel La Fontana (github.com/alejagoguti-cpu/hotel-la-fontana-masterplan), con autorización de su autora.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/**
 * SkyEnvironment — entorno de cielo procedural tipo Unreal Engine:
 *  - Sky Atmosphere: dispersión física Rayleigh + Mie (three Sky / Preetham), sin fotos.
 *  - Volumetric Clouds: capa de nubes raymarched (fbm 3D) con luz del sol, sombra
 *    propia, powder effect y fase Henyey-Greenstein. Animadas por viento.
 *  - Directional Light (sol) sincronizada con la atmósfera y las nubes.
 *  - SkyLight: captura del cielo en PMREM -> scene.environment (IBL real).
 *  - Exponential Height Fog: niebla que toma el color real del horizonte.
 *  - Hora del día para Bogotá (lat 4.6°N).
 */

const CLOUD_VERT = /* glsl */`
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    gl_Position.z = gl_Position.w; // pegado al plano lejano, detrás de todo
  }
`;

const CLOUD_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWorldPos;
  uniform vec3  uSunDir;
  uniform vec3  uSunColor;
  uniform vec3  uAmbientTop;
  uniform vec3  uAmbientBottom;
  uniform float uTime;
  uniform float uCoverage;
  uniform float uDensity;
  uniform vec2  uWind;
  uniform float uSteps;

  const float CLOUD_BOTTOM = 1150.0;
  const float CLOUD_TOP    = 2700.0;

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash13(i);
    float n100 = hash13(i + vec3(1,0,0));
    float n010 = hash13(i + vec3(0,1,0));
    float n110 = hash13(i + vec3(1,1,0));
    float n001 = hash13(i + vec3(0,0,1));
    float n101 = hash13(i + vec3(1,0,1));
    float n011 = hash13(i + vec3(0,1,1));
    float n111 = hash13(i + vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
               mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
  }
  float fbm(vec3 p, int oct) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 5; i++) {
      if (i >= oct) break;
      s += a * vnoise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    return s;
  }

  float cloudDensity(vec3 p, int oct) {
    float h = clamp((p.y - CLOUD_BOTTOM) / (CLOUD_TOP - CLOUD_BOTTOM), 0.0, 1.0);
    // perfil vertical cúmulo: base plana, cima redondeada
    float profile = smoothstep(0.0, 0.08, h) * smoothstep(1.0, 0.35, h);
    vec3 q = p * 0.00031;
    q.xz += uWind * uTime;
    // forma base a gran escala (cobertura)
    float base = fbm(q * 0.55 + vec3(0.0, uTime * 0.004, 0.0), 3);
    base = mix(base, 1.0 - abs(base * 2.0 - 1.0), 0.35);           // bordes redondeados (cúmulo)
    float shape = base - (1.0 - uCoverage);
    shape = shape * profile;
    if (shape <= 0.0) return 0.0;
    // erosión de detalle (bordes de algodón)
    float detail = fbm(q * 2.6 - vec3(uTime * 0.02, 0.0, 0.0), oct);
    float d = shape - detail * 0.26 * (1.0 - h * 0.6);
    return max(d, 0.0) * uDensity;
  }

  float hg(float c, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5));
  }

  void main() {
    vec3 ro = vec3(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    vec3 rd = normalize(vWorldPos - cameraPosition);

    float horizonFade = smoothstep(0.01, 0.09, rd.y);
    if (rd.y <= 0.012) { gl_FragColor = vec4(0.0); return; }

    float t0 = (CLOUD_BOTTOM - ro.y) / rd.y;
    float t1 = (CLOUD_TOP - ro.y) / rd.y;
    t1 = min(t1, t0 + 5500.0);           // limita en rasante
    float len = t1 - t0;
    int steps = int(uSteps);
    float dt = len / uSteps;
    float jitter = hash13(vec3(gl_FragCoord.xy, uTime * 60.0));
    float t = t0 + dt * jitter;

    float cosT = dot(rd, uSunDir);
    float phase = mix(hg(cosT, 0.72), hg(cosT, -0.2), 0.35) * 4.2 + 0.45;   // borde plateado a contraluz

    float trans = 1.0;
    vec3  col = vec3(0.0);
    for (int i = 0; i < 48; i++) {
      if (i >= steps || trans < 0.02) break;
      vec3 p = ro + rd * t;
      float d = cloudDensity(p, 3);
      if (d > 0.002) {
        // sombra propia hacia el sol (cono corto)
        float ld = 0.0;
        for (int j = 1; j <= 4; j++) {
          vec3 lp = p + uSunDir * (float(j * j) * 70.0);
          ld += cloudDensity(lp, 2);
        }
        float lightT = max(exp(-ld * 1.1), exp(-ld * 0.28) * 0.32);   // varias dispersiones: nube clara por dentro
        float powder = 1.0 - exp(-d * 4.0);
        float h = clamp((p.y - CLOUD_BOTTOM) / (CLOUD_TOP - CLOUD_BOTTOM), 0.0, 1.0);
        vec3 ambient = mix(uAmbientBottom, uAmbientTop, h);
        vec3 S = uSunColor * lightT * phase * mix(0.55, 1.0, powder) + ambient;
        float ext = d * dt * 0.0095;
        float sampleT = exp(-ext);
        col += trans * S * (1.0 - sampleT);
        trans *= sampleT;
      }
      t += dt;
    }

    {
      float tc = (7200.0 - ro.y) / rd.y;
      vec2 cp = (ro.xz + rd.xz * tc) * 0.00011 + uWind * uTime * 1.6;
      cp.x *= 0.45;                                                     // fibras alargadas
      float ci = fbm(vec3(cp, uTime * 0.002), 4);
      ci = smoothstep(0.6, 0.9, ci) * 0.38 * smoothstep(0.03, 0.25, rd.y);
      vec3 cc = uSunColor * 0.32 * (0.6 + phase * 0.25) + uAmbientTop * 1.1;
      col += trans * cc * ci;
      trans *= 1.0 - ci;
    }
    float alpha = (1.0 - trans) * horizonFade;
    // perspectiva aérea: nubes lejanas se funden con la atmósfera
    float distFade = exp(-t0 * 0.000045);
    alpha *= mix(0.35, 1.0, distFade);
    gl_FragColor = vec4(col / max(1.0 - trans, 1e-4), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class SkyEnvironment {
  constructor(renderer, scene, sunLight, hemiLight) {
    this.renderer = renderer;
    this.scene = scene;
    this.sunLight = sunLight;
    this.hemiLight = hemiLight;
    this.hour = 15.25;                                 // media tarde: el sol del occidente ilumina la fachada sobre la Carrera 18
    this.sunDir = new THREE.Vector3();
    this.elapsed = 0;

    // ---- 1. Sky Atmosphere ----
    this.sky = this._makeSky();
    this.scene.add(this.sky);

    // ---- 2. Volumetric clouds ----
    this.cloudMaterial = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uAmbientTop: { value: new THREE.Color(0.5, 0.6, 0.75) },
        uAmbientBottom: { value: new THREE.Color(0.35, 0.38, 0.45) },
        uTime: { value: 0 },
        uCoverage: { value: 0.4 },
        uDensity: { value: 1.25 },
        uWind: { value: new THREE.Vector2(0.006, 0.0025) },
        uSteps: { value: 32 }
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false
    });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), this.cloudMaterial);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -1;
    this.scene.add(this.clouds);

    // ---- 2b. Terreno lejano (sabana) que se funde con la niebla en el horizonte ----
    const farGround = new THREE.Mesh(
      new THREE.RingGeometry(260, 2900, 96, 1),
      new THREE.MeshStandardMaterial({ color: 0x7d8a6c, roughness: 1, metalness: 0 })
    );
    farGround.rotation.x = -Math.PI / 2;
    farGround.position.set(8, -0.45, 16);
    this.farGround = farGround;
    this.scene.add(farGround);

    // ---- 3. SkyLight (IBL capturado del cielo) ----
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = this._makeSky();
    this.envScene.add(this.envSky);
    this.envRT = null;

    // ---- 4. Horizon sampler para la niebla ----
    this.horizonRT = new THREE.WebGLRenderTarget(16, 4, { type: THREE.FloatType });
    this.horizonCam = new THREE.PerspectiveCamera(60, 4, 0.1, 10);

    // PMREMGenerator.fromScene crea y suelta un material de fondo en cada llamada: el programa quedaba sin
    // uso, three lo borraba y lo compilaba otra vez en cada cambio de hora. Una copia idéntica que no se
    // suelta lo mantiene vivo (mismos parámetros y el mismo tipo de destino: flotante, sin tone mapping).
    try {
      this._pmremKeep = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ name: 'PMREM.Background', side: THREE.BackSide, depthWrite: false, depthTest: false }));
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(this.horizonRT);
      renderer.compile(this._pmremKeep, this.horizonCam);
      renderer.setRenderTarget(prev);
    } catch (e) { /* solo optimización */ }

    // Perfil de calidad: menos pasos en móviles
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    this.cloudMaterial.uniforms.uSteps.value = mobile ? 22 : 40;

    this.setHour(this.hour);
  }

  _makeSky() {
    const sky = new Sky();
    sky.scale.setScalar(4500);
    sky.frustumCulled = false;
    const m = sky.material;
    // Intensidad ajustable (equivalente a la exposición del Sky Atmosphere)
    m.uniforms.uSkyIntensity = { value: 0.25 };
    m.fragmentShader = m.fragmentShader
      .replace('uniform vec3 up;', 'uniform vec3 up;\nuniform float uSkyIntensity;')
      .replace('gl_FragColor = vec4( retColor, 1.0 );', 'retColor = max(mix(vec3(dot(retColor, vec3(0.2126, 0.7152, 0.0722))), retColor, 1.45), 0.0);\ngl_FragColor = vec4( retColor * uSkyIntensity, 1.0 );');   // cielo más saturado: azul profundo arriba, naranja al ocaso
    const u = m.uniforms;
    u.turbidity.value = 1.5;      // aire de sabana relativamente limpio
    u.rayleigh.value = 2.5;
    u.mieCoefficient.value = 0.0032;
    u.mieDirectionalG.value = 0.88;   // halo del sol más concentrado
    return sky;
  }

  /** Posición solar aproximada para Bogotá (4.6°N). Este = +X, Sur = +Z. */
  computeSunDir(hour) {
    const a = ((hour - 6) / 12) * Math.PI;         // 0 al amanecer, π al ocaso
    const tilt = THREE.MathUtils.degToRad(14);     // trayectoria inclinada al sur (oct.)
    const x = Math.cos(a);
    const y = Math.sin(a) * Math.cos(tilt);
    const z = Math.sin(a) * Math.sin(tilt);
    return this.sunDir.set(x, Math.max(y, -0.08), z).normalize();
  }

  setHour(hour) {
    this.hour = hour;
    const dir = this.computeSunDir(hour);
    const elev = Math.asin(dir.y);

    for (const s of [this.sky, this.envSky]) s.material.uniforms.sunPosition.value.copy(dir);
    // ocaso: el aire se carga cerca del horizonte (más turbidez y Mie) y el cielo hacia el sol se pone naranja
    const low = 1 - THREE.MathUtils.smoothstep(elev, 0.02, 0.3);
    for (const s of [this.sky, this.envSky]) {
      const u = s.material.uniforms;
      u.turbidity.value = 1.5 + low * 5.5;
      u.rayleigh.value = 2.5 + low * 1.2;
      u.mieCoefficient.value = 0.0032 + low * 0.005;
      u.uSkyIntensity.value = 0.25 + low * 0.12;
    }

    // Color e intensidad del sol según elevación (enrojece en rasante)
    const k = THREE.MathUtils.clamp(elev / THREE.MathUtils.degToRad(35), 0, 1);
    const sunCol = new THREE.Color().setRGB(1.0, 0.62 + 0.36 * k, 0.38 + 0.56 * k);
    const sunI = THREE.MathUtils.smoothstep(elev, -0.02, 0.25);

    this.sunLight.position.copy(dir).multiplyScalar(110);
    this.sunLight.color.copy(sunCol);
    this.sunLight.intensity = 2.9 * sunI;

    const cu = this.cloudMaterial.uniforms;
    cu.uSunDir.value.copy(dir);
    cu.uSunColor.value.copy(sunCol).multiplyScalar(5.2 * Math.max(sunI, 0.12));   // cúmulos blancos y luminosos

    // el reflejo del cielo (PMREM) y el color del horizonte (lectura de píxeles, frena la GPU) se
    // recalculan a lo sumo ~4 veces por segundo: la intro y el control de hora llaman setHour cada cuadro
    // y rehacerlos cada vez trababa la animación
    const now = performance.now();
    clearTimeout(this._envTimer);
    if (!this.envRT || now - (this._envAt || 0) > 260) { this._envAt = now; this._updateEnvironment(); }
    else this._envTimer = setTimeout(() => { this._envAt = performance.now(); this._updateEnvironment(); }, 280);
  }

  _updateEnvironment() {
    // SkyLight: captura PMREM del cielo atmosférico
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 100);
    this.scene.environment = this.envRT.texture;

    // Color real del horizonte -> niebla + luz hemisférica + ambiente de nubes
    const horizon = this._sampleSky(0.04);
    const zenith = this._sampleSky(1.2);
    if (horizon) {
      if (!this.scene.fog) this.scene.fog = new THREE.Fog(0xffffff, 220, 1400);
      this.scene.fog.color.copy(horizon);
      this.scene.background = null;
      if (this.hemiLight) {
        // luz de cielo un poco menos saturada que el cenit: las sombras quedaban azul petróleo y el césped y
        // los árboles a la sombra se veían turquesa
        const sky = (zenith || horizon).clone(), l = sky.r * 0.2126 + sky.g * 0.7152 + sky.b * 0.0722;
        this.hemiLight.color.copy(sky.lerp(new THREE.Color(l, l, l), 0.35)).multiplyScalar(1.05);
        this.hemiLight.groundColor.setHex(0x8d8172);
      }
      const cu = this.cloudMaterial.uniforms;
      cu.uAmbientTop.value.copy(zenith || horizon).multiplyScalar(1.6).lerp(horizon, 0.3);
      cu.uAmbientBottom.value.copy(horizon).multiplyScalar(0.85);
    }
  }

  /** Renderiza el cielo en un RT flotante y devuelve el color lineal medio. */
  _sampleSky(pitch) {
    try {
      const cam = this.horizonCam;
      cam.position.set(0, 0, 0);
      cam.rotation.set(0, 0, 0);
      // mirar en dirección opuesta al sol en azimut para evitar el disco solar
      const az = Math.atan2(-this.sunDir.z, -this.sunDir.x);
      cam.lookAt(Math.cos(az), Math.tan(pitch), Math.sin(az));
      const prevRT = this.renderer.getRenderTarget();
      this.renderer.setRenderTarget(this.horizonRT);
      this.renderer.render(this.envScene, cam);
      const buf = new Float32Array(16 * 4 * 4);
      this.renderer.readRenderTargetPixels(this.horizonRT, 0, 0, 16, 4, buf);
      this.renderer.setRenderTarget(prevRT);
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < buf.length; i += 4) { r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; }
      const n = buf.length / 4;
      if (!isFinite(r) || r + g + b === 0) return null;
      return new THREE.Color().setRGB(r / n, g / n, b / n, THREE.LinearSRGBColorSpace);
    } catch (e) {
      return null;
    }
  }

  update(dt) {
    this.elapsed += dt;
    this.cloudMaterial.uniforms.uTime.value = this.elapsed;
  }
}
