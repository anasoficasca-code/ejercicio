"""
Empaqueta la geometría exportada de Revit (ejercicio2.rvt) para la web.

Entrada: JSON con mallas por (piso, color de material, vidrio, categoría) en milímetros y en el
marco de la planta: x = oriente desde la fachada de la Carrera 18, y = altura desde el piso 1,
z = sur desde la fachada de la Calle 56.

Salida (assets/models/):
  edificio-revit.bin   posiciones Int16 (mm), normales Int8 (x, y, z, 0) e índices Uint16/Uint32
  edificio-revit.json  manifiesto con los rangos de cada malla dentro del .bin

Uso: python scripts/build-revit-model.py revit_geom.json   (revit_geom.json sale de export-revit-geometry.py)
"""
import json, math, struct, sys
from pathlib import Path

out_dir = Path(__file__).resolve().parent.parent / 'assets' / 'models'
# uno o varios JSON de export-revit-geometry.py (p. ej. arquitectura y mobiliario por separado)
raw = [m for f in sys.argv[1:] for m in json.loads(Path(f).read_text())]

# las categorías se agrupan en capas para poder encender y apagar el mobiliario en la web
LAYER = {'Furniture': 'mobiliario', 'Plumbing Fixtures': 'mobiliario', 'Casework': 'mobiliario',
         'Specialty Equipment': 'mobiliario', 'Generic Models': 'mobiliario'}

groups = {}
for m in raw:
    layer = LAYER.get(m['cat'], 'arquitectura')
    # el nombre del material (tela, madera, porcelana…) le permite a la web darle un acabado real
    key = (m['floor'], m['color'], m['glass'], layer, m.get('mat', ''))
    groups.setdefault(key, []).append(m)

blob = bytearray()
meshes = []
tri_total = 0
for (floor, color, glass, layer, matname), parts in sorted(groups.items()):
    vmap, pos, nor, idx = {}, [], [], []
    for m in parts:
        p, ii = m['p'], m['i']
        for t in range(0, len(ii), 3):
            a, b, c = (p[3 * ii[t + k]: 3 * ii[t + k] + 3] for k in range(3))
            ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
            vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
            # Revit: (X sur, Y oriente, Z arriba) → web (x oriente, y arriba, z sur) conserva la orientación
            nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
            ln = math.sqrt(nx * nx + ny * ny + nz * nz)
            if ln < 1e-6:
                continue
            n = (round(nx / ln * 127), round(ny / ln * 127), round(nz / ln * 127))
            for v in (a, b, c):
                k = (v[0], v[1], v[2], n)
                j = vmap.get(k)
                if j is None:
                    j = vmap[k] = len(pos)
                    pos.append(v)
                    nor.append(n)
                idx.append(j)
    if not idx:
        continue
    tri_total += len(idx) // 3
    entry = {'floor': floor, 'color': '#' + color, 'glass': bool(glass), 'layer': layer,
             'vertices': len(pos), 'indices': len(idx)}
    if matname:
        entry['mat'] = matname
    entry['position'] = len(blob)
    for v in pos:
        blob += struct.pack('<3h', *v)
    blob += b'\0' * (-len(blob) % 4)
    entry['normal'] = len(blob)
    for n in nor:
        blob += struct.pack('<4b', n[0], n[1], n[2], 0)
    entry['index'] = len(blob)
    wide = len(pos) > 65535
    entry['index32'] = wide
    blob += struct.pack('<%d%s' % (len(idx), 'I' if wide else 'H'), *idx)
    blob += b'\0' * (-len(blob) % 4)
    meshes.append(entry)

out_dir.mkdir(parents=True, exist_ok=True)
(out_dir / 'edificio-revit.bin').write_bytes(bytes(blob))
manifest = {'fuente': 'ejercicio2.rvt (Revit 2027)', 'unidad': 'mm', 'triangulos': tri_total, 'mallas': meshes}
(out_dir / 'edificio-revit.json').write_text(json.dumps(manifest, separators=(',', ':')))
print('mallas', len(meshes), 'triangulos', tri_total, 'bytes', len(blob))
