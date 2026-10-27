"""Descarga el contexto urbano real de Catastro Bogotá (servicios ArcGIS públicos de la UAECD)
alrededor del lote del proyecto y lo guarda en coordenadas locales de la escena 3D.

Origen (0, 0) = centroide del lote 007208002009 · Calle 56 # 17-53, esquina Carrera 18 (Galerías).
Ejes: X = este, Z = sur (−Z = norte), Y = altura. Unidades: metros.

Salidas en data/geometry/:
  construcciones.json   huellas de construcción con número de pisos y altura (Catastro · construccion)
  manzanas.json         manzanas con uso predominante, altura media y valor de referencia del suelo
  lotes.json            lotes catastrales cercanos al proyecto
  predios.json          los tres lotes evaluados en el estudio de mercado
  puntos.json           servicios, equipamientos y proyectos competidores (geocodificados por placa)
  andenes.json          andenes: manzanas ampliadas 2,6 m (requiere shapely)

Uso: python3 scripts/build-context.py [radio_m]
"""
import json, math, os, sys, time, urllib.parse, urllib.request

CAT = "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/catastro/{}/MapServer/0/query"
LOTE_PROYECTO = "007208002009"
PREDIOS = {
    "lote-01": ("007208008013", "LOTE 01", "Carrera 18 # 54-53"),
    "lote-02": ("007208002009", "LOTE 02 · SELECCIONADO", "Calle 56 # 17-53"),
    "lote-03": ("007203014009", "LOTE 03", "Carrera 15A # 60-44"),
}
MLON, MLAT = 110945, 110574
R = float(sys.argv[1]) if len(sys.argv) > 1 else 700
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "geometry")


def query(layer, **params):
    base = dict(outFields="*", returnGeometry="true", outSR=4326, geometryPrecision=7, f="json")
    base.update(params)
    feats, off = [], 0
    while True:
        base["resultOffset"] = off
        url = CAT.format(layer) + "?" + urllib.parse.urlencode(base)
        for a in range(6):
            try:
                d = json.load(urllib.request.urlopen(url, timeout=90))
                break
            except Exception as e:
                print("  reintento", layer, e, flush=True)
                time.sleep(2 + a * 2)
        else:
            raise SystemExit(f"Catastro no respondió ({layer})")
        if "error" in d:
            raise SystemExit(f"{layer}: {d['error']}")
        fs = d.get("features", [])
        feats += fs
        off += len(fs)
        if not d.get("exceededTransferLimit") or not fs:
            return feats


def envelope(lon, lat, r):
    dl, dt = r / MLON, r / MLAT
    return dict(geometry=f"{lon - dl},{lat - dt},{lon + dl},{lat + dt}", geometryType="esriGeometryEnvelope",
                inSR=4326, spatialRel="esriSpatialRelIntersects", where="1=1")


def centroid(ring):
    return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)


lote = query("lote", where=f"LOTCODIGO='{LOTE_PROYECTO}'")[0]
LON0, LAT0 = centroid(lote["geometry"]["rings"][0][:-1])
print(f"origen: {LON0:.7f}, {LAT0:.7f}")


def loc(lon, lat):
    return [round((lon - LON0) * MLON, 2), round(-(lat - LAT0) * MLAT, 2)]


def ring_local(ring, tol=0.35):
    pts = [loc(*p) for p in ring]
    if len(pts) > 3 and pts[0] == pts[-1]:
        pts = pts[:-1]
    out = [pts[0]]
    for p in pts[1:]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > tol:
            out.append(p)
    return out


def area(p):
    return abs(0.5 * sum(p[k][0] * p[(k + 1) % len(p)][1] - p[(k + 1) % len(p)][0] * p[k][1] for k in range(len(p))))


def save(name, data):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {name}: {os.path.getsize(os.path.join(OUT, name)) / 1024:.0f} KB")


# --- Construcciones -------------------------------------------------------------------------
print("construcciones…")
N = 4
cells = []
for i in range(N):
    for j in range(N):
        lon = LON0 - R / MLON + (2 * i + 1) * R / MLON / N
        lat = LAT0 - R / MLAT + (2 * j + 1) * R / MLAT / N
        cells += query("construccion", outFields="CONNPISOS,CONALTURA,CONNSOTANO,LOTECODIGO",
                       **envelope(lon, lat, R / N))
seen, cons = set(), []
for f in cells:
    a = f["attributes"]
    if a.get("LOTECODIGO") == LOTE_PROYECTO:
        continue
    for ring in f["geometry"].get("rings", [])[:1]:
        pts = ring_local(ring)
        if len(pts) < 3 or area(pts) < 10:
            continue
        cx, cz = centroid(pts)
        if math.hypot(cx, cz) > R:
            continue
        key = (round(cx, 1), round(cz, 1))
        if key in seen:
            continue
        seen.add(key)
        pisos = int(a.get("CONNPISOS") or 1)
        h = float(a.get("CONALTURA") or 0) or pisos * 2.9
        cons.append({"p": pisos, "h": round(max(2.6, h), 1), "l": a.get("LOTECODIGO"), "pts": pts})
save("construcciones.json", {"origen": [LON0, LAT0], "fuente": "Catastro Bogotá · construccion", "b": cons})

# --- Manzanas con atributos -----------------------------------------------------------------
print("manzanas…")
RM = R * 1.35
env = envelope(LON0, LAT0, RM)
uso = {f["attributes"]["MANCODIGO"]: f["attributes"]["GRUPOUSOECON"] for f in query("usopredominante", returnGeometry="false", **env)}
alt = {f["attributes"]["MANCODIGO"]: f["attributes"]["ALTURA"] for f in query("alturamedia", returnGeometry="false", **env)}
val = {f["attributes"]["MANCODIGO"]: f["attributes"]["V_REF"] for f in query("valorreferencia", returnGeometry="false", **env)}
mzs = []
for f in query("manzana", outFields="MANCODIGO,SECCODIGO", **env):
    c = f["attributes"]["MANCODIGO"]
    for ring in f["geometry"].get("rings", [])[:1]:
        pts = ring_local(ring, 0.5)
        if len(pts) < 3:
            continue
        mzs.append({"id": c, "sec": f["attributes"]["SECCODIGO"], "uso": uso.get(c), "alt": alt.get(c),
                    "vref": val.get(c), "pts": pts})
save("manzanas.json", {"fuente": "Catastro Bogotá · manzana, usopredominante, alturamedia, valorreferencia", "m": mzs})

# --- Lotes cercanos ------------------------------------------------------------------------
print("lotes…")
lotes = []
for f in query("lote", outFields="LOTCODIGO,MANZCODIGO", **envelope(LON0, LAT0, 260)):
    for ring in f["geometry"].get("rings", [])[:1]:
        pts = ring_local(ring, 0.2)
        if len(pts) >= 3:
            lotes.append({"id": f["attributes"]["LOTCODIGO"], "pts": pts})
save("lotes.json", {"fuente": "Catastro Bogotá · lote", "l": lotes})

# --- Los tres predios evaluados -------------------------------------------------------------
print("predios…")
predios = []
for pid, (cod, nombre, dir_) in PREDIOS.items():
    f = query("lote", where=f"LOTCODIGO='{cod}'")[0]
    ring = f["geometry"]["rings"][0]
    predios.append({"id": pid, "codigo": cod, "nombre": nombre, "direccion": dir_,
                    "lonlat": [round(v, 7) for v in centroid(ring[:-1])],
                    "pts": ring_local(ring, 0.05), "areaCatastro": round(area(ring_local(ring, 0.05)), 2)})
save("predios.json", {"fuente": "Catastro Bogotá · lote", "p": predios})

# --- Puntos de interés (geocodificados con la placa domiciliaria de Catastro) ---------------
print("puntos…")


def placa(via, txt):
    fs = query("placadomiciliaria", where=f"PDONVIAL='{via}' AND PDOTEXTO like '{txt}%'",
               outFields="PDOTEXTO", returnGeometry="true", resultRecordCount=1)
    g = fs[0]["geometry"]
    return g["x"], g["y"]


with open(os.path.join(OUT, "..", "puntos-fuente.json"), encoding="utf-8") as f:
    fuente = json.load(f)
pts = []
for p in fuente["puntos"]:
    lon, lat = placa(*p["placa"]) if "placa" in p else p["lonlat"]
    pts.append({**{k: v for k, v in p.items() if k != "placa"}, "lonlat": [round(lon, 7), round(lat, 7)], "xz": loc(lon, lat)})
save("puntos.json", {"p": pts})



# --- Andenes ----------------------------------------------------------------------------------
def build_andenes(ancho=2.6, radio=820):
    """Anden = manzana ampliada `ancho` metros (requiere shapely). La calzada es lo que queda entre andenes."""
    from shapely.geometry import Polygon
    m = json.load(open(os.path.join(OUT, "manzanas.json"), encoding="utf-8"))["m"]
    out = []
    for z in m:
        p = Polygon(z["pts"])
        if not p.is_valid:
            p = p.buffer(0)
        c = p.centroid
        if math.hypot(c.x, c.y) > radio:
            continue
        b = p.buffer(ancho, join_style=2, mitre_limit=2.5).simplify(0.3)
        if b.geom_type != "Polygon":
            continue
        out.append([[round(x, 2), round(y, 2)] for x, y in list(b.exterior.coords)[:-1]])
    save("andenes.json", {"fuente": "Manzanas de Catastro Bogotá ampliadas %.1f m" % ancho, "a": out})


build_andenes()
print("listo")
