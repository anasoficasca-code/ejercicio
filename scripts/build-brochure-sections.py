# -*- coding: utf-8 -*-
"""Genera las secciones Corte, Cabida arquitectónica, Qué hay cerca y La firma del brochure (index.html)
a partir de data/proyecto.json, data/geometry/predios.json y data/geometry/puntos.json.
Uso: python scripts/build-brochure-sections.py   (reescribe los bloques entre <!-- gen:xxx --> y <!-- /gen:xxx -->)"""
import json, math, re, io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(io.open(os.path.join(ROOT, p), encoding='utf-8'))
proj, predios, puntos = J('data/proyecto.json'), J('data/geometry/predios.json'), J('data/geometry/puntos.json')
pa = proj['proyectoActual']
PW, PD = pa['plantaM']
FH, NF = pa['alturaPisoM'], pa['pisos']
CX0, CX1 = 9.41, 15.26
es = lambda v, d=2: f'{v:,.{d}f}'.replace(',', '§').replace('.', ',').replace('§', '.')

# ------------------------------------------------------------------ corte
S = 24
X = lambda m: round(150 + m * S, 1)
Y = lambda m: round(600 - m * S, 1)
c = []
a = c.append
a('<svg class="cx-svg" viewBox="-70 0 970 690" role="img" aria-labelledby="cx-t cx-d">')
a('<title id="cx-t">Corte longitudinal de Distrito Arboleda</title>')
a(f'<desc id="cx-d">Seis pisos de {es(FH)} metros y terraza: primer piso con lobby y restaurante, pisos 2 a 6 con apartamentos a cada lado del punto fijo, y cubierta con zona BBQ, café lounge y gimnasio.</desc>')
a('<defs><pattern id="cx-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" class="cx-h"/></pattern></defs>')
# terreno, vecino y árboles
a(f'<g class="cx-site"><rect x="-40" y="{Y(0)}" width="900" height="26" fill="url(#cx-hatch)"/><line x1="-40" y1="{Y(0)}" x2="860" y2="{Y(0)}" class="cx-ground"/>')
a(f'<path d="M{X(PW)} {Y(0)}V{Y(6.4)}H{X(PW+4.6)}L{X(PW+6.4)} {Y(8.2)}L{X(PW+8.2)} {Y(6.4)}V{Y(0)}" class="cx-nb"/><text x="{X(PW+4.3)}" y="{Y(2.6)}" class="cx-s" text-anchor="middle">Vecino</text>')
for tx, th, tr in ((-3.2, 6.4, 2.1), (-1.5, 4.6, 1.5)):
    a(f'<g class="cx-tree"><line x1="{X(tx)}" y1="{Y(0)}" x2="{X(tx)}" y2="{Y(th)}"/><circle cx="{X(tx)}" cy="{Y(th)}" r="{tr*S}"/><circle cx="{X(tx-0.5)}" cy="{Y(th-0.9)}" r="{tr*S*0.62}"/></g>')
a(f'<text x="{X(-2.4)}" y="{Y(-0.75)}" class="cx-s" text-anchor="middle">Antejardín 3,50 m</text><text x="{X(PW/2)}" y="{Y(-0.75)}" class="cx-s" text-anchor="middle">Calle 56 · fachada de {es(PW)} m</text></g>')
# pisos
for i in range(NF):
    y0, y1 = i * FH, (i + 1) * FH
    key = 'p1' if i == 0 else 'apt'
    a(f'<g class="cx-floor" data-l="{key}" data-i="{i}" tabindex="0" role="button" aria-label="Piso {i+1}">')
    a(f'<rect class="cx-room" x="{X(0)}" y="{Y(y1)}" width="{round((CX0)*S,1)}" height="{round(FH*S,1)}"/>')
    a(f'<rect class="cx-core" x="{X(CX0)}" y="{Y(y1)}" width="{round((CX1-CX0)*S,1)}" height="{round(FH*S,1)}"/>')
    a(f'<rect class="cx-room" x="{X(CX1)}" y="{Y(y1)}" width="{round((PW-CX1)*S,1)}" height="{round(FH*S,1)}"/>')
    # escalera en el punto fijo
    st = ' '.join(f'{X(CX0+0.5+k*0.42)},{Y(y0+0.3+k*0.33)}' for k in range(8))
    a(f'<polyline class="cx-stair" points="{st}"/><rect class="cx-lift" x="{X(CX1-1.9)}" y="{Y(y1-0.45)}" width="{1.5*S}" height="{round((FH-0.7)*S,1)}"/>')
    a(f'<rect class="cx-slab" x="{X(-1.3 if i else 0)}" y="{Y(y1)}" width="{round((PW+(1.3 if i else 0))*S,1)}" height="{0.26*S:.1f}"/>')
    if i:  # balcón sobre la Carrera 18
        a(f'<path class="cx-rail" d="M{X(-1.3)} {Y(y0)}V{Y(y0+1.1)}"/>')
    lab = ('Lobby y bicicletero', 'Restaurante con terraza') if i == 0 else (f'Apto {i+1}01 · tipo A', f'Apto {i+1}02 · tipo A')
    a(f'<text class="cx-t" x="{X(CX0/2)}" y="{Y(y0+FH/2-0.25)}" text-anchor="middle">{lab[0]}</text><text class="cx-t" x="{X((CX1+PW)/2)}" y="{Y(y0+FH/2-0.25)}" text-anchor="middle">{lab[1]}</text>')
    a(f'<text class="cx-lv" x="12" y="{Y(y0+FH/2-0.1)}" text-anchor="end">Piso {i+1}</text><text class="cx-n" x="12" y="{Y(y0+FH/2-0.75)}" text-anchor="end">N +{es(y0)}</text>')
    a('</g>')
# cubierta
top = NF * FH
a(f'<g class="cx-floor cx-roof" data-l="t" data-i="{NF}" tabindex="0" role="button" aria-label="Terraza en la cubierta">')
a(f'<rect class="cx-hit" x="{X(0)}" y="{Y(top+3.4)}" width="{PW*S:.1f}" height="{3.4*S:.1f}"/>')
a(f'<path class="cx-rail" d="M{X(0)} {Y(top)}V{Y(top+1.1)}M{X(PW)} {Y(top)}V{Y(top+1.1)}"/>')
a(f'<rect class="cx-core" x="{X(CX0)}" y="{Y(top+2.9)}" width="{round((CX1-CX0)*S,1)}" height="{2.9*S:.1f}"/><rect class="cx-slab" x="{X(CX0-0.2)}" y="{Y(top+3.1)}" width="{round((CX1-CX0+0.4)*S,1)}" height="{0.2*S:.1f}"/>')
a(f'<path class="cx-perg" d="M{X(1.2)} {Y(top)}V{Y(top+2.6)}M{X(8.2)} {Y(top)}V{Y(top+2.6)}M{X(0.7)} {Y(top+2.6)}H{X(8.7)}' + ''.join(f'M{X(1.0+k*0.62)} {Y(top+2.6)}v-5' for k in range(13)) + '"/>')
a(f'<text class="cx-t" x="{X(4.7)}" y="{Y(top+1.0)}" text-anchor="middle">BBQ · café lounge</text><text class="cx-t" x="{X((CX1+PW)/2)}" y="{Y(top+1.0)}" text-anchor="middle">Gimnasio al aire libre</text>')
a(f'<text class="cx-lv" x="12" y="{Y(top+1.1)}" text-anchor="end">Terraza</text><text class="cx-n" x="12" y="{Y(top+0.45)}" text-anchor="end">N +{es(top)}</text></g>')
# cotas
xd = X(PW) + 44
a(f'<g class="cx-dim"><path class="cx-dl" d="M{xd} {Y(0)}V{Y(top)}"/>' + ''.join(f'<path class="cx-dt" d="M{xd-5} {Y(k*FH)}h10"/>' for k in range(NF + 1)))
for k in range(NF):
    a(f'<text class="cx-n" x="{xd+10}" y="{Y(k*FH+FH/2-0.15)}">{es(FH)}</text>')
a(f'<text class="cx-total" x="{xd+62}" y="{Y(top/2)}" transform="rotate(-90 {xd+62} {Y(top/2)})" text-anchor="middle">{es(top)} m en {NF} pisos</text>')
a(f'<path class="cx-dl" d="M{X(0)} {Y(-1.6)}H{X(PW)}"/><path class="cx-dt" d="M{X(0)} {Y(-1.6)-5}v10M{X(CX0)} {Y(-1.6)-5}v10M{X(CX1)} {Y(-1.6)-5}v10M{X(PW)} {Y(-1.6)-5}v10"/>')
a(f'<text class="cx-n" x="{X(CX0/2)}" y="{Y(-2.35)}" text-anchor="middle">{es(CX0)}</text><text class="cx-n" x="{X((CX0+CX1)/2)}" y="{Y(-2.35)}" text-anchor="middle">Punto fijo {es(CX1-CX0)}</text><text class="cx-n" x="{X((CX1+PW)/2)}" y="{Y(-2.35)}" text-anchor="middle">{es(PW-CX1)}</text></g>')
a('</svg>')
corte_svg = ''.join(c)

# ------------------------------------------------------------------ cabida: lote real de Catastro y huella
lot = next(p for p in predios['p'] if p['id'] == 'englobe')['pts']
best, north = 1e9, 0
for i in range(len(lot)):
    p, q = lot[i], lot[(i + 1) % len(lot)]
    score = (p[1] + q[1]) / 2 - math.dist(p, q) * 0.2
    if score < best: best, north = score, i
B, C = lot[north], lot[(north + 1) % len(lot)]
if B[0] > C[0]: B, C = C, B
L = math.dist(B, C); u = ((C[0]-B[0])/L, (C[1]-B[1])/L); v = (-u[1], u[0])
poly = [((p[0]-B[0])*u[0] + (p[1]-B[1])*u[1], (p[0]-B[0])*v[0] + (p[1]-B[1])*v[1]) for p in lot]
ant = pa['antejardinM']
ox = max(0, max(p[0] for p in poly if p[0] < 5)) + ant; oz = ant
xs, zs = [p[0] for p in poly], [p[1] for p in poly]
K = 15
QX = lambda m: round(70 + (m - min(xs)) * K, 1)
QZ = lambda m: round(70 + (m - min(zs)) * K, 1)
W2, H2 = QX(max(xs)) + 70, QZ(max(zs)) + 60
lotd = 'M' + 'L'.join(f'{QX(x)} {QZ(z)}' for x, z in poly) + 'Z'
k = []
b = k.append
b(f'<svg class="cb-svg" viewBox="0 0 {W2:.0f} {H2:.0f}" role="img" aria-labelledby="cb-t cb-d"><title id="cb-t">Implantación del edificio en el lote</title>')
b(f'<desc id="cb-d">Lote de {es(pa["loteM2"])} metros cuadrados con la huella del edificio de {es(PW)} por {es(PD)} metros, retirada {es(ant)} metros de la Calle 56 y de la Carrera 18.</desc>')
b('<defs><pattern id="cb-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="cb-h"/></pattern>'
  f'<clipPath id="cb-clip"><path d="{lotd}"/></clipPath></defs>')
b(f'<path class="cb-lot" d="{lotd}" pathLength="1"/>')
b(f'<g clip-path="url(#cb-clip)"><rect class="cb-ant" x="{QX(min(xs))}" y="{QZ(min(zs))}" width="{(max(xs)-min(xs))*K:.1f}" height="{(oz - min(zs))*K:.1f}" fill="url(#cb-hatch)"/>'
  f'<rect class="cb-ant" x="{QX(min(xs))}" y="{QZ(min(zs))}" width="{(ox - min(xs))*K:.1f}" height="{(max(zs)-min(zs))*K:.1f}" fill="url(#cb-hatch)"/></g>')
b(f'<rect class="cb-foot" x="{QX(ox)}" y="{QZ(oz)}" width="{PW*K:.1f}" height="{PD*K:.1f}"/>')
b(f'<rect class="cb-core" x="{QX(ox+CX0)}" y="{QZ(oz+4.44)}" width="{(CX1-CX0)*K:.1f}" height="{(9.52-4.44)*K:.1f}"/>')
b(f'<path class="cb-split" d="M{QX(ox+12.14)} {QZ(oz)}V{QZ(oz+4.44)}M{QX(ox+12.3)} {QZ(oz+9.52)}V{QZ(oz+PD)}M{QX(ox)} {QZ(oz+7.83)}H{QX(ox+CX0)}M{QX(ox+CX1)} {QZ(oz+7.83)}H{QX(ox+PW)}"/>')
for lx, lz, t in ((ox+4.7, oz+4.2, 'A'), (ox+20, oz+4.2, 'A'), (ox+4.7, oz+11.2, 'B'), (ox+20, oz+11.2, 'B')):
    b(f'<text class="cb-u" x="{QX(lx)}" y="{QZ(lz)}" text-anchor="middle">{t}</text>')
b(f'<text class="cb-s" x="{QX(ox+PW/2)}" y="{QZ(oz+7.25)}" text-anchor="middle">Punto fijo</text>')
if max(zs) - (oz + PD) > 2.5:
    b(f'<text class="cb-s" x="{QX(ox+PW/2)}" y="{QZ((oz+PD+max(zs))/2)+4}" text-anchor="middle">Jardín del patio</text>')
b(f'<text class="cb-st" x="{QX((min(xs)+max(xs))/2)}" y="38" text-anchor="middle">Calle 56</text>')
b(f'<text class="cb-st" x="30" y="{QZ((min(zs)+max(zs))/2)}" text-anchor="middle" transform="rotate(-90 30 {QZ((min(zs)+max(zs))/2)})">Carrera 18</text>')
yd = QZ(oz + PD) + 16
b(f'<g class="cb-dim"><path d="M{QX(ox)} {yd}H{QX(ox+PW)}M{QX(ox)} {yd-5}v10M{QX(ox+PW)} {yd-5}v10"/><text x="{QX(ox+PW/2)}" y="{yd+16}" text-anchor="middle">{es(PW)} m</text>')
xd2 = QX(ox + PW) + 16
b(f'<path d="M{xd2} {QZ(oz)}V{QZ(oz+PD)}M{xd2-5} {QZ(oz)}h10M{xd2-5} {QZ(oz+PD)}h10"/><text x="{xd2+14}" y="{QZ(oz+PD/2)}" transform="rotate(-90 {xd2+14} {QZ(oz+PD/2)})" text-anchor="middle">{es(PD)} m</text>')
b(f'<text x="{QX(ox+PW/2)}" y="{QZ(oz/2 + min(zs)/2)+4}" text-anchor="middle">Antejardín {es(ant)} m</text></g>')
# norte: el norte del mundo es -z
nx, nz = -u[1] * -1, -v[1] * -1
nx, nz = (0*u[0] + -1*u[1]), (0*v[0] + -1*v[1])
ang = math.degrees(math.atan2(nx, -nz))
b(f'<g class="cb-north" transform="translate({W2-44:.0f} {H2-44:.0f}) rotate({ang:.1f})"><circle r="17"/><path d="M0 -13L5 6L0 2L-5 6Z"/></g><text class="cb-s" x="{W2-44:.0f}" y="{H2-10:.0f}" text-anchor="middle">N</text>')
b('</svg>')
cabida_svg = ''.join(k)

lote, huella = pa['loteM2'], pa['plantaM2']
constr = huella * NF
vend = sum(t['area'] for t in pa['tipologias']) * (pa['unidades'] / len(pa['tipologias']))
ventas = sum(t['precio'] for t in pa['tipologias']) * (pa['unidades'] / len(pa['tipologias']))
comunal = constr / 80 * 10
num = lambda v, d, suf='', pre='': f'<dt data-num="{v:.4f}" data-dec="{d}" data-pre="{pre}" data-suf="{suf}">{pre}{es(v, d)}{suf}</dt>'
cab_rows = [
    (num(lote, 2, ' m²'), 'Lote', 'Englobe de cinco predios del parqueadero Divino Salvador (Catastro Bogotá)'),
    (num(huella, 2, ' m²'), 'Huella del edificio', f'{es(PW)} × {es(PD)} m, con punto fijo de {es(pa["puntoFijoM2"])} m²'),
    (num(huella / lote, 2), 'Índice de ocupación', f'El {round(huella/lote*100)} % del lote; el resto es antejardín y jardín'),
    (num(constr, 2, ' m²'), 'Área construida', f'{NF} pisos de {es(huella)} m²'),
    (num(constr / lote, 2), 'Índice de construcción', 'Área construida sobre área del lote'),
    (num(NF * FH, 2, ' m'), 'Altura', f'{NF} pisos de {es(FH)} m, más la terraza'),
    (num(pa['unidades'], 0), 'Apartamentos', '4 por piso en los pisos 2 a 6: 10 tipo A y 10 tipo B'),
    (num(vend, 2, ' m²'), 'Área vendible', f'10 × {es(pa["tipologias"][0]["area"])} m² + 10 × {es(pa["tipologias"][1]["area"])} m²'),
    (num(ventas / 1e6, 0, ' M', '$'), 'Ventas estimadas', 'Suma de los 20 apartamentos a precio de lista, en millones de pesos'),
    (num(comunal, 1, ' m²'), 'Equipamiento comunal exigido', '10 m² por cada 80 m² construidos (POT, Decreto 555 de 2021)'),
]
cab_dl = ''.join(f'<div class="cb-row">{n}<dd><b>{t}</b><span>{d}</span></dd></div>' for n, t, d in cab_rows)

# ------------------------------------------------------------------ qué hay cerca
me = next(p for p in puntos['p'] if p['tipo'] == 'proyecto')
near = []
for p in puntos['p']:
    if p['tipo'] in ('proyecto', 'competencia'): continue
    dx, dz = p['xz'][0] - me['xz'][0], p['xz'][1] - me['xz'][1]
    near.append(dict(n=p['nombre'].replace('TransMilenio · ', 'TransMilenio '), t=p['tipo'], d=math.hypot(dx, dz), dx=dx, dz=dz, ll=p['lonlat'], det=p.get('detalle', '')))
near.sort(key=lambda o: o['d'])
TIPO = {'transporte': 'Transporte', 'comercio': 'Comercio', 'educacion': 'Educación', 'salud': 'Salud', 'recreacion': 'Recreación'}
RMAX, RPX = 1200, 210
r = ['<svg class="nr-svg" viewBox="-260 -260 520 520" role="img" aria-labelledby="nr-t"><title id="nr-t">Lugares cercanos a Distrito Arboleda, ubicados según su dirección y distancia reales</title>']
r.append('<defs><linearGradient id="nr-sweep" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".0"/><stop offset="1" stop-color="currentColor" stop-opacity=".34"/></linearGradient></defs>')
for m in (400, 800, 1200):
    rr = m / RMAX * RPX
    r.append(f'<circle class="nr-ring" r="{rr:.1f}"/><text class="nr-rl" x="4" y="{-rr-5:.1f}">{"1,2 km" if m == 1200 else str(m) + " m"}</text>')
r.append(f'<path class="nr-axis" d="M-{RPX+20} 0H{RPX+20}M0 -{RPX+20}V{RPX+20}"/><text class="nr-rl" x="0" y="-{RPX+28}" text-anchor="middle">N</text>')
r.append(f'<g class="nr-sweep"><path d="M0 0L0 -{RPX}A{RPX} {RPX} 0 0 1 {RPX*math.sin(math.radians(50)):.1f} {-RPX*math.cos(math.radians(50)):.1f}Z" fill="url(#nr-sweep)"/></g>')
for i, o in enumerate(near):
    f = min(o['d'], RMAX * 1.12) / RMAX * RPX / o['d']
    x, y = o['dx'] * f, o['dz'] * f
    far = ' nr-far' if o['d'] > RMAX else ''
    r.append(f'<g class="nr-dot{far}" data-i="{i}" transform="translate({x:.1f} {y:.1f})"><circle class="nr-pulse" r="13"/><circle class="nr-c" r="11"/><text y="4" text-anchor="middle">{i+1}</text></g>')
r.append('<g class="nr-me"><circle class="nr-pulse" r="18"/><circle r="7"/></g></svg>')
radar_svg = ''.join(r)
def walk(d):
    if d > 1500: return f'{round(d*1.3/250)} min en bici'
    return f'{round(d*1.3/80)} min a pie'
near_li = ''.join(
    f'<li><button type="button" data-i="{i}"><i>{i+1}</i><span class="nr-name"><b>{o["n"]}</b><small>{TIPO[o["t"]]} · {o["det"]}</small></span>'
    f'<span class="nr-dist"><b>{(es(o["d"]/1000, 1) + " km") if o["d"] >= 1000 else (str(int(round(o["d"], -1))) + " m")}</b><small>{walk(o["d"])}</small></span></button></li>'
    for i, o in enumerate(near))
near_js = json.dumps([dict(n=o['n'], ll=[o['ll'][1], o['ll'][0]], d=round(o['d'])) for o in near], ensure_ascii=False)

# ------------------------------------------------------------------ bloques HTML
autores = proj['proyecto']['autores']
blocks = {}
blocks['corte'] = f'''
    <section class="sec corte" id="corte" aria-labelledby="corte-h">
      <div class="wrap corte-grid">
        <div class="corte-copy">
          <p class="hero-kicker" data-reveal>Corte longitudinal</p>
          <h2 id="corte-h" data-reveal>Qué hay en cada piso</h2>
          <p class="corte-lead" data-reveal>El edificio cortado a lo largo de la Calle 56. Pasa por cada nivel para ver qué espacios tiene.</p>
          <ol class="cx-list">
            <li><button type="button" data-l="t"><b>Terraza</b><span>Zona BBQ, café lounge bajo la pérgola y gimnasio al aire libre. A {es(NF*FH)} m sobre la calle.</span></button></li>
            <li><button type="button" data-l="apt"><b>Pisos 2 a 6</b><span>Cuatro apartamentos por piso alrededor del punto fijo: dos tipo A de 78,75 m² sobre la Calle 56 y dos tipo B de 70 m² hacia el jardín. Altura de piso a piso de {es(FH)} m.</span></button></li>
            <li><button type="button" data-l="p1"><b>Piso 1</b><span>Lobby con bicicletero en la esquina, restaurante con terraza sobre la Calle 56, sala de cine y gimnasio hacia el patio.</span></button></li>
          </ol>
        </div>
        <figure class="corte-fig">{corte_svg}<figcaption>Corte esquemático con las medidas del modelo de Revit. El punto fijo tiene escalera y ascensor.</figcaption></figure>
      </div>
    </section>
'''
blocks['cabida'] = f'''
    <section class="sec cabida dark" id="cabida" aria-labelledby="cabida-h">
      <div class="wrap">
        <div class="cabida-head">
          <p class="hero-kicker" data-reveal>Cabida arquitectónica</p>
          <h2 id="cabida-h" data-reveal>Cuánto cabe en el lote</h2>
        </div>
        <div class="cabida-grid">
          <figure class="cabida-fig">{cabida_svg}
            <figcaption><span><i class="k-foot"></i>Huella del edificio</span><span><i class="k-ant"></i>Antejardín de {es(ant)} m</span><span><i class="k-lot"></i>Lindero del lote</span></figcaption>
          </figure>
          <dl class="cabida-dl">{cab_dl}</dl>
        </div>
        <p class="cabida-src">Fuentes: Catastro Bogotá (lote), POT de Bogotá, Decreto 555 de 2021 (antejardín, aislamiento posterior de {es(pa["aislamientoPosteriorM"])} m y equipamiento comunal) y modelo de Revit del proyecto (huella, alturas y áreas).</p>
      </div>
    </section>
'''
blocks['cerca'] = f'''
    <section class="sec cerca" id="ubicacion" aria-labelledby="cerca-h">
      <div class="wrap">
        <div class="cerca-head">
          <p class="hero-kicker" data-reveal>Galerías, Teusaquillo</p>
          <h2 id="cerca-h" data-reveal>Qué hay cerca</h2>
          <p data-reveal>Calle 56 con Carrera 18, frente a la Parroquia Divino Salvador. Cada punto está puesto en su dirección y distancia reales desde el edificio.</p>
        </div>
        <div class="cerca-grid">
          <figure class="cerca-radar">{radar_svg}</figure>
          <ol class="nr-list">{near_li}</ol>
        </div>
        <p class="cerca-note">Distancias en línea recta desde el lote. Los minutos son aproximados: recorrido 30 % más largo que la línea recta, a 80 m por minuto a pie y 250 m por minuto en bicicleta. Además pasan rutas del SITP por las calles 53, 57 y 63 y las carreras 13 y 24.</p>
        <div class="map" id="map" role="region" aria-label="Mapa de Galerías con Distrito Arboleda y los lugares cercanos"></div>
      </div>
      <script>window.CERCA = {near_js};</script>
    </section>
'''
blocks['firma'] = f'''
    <section class="sec firma dark" id="firma" aria-labelledby="firma-h">
      <div class="wrap">
        <p class="hero-kicker" data-reveal>La firma</p>
        <h2 class="firma-name" id="firma-h" aria-label="JMC Arquitectura"><span aria-hidden="true" data-split>JMC</span> <span aria-hidden="true" data-split>Arquitectura</span></h2>
        <p class="firma-lead wh2" data-wh2>Somos un estudio de Bogotá que diseña vivienda en barrios que ya existen. Tomamos lotes subutilizados, como un parqueadero en Galerías, y los convertimos en edificios de escala media que le devuelven árboles, vecinos y vida de primer piso a la calle.</p>
        <div class="firma-cards">
          <article class="fcard" data-tilt>
            <span class="fcard-n" aria-hidden="true">01</span>
            <h3>Misión</h3>
            <p>Diseñar vivienda que mejore la calle donde se construye: apartamentos con buena luz y ventilación, materiales que duran décadas y primeros pisos abiertos al barrio.</p>
          </article>
          <article class="fcard" data-tilt>
            <span class="fcard-n" aria-hidden="true">02</span>
            <h3>Visión</h3>
            <p>Ser en 2035 el estudio de referencia en Bogotá para vivienda de escala media en barrios tradicionales, con proyectos que sumen árboles, comercio de barrio y nuevos vecinos a cada cuadra.</p>
          </article>
        </div>
        <ul class="firma-vals">
          <li><b>El barrio primero</b><span>Cada proyecto empieza por la calle: antejardines sembrados, andenes amplios y un primer piso que se puede usar.</span></li>
          <li><b>Materiales honestos</b><span>Ladrillo de la sabana, pañete, madera y vidrio. Lo que se ve es lo que hay, y envejece bien.</span></li>
          <li><b>Números claros</b><span>Norma, cabida y mercado verificados antes de dibujar: cada metro cuadrado tiene una razón.</span></li>
        </ul>
        <p class="firma-team"><span>Equipo</span>{' · '.join(autores)}</p>
      </div>
    </section>
'''

# ------------------------------------------------------------------ escribir en index.html
path = os.path.join(ROOT, 'index.html')
html = io.open(path, encoding='utf-8').read()
for name, body in blocks.items():
    pat = re.compile(rf'<!-- gen:{name} -->.*?<!-- /gen:{name} -->', re.S)
    if not pat.search(html): raise SystemExit(f'falta el marcador gen:{name}')
    html = pat.sub(lambda m: f'<!-- gen:{name} -->{body}    <!-- /gen:{name} -->', html)
io.open(path, 'w', encoding='utf-8', newline='\n').write(html)
print('ok', {k: len(v) for k, v in blocks.items()}, 'lote', es(lote), 'constr', es(constr), 'vend', es(vend), 'ventas', es(ventas/1e6, 0), 'autores', autores)
