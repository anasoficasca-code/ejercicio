"""
Exporta la geometría del edificio desde Revit (ejercicio2.rvt) para el masterplan web.

Se ejecuta DENTRO de Revit (pyRevit, RevitPythonShell o el puente Horizun) con el modelo abierto.
Escribe un JSON con mallas por (piso, color de material, vidrio, categoría) que luego empaqueta
scripts/build-revit-model.py en assets/models/edificio-revit.{bin,json}.

- Arquitectura (muros, losas, fachada, ventanería, puertas, escaleras, barandas…) de todos los pisos.
- Mobiliario simplificado (vista gruesa) solo del piso 1, del piso 3 —que la web repite en los pisos
  2 a 6, porque la planta tipo es la misma— y de la terraza.
- Marco: x = oriente desde la fachada de la Carrera 18 (Y de Revit − 6.719), y = Z de Revit,
  z = sur desde la fachada de la Calle 56 (X de Revit − 21.503), en milímetros.
- Cada triángulo va al piso de su centroide con 400 mm de margen, para que la losa de cada nivel
  (cuya cara inferior queda ~300 mm por debajo del nivel) viaje con su propio piso.
"""
from Autodesk.Revit.DB import *
import json

doc = __revit__.ActiveUIDocument.Document
FT = 304.8
X0, Y0 = 21503.0, 6719.0
OUT = r'revit_geom.json'
ARQ = [BuiltInCategory.OST_Walls, BuiltInCategory.OST_Floors, BuiltInCategory.OST_Roofs, BuiltInCategory.OST_Windows,
       BuiltInCategory.OST_Doors, BuiltInCategory.OST_CurtainWallPanels, BuiltInCategory.OST_CurtainWallMullions,
       BuiltInCategory.OST_Stairs, BuiltInCategory.OST_StairsRailing, BuiltInCategory.OST_Railings,
       BuiltInCategory.OST_RailingTopRail, BuiltInCategory.OST_RailingHandRail, BuiltInCategory.OST_RailingSupport,
       BuiltInCategory.OST_Columns, BuiltInCategory.OST_StructuralColumns, BuiltInCategory.OST_StructuralFraming,
       BuiltInCategory.OST_Ramps, BuiltInCategory.OST_StairsRuns, BuiltInCategory.OST_StairsLandings]
MOB = [BuiltInCategory.OST_Furniture, BuiltInCategory.OST_PlumbingFixtures, BuiltInCategory.OST_Casework,
       BuiltInCategory.OST_SpecialityEquipment]

optA = Options(); optA.DetailLevel = ViewDetailLevel.Medium
optM = Options(); optM.DetailLevel = ViewDetailLevel.Coarse
matcache = {}
buckets = {}


def matinfo(mid):
    k = mid.Value
    if k not in matcache:
        r = None
        m = doc.GetElement(mid) if k > 0 else None
        if isinstance(m, Material) and m.Color.IsValid:
            c = m.Color
            r = ('%02x%02x%02x' % (c.Red, c.Green, c.Blue), int(m.Transparency))
        matcache[k] = r
    return matcache[k]


def add(key, tri):
    b = buckets.setdefault(key, {'v': {}, 'p': [], 'i': []})
    for (x, y, z) in tri:
        kk = (int(round(y - Y0)), int(round(z)), int(round(x - X0)))
        idx = b['v'].get(kk)
        if idx is None:
            idx = len(b['p']) // 3
            b['v'][kk] = idx
            b['p'].extend(kk)
        b['i'].append(idx)


def dosolid(s, cat, defmat, lod, fixfl):
    for f in s.Faces:
        mi = matinfo(f.MaterialElementId) or defmat
        try:
            mesh = f.Triangulate(lod)
        except Exception:
            continue
        vs = [(p.X * FT, p.Y * FT, p.Z * FT) for p in mesh.Vertices]
        for t in range(mesh.NumTriangles):
            tr = mesh.get_Triangle(t)
            a, b, c = vs[tr.get_Index(0)], vs[tr.get_Index(1)], vs[tr.get_Index(2)]
            fl = fixfl if fixfl is not None else max(0, min(6, int(((a[2] + b[2] + c[2]) / 3.0 + 400) // 3100)))
            add((fl, mi[0], 1 if mi[1] >= 40 else 0, cat), (a, b, c))


def walk(geo, cat, defmat, lod, fixfl):
    for g in geo:
        if isinstance(g, Solid):
            if g.Faces.Size > 0 and g.Volume > 1e-9:
                dosolid(g, cat, defmat, lod, fixfl)
        elif isinstance(g, GeometryInstance):
            walk(g.GetInstanceGeometry(), cat, defmat, lod, fixfl)


def run(cats, opt, lod, mob):
    for c in cats:
        for e in FilteredElementCollector(doc).OfCategory(c).WhereElementIsNotElementType():
            if isinstance(e, DirectShape):
                continue
            if isinstance(e, FamilyInstance) and e.SuperComponent is not None:
                continue
            bb = e.get_BoundingBox(None)
            if bb is None:
                continue
            if bb.Max.X * FT < 19500 or bb.Min.X * FT > 37500 or bb.Max.Y * FT < 4700 or bb.Min.Y * FT > 33600:
                continue
            if bb.Max.Z * FT < -50 or bb.Min.Z * FT > 22000:
                continue
            fixfl = None
            if mob:
                fixfl = int((bb.Min.Z * FT + 450) // 3100)
                if fixfl not in (0, 2, 6):
                    continue
            cm = e.Category.Material
            defmat = (matinfo(cm.Id) if cm else None) or ('b4b4b4', 0)
            geo = e.get_Geometry(opt)
            if geo is not None:
                walk(geo, e.Category.Name, defmat, lod, fixfl)


run(ARQ, optA, 0.1, False)
run(MOB, optM, 0.0, True)
with open(OUT, 'w') as fh:
    json.dump([{'floor': k[0], 'color': k[1], 'glass': k[2], 'cat': k[3], 'p': b['p'], 'i': b['i']}
               for k, b in buckets.items()], fh, separators=(',', ':'))
