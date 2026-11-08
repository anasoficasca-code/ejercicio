"""
Ventanería de fachada para el masterplan: lee los vidrios de ventana del modelo de Revit
(assets/models/edificio-revit.*, color #0a64f4) y escribe assets/models/ventanas.json con un ventanal
más grande por cada ventana del modelo.

Cada vidrio de Revit (1,46 × 1,34 m con antepecho de 1,10 m) se convierte en un ventanal de piso a
casi techo centrado en el mismo eje, tan ancho como permiten la ventana vecina y la esquina de la
fachada. Va sobre el plano exterior del pañete (13 cm por fuera del vidrio de Revit); la celosía de
ladrillo queda 40 cm más afuera, así que el ventanal se ve detrás de ella. La web le pone marco de
aluminio, divisiones y vidrio.

Uso: python scripts/build-windows.py
"""
import collections, json, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / 'assets' / 'models' / 'edificio-revit'
PW, PD, LEVEL = 24840, 14000, 3100           # planta en mm y altura de piso
TARGET_W, MIN_GAP, EDGE = 2300, 450, 350      # ancho buscado, muro mínimo entre ventanas y a la esquina
SILL, HEAD = 250, 2650                        # antepecho bajo y dintel bajo la losa (nivel + mm)

manifest = json.loads(MODEL.with_suffix('.json').read_text())
blob = MODEL.with_suffix('.bin').read_bytes()


def boxes(color):
    """Cajas (componentes conexas) de las mallas de un color, en mm."""
    out = []
    for m in manifest['mallas']:
        if m['color'] != color:
            continue
        n = m['vertices']
        pos = struct.unpack_from('<%dh' % (n * 3), blob, m['position'])
        idx = struct.unpack_from('<%d%s' % (m['indices'], 'I' if m['index32'] else 'H'), blob, m['index'])
        key = lambda i: (pos[3 * i], pos[3 * i + 1], pos[3 * i + 2])
        parent = {}

        def find(a):
            while parent.setdefault(a, a) != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a
        for t in range(0, len(idx), 3):
            a, b, c = (find(key(idx[t + k])) for k in range(3))
            parent[b] = a
            parent[find(c)] = a
        comp = collections.defaultdict(list)
        for v in parent:
            comp[find(v)].append(v)
        for vs in comp.values():
            xs, ys, zs = zip(*vs)
            out.append((min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)))
    return out


def facade(b):
    """Fachada de una caja delgada: N (Calle 56), S (patio), W (Carrera 18) o E; y su coordenada a lo largo."""
    x0, x1, y0, y1, z0, z1 = b
    if z1 - z0 < x1 - x0:                     # caja delgada en z → fachada norte o sur
        return ('N' if z0 < PD / 2 else 'S'), x0, x1
    return ('W' if x0 < PW / 2 else 'E'), z0, z1


OUT = 136                                    # del lado exterior del vidrio al plano del pañete, + 5 mm
panes = boxes('#0a64f4')
by_row = collections.defaultdict(list)
for b in panes:
    if b[3] - b[2] < 500:                     # restos sin altura
        continue
    f, a0, a1 = facade(b)
    level = round((b[2] - 1100) / LEVEL) * LEVEL
    face = b[4] - OUT if f == 'N' else b[5] + OUT if f == 'S' else b[0] - OUT if f == 'W' else b[1] + OUT
    by_row[(f, level)].append({'c': (a0 + a1) / 2, 'face': face})

length = {'N': PW, 'S': PW, 'W': PD, 'E': PD}
windows = []
for (f, level), row in sorted(by_row.items()):
    row.sort(key=lambda w: w['c'])
    for i, w in enumerate(row):
        c, half = w['c'], TARGET_W / 2
        if i > 0:
            half = min(half, (c - row[i - 1]['c'] - MIN_GAP) / 2)
        if i < len(row) - 1:
            half = min(half, (row[i + 1]['c'] - c - MIN_GAP) / 2)
        half = min(half, c - EDGE, length[f] - EDGE - c)
        if half < 600:
            half = 730                           # nunca más angosta que la de Revit
        windows.append({'f': f, 'piso': level // LEVEL, 'c': round(c), 'w': round(2 * half),
                        'y0': level + SILL, 'y1': level + HEAD, 'face': w['face']})

(MODEL.parent / 'ventanas.json').write_text(json.dumps({'unidad': 'mm', 'ventanas': windows}, separators=(',', ':')))
print(len(windows), 'ventanas')
print(collections.Counter(w['w'] // 100 * 100 for w in windows))
