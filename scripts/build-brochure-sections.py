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
        <figure class="corte-fig">{corte_svg}<figcaption>Pasa por cada nivel para resaltarlo. Escalera y ascensor en el punto fijo; balcones con jardinera sobre la Carrera 18.</figcaption></figure>
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
