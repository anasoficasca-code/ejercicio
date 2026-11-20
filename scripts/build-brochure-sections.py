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

# ------------------------------------------------------------------ corte (lenguaje de plano: poché, vidrio, escalera, mobiliario, figuras, cotas)
import random
S = 24
X = lambda m: round(150 + m * S, 1)
Y = lambda m: round(600 - m * S, 1)
Wd = lambda m: round(m * S, 1)
SL = 0.3                      # espesor de losa
c = []
a = c.append
def rect(x0, y0, x1, y1, cls):
    a(f'<rect class="{cls}" x="{X(min(x0,x1))}" y="{Y(max(y0,y1))}" width="{Wd(abs(x1-x0))}" height="{Wd(abs(y1-y0))}"/>')
def path(d, cls): a(f'<path class="{cls}" d="{d}"/>')
def P(x, y): return f'{X(x)} {Y(y)}'
def person(x, y, h=1.72, flip=1, sit=False):
    k = h / 1.72
    hx, hy = x, y + 1.6 * k
    if sit:
        d = (f'M{P(x-0.12*flip, y+0.45)}L{P(x-0.12*flip, y+1.0*k)}Q{P(x, y+1.18*k)} {P(x+0.12*flip, y+1.0*k)}L{P(x+0.14*flip, y+0.55)}'
             f'L{P(x+0.5*flip, y+0.5)}L{P(x+0.52*flip, y)}L{P(x+0.4*flip, y)}L{P(x+0.38*flip, y+0.4)}L{P(x-0.1*flip, y+0.42)}Z')
        a(f'<g class="cx-ppl"><circle cx="{X(x)}" cy="{Y(y+1.3*k)}" r="{Wd(0.11*k)}"/><path d="{d}"/></g>'); return
    d = (f'M{P(x-0.07, y)}L{P(x-0.13, y+0.85*k)}L{P(x-0.2, y+1.42*k)}Q{P(x, y+1.52*k)} {P(x+0.2, y+1.42*k)}'
         f'L{P(x+0.13, y+0.85*k)}L{P(x+0.07, y)}L{P(x+0.02, y)}L{P(x, y+0.78*k)}L{P(x-0.02, y)}Z')
    a(f'<g class="cx-ppl"><circle cx="{X(hx)}" cy="{Y(hy)}" r="{Wd(0.11*k)}"/><path d="{d}"/></g>')
def sofa(x, y, w=2.1):
    path(f'M{P(x, y)}V{P(x, y+0.42)[P(x, y+0.42).index(" ")+1:]}' if False else f'M{P(x, y)}L{P(x, y+0.85)}L{P(x+0.18, y+0.85)}L{P(x+0.18, y+0.45)}L{P(x+w-0.18, y+0.45)}L{P(x+w-0.18, y+0.6)}L{P(x+w, y+0.6)}L{P(x+w, y)}', 'cx-furn')
def table(x, y, w=1.4, h=0.75):
    path(f'M{P(x, y+h)}L{P(x+w, y+h)}M{P(x+0.1, y+h)}L{P(x+0.1, y)}M{P(x+w-0.1, y+h)}L{P(x+w-0.1, y)}', 'cx-furn')
def chair(x, y, f=1):
    path(f'M{P(x, y)}L{P(x, y+0.45)}L{P(x+0.42*f, y+0.45)}M{P(x+0.42*f, y)}L{P(x+0.42*f, y+0.9)}', 'cx-furn')
def bed(x, y, w=2.0):
    path(f'M{P(x, y)}L{P(x, y+1.05)}M{P(x, y+0.5)}L{P(x+w, y+0.5)}L{P(x+w, y)}M{P(x+0.15, y+0.6)}Q{P(x+0.4, y+0.72)} {P(x+0.65, y+0.6)}', 'cx-furn')
def counter(x, y, w=2.4):
    path(f'M{P(x, y)}L{P(x, y+0.9)}L{P(x+w, y+0.9)}L{P(x+w, y)}M{P(x, y+1.5)}L{P(x+w, y+1.5)}L{P(x+w, y+2.25)}L{P(x, y+2.25)}Z', 'cx-furn')
def plant(x, y, h=1.1):
    path(f'M{P(x-0.18, y)}L{P(x-0.22, y+0.35)}L{P(x+0.22, y+0.35)}L{P(x+0.18, y)}Z', 'cx-furn')
    path(f'M{P(x, y+0.35)}Q{P(x-0.45, y+h*0.7)} {P(x-0.3, y+h)}M{P(x, y+0.35)}Q{P(x+0.4, y+h*0.75)} {P(x+0.35, y+h*0.95)}M{P(x, y+0.35)}L{P(x+0.05, y+h*1.05)}', 'cx-leaf')
TREE_AR = 0.6332
def tree(cx, h, r, seed, cls=''):
    w = h * TREE_AR * (0.95 + (seed % 5) * 0.03)
    flip = ' transform="translate({0} 0) scale(-1 1)"' if seed % 2 else ''
    x0 = X(cx - w / 2)
    if seed % 2:
        a(f'<g class="cx-tree{cls}" transform="translate({X(cx) * 2} 0) scale(-1 1)"><image href="./assets/brochure/arbol-corte.png" x="{x0}" y="{Y(h)}" width="{Wd(w)}" height="{Wd(h)}" preserveAspectRatio="none"/></g>')
    else:
        a(f'<g class="cx-tree{cls}"><image href="./assets/brochure/arbol-corte.png" x="{x0}" y="{Y(h)}" width="{Wd(w)}" height="{Wd(h)}" preserveAspectRatio="none"/></g>')

top = NF * FH
a('<svg class="cx-svg" viewBox="-70 0 1080 760" role="img" aria-labelledby="cx-t cx-d">')
a('<title id="cx-t">Corte A-A de Distrito Arboleda</title>')
a(f'<desc id="cx-d">Corte longitudinal: seis pisos de {es(FH)} metros y terraza. Primer piso con lobby y restaurante, pisos 2 a 6 con apartamentos a cada lado del punto fijo con escalera y ascensor, y cubierta con zona BBQ, café lounge y gimnasio.</desc>')
a('<defs><pattern id="cx-earth" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" class="cx-h"/></pattern>'
  '<pattern id="cx-dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".7" class="cx-dot"/></pattern></defs>')
# niveles (líneas finas a todo lo ancho)
for k in range(NF + 1):
    yy = k * FH + SL if k < NF else top + SL
    a(f'<line class="cx-lvl" x1="-30" x2="{X(PW)+8}" y1="{Y(yy)}" y2="{Y(yy)}"/>')
# árboles del antejardín y del fondo, vecino
tree(-3.1, 9.6, 2.5, 4)
tree(-1.2, 7.2, 1.7, 11)
tree(PW + 2.6, 8.8, 2.4, 6)
# suelo
a(f'<rect x="-70" y="{Y(0)}" width="1080" height="{Wd(2.4)}" fill="url(#cx-earth)"/>')
a(f'<line class="cx-ground" x1="-70" x2="1010" y1="{Y(0)}" y2="{Y(0)}"/>')
# pisos
for i in range(NF):
    y0, y1 = i * FH, (i + 1) * FH
    f0 = y0 + SL
    key = 'p1' if i == 0 else 'apt'
    a(f'<g class="cx-floor" data-l="{key}" data-i="{i}" tabindex="0" role="button" aria-label="Piso {i+1}">')
    rect(0.25, f0, CX0, y1, 'cx-room'); rect(CX0, f0, CX1, y1, 'cx-core'); rect(CX1, f0, PW - 0.3, y1, 'cx-room')
    # poché: losa (con voladizo del balcón), fachada oeste (dintel + vidrio), medianera este, muros del punto fijo, divisiones
    rect(-1.45 if i else -0.2, y0, PW, f0, 'cx-poche')
    rect(0, y1 - 0.45, 0.25, y1, 'cx-poche'); rect(0, f0, 0.25, y1 - 0.45, 'cx-glass')
    rect(PW - 0.3, f0, PW, y1, 'cx-poche')
    rect(CX0, f0 + 2.25, CX0 + 0.2, y1, 'cx-poche'); rect(CX1 - 0.2, f0, CX1, y1, 'cx-poche')
    if i:
        rect(5.3, f0 + 2.15, 5.42, y1, 'cx-poche'); rect(19.6, f0 + 2.15, 19.72, y1, 'cx-poche')
        # balcón: baranda de vidrio y jardinera
        rect(-1.45, f0, -1.38, f0 + 1.05, 'cx-glass'); rect(-1.3, f0, -0.55, f0 + 0.45, 'cx-poche')
        path(f'M{P(-0.95, f0+0.45)}Q{P(-1.3, f0+1.1)} {P(-1.2, f0+1.35)}M{P(-0.95, f0+0.45)}Q{P(-0.6, f0+1.0)} {P(-0.7, f0+1.25)}M{P(-0.95, f0+0.45)}L{P(-0.9, f0+1.4)}', 'cx-leaf')
        sofa(1.0, f0); table(3.4, f0, 1.3, 0.45); plant(4.75, f0)
        counter(6.0, f0, 2.6); person(2.9 if i % 2 else 7.6, f0, flip=-1)
        bed(16.0, f0, 2.1); chair(20.6, f0); table(21.1, f0, 1.1); plant(23.6, f0, 0.9)
        if i % 2 == 0: person(18.7, f0)
        lab = (f'Apto {i+1}01 · sala y cocina', f'Apto {i+1}02 · alcoba')
    else:
        # primer piso: lobby (recepción) y restaurante (mesas y barra)
        rect(-0.2, f0 + 2.45, 0.25, y1, 'cx-poche')
        counter(5.6, f0, 2.2) if False else path(f'M{P(5.4, f0)}L{P(5.4, f0+1.05)}L{P(7.9, f0+1.05)}L{P(7.9, f0)}', 'cx-furn')
        sofa(1.0, f0, 1.8); plant(3.5, f0, 1.3); person(4.4, f0); person(8.6, f0, flip=-1)
        for tx in (16.0, 19.4):
            table(tx, f0, 0.9); chair(tx - 0.55, f0); chair(tx + 1.45, f0, -1)
            person(tx - 0.42, f0, sit=True)
        path(f'M{P(21.9, f0)}L{P(21.9, f0+1.1)}L{P(24.0, f0+1.1)}', 'cx-furn'); person(23.1, f0, flip=-1)
        lab = ('Lobby y recepción', 'Restaurante')
    # escalera (tramo cortado en poché fino y tramo visto en línea) y ascensor
    st = ''.join(f'L{P(CX0+0.55+k*0.28, f0+k*0.172)}L{P(CX0+0.55+(k+1)*0.28, f0+k*0.172)}' for k in range(9))
    path(f'M{P(CX0+0.55, f0)}{st}L{P(CX0+3.35, f0+1.55)}L{P(CX0+3.35, f0+1.4)}L{P(CX0+0.55, f0-0.12)}Z', 'cx-stair')
    path(f'M{P(CX0+3.35, f0+1.55)}L{P(CX0+0.55, y1+SL-0.02)}', 'cx-stair-v')
    rect(CX1 - 2.05, f0, CX1 - 0.35, y1, 'cx-lift')
    if i == 2: rect(CX1 - 1.9, f0 + 0.05, CX1 - 0.5, f0 + 2.3, 'cx-cab')
    a(f'<text class="cx-t" x="{X(CX0/2+0.1)}" y="{Y(f0+2.35)}" text-anchor="middle">{lab[0]}</text><text class="cx-t" x="{X((CX1+PW)/2)}" y="{Y(f0+2.35)}" text-anchor="middle">{lab[1]}</text>')
    a(f'<g class="cx-mark"><path d="M-36 {Y(f0)-8}h12l-6 8z"/><text class="cx-lv" x="-18" y="{Y(f0)-12}">Piso {i+1}</text><text class="cx-n" x="-18" y="{Y(f0)-1}">N +{es(f0)}</text></g>')
    a('</g>')
# cubierta
a(f'<g class="cx-floor cx-roof" data-l="t" data-i="{NF}" tabindex="0" role="button" aria-label="Terraza en la cubierta">')
rect(0, top + SL, PW, top + 3.6, 'cx-hit')
rect(-0.2, top, PW, top + SL, 'cx-poche')
rect(0, top + SL, 0.25, top + 1.15, 'cx-poche'); rect(PW - 0.3, top + SL, PW, top + 1.15, 'cx-poche')
rect(CX0, top + SL, CX0 + 0.2, top + 3.0, 'cx-poche'); rect(CX1 - 0.2, top + SL, CX1, top + 3.0, 'cx-poche'); rect(CX0 - 0.15, top + 3.0, CX1 + 0.15, top + 3.25, 'cx-poche')
rect(CX0 + 0.2, top + SL, CX1 - 0.2, top + 3.0, 'cx-core')
# pérgola: columnas y vigas cortadas
rect(1.0, top + SL, 1.2, top + 2.75, 'cx-poche'); rect(8.0, top + SL, 8.2, top + 2.75, 'cx-poche')
rect(0.6, top + 2.75, 8.6, top + 2.95, 'cx-perg')
for k in range(12):
    xx = 0.8 + k * 0.68
    rect(xx, top + 2.95, xx + 0.12, top + 3.2, 'cx-poche')
table(3.0, top + SL, 1.6); chair(2.4, top + SL); chair(4.75, top + SL, -1); person(2.55, top + SL, sit=True); person(5.6, top + SL, flip=-1)
sofa(16.4, top + SL, 1.9); plant(19.0, top + SL, 1.2); person(21.0, top + SL); plant(23.2, top + SL, 1.4)
a(f'<text class="cx-t" x="{X(4.7)}" y="{Y(top+3.65)}" text-anchor="middle">BBQ · café lounge</text><text class="cx-t" x="{X((CX1+PW)/2)}" y="{Y(top+2.35)}" text-anchor="middle">Gimnasio al aire libre</text>')
a(f'<g class="cx-mark"><path d="M-36 {Y(top+SL)-8}h12l-6 8z"/><text class="cx-lv" x="-18" y="{Y(top+SL)-12}">Terraza</text><text class="cx-n" x="-18" y="{Y(top+SL)-1}">N +{es(top+SL)}</text></g></g>')
# cimentación
rect(-0.2, -0.6, PW, 0, 'cx-poche')
for xx in (0.1, CX0, CX1 - 0.3, PW - 0.6):
    rect(xx - 0.35, -1.5, xx + 0.65, -0.6, 'cx-poche')
# cotas
xd = X(PW + 7.4)
a(f'<g class="cx-dim"><path class="cx-dl" d="M{xd} {Y(0)}V{Y(top+SL)}"/>' + ''.join(f'<path class="cx-dt" d="M{xd-5} {Y(k*FH+(SL if k else 0))+5}l10 -10"/>' for k in range(NF + 1)))
for k in range(NF):
    a(f'<text class="cx-n" x="{xd+8}" y="{Y(k*FH+FH/2)}">{es(FH)}</text>')
a(f'<text class="cx-total" x="{xd+48}" y="{Y(top/2)}" transform="rotate(-90 {xd+48} {Y(top/2)})" text-anchor="middle">{es(top)} m · {NF} pisos</text>')
yb = -2.6
a(f'<path class="cx-dl" d="M{X(0)} {Y(yb)}H{X(PW)}"/>' + ''.join(f'<path class="cx-dt" d="M{X(v)-5} {Y(yb)+5}l10 -10"/>' for v in (0, CX0, CX1, PW)))
a(f'<text class="cx-n" x="{X(CX0/2)}" y="{Y(yb)-6}" text-anchor="middle">{es(CX0)}</text><text class="cx-n" x="{X((CX0+CX1)/2)}" y="{Y(yb)-6}" text-anchor="middle">Punto fijo {es(CX1-CX0)}</text><text class="cx-n" x="{X((CX1+PW)/2)}" y="{Y(yb)-6}" text-anchor="middle">{es(PW-CX1)}</text>')
a(f'<text class="cx-s" x="{X(-2.4)}" y="{Y(yb)-6}" text-anchor="middle">Antejardín 3,50</text></g>')
# rótulo y escala gráfica
yt = Y(-4.4)
a(f'<g class="cx-title"><text class="cx-tt" x="-60" y="{yt}">Corte A–A′</text><text class="cx-n" x="-60" y="{yt+16}">Longitudinal, sobre la Calle 56 · medidas del modelo de Revit</text>')
sx = X(PW - 5.2)
a(f'<rect class="cx-poche" x="{sx}" y="{yt-10}" width="{Wd(1)}" height="5"/><rect class="cx-sb" x="{sx+Wd(1)}" y="{yt-10}" width="{Wd(1)}" height="5"/><rect class="cx-poche" x="{sx+Wd(2)}" y="{yt-10}" width="{Wd(3)}" height="5"/>')
a(f'<text class="cx-n" x="{sx}" y="{yt+6}" text-anchor="middle">0</text><text class="cx-n" x="{sx+Wd(2)}" y="{yt+6}" text-anchor="middle">2</text><text class="cx-n" x="{sx+Wd(5)}" y="{yt+6}" text-anchor="middle">5 m</text></g>')
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

# ------------------------------------------------------------------ cabida en axonometría (isométrica)
SA = 11.5
def ISO(x, z, y=0.0):
    return ((x - z) * 0.8660 * SA, -(x + z) * 0.5 * SA - y * SA)
axp = []
def poly_ax(pts3, cls, extra=''):
    q = [ISO(*p) for p in pts3]; axp.extend(q)
    return f'<path class="{cls}" d="M' + 'L'.join(f'{a:.1f} {b:.1f}' for a, b in q) + f'Z"{extra}/>'
ax = []
ax.append('<g class="ax-lot">' + poly_ax([(x, z, 0) for x, z in poly], 'ax-ground') + '</g>')
# antejardines (franja de 3,50 m sobre las dos calles), dentro del lote
x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
ax.append('<g class="ax-ant">' + poly_ax([(x0, z0, 0), (x1, z0, 0), (x1, oz, 0), (ox, oz, 0), (ox, z1, 0), (x0, z1, 0)], 'ax-green') + '</g>')
TOP = NF * FH
for i in range(NF):
    y0, y1 = i * FH, (i + 1) * FH
    g = ['<g class="ax-f">']
    # cara sobre la Carrera 18 (x = ox) y cara sobre la Calle 56 (z = oz)
    g.append(poly_ax([(ox, oz + PD, y0), (ox, oz, y0), (ox, oz, y1), (ox, oz + PD, y1)], 'ax-w'))
    g.append(poly_ax([(ox, oz, y0), (ox + PW, oz, y0), (ox + PW, oz, y1), (ox, oz, y1)], 'ax-s'))
    gh0, gh1 = (y0 + 0.35, y1 - 0.45) if i == 0 else (y0 + 0.95, y1 - 0.35)
    for a0, a1 in ((0.8, 6.2), (7.0, 12.2), (13.2, 18.4), (19.3, 24.0)):
        g.append(poly_ax([(ox + a0, oz, gh0), (ox + a1, oz, gh0), (ox + a1, oz, gh1), (ox + a0, oz, gh1)], 'ax-glass'))
    for a0, a1 in ((0.8, 6.4), (7.4, 13.2)):
        g.append(poly_ax([(ox, oz + a1, gh0), (ox, oz + a0, gh0), (ox, oz + a0, gh1), (ox, oz + a1, gh1)], 'ax-glass'))
    # franjas de ladrillo
    for a0, a1 in ((6.2, 7.0), (18.4, 19.3)):
        g.append(poly_ax([(ox + a0, oz, y0), (ox + a1, oz, y0), (ox + a1, oz, y1), (ox + a0, oz, y1)], 'ax-brick'))
    g.append(poly_ax([(ox, oz + PD, y1), (ox, oz, y1), (ox + PW, oz, y1), (ox + PW, oz + 0.25, y1), (ox + 0.25, oz + 0.25, y1), (ox + 0.25, oz + PD, y1)], 'ax-slab'))
    g.append('</g>'); ax.append(''.join(g))
r = ['<g class="ax-roof">', poly_ax([(ox, oz, TOP), (ox + PW, oz, TOP), (ox + PW, oz + PD, TOP), (ox, oz + PD, TOP)], 'ax-top')]
r.append(poly_ax([(ox + CX0, oz + 9.52, TOP), (ox + CX0, oz + 4.44, TOP), (ox + CX0, oz + 4.44, TOP + 2.9), (ox + CX0, oz + 9.52, TOP + 2.9)], 'ax-w'))
r.append(poly_ax([(ox + CX0, oz + 4.44, TOP), (ox + CX1, oz + 4.44, TOP), (ox + CX1, oz + 4.44, TOP + 2.9), (ox + CX0, oz + 4.44, TOP + 2.9)], 'ax-s'))
r.append(poly_ax([(ox + CX0, oz + 4.44, TOP + 2.9), (ox + CX1, oz + 4.44, TOP + 2.9), (ox + CX1, oz + 9.52, TOP + 2.9), (ox + CX0, oz + 9.52, TOP + 2.9)], 'ax-top'))
r.append(poly_ax([(ox + 0.8, oz + 0.8, TOP + 2.6), (ox + 8.4, oz + 0.8, TOP + 2.6), (ox + 8.4, oz + 6.0, TOP + 2.6), (ox + 0.8, oz + 6.0, TOP + 2.6)], 'ax-perg'))
r.append('</g>'); ax.append(''.join(r))
# cotas y rótulos
hx, hy = ISO(ox, oz + PD + 2.6, 0); tx, ty = ISO(ox, oz + PD + 2.6, TOP)
ax.append(f'<g class="ax-dim"><path d="M{hx:.1f} {hy:.1f}V{ty:.1f}M{hx-5:.1f} {hy:.1f}h10M{tx-5:.1f} {ty:.1f}h10"/>'
          f'<text x="{hx-10:.1f}" y="{(hy+ty)/2:.1f}" text-anchor="end">{es(TOP)} m</text><text x="{hx-10:.1f}" y="{(hy+ty)/2+15:.1f}" text-anchor="end" class="ax-sm">{NF} pisos</text>')
cx_, cy_ = ISO((x0 + x1) / 2, z0 - 2.4, 0)
ax.append(f'<text class="ax-st" transform="translate({cx_:.1f} {cy_:.1f}) rotate(-30)" text-anchor="middle">Calle 56</text>')
cx_, cy_ = ISO(x0 - 2.4, (z0 + z1) / 2, 0)
ax.append(f'<text class="ax-st" transform="translate({cx_:.1f} {cy_:.1f}) rotate(30)" text-anchor="middle">Carrera 18</text></g>')
X0 = min(a for a, b in axp) - 90; X1 = max(a for a, b in axp) + 40; Y0 = min(b for a, b in axp) - 30; Y1 = max(b for a, b in axp) + 40
axo_svg = (f'<svg class="ax-svg" viewBox="{X0:.0f} {Y0:.0f} {X1-X0:.0f} {Y1-Y0:.0f}" role="img" aria-label="Axonometría de la cabida: lote esquinero con antejardines y el volumen de {NF} pisos">' + ''.join(ax) + '</svg>')

lote, huella = pa['loteM2'], pa['plantaM2']
constr = huella * NF
vend = sum(t['area'] for t in pa['tipologias']) * (pa['unidades'] / len(pa['tipologias']))
ventas = sum(2 * t['area'] * (pa['precioM2Base'] + (f - 2) * pa['diferencialPiso']) for f in range(2, NF + 1) for t in pa['tipologias'])
comunal = constr / 80 * 10
num = lambda v, d, suf='', pre='': f'<dt data-num="{v:.4f}" data-dec="{d}" data-pre="{pre}" data-suf="{suf}">{pre}{es(v, d)}{suf}</dt>'
cab_rows = [
    (num(lote, 2, ' m²'), 'Lote', 'Lote esquinero, englobe de cinco predios (Catastro Bogotá)'),
    (num(huella, 2, ' m²'), 'Huella del edificio', f'{es(PW)} × {es(PD)} m, con punto fijo de {es(pa["puntoFijoM2"])} m²'),
    (num(huella / lote, 2), 'Índice de ocupación', f'El {round(huella/lote*100)} % del lote; el resto es antejardín y jardín'),
    (num(constr, 2, ' m²'), 'Área construida', f'{NF} pisos de {es(huella)} m²'),
    (num(constr / lote, 2), 'Índice de construcción', 'Área construida sobre área del lote'),
    (num(NF * FH, 2, ' m'), 'Altura', f'{NF} pisos de {es(FH)} m, más la terraza'),
    (num(46, 0), 'Parqueaderos', '2 sótanos de 23 cupos bajo todo el lote, con rampa sobre la Calle 56'),
    (num(pa['unidades'], 0), 'Apartamentos', '4 por piso en los pisos 2 a 6: 10 tipo A y 10 tipo B'),
    (num(vend, 2, ' m²'), 'Área vendible', f'10 × {es(pa["tipologias"][0]["area"])} m² + 10 × {es(pa["tipologias"][1]["area"])} m²'),
    (num(ventas / 1e6, 0, ' M', '$'), 'Ventas estimadas', 'Los 20 apartamentos a precio de lista por piso, en millones de pesos'),
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
            <li><button type="button" data-l="s"><b>Sótanos 1 y 2</b><span>46 parqueaderos, 23 por sótano, bajo todo el lote. La rampa entra por la Calle 56 y deja libres los antejardines.</span></button></li>
          </ol>
        </div>
        <figure class="corte-fig"><div class="cx-img"><img src="./assets/renders/corte-axo.webp" alt="Corte axonométrico renderizado del edificio: dos sótanos, primer piso con zonas comunes, cinco pisos de apartamentos amoblados y la terraza" loading="lazy" width="2200" height="1416" /><svg class="cx-ov" viewBox="0 0 100 64.36" preserveAspectRatio="none" aria-hidden="false"><polygon class="cx-floor" data-l="s" data-i="0" tabindex="0" aria-label="Sótano 2" points="20.67,53.58 65.15,62.45 65.15,57.24 20.67,48.38"/><polygon class="cx-floor" data-l="s" data-i="1" tabindex="0" aria-label="Sótano 1" points="20.67,48.38 65.15,57.24 65.15,52.03 20.67,43.16"/><polygon class="cx-floor" data-l="p1" data-i="2" tabindex="0" aria-label="Piso 1" points="20.67,43.16 65.15,52.03 65.15,46.82 20.67,37.96"/><polygon class="cx-floor" data-l="apt" data-i="3" tabindex="0" aria-label="Piso 2" points="20.67,37.96 65.15,46.82 65.15,41.60 20.67,32.75"/><polygon class="cx-floor" data-l="apt" data-i="4" tabindex="0" aria-label="Piso 3" points="20.67,32.75 65.15,41.60 65.15,36.40 20.67,27.54"/><polygon class="cx-floor" data-l="apt" data-i="5" tabindex="0" aria-label="Piso 4" points="20.67,27.54 65.15,36.40 65.15,31.20 20.67,22.33"/><polygon class="cx-floor" data-l="apt" data-i="6" tabindex="0" aria-label="Piso 5" points="20.67,22.33 65.15,31.20 65.15,25.98 20.67,17.12"/><polygon class="cx-floor" data-l="apt" data-i="7" tabindex="0" aria-label="Piso 6" points="20.67,17.12 65.15,25.98 65.15,20.78 20.67,11.92"/><polygon class="cx-floor" data-l="t" data-i="8" tabindex="0" aria-label="Terraza" points="20.67,11.92 65.15,20.78 65.15,15.74 20.67,6.87"/></svg></div><figcaption>Pasa por cada nivel para resaltarlo. Corte a lo largo de la Calle 56, modelo de Revit del proyecto.</figcaption></figure>
      </div>
    </section>
'''
blocks['cabida'] = f'''
    <section class="sec cabida dark" id="cabida" aria-labelledby="cabida-h">
      <div class="wrap">
        <div class="cabida-head">
          <p class="hero-kicker" data-reveal>Cabida arquitectónica</p>
          <h2 id="cabida-h" data-reveal>Cuánto cabe en el lote</h2>
          <p class="cabida-lead">Lote esquinero de {es(lote)} m² en la Calle 56 con Carrera 18. El volumen se retira {es(ant)} m de las dos calles para los antejardines y deja un jardín en el patio.</p>
          <p class="eco-note"><svg class="eco-leaf" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19l8-8"/></svg>Solo el {round(huella/lote*100)} % del lote se ocupa: el resto queda para antejardines sembrados, árboles y el jardín del patio.</p>
        </div>
        <div class="cabida-vis">
          <figure class="cabida-axo"><div class="cb-img"><img src="./assets/renders/cabida-axo.webp" alt="Axonometría renderizada de la cabida: edificio de 6 pisos sobre el lote esquinero con antejardines arborizados y dos sótanos de parqueaderos a la vista" loading="lazy" width="2000" height="1493" /><span class="lbl lbl-st" style="left:39.56%;top:78.32%">Calle 56</span><span class="lbl lbl-st" style="left:80.13%;top:74.02%">Carrera 18</span><span class="lbl lbl-s lbl-r" style="left:63.5%;top:89.1%">Sótano 1 · 23 parqueaderos</span><span class="lbl lbl-s lbl-r" style="left:63.5%;top:96.23%">Sótano 2 · 23 parqueaderos</span><span class="cb-h" style="left:21.77%;top:23.58%;height:42.78%"><em>18,6 m · 6 pisos</em></span><span class="lbl lbl-s" style="left:49.42%;top:15.58%">Terraza</span></div><figcaption>Axonometría · {NF} pisos y 2 sótanos sobre el lote</figcaption></figure>
          <figure class="cabida-fig"><div class="cb-img"><img src="./assets/renders/cabida-planta.webp" alt="Planta renderizada del piso tipo sobre el lote, con la misma orientación de la axonometría" loading="lazy" width="1600" height="1467" /><span class="lbl lbl-a" style="left:60.95%;top:70.32%"><b>A</b></span><span class="lbl lbl-a" style="left:31.86%;top:55.52%"><b>A</b></span><span class="lbl lbl-b" style="left:68.35%;top:53.03%"><b>B</b></span><span class="lbl lbl-b" style="left:39.26%;top:38.23%"><b>B</b></span><span class="lbl lbl-s" style="left:50.0%;top:54.52%">Punto fijo</span><span class="lbl lbl-st" style="left:37.85%;top:82.94%">Calle 56</span><span class="lbl lbl-st" style="left:88.34%;top:74.02%">Carrera 18</span></div>
            <figcaption>Planta del piso tipo, vista con la misma orientación de la axonometría</figcaption>
          </figure>
        </div>
        <dl class="cabida-dl">{cab_dl}</dl>
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
          <p data-reveal>Calle 56 con Carrera 18, frente a la Parroquia Divino Salvador. Toca un lugar de la lista para verlo en el mapa, con la línea desde el edificio.</p>
        </div>
        <div class="cerca-grid">
          <div class="cerca-map">
            <div class="map" id="map" role="region" aria-label="Mapa de Galerías con Distrito Arboleda y los lugares cercanos"></div>
            <div class="map-modes" role="group" aria-label="Tipo de mapa"><button type="button" data-base="calles" aria-pressed="true">Calles</button><button type="button" data-base="satelite" aria-pressed="false">Satélite</button></div>
          </div>
          <ol class="nr-list">{near_li}</ol>
        </div>
        <p class="cerca-note">Distancias en línea recta desde el lote. Los minutos son aproximados: recorrido 30 % más largo que la línea recta, a 80 m por minuto a pie y 250 m por minuto en bicicleta. Además pasan rutas del SITP por las calles 53, 57 y 63 y las carreras 13 y 24.</p>
      </div>
      <script>window.CERCA = {near_js};</script>
    </section>
'''
blocks['firma'] = f'''
    <section class="sec firma dark" id="firma" aria-labelledby="firma-h">
      <div class="wrap">
        <p class="hero-kicker" data-reveal>La firma</p>
        <h2 class="firma-name" id="firma-h" aria-label="JMC Arquitectura"><span aria-hidden="true" data-split>JMC</span> <span aria-hidden="true" data-split>Arquitectura</span></h2>
        <p class="firma-lead wh2" data-wh2>Somos un estudio de Bogotá que diseña vivienda sostenible para jóvenes en barrios que ya existen. Diseñamos edificios con luz y aire naturales, más verde en la calle y todo a pocos minutos a pie o en bicicleta.</p>
        <div class="mv">
          <article class="mv-col">
            <svg class="mv-ico" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="3"/><path d="M24 5v6M24 37v6M5 24h6M37 24h6"/></svg><p class="mv-k">Misión</p>
            <p class="mv-t">Diseñar vivienda sostenible y asequible para jóvenes en barrios consolidados de Bogotá: con luz y ventilación naturales, materiales locales, más árboles en la calle y a pocos minutos del transporte público.</p>
          </article>
          <div class="mv-rule" aria-hidden="true"></div>
          <article class="mv-col">
            <svg class="mv-ico" viewBox="0 0 48 48" aria-hidden="true"><path d="M4 24s8-13 20-13 20 13 20 13-8 13-20 13S4 24 4 24z"/><circle cx="24" cy="24" r="6"/><path d="M24 4v3M38 9l-2 2M10 9l2 2"/></svg><p class="mv-k">Visión</p>
            <p class="mv-t">Ser en 2035 el estudio de referencia en Bogotá para vivienda joven y sostenible, demostrando que densificar con cuidado un barrio tradicional lo hace más verde, más caminable y más vivo.</p>
          </article>
        </div>
        <ul class="firma-vals">
          <li><svg class="mv-ico sm" viewBox="0 0 48 48" aria-hidden="true"><path d="M8 38c0-16 10-26 30-28-2 20-12 30-28 28"/><path d="M8 38l16-16"/></svg><b>Sostenibilidad</b><span>Primero lo pasivo: sombra, luz y ventilación natural antes que máquinas. Menos energía, menos costo para quien vive.</span></li>
          <li><svg class="mv-ico sm" viewBox="0 0 48 48" aria-hidden="true"><circle cx="17" cy="16" r="6"/><circle cx="32" cy="18" r="5"/><path d="M6 38c1-7 6-11 11-11s10 4 11 11M27 38c1-6 3-9 6-9s7 3 8 9"/></svg><b>Para jóvenes</b><span>Apartamentos compactos y flexibles, con espacios comunes que reemplazan lo que no cabe en casa: terraza, cine, gimnasio.</span></li>
          <li><svg class="mv-ico sm" viewBox="0 0 48 48" aria-hidden="true"><path d="M6 40V20l10-8 10 8v20M26 40V14h16v26M4 40h40"/><path d="M12 28h8M31 21h6M31 28h6M31 34h6"/></svg><b>El barrio primero</b><span>Antejardines sembrados, primeros pisos abiertos y bicicletas antes que carros.</span></li>
        </ul>
        <div class="ficha">
          <div class="ficha-head"><p class="mv-k">Ficha técnica</p><h3>JMC Arquitectura S.A.S.</h3></div>
          <dl class="ficha-kpi">
            <div><dt>S.A.S.</dt><dd>Forma jurídica</dd></div>
            <div><dt data-count="3">3</dt><dd>Socios fundadores</dd></div>
            <div><dt>4111</dt><dd>Código CIIU principal</dd></div>
            <div><dt>Bogotá D.C.</dt><dd>Domicilio</dd></div>
          </dl>
          <dl class="ficha-rows">
            <div><dt>Razón social</dt><dd>JMC Arquitectura S.A.S.</dd></div>
            <div><dt>Representante legal</dt><dd>Jorge Andrés Mojica Bestene</dd></div>
            <div><dt>Actividad principal</dt><dd>Construcción de edificios residenciales (CIIU 4111)</dd></div>
          </dl>
        </div>
        <div class="org" aria-labelledby="org-h">
          <p class="mv-k" id="org-h">Estructura organizacional</p>
          <div class="org-chart">
            <div class="org-top"><span>Junta de Socios</span></div>
            <div class="org-mid"><span>Gerencia General</span></div>
            <ul class="org-areas">
              <li><b>Área Comercial</b><span>Ventas y mercadeo de los proyectos</span><em>Ana Sofía Casas</em></li>
              <li><b>Área Técnica</b><span>Diseño y construcción</span><em>Martín Jaramillo V.</em></li>
              <li><b>Área Administrativa y Financiera</b><span>Contabilidad, finanzas y recursos humanos</span><em>Jorge Andrés Mojica</em></li>
            </ul>
          </div>
          <p class="org-note">Cada socio lidera un área según su perfil profesional.</p>
        </div>
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
