/**
 * Maqueta del modelo de Revit dentro de "Sube por el edificio" del brochure.
 * Cada paso del scroll corta el edificio en su piso (los de arriba se levantan), marca la unidad y pone un
 * cono en el punto donde está la cámara del render que se ve al lado, apuntando hacia donde mira la foto.
 * Escucha el evento 'lift:step' que manda arboleda.js. Se carga solo cuando la sección se acerca.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ProjectBuilding } from '../../src/scene/ProjectBuilding.js';

const FLOOR_H = 3.1, PW = 24.84, PD = 14.0;

// qué muestra cada paso: piso abierto, unidad resaltada, cámara del render (planta: x, y, z → mira a x, y, z),
// y encuadre de la maqueta (azimut, elevación en grados, distancia)
const STEPS = [
  { cut: 1, unit: 'lobby', room: 'Lobby · piso 1', eye: [6.5, 1.5, 5.6], look: [2.2, 1.4, 1.2], az: -38, el: 42, dist: 74 },
  { cut: 1, unit: 'salon', room: 'Restaurante · piso 1', eye: [21.5, 1.5, -2.8], look: [16.5, 1.2, 3.5], az: -8, el: 38, dist: 74 },
  { cut: 2, unit: '201', room: 'Sala · apto 201', roomKey: 'sala', az: -30, el: 48, dist: 70 },
  { cut: 3, unit: '301', room: 'Alcoba principal · apto 301', roomKey: 'habitacion', az: -16, el: 52, dist: 70 },
  { cut: 4, unit: '401', room: 'Tipo A · apto 401', az: -24, el: 64, dist: 66 },
  { cut: 5, unit: null, room: 'Planta tipo · piso 5', az: 0, el: 84, dist: 64 },
  { cut: null, unit: null, room: 'Fachada · Calle 56', az: -24, el: 12, dist: 86 },
  { cut: null, unit: null, room: 'Terraza · cubierta', eye: [9, 6 * FLOOR_H + 1.6, 3.5], look: [14, 6 * FLOOR_H + 1.4, 9], az: 32, el: 38, dist: 84 }
];

export async function mountSection(panel) {
  const canvasHost = panel.querySelector('.lm-canvas');
  const caption = panel.querySelector('.lm-room');
  const g = window.gsap, still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasHost.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6b6156, 0.9));
  const sun = new THREE.DirectionalLight(0xffe2bf, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 900);

  const get = (p) => fetch(p).then((r) => { if (!r.ok) throw new Error(p); return r.json(); });
  const [project, predios] = await Promise.all([get('./data/proyecto.json'), get('./data/geometry/predios.json')]);
  const lot = predios.p.find((p) => p.id === 'englobe');
  const b = new ProjectBuilding(scene, { lot, project });
  await b.ready;
  window.__section = b;
  b.setHighlight({ show: false });
  b.unitVolumes.forEach((v) => { v.visible = false; });

  // sombra del sol encuadrada al edificio
  const c0 = b.center();
  sun.position.copy(c0).add(new THREE.Vector3(-38, 60, -26));
  sun.target.position.copy(c0);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -34; sc.right = sc.top = 34; sc.near = 1; sc.far = 160;
  sc.updateProjectionMatrix();

  // ángulo de la fachada de la Calle 56 en el mundo, para que el azimut 0 mire de frente a esa fachada
  const front = b.world(PW / 2, 0, -10).sub(b.world(PW / 2, 0, PD / 2)).setY(0).normalize();
  const baseAz = Math.atan2(front.x, front.z);

  // resalte de la unidad: volumen azul suave con borde
  const hiMat = new THREE.MeshBasicMaterial({ color: 0x9c4f2e, transparent: true, opacity: 0, depthWrite: false });
  let hiVol = null;
  const setUnit = (id) => {
    if (hiVol) { const old = hiVol; g ? g.to(old.material, { opacity: 0, duration: 0.4, onComplete: () => { old.visible = false; } }) : (old.visible = false); }
    hiVol = null;
    if (!id) return;
    const v = b.unitVolumes.find((u) => u.userData.unitId === id);
    if (!v) return;
    v.material = hiMat.clone();
    v.visible = true;
    v.material.visible = true;
    v.children[0].visible = true;
    v.children[0].material.visible = true;
    hiVol = v;
    g ? g.fromTo(v.material, { opacity: 0 }, { opacity: 0.32, duration: 0.8, delay: 0.5 }) : (v.material.opacity = 0.32);
  };

  // "cámara del render": anillo en el piso + cono de visión que apunta hacia donde mira la foto
  const mark = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false }));
  ring.rotation.x = -Math.PI / 2;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), new THREE.MeshBasicMaterial({ color: 0x9c4f2e, depthTest: false }));
  dot.rotation.x = -Math.PI / 2; dot.position.y = 0.01;
  const coneGeo = new THREE.BufferGeometry();
  const L = 7.5, half = THREE.MathUtils.degToRad(34);
  const fan = [0, 0, 0];
  for (let i = 0; i <= 16; i++) { const a = -half + (2 * half * i) / 16; fan.push(Math.sin(a) * L, 0, Math.cos(a) * L); }
  const idx = []; for (let i = 1; i <= 16; i++) idx.push(0, i, i + 1);
  coneGeo.setAttribute('position', new THREE.Float32BufferAttribute(fan, 3));
  coneGeo.setIndex(idx);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xd9894f, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthTest: false }));
  cone.position.y = 0.02;
  mark.add(cone, ring, dot);
  mark.renderOrder = 10;
  mark.children.forEach((m) => { m.renderOrder = 10; });
  mark.visible = false;
  scene.add(mark);

  const placeMark = (s) => {
    let eye = s.eye, look = s.look;
    if (s.roomKey) {
      const unit = b.units.find((u) => u.id === s.unit);
      const r = unit && b.interiorCamera(unit, s.roomKey);
      if (r) {
        const toLocal = (w) => b.plate.worldToLocal(w.clone());
        const e = toLocal(r.pos), t = toLocal(r.target);
        eye = [e.x, e.y, e.z]; look = [t.x, t.y, t.z];
      }
    }
    if (!eye) { mark.visible = false; return; }
    const p = b.world(eye[0], eye[1] - 1.45, eye[2]);
    const q = b.world(look[0], eye[1] - 1.45, look[2]);
    mark.position.copy(p).y += 0.12;
    mark.rotation.set(0, Math.atan2(q.x - p.x, q.z - p.z), 0);
    mark.visible = true;
    if (g && !still) g.fromTo(mark.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.9, delay: 0.55, ease: 'back.out(1.6)' });
  };

  // cámara: órbita alrededor del piso abierto, con un giro lento mientras se lee
  const view = { az: 0, el: 45, dist: 46, ty: 8 };
  let drift = 0;
  const apply = () => {
    const c = b.center();
    const az = baseAz + THREE.MathUtils.degToRad(view.az + drift), el = THREE.MathUtils.degToRad(view.el);
    const t = new THREE.Vector3(c.x, view.ty, c.z);
    camera.position.set(t.x + Math.sin(az) * Math.cos(el) * view.dist, t.y + Math.sin(el) * view.dist, t.z + Math.cos(az) * Math.cos(el) * view.dist);
    camera.lookAt(t);
  };

  const ground = b.world(0, 0, 0).y;
  let cur = -1;
  const go = (i) => {
    const s = STEPS[Math.max(0, Math.min(STEPS.length - 1, i))];
    if (i === cur) return;
    cur = i;
    b.setCut(s.cut);
    setUnit(s.unit);
    placeMark(s);
    caption.textContent = s.room;
    panel.classList.toggle('is-plan', s.el > 60);
    const ty = ground + (s.cut ? (s.cut - 1) * FLOOR_H + 1 : 9);
    const to = { az: s.az, el: s.el, dist: innerWidth < 760 ? s.dist * 0.82 : s.dist, ty };
    if (g && !still) g.to(view, { ...to, duration: 1.6, ease: 'power3.inOut', overwrite: true });
    else Object.assign(view, to);
  };

  const resize = () => {
    const w = canvasHost.clientWidth, h = canvasHost.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  // solo se dibuja cuando la sección está en pantalla
  let visible = true, last = performance.now(), tAll = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(panel);
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;
    tAll += dt;
    if (!still) drift = Math.sin(tAll * 0.18) * 9;
    if (mark.visible) ring.scale.setScalar(1 + Math.sin(tAll * 3) * 0.12);
    apply();
    renderer.render(scene, camera);
  });

  addEventListener('lift:step', (e) => go(e.detail.index));
  go(window.__liftStep || 0);
  // el edificio se arma piso por piso la primera vez que aparece
  b.assemble?.({ delay: 0.2, step: 0.32 })?.eventCallback?.('onComplete', () => { b._assembling = false; b.setCut(STEPS[cur].cut); });
  panel.classList.add('ready');
}
