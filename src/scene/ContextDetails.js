import * as THREE from 'three';

/** Nearby facade depth; distant cadastral volumes keep the lightweight shader.
 * These are schematic finishes, not surveyed architectural details.
 */
export class ContextDetails {
  constructor(parent, buildings, heightAt, mobile = false) {
    this.group = new THREE.Group();
    this.group.name = 'Acabados del contexto cercano';
    parent.add(this.group);
    const stone = [], metal = [], roof = [];
    const hash = (str) => {
      // Match the facade's stable seed (see CityContext).
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0) / 4294967296;
    };
    const radius = mobile ? 95 : 180;
    for (const b of buildings) {
      const pts = b.pts.map(p => [...p]);
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
      const cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      if (Math.hypot(cx, cz) > radius) continue;
      let area = 0;
      pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; });
      if (area > 0) pts.reverse();
      const sd = b.l === '007208001002' ? 0.7 : hash(`${b.l}${b.pts[0][0]}`);
      const fract = x => x - Math.floor(x);
      const fh = 2.75 + 0.35 * fract(sd * 29.31 + 0.71);
      const cw = 2.6 + 1.2 * fract(sd * 47.73 + 0.13);
      const ground = heightAt(cx, cz), h = Math.max(b.h, Math.max(1, b.p) * 2.8);
      let per = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (length < 0.05) continue;
        const ux = (q[0] - p[0]) / length, uz = (q[1] - p[1]) / length;
        const nx = -uz, nz = ux, angle = -Math.atan2(uz, ux);
        const put = (list, along, y, w, ht, depth, offset) => list.push({
          x: p[0] + ux * along + nx * offset,
          y: ground + y,
          z: p[1] + uz * along + nz * offset,
          w, h: ht, d: depth, angle
        });
        // Raised coping has an actual shadow silhouette instead of a painted line.
        if (b.p >= 4) put(roof, length / 2, h + 0.12, length, 0.24, 0.22, 0);
        for (let floor = 0; (floor + 0.86) * fh < h; floor++) {
          for (let bay = Math.floor(per / cw); bay * cw < per + length; bay++) {
            const along = (bay + 0.5) * cw - per;
            if (along < cw * 0.3 || along > length - cw * 0.3) continue;
            if ((floor + 0.36) * fh < 1.2) continue;
            // Align the sill and lintel to the shader's window bay.
            put(stone, along, (floor + 0.36) * fh - 0.055, cw * 0.5 + 0.2, 0.11, 0.24, 0.085);
            put(stone, along, (floor + 0.82) * fh + 0.035, cw * 0.5 + 0.14, 0.07, 0.12, 0.035);
            put(metal, along, (floor + 0.59) * fh, 0.035, fh * 0.46, 0.055, 0.035);
          }
        }
        per += length;
      }
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    const add = (items, color, roughness, metallic = 0) => {
      if (!items.length) return;
      const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: metallic });
      const mesh = new THREE.InstancedMesh(box, material, items.length);
      const obj = new THREE.Object3D();
      items.forEach((p, i) => {
        obj.position.set(p.x, p.y, p.z); obj.rotation.y = p.angle;
        obj.scale.set(p.w, p.h, p.d); obj.updateMatrix(); mesh.setMatrixAt(i, obj.matrix);
      });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    };
    add(stone, 0xbcb6aa, 0.87);
    add(metal, 0x4a4843, 0.38, 0.65);
    add(roof, 0xb1aca2, 0.91);
  }
}
