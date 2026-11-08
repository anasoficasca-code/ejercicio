import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/**
 * Traffic — tráfico del barrio sobre la red vial real (OpenStreetMap, data/geometry/vias.json):
 *  · carros (sedán, camioneta y taxi) que circulan por el carril derecho, respetan los sentidos de cada
 *    vía, guardan distancia con el de adelante y paran en rojo
 *  · semáforos donde OSM los tiene, con poste, brazo y luces que cambian por fases (verde, amarillo, rojo)
 *  · cebras en los cruces peatonales que OSM tiene marcados
 * Todo dentro de R metros del lote, donde el suelo es plano (y = 0).
 */

const R = 380;                       // radio con tráfico (m)
const ROAD_Y = 0.02;
const LANE = 3.1;                    // ancho de carril (m)
const SPEED = { secondary: 11, primary: 12, trunk: 12, tertiary: 9, residential: 7, unclassified: 7, living_street: 4 };
const CYCLE = { green: 13, amber: 3, allRed: 1.5 };

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export class Traffic {
  constructor(scene, data, { mobile = false, andenes = null } = {}) {
    // andenes (polígonos de Catastro) cercanos, para pararlos postes sobre el andén y no en la calzada
    this.sidewalks = (andenes?.a || []).filter((poly) => poly.some(([x, z]) => Math.hypot(x, z) < R + 60));
    this.group = new THREE.Group();
    this.group.name = 'Tráfico';
    scene.add(this.group);
    this.time = 0;
    this.nodes = data.nodos;
    this._buildGraph(data);
    this._buildSignals(data);
    this._buildZebras(data);
    this._spawnCars(mobile ? 14 : 42);
  }

  // ---------------------------------------------------------------- red vial
  _buildGraph(data) {
    const N = this.nodes, inR = (k) => N[k] && Math.hypot(N[k][0], N[k][1]) < R;
    this.edges = [];            // aristas dirigidas: { pts, len, cum, from, to, speed, lanes, oneway, way }
    this.out = new Map();       // nodo -> aristas que salen
    this.wayOf = new Map();     // nodo -> [ [vía, índice] ]
    data.vias.forEach((v, wi) => {
      v.r.forEach((k, i) => { if (!this.wayOf.has(k)) this.wayOf.set(k, []); this.wayOf.get(k).push([v, i]); });
    });
    data.vias.forEach((v) => {
      const lanes = +v.l || (v.o === 'yes' ? (v.h === 'secondary' ? 3 : 2) : 2);
      const oneway = v.o === 'yes' || v.o === '-1';
      const refs = v.o === '-1' ? [...v.r].reverse() : v.r;
      // cortes en los nodos que aparecen en más de una vía (intersecciones) o en los extremos
      const cuts = [0];
      for (let i = 1; i < refs.length - 1; i++) if ((this.wayOf.get(refs[i])?.length || 0) > 1) cuts.push(i);
      cuts.push(refs.length - 1);
      for (let c = 0; c < cuts.length - 1; c++) {
        const seg = refs.slice(cuts[c], cuts[c + 1] + 1);
        if (!seg.every(inR)) continue;
        const add = (ids) => {
          const pts = ids.map((k) => new THREE.Vector2(N[k][0], N[k][1]));
          const cum = [0];
          for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
          if (cum[cum.length - 1] < 2) return;
          const e = { pts, cum, len: cum[cum.length - 1], from: ids[0], to: ids[ids.length - 1], ids, speed: SPEED[v.h.replace('_link', '')] || 7, lanes, oneway, way: v, cars: [] };
          this.edges.push(e);
          if (!this.out.has(e.from)) this.out.set(e.from, []);
          this.out.get(e.from).push(e);
        };
        add(seg);
        if (!oneway) add([...seg].reverse());
      }
    });
  }

  /** Dirección de la vía en un nodo (vector unitario en x, z). */
  _dirAt(k) {
    const w = this.wayOf.get(k)?.[0];
    if (!w) return new THREE.Vector2(1, 0);
    const [v, i] = w, N = this.nodes;
    const a = N[v.r[Math.max(0, i - 1)]], b = N[v.r[Math.min(v.r.length - 1, i + 1)]];
    return new THREE.Vector2(b[0] - a[0], b[1] - a[1]).normalize();
  }

  _roadWidth(k) {
    const v = this.wayOf.get(k)?.[0]?.[0];
    if (!v) return 7;
    const lanes = +v.l || (v.o === 'yes' ? (v.h === 'secondary' ? 3 : 2) : 2);
    return Math.max(6, lanes * LANE);
  }

  // ---------------------------------------------------------------- semáforos
  _buildSignals(data) {
    const N = this.nodes;
    const sig = data.semaforos.filter((k) => N[k] && Math.hypot(...N[k]) < R);
    this.signalNode = new Map();       // nodo con semáforo -> { cluster, axis }
    // agrupa los semáforos de una misma intersección (a menos de 28 m)
    const clusters = [];
    for (const k of sig) {
      const p = N[k];
      let c = clusters.find((c) => Math.hypot(c.x - p[0], c.z - p[1]) < 28);
      if (!c) { c = { x: p[0], z: p[1], nodes: [], offset: hash(k) * 30, ref: null, mats: null }; clusters.push(c); }
      c.nodes.push(k);
    }
    // materiales de las luces por intersección y fase (A = un eje, B = el otro)
    const lamp = (hex) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: hex, emissiveIntensity: 0.05, roughness: 0.3 });
    const housing = new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.55, metalness: 0.3 });
    const yellowBack = new THREE.MeshStandardMaterial({ color: 0xd7a91c, roughness: 0.6 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x5d6166, roughness: 0.45, metalness: 0.7 });
    const poleG = new THREE.CylinderGeometry(0.09, 0.11, 5.6, 10); poleG.translate(0, 2.8, 0);
    const armG = new THREE.CylinderGeometry(0.06, 0.06, 1, 8); armG.rotateZ(Math.PI / 2); armG.translate(0.5, 0, 0);
    const headG = new THREE.BoxGeometry(0.36, 1.0, 0.26);
    const backG = new THREE.BoxGeometry(0.62, 1.24, 0.03);
    const lampG = new THREE.CircleGeometry(0.11, 16);
    const visorG = new THREE.CylinderGeometry(0.13, 0.13, 0.16, 12, 1, true, 0, Math.PI); visorG.rotateX(Math.PI / 2); visorG.rotateZ(Math.PI / 2);

    this.clusters = clusters;
    for (const c of clusters) {
      c.mats = [[lamp(0xff2a1a), lamp(0xffae1a), lamp(0x39ff6a)], [lamp(0xff2a1a), lamp(0xffae1a), lamp(0x39ff6a)]];
      const placed = [];
      for (const k of c.nodes) {
        // carros que llegan a este semáforo: aristas que terminan en el nodo (o pasan por él)
        const incoming = this.edges.filter((e) => e.ids.includes(k) && e.ids.indexOf(k) > 0);
        for (const e of incoming) {
          const i = e.ids.indexOf(k);
          const d = new THREE.Vector2().subVectors(e.pts[i], e.pts[i - 1]).normalize();
          const ang = Math.atan2(d.y, d.x);
          if (c.ref == null) c.ref = ang;
          let diff = Math.abs(((ang - c.ref) % Math.PI + Math.PI) % Math.PI);
          diff = Math.min(diff, Math.PI - diff);
          const phase = diff < Math.PI / 4 ? 0 : 1;
          this.signalNode.set(`${k}|${e.from}|${e.to}`, { c, phase });
          if (!this.signalNode.has(k)) this.signalNode.set(k, { c, phase });
          // un poste por sentido de llegada, en el andén derecho antes del cruce
          const key = `${phase}_${Math.round(ang * 4)}`;
          if (placed.includes(key)) continue;
          placed.push(key);
          const half = this._roadWidth(k) / 2 + 1.0;
          const right = new THREE.Vector2(-d.y, d.x);
          const base = this._curb(e.pts[i].clone().addScaledVector(d, -4), right, half);
          const g = new THREE.Group();
          g.position.set(base.x, 0, base.y);
          g.rotation.y = -Math.atan2(d.y, d.x) + Math.PI * 1.5; // +z local (las luces) mira hacia los carros que llegan
          const pole = new THREE.Mesh(poleG, poleMat); g.add(pole);
          // brazo hacia la calzada (a la izquierda del poste mirando a los carros), cabeza colgada al final
          const armLen = Math.min(4.2, half - 0.4);
          const arm = new THREE.Mesh(armG, poleMat); arm.scale.x = armLen; arm.position.set(0, 5.45, 0); arm.rotation.y = Math.PI; g.add(arm);
          const head = (x, y) => {
            const h = new THREE.Group(); h.position.set(x, y, 0);
            h.add(new THREE.Mesh(headG, housing));
            const back = new THREE.Mesh(backG, yellowBack); back.position.z = -0.15; h.add(back);
            [0, 1, 2].forEach((j) => {
              const m = new THREE.Mesh(lampG, c.mats[phase][j]); m.position.set(0, 0.31 - j * 0.31, 0.135); h.add(m);
              const vz = new THREE.Mesh(visorG, housing); vz.position.set(0, 0.31 - j * 0.31 + 0.06, 0.2); h.add(vz);
            });
            return h;
          };
          g.add(head(-armLen + 0.2, 4.85));
          g.add(head(0, 2.7));
          g.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
          this.group.add(g);
          (this.poles ||= []).push(g);
        }
      }
    }
  }

  /** Primer punto sobre un andén al alejarse del eje de la vía hacia `right` (si no hay, el ancho estimado). */
  _curb(p, right, fallback) {
    const inside = (x, z, poly) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i], [xj, zj] = poly[j];
        if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
      }
      return c;
    };
    const near = this.sidewalks.filter((poly) => poly.some(([x, z]) => Math.hypot(x - p.x, z - p.y) < 80));
    for (let o = 2; o <= 16; o += 0.5) {
      const x = p.x + right.x * o, z = p.y + right.y * o;
      if (near.some((poly) => inside(x, z, poly))) return new THREE.Vector2(x + right.x * 0.7, z + right.y * 0.7);
    }
    return p.clone().addScaledVector(right, fallback);
  }

  /** Estado de la fase (0 o 1) de una intersección: 'g', 'a' o 'r'. */
  _state(c, phase) {
    const T = 2 * (CYCLE.green + CYCLE.amber + CYCLE.allRed);
    let t = ((this.time + c.offset) % T + T) % T;
    const half = CYCLE.green + CYCLE.amber + CYCLE.allRed;
    const mine = phase === 0 ? t < half : t >= half;
    if (!mine) return 'r';
    t %= half;
    return t < CYCLE.green ? 'g' : t < CYCLE.green + CYCLE.amber ? 'a' : 'r';
  }

  // ---------------------------------------------------------------- cebras
  _buildZebras(data) {
    const N = this.nodes;
    const stripe = new THREE.PlaneGeometry(0.5, 3.0); stripe.rotateX(-Math.PI / 2);
    const inR = (k) => N[k] && Math.hypot(...N[k]) < R && this.wayOf.has(k);
    const width = (v) => Math.max(6, (+v.l || (v.o === 'yes' ? (v.h === 'secondary' ? 3 : 2) : 2)) * LANE);
    const waysAt = (k) => [...new Set(this.wayOf.get(k).map(([v]) => v))];
    const m4 = [];
    const dummy = new THREE.Object3D();
    // franjas de 3 m paralelas al tráfico, repartidas a lo ancho de la calzada
    const addZebra = (x, z, d, W) => {
      const right = new THREE.Vector2(-d.y, d.x);
      const n = Math.max(4, Math.floor(W / 1.0));
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 1.0;
        dummy.position.set(x + right.x * o, ROAD_Y, z + right.y * o);
        dummy.rotation.set(0, -Math.atan2(d.y, d.x) + Math.PI / 2, 0);
        dummy.updateMatrix();
        m4.push(dummy.matrix.clone());
      }
    };
    const seen = [];
    const once = (x, z) => {
      if (seen.some((s) => Math.hypot(s[0] - x, s[1] - z) < 4)) return false;
      seen.push([x, z]);
      return true;
    };
    // En una intersección la cebra no va en el centro: va en cada brazo, retirada lo que mide la vía
    // transversal más la esquina del andén, como en la Calle 56 con Carrera 18 frente al lote.
    const atIntersection = (k) => {
      const P = N[k], ways = waysAt(k);
      for (const [v, i] of this.wayOf.get(k)) {
        const cross = Math.max(...ways.filter((w) => w !== v).map(width));
        for (const j of [i - 1, i + 1]) {
          const q = N[v.r[j]];
          if (!q) continue;
          const a = new THREE.Vector2(q[0] - P[0], q[1] - P[1]);
          const len = a.length();
          a.normalize();
          const off = Math.min(cross / 2 + 3.2, len * 0.6);
          const x = P[0] + a.x * off, z = P[1] + a.y * off;
          if (once(x, z)) addZebra(x, z, a, width(v));
        }
      }
    };
    // cruces que OSM marca (en la intersección o a mitad de cuadra) y brazos de los cruces con semáforo
    const marked = data.cruces.filter(inR);
    const signals = data.semaforos.filter(inR).filter((k) => waysAt(k).length > 1);
    for (const k of [...marked, ...signals]) {
      if (waysAt(k).length > 1) atIntersection(k);
      else if (once(N[k][0], N[k][1])) addZebra(N[k][0], N[k][1], this._dirAt(k), this._roadWidth(k));
    }
    if (!m4.length) return;
    const mat = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const im = new THREE.InstancedMesh(stripe, mat, m4.length);
    m4.forEach((m, i) => im.setMatrixAt(i, m));
    im.receiveShadow = true;
    im.name = 'Cebras';
    this.group.add(im);
    this.zebraCount = seen.length;
  }

  // ---------------------------------------------------------------- carros
  setNight(v) {
    if (!this.headMat) return;
    this.headMat.emissiveIntensity = 0.2 + v * 6;
    this.tailMat.emissiveIntensity = 0.3 + v * 3;
  }

  _spawnCars(n) {
    this.cars = [];
    this.lightG = new THREE.CircleGeometry(0.11, 12);
    this.headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 0.2 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a0a, emissiveIntensity: 0.3 });
    const loader = new GLTFLoader();
    const kinds = ['sedan', 'sedan', 'suv', 'taxi', 'sedan', 'suv', 'taxi', 'taxi'];
    const r = rng(42);
    // el color de la carrocería viene en el atlas del modelo: se tiñe el material para variar los carros
    const paint = [0xffffff, 0x3a3d42, 0xffffff, 0xb0473c, 0x5a6f96, 0x8a8f96, 0x2a2c30, 0xd8d4c8];
    Promise.all(['sedan', 'suv', 'taxi'].map((k) => loader.loadAsync(`./assets/models/${k}.glb`).catch(() => null))).then(([sedan, suv, taxi]) => {
      const models = { sedan, suv, taxi };
      const pool = this.edges.filter((e) => e.len > 15);
      if (!pool.length) return;
      for (let i = 0; i < n; i++) {
        const kind = kinds[i % kinds.length];
        const gltf = models[kind] || sedan;
        if (!gltf) continue;
        const o = SkeletonUtils.clone(gltf.scene);
        o.scale.setScalar(0.92);
        // color de carrocería variado en sedanes y camionetas (los taxis siguen amarillos)
        if (kind !== 'taxi') {
          const col = new THREE.Color(paint[Math.floor(r() * paint.length)]);
          o.traverse((m) => {
            if (m.isMesh && m.material && m.material.name === 'atlas_colors') { m.material = m.material.clone(); m.material.color.copy(col); }
          });
        }
        o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        const holder = new THREE.Group(); holder.add(o); this.group.add(holder);
        // farolas y stops: se encienden con el anochecer (ver setNight)
        const bb = new THREE.Box3().setFromObject(o);
        const front = bb.max.z - 0.02, back = bb.min.z + 0.02, y = bb.min.y + (bb.max.y - bb.min.y) * 0.36, hx = (bb.max.x - bb.min.x) * 0.33;
        for (const sx of [-hx, hx]) {
          const hl = new THREE.Mesh(this.lightG, this.headMat); hl.position.set(sx, y, front); holder.add(hl);
          const tl = new THREE.Mesh(this.lightG, this.tailMat); tl.position.set(sx, y + 0.08, back); tl.rotation.y = Math.PI; holder.add(tl);
        }
        const car = { obj: holder, edge: null, s: 0, v: 0, lane: 0, yaw: 0, rnd: r() };
        this._place(car, pool[Math.floor(r() * pool.length)], r() * 0.8);
        this.cars.push(car);
      }
      this.ready = true;
    });
  }

  _place(car, edge, frac = 0) {
    if (car.edge) car.edge.cars.splice(car.edge.cars.indexOf(car), 1);
    car.edge = edge;
    car.s = edge.len * frac;
    edge.cars.push(car);
    // carril: el derecho en vías de doble sentido; uno al azar en las de un sentido
    car.lane = edge.oneway ? (Math.floor(car.rnd * edge.lanes) - (edge.lanes - 1) / 2) * LANE : LANE / 2;
    car.v = Math.min(car.v || edge.speed * 0.6, edge.speed);
  }

  _pos(edge, s, out) {
    const { pts, cum } = edge;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1;
    const t = THREE.MathUtils.clamp((s - cum[i - 1]) / seg, 0, 1);
    out.dir.subVectors(b, a).normalize();
    out.p.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    return out;
  }

  /** Siguiente arista al llegar a un nodo: cualquiera menos dar la vuelta en U (salvo calle cerrada). */
  _next(edge, car) {
    const outs = (this.out.get(edge.to) || []).filter((e) => e.to !== edge.from || e.ids.length !== edge.ids.length);
    if (!outs.length) return null;
    return outs[Math.floor(Math.random() * outs.length)];
  }

  update(dt) {
    this.time += dt;
    // luces de los semáforos
    for (const c of this.clusters || []) {
      for (let ph = 0; ph < 2; ph++) {
        const st = this._state(c, ph);
        const [red, amb, grn] = c.mats[ph];
        red.emissiveIntensity = st === 'r' ? 3.2 : 0.05;
        amb.emissiveIntensity = st === 'a' ? 3.2 : 0.05;
        grn.emissiveIntensity = st === 'g' ? 3.2 : 0.05;
      }
    }
    if (!this.ready) return;
    const tmp = { p: new THREE.Vector2(), dir: new THREE.Vector2() };
    for (const car of this.cars) {
      const e = car.edge;
      let target = e.speed * (0.85 + car.rnd * 0.3);
      // distancia al carro de adelante en el mismo tramo y carril
      let gap = Infinity;
      for (const o of e.cars) if (o !== car && Math.abs(o.lane - car.lane) < 1 && o.s > car.s) gap = Math.min(gap, o.s - car.s);
      if (gap === Infinity) {
        const nx = car.nextEdge;
        if (nx) for (const o of nx.cars) if (Math.abs(o.lane - car.lane) < 1) gap = Math.min(gap, e.len - car.s + o.s);
      }
      // semáforo al final del tramo (o en un nodo intermedio)
      let stopAt = Infinity;
      for (let i = 1; i < e.ids.length; i++) {
        const sg = this.signalNode.get(`${e.ids[i]}|${e.from}|${e.to}`) || this.signalNode.get(e.ids[i]);
        if (!sg) continue;
        const d = e.cum[i] - car.s - 5;              // la línea de pare queda 5 m antes del cruce
        if (d < -1) continue;
        const st = this._state(sg.c, sg.phase);
        if (st === 'r' || (st === 'a' && d > 6)) { stopAt = Math.min(stopAt, d); }
        break;
      }
      const room = Math.min(gap - 7, stopAt);
      if (room < 30) target = Math.min(target, Math.max(0, room) * 0.7);
      // aceleración y frenado suaves
      const acc = target > car.v ? 2.5 : 6;
      car.v += THREE.MathUtils.clamp(target - car.v, -acc * dt, acc * dt);
      if (room < 0.5) car.v = Math.min(car.v, 0);
      car.s += car.v * dt;
      if (car.s >= e.len) {
        const nx = car.nextEdge || this._next(e, car);
        car.nextEdge = null;
        if (nx) { const extra = car.s - e.len; this._place(car, nx); car.s = Math.min(extra, nx.len); }
        else { const pool = this.edges.filter((x) => x.len > 15); this._place(car, pool[Math.floor(Math.random() * pool.length)], Math.random() * 0.5); }
      }
      if (!car.nextEdge && car.edge.len - car.s < 25) car.nextEdge = this._next(car.edge, car);
      // posición en el carril y giro suave hacia la dirección de la vía
      this._pos(car.edge, car.s, tmp);
      const right = { x: -tmp.dir.y, y: tmp.dir.x };
      const x = tmp.p.x + right.x * car.lane, z = tmp.p.y + right.y * car.lane;
      const yaw = Math.atan2(tmp.dir.x, tmp.dir.y);
      let dy = yaw - car.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      car.yaw += dy * Math.min(1, dt * 6);
      const o = car.obj;
      if (o.userData.init) { o.position.x += (x - o.position.x) * Math.min(1, dt * 8); o.position.z += (z - o.position.z) * Math.min(1, dt * 8); }
      else { o.position.set(x, 0, z); car.yaw = yaw; o.userData.init = true; }
      o.position.y = -0.34;
      o.rotation.y = car.yaw + (this.flip ? Math.PI : 0);
    }
  }
}
