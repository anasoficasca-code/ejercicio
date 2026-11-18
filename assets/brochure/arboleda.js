/* Distrito Arboleda · animaciones e interacciones del brochure (GSAP + ScrollTrigger, Leaflet para el mapa).
 *  · entrada: el nombre, una línea que crece y el telón que sube sobre la portada
 *  · portada: el título sube por líneas y la foto se acerca y se mueve más lento que el scroll
 *  · la frase se ilumina palabra por palabra y las cifras cuentan
 *  · un día en el edificio: tira horizontal fijada al scroll con reloj
 *  · la ventana del recorrido 3D se abre al bajar
 * Con "reducir movimiento" todo queda quieto y legible. */

// Contacto de la sala de ventas. Con whatsapp (indicativo y número, sin espacios) el formulario abre
// WhatsApp; si no, abre el correo de la persona dirigido a `correo`.
const CONTACTO = { correo: '', whatsapp: '' };

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const g = window.gsap, ST = window.ScrollTrigger;
const motion = !!(g && ST) && !reduce;
if (motion) g.registerPlugin(ST);

// ------------------------------------------------------------------ entrada
// el nombre de la portada se parte en letras para que entren una por una
document.querySelectorAll('[data-split]').forEach((el) => {
  el.innerHTML = [...el.textContent].map((c) => `<span class="ch">${c}</span>`).join('');
});
const preloader = document.querySelector('.preloader');
function intro() {
  if (!document.body.classList.contains('is-loading')) return;
  document.body.classList.remove('is-loading');
  if (!motion) return;
  g.timeline()
    .fromTo('.hero-media img', { scale: 1.08, opacity: 0 }, { scale: 1, opacity: 1, duration: 2.2, ease: 'power2.out' }, 0)
    .from('.ht-word .ch', { yPercent: 110, opacity: 0, duration: 1.1, stagger: 0.035, ease: 'expo.out' }, 0.35)
    .from('.hero-kicker, .hero-fact, .hero .actions, .nav', { opacity: 0, y: 16, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, 0.8);
}
if (document.readyState === 'complete') intro(); else addEventListener('load', intro);
// si la portada tarda, la entrada no espera más de 3 s
setTimeout(() => { if (document.body.classList.contains('is-loading')) intro(); }, 3000);

// ------------------------------------------------------------------ navegación: sólida al bajar, se esconde al seguir bajando
const nav = document.getElementById('nav');
let lastY = 0;
addEventListener('scroll', () => {
  const y = scrollY;
  nav.classList.toggle('solid', y > innerHeight * 0.75);
  nav.classList.toggle('hide', y > innerHeight && y > lastY + 4);
  if (y < lastY - 4) nav.classList.remove('hide');
  lastY = y;
}, { passive: true });

// ------------------------------------------------------------------ la frase se ilumina palabra por palabra
const wh = document.querySelector('[data-wh]');
const words = [];
(function split(node) {
  [...node.childNodes].forEach((n) => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((t) => {
        if (!t) return;
        if (/^\s+$/.test(t)) { frag.append(t); return; }
        const s = document.createElement('span');
        s.className = 'w';
        s.textContent = t;
        words.push(s);
        frag.append(s);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1) split(n);
  });
})(wh);

if (motion) {
  ST.create({
    trigger: wh, start: 'top 80%', end: 'bottom 45%', scrub: true,
    onUpdate: (st) => { const k = Math.round(st.progress * words.length); words.forEach((w, i) => w.classList.toggle('on', i < k)); }
  });

  // cifras: cuentan desde cero al aparecer
  document.querySelectorAll('[data-count]').forEach((el) => {
    const n = { v: 0 }, to = +el.dataset.count;
    g.to(n, { v: to, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' }, onUpdate: () => { el.textContent = Math.round(n.v); } });
  });

  // portada: la foto baja más lento que la página
  g.to('.hero-media img', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  g.to('.hero-copy', { yPercent: -20, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: true } });

  // títulos y párrafos marcados: suben y se aclaran una sola vez
  g.utils.toArray('[data-reveal]:not(h2)').forEach((el) => {
    g.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  // interiores: la foto se asienta desde un leve zoom al entrar (transición en CSS)
  g.utils.toArray('.inside-hero, .inside-pic').forEach((el) => {
    window.ScrollTrigger?.create({ trigger: el, start: 'top 80%', once: true, onEnter: () => el.classList.add('is-in') });
  });

  // fotos: se descubren de abajo hacia arriba y se asientan desde un leve zoom; luego un parallax suave
  g.utils.toArray('.pic').forEach((pic) => {
    const img = pic.querySelector('img');
    g.from(pic, { opacity: 0, y: 30, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: pic, start: 'top 88%' } });
    const amt = +(pic.dataset.parallax || 6);
    g.fromTo(img, { yPercent: -amt }, { yPercent: amt, ease: 'none', scrollTrigger: { trigger: pic, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // vivir aquí: las tarjetas entran escalonadas y la foto se asienta desde un leve zoom
  g.utils.toArray('.vv').forEach((v, i) => {
    g.from(v, { y: 50, opacity: 0, duration: 1.1, delay: (i % 2) * 0.12, ease: 'expo.out', scrollTrigger: { trigger: v, start: 'top 88%' } });
    g.fromTo(v.querySelector('img'), { scale: 1.08 }, { scale: 1, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: v, start: 'top 88%' } });
  });



  // botones magnéticos: siguen un poco al puntero
  if (matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        g.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4, ease: 'power3.out' });
      });
      b.addEventListener('pointerleave', () => g.to(b, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' }));
    });
  }
} else {
  words.forEach((w) => w.classList.add('on'));
}

// ------------------------------------------------------------------ sube por el edificio
// La sección queda fija y el scroll recorre del lobby a la terraza: cambia la foto, el texto y el piso
// del contador (como un ascensor). Sin GSAP o con "reducir movimiento" se ven todos los textos en orden.
const lift = document.querySelector('.lift');
if (lift) {
  const shots = [...lift.querySelectorAll('.lift-shot')], steps = [...lift.querySelectorAll('.lift-step')];
  const rail = [...lift.querySelectorAll('.lift-rail li')], num = lift.querySelector('.ll-num'), label = lift.querySelector('.ll-label');
  const levelOf = (i) => steps[i].dataset.level;
  const numOf = (l) => (l === 'T' ? 7 : +l);
  let cur = 0, shown = 1;
  const setLevel = (l) => {
    label.textContent = l === 'T' ? 'Cubierta' : 'Piso';
    rail.forEach((li) => li.classList.toggle('on', li.dataset.l === l));
    const to = numOf(l), o = { v: shown };
    // el contador sube piso a piso y en la cubierta termina en una T
    const write = (v) => { num.textContent = Math.round(v) >= 7 ? 'T' : String(Math.round(v)).padStart(2, '0'); };
    if (motion) g.to(o, { v: to, duration: 0.8, ease: 'power2.out', onUpdate: () => write(o.v) }); else write(to);
    shown = to;
  };
  const show = (i) => {
    if (i === cur) return;
    const prev = cur;
    cur = i;
    shots.forEach((s, k) => s.classList.toggle('on', k === i));
    steps.forEach((s, k) => s.classList.toggle('on', k === i));
    if (motion) {
      g.to(shots[prev], { opacity: 0, duration: 0.9, ease: 'power2.inOut', overwrite: true });
      g.fromTo(shots[i], { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.inOut', overwrite: true });
      if (!shots[i].classList.contains('contain')) g.fromTo(shots[i].querySelector('img'), { scale: 1.06 }, { scale: 1, duration: 2.6, ease: 'expo.out' });
      g.fromTo(steps[i].children, { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.07, ease: 'expo.out', overwrite: true });
    }
    setLevel(levelOf(i));
    // la maqueta 3D (section3d.js) corta el edificio en el piso de este paso
    window.__liftStep = i;
    dispatchEvent(new CustomEvent('lift:step', { detail: { index: i } }));
  };
  if (motion) {
    ST.create({
      trigger: lift, pin: '.lift-pin', start: 'top top', end: () => `+=${innerHeight * (steps.length - 1) * 0.85}`,
      refreshPriority: 1,   // va antes que "Un día en el edificio" en la página: se calcula primero
      invalidateOnRefresh: true,
      onUpdate: (st) => show(Math.min(steps.length - 1, Math.floor(st.progress * steps.length)))
    });
  } else {
    lift.classList.add('static');
  }
}

// ------------------------------------------------------------------ masterplan al final, a pantalla completa
// El 3D pesa varios MB: se descarga cuando la persona se acerca al final. Se ve detrás del texto; con
// "Explorar" se puede girar y entrar (la rueda mueve la cámara); "Volver al brochure" o Esc lo sueltan.
const mpSec = document.getElementById('recorrido');
if (mpSec) {
  const frame = mpSec.querySelector('.mp-frame');
  const load = () => {
    if (frame.getAttribute('src')) return;
    frame.src = frame.dataset.src;
    frame.addEventListener('load', () => { preview(!mpSec.classList.contains('is-live')); setTimeout(() => mpSec.classList.add('is-ready'), 2500); }, { once: true });
  };
  // vista previa: el masterplan sin paneles y girando despacio; al explorar vuelven los controles
  const preview = (on) => {
    try {
      const d = frame.contentDocument, w = frame.contentWindow;
      d?.body.classList.toggle('is-preview', on);
      const c = w?.__masterplan?.controls;
      if (c) { c.autoRotate = on; c.autoRotateSpeed = 0.35; }
      if (on && !w?.__masterplan?.controls) setTimeout(() => preview(!mpSec.classList.contains('is-live')), 1500);
    } catch (e) { /* otro origen */ }
  };
  new IntersectionObserver(([e]) => { if (e.isIntersecting) load(); }, { rootMargin: '150% 0px' }).observe(mpSec);
  const exit = () => { preview(true); mpSec.classList.remove('is-live'); document.body.classList.remove('tour-open'); frame.tabIndex = -1; document.getElementById('tour-enter').focus(); };
  document.getElementById('tour-enter').addEventListener('click', () => {
    load();
    mpSec.scrollIntoView({ block: 'start' });
    preview(false);
    mpSec.classList.add('is-live'); document.body.classList.add('tour-open'); frame.tabIndex = 0;
    setTimeout(() => frame.focus(), 300);
  });
  document.getElementById('tour-exit').addEventListener('click', exit);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && mpSec.classList.contains('is-live')) exit(); });
  if (motion) g.from('.mp-copy > *', { y: 30, opacity: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: mpSec, start: 'top 55%' } });
}

// ------------------------------------------------------------------ tipologías: la pastilla azul se desliza a la pestaña elegida
const tabs = [...document.querySelectorAll('.tab')];
const ink = document.querySelector('.tab-ink');
function placeInk(t) { ink.style.width = `${t.offsetWidth}px`; ink.style.transform = `translateX(${t.offsetLeft - 5}px)`; }
function selectTab(t) {
  tabs.forEach((x) => {
    const on = x === t;
    x.classList.toggle('is-on', on);
    x.setAttribute('aria-selected', on);
    x.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(x.getAttribute('aria-controls'));
    panel.hidden = !on;
    if (on) document.querySelector('.plan-r')?.classList.toggle('show-b', x.id === 'tab-b');
    if (on && motion) {
      g.from(panel.querySelectorAll('.apt-where, .price, tr'), { y: 14, opacity: 0, duration: 0.6, stagger: 0.04, ease: 'power3.out' });
      // el precio cuenta hasta su valor
      const p = panel.querySelector('[data-price]'), to = +p.dataset.price, n = { v: to * 0.7 };
      g.to(n, { v: to, duration: 1, ease: 'power3.out', onUpdate: () => { p.textContent = '$' + (Math.round(n.v / 1e5) * 1e5).toLocaleString('es-CO'); }, onComplete: () => { p.textContent = '$' + to.toLocaleString('es-CO'); } });
    }
  });
  placeInk(t);
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    n.focus(); selectTab(n);
  });
});
placeInk(tabs[0]);
addEventListener('resize', () => placeInk(tabs.find((t) => t.classList.contains('is-on'))));
document.fonts?.ready.then(() => placeInk(tabs.find((t) => t.classList.contains('is-on'))));

// planta: clic para acercar donde se señala, otro clic para alejar
const plan = document.querySelector('[data-zoom]');
plan.addEventListener('click', (e) => {
  const r = plan.getBoundingClientRect();
  plan.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`);
  plan.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`);
  plan.classList.toggle('zoomed');
});

// ------------------------------------------------------------------ zonas: al señalar un nombre cambia la foto
const zoneBtns = [...document.querySelectorAll('.zone-list button')];
const zonePics = [...document.querySelectorAll('.zpic')];
const showZone = (i) => {
  zonePics.forEach((p) => p.classList.toggle('on', +p.dataset.z === i));
  zoneBtns.forEach((b) => b.classList.toggle('on', +b.dataset.z === i));
};
zoneBtns.forEach((b) => {
  const i = +b.dataset.z;
  b.addEventListener('mouseenter', () => showZone(i));
  b.addEventListener('focus', () => showZone(i));
  b.addEventListener('click', () => showZone(i));
});
showZone(0);

// ------------------------------------------------------------------ mapa real con los lugares cercanos
const LAT = 4.6438909, LNG = -74.0692778;
if (window.L && document.getElementById('map')) {
  const map = L.map('map', { scrollWheelZoom: false, zoomSnap: 0.25 }).setView([LAT, LNG], 15);
  const bases = {
    calles: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }),
    satelite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19,
      attribution: 'Imagen: Esri, Maxar, Earthstar Geographics' })
  };
  bases.calles.addTo(map);
  document.querySelectorAll('.map-modes button').forEach((b) => b.addEventListener('click', () => {
    Object.values(bases).forEach((l) => map.removeLayer(l));
    bases[b.dataset.base].addTo(map);
    document.querySelectorAll('.map-modes button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  // anillos de 400 m, 800 m y 1,2 km
  [400, 800, 1200].forEach((r) => L.circle([LAT, LNG], { radius: r, color: '#1b2c45', weight: 1.2, fill: r === 400, fillColor: '#1b2c45', fillOpacity: 0.07, dashArray: '4 7', interactive: false }).addTo(map));
  L.marker([LAT, LNG], { title: 'Distrito Arboleda', zIndexOffset: 1000, icon: L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }) })
    .addTo(map).bindTooltip('Distrito Arboleda', { permanent: true, direction: 'top', offset: [0, -12], className: 'tip-me' });
  const C = window.CERCA || [];
  const dist = (c) => (c.d >= 1000 ? (c.d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(c.d / 10) * 10 + ' m');
  const marks = C.map((c, i) => L.marker(c.ll, { title: c.n, icon: L.divIcon({ className: 'pin-wrap', html: `<div class="pin-n">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) })
    .addTo(map).bindTooltip(`<b>${c.n}</b><br>${dist(c)}`, { direction: 'top', offset: [0, -12] }));
  const home = () => L.latLngBounds(C.filter((c) => c.d < 1300).map((c) => c.ll)).extend([LAT, LNG]).pad(0.1);
  if (C.length) map.fitBounds(home());
  const line = L.polyline([], { color: '#1b2c45', weight: 3, dashArray: '2 9', lineCap: 'round', className: 'route' }).addTo(map);
  window.__cercaMap = { map, marks, line, home, me: [LAT, LNG] };
} else if (document.getElementById('map')) {
  document.getElementById('map').innerHTML = '<p style="padding:24px">Calle 56 con Carrera 18, Galerías, Bogotá.</p>';
}

// ------------------------------------------------------------------ formulario: cada error bajo su campo
const form = document.getElementById('form');
const msg = document.getElementById('form-msg');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(form));
  const errs = { nombre: !d.nombre.trim() && 'Escribe tu nombre.', cel: !/^[\d\s+()-]{7,}$/.test(d.celular.trim()) && 'Escribe un celular de al menos 7 dígitos.' };
  document.getElementById('e-nombre').textContent = errs.nombre || '';
  document.getElementById('e-cel').textContent = errs.cel || '';
  form.querySelector('#f-nombre').setAttribute('aria-invalid', !!errs.nombre);
  form.querySelector('#f-cel').setAttribute('aria-invalid', !!errs.cel);
  if (errs.nombre || errs.cel) { form.querySelector(errs.nombre ? '#f-nombre' : '#f-cel').focus(); msg.textContent = ''; return; }
  const texto = `Hola, quiero agendar una visita a Distrito Arboleda.\nNombre: ${d.nombre}\nCelular: ${d.celular}\nTipo de apartamento: ${d.tipo}`;
  if (CONTACTO.whatsapp) {
    window.open(`https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    msg.textContent = 'Abrimos WhatsApp con tu mensaje listo. Solo falta enviarlo.';
  } else {
    location.href = `mailto:${CONTACTO.correo}?subject=${encodeURIComponent('Visita a Distrito Arboleda')}&body=${encodeURIComponent(texto)}`;
    msg.textContent = 'Abrimos tu correo con el mensaje listo. Solo falta enviarlo.';
  }
});

// ================================================================== secciones nuevas
// barra de avance de lectura
const prog = document.querySelector('.progress i');
if (prog && motion) g.to(prog, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

// cifras con decimales (cabida): cuentan hasta su valor con formato colombiano
const fmt = (v, d) => v.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
if (motion) document.querySelectorAll('[data-num]').forEach((el) => {
  const to = +el.dataset.num, d = +el.dataset.dec, pre = el.dataset.pre || '', suf = el.dataset.suf || '', n = { v: 0 };
  g.to(n, { v: to, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' },
    onUpdate: () => { el.textContent = pre + fmt(n.v, d) + suf; }, onComplete: () => { el.textContent = pre + fmt(to, d) + suf; } });
});

// ------------------------------------------------------------------ corte: cada nivel se enciende con su texto
const corte = document.querySelector('.corte');
if (corte) {
  const floors = [...corte.querySelectorAll('.cx-floor')], items = [...corte.querySelectorAll('.cx-list button')];
  let auto = null;
  const pick = (key, idx) => {
    floors.forEach((f) => f.classList.toggle('on', idx != null ? +f.dataset.i === idx : f.dataset.l === key));
    items.forEach((b) => b.classList.toggle('on', b.dataset.l === key));
  };
  const stop = () => { auto?.kill(); auto = null; };
  floors.forEach((f) => {
    const on = () => { stop(); pick(f.dataset.l, +f.dataset.i); };
    f.addEventListener('pointerenter', on); f.addEventListener('focus', on); f.addEventListener('click', on);
  });
  items.forEach((b) => {
    const on = () => { stop(); pick(b.dataset.l); };
    b.addEventListener('pointerenter', on); b.addEventListener('focus', on); b.addEventListener('click', on);
  });
  pick('p1', 0);
  if (motion) {
    // el edificio se levanta piso por piso, luego aparecen cotas y árboles; después un "ascensor" recorre los niveles
    const tl = g.timeline({ scrollTrigger: { trigger: '.corte-fig', start: 'top 72%' } });
    tl.from('.cx-site > *', { opacity: 0, duration: 0.6, stagger: 0.05 })
      .from(floors, { y: -70, opacity: 0, duration: 0.75, stagger: 0.13, ease: 'back.out(1.3)' }, 0.2)
      .from('.cx-dim > *', { opacity: 0, x: 12, duration: 0.5, stagger: 0.03 }, '-=0.3')
      .add(() => {
        const o = { i: 0 };
        auto = g.to(o, { i: floors.length - 1, duration: 4.2, ease: 'none', repeat: 1, yoyo: true, onUpdate: () => { const f = floors[Math.round(o.i)]; pick(f.dataset.l, +f.dataset.i); } });
      });
  }
}

// ------------------------------------------------------------------ cabida: se traza el lote y se asienta la huella
if (motion && document.querySelector('.cabida')) {
  const tl = g.timeline({ scrollTrigger: { trigger: '.cabida-fig', start: 'top 75%' } });
  tl.from('.cb-lot', { strokeDashoffset: 1, duration: 1.8, ease: 'power2.inOut' })
    .from('.cb-ant', { opacity: 0, duration: 0.7 }, 0.9)
    .from('.cb-foot', { scale: 0, duration: 1.1, ease: 'expo.out' }, 1.2)
    .from('.cb-core, .cb-split, .cb-u, .cb-s, .cb-st, .cb-north', { opacity: 0, duration: 0.5, stagger: 0.05 }, 1.7)
    .from('.cb-dim > *', { opacity: 0, duration: 0.5, stagger: 0.06 }, 2.0);
  g.from('.cb-row', { y: 26, opacity: 0, duration: 0.8, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: '.cabida-dl', start: 'top 82%' } });
}

// ------------------------------------------------------------------ qué hay cerca: la lista mueve el mapa real
const cerca = document.querySelector('.cerca');
if (cerca) {
  const rows = [...cerca.querySelectorAll('.nr-list button')];
  const sel = (i, fly) => {
    rows.forEach((r) => r.classList.toggle('on', +r.dataset.i === i));
    const m = window.__cercaMap;
    if (!m) return;
    m.marks.forEach((k, j) => k.getElement()?.classList.toggle('on', j === i));
    const to = m.marks[i].getLatLng();
    m.line.setLatLngs([m.me, to]);
    m.marks[i].openTooltip();
    if (fly) m.map.flyToBounds(L.latLngBounds([m.me, to]).pad(0.35), { duration: reduce ? 0 : 1.1, maxZoom: 17 });
  };
  rows.forEach((el) => {
    const i = +el.dataset.i;
    el.addEventListener('pointerenter', () => sel(i));
    el.addEventListener('focus', () => sel(i));
    el.addEventListener('click', () => sel(i, true));
  });
  window.__cercaMap?.marks.forEach((k, i) => k.on('click', () => sel(i, true)));
  if (motion) {
    // al llegar: los marcadores caen uno por uno sobre el mapa y entra la lista
    ST.create({ trigger: '.cerca-grid', start: 'top 70%', once: true, onEnter: () => {
      window.__cercaMap?.map.invalidateSize();
      const pins = [...cerca.querySelectorAll('.pin-n')];
      g.from(pins, { y: -46, opacity: 0, scale: 0.4, duration: 0.7, stagger: 0.09, ease: 'bounce.out', clearProps: 'transform,opacity' });
      g.from(rows, { x: 30, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'expo.out' });
    } });
  }
}

// ------------------------------------------------------------------ la firma
const firma = document.querySelector('.firma');
if (firma) {
  // el párrafo se ilumina palabra por palabra al bajar
  const lead = firma.querySelector('[data-wh2]'), ws = [];
  lead.innerHTML = lead.textContent.trim().split(/\s+/).map((t) => `<span class="w">${t}</span>`).join(' ');
  lead.querySelectorAll('.w').forEach((w) => ws.push(w));
  const cards = [...firma.querySelectorAll('.fcard')];
  if (motion) {
    g.from('.firma-name .ch', { yPercent: 115, rotate: 6, duration: 1.1, stagger: 0.035, ease: 'expo.out', scrollTrigger: { trigger: '.firma-name', start: 'top 82%' } });
    ST.create({ trigger: lead, start: 'top 82%', end: 'bottom 50%', scrub: true, onUpdate: (st) => { const k = Math.round(st.progress * ws.length); ws.forEach((w, i) => w.classList.toggle('on', i < k)); } });
    cards.forEach((c, i) => {
      g.from(c, { y: 90, rotateX: -18, opacity: 0, duration: 1.2, delay: i * 0.14, ease: 'expo.out', scrollTrigger: { trigger: '.firma-cards', start: 'top 80%', onEnter: () => c.classList.add('is-in') } });
      g.to(c.querySelector('.fcard-n'), { yPercent: -30, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: true } });
      // la tarjeta se inclina hacia el puntero y un brillo lo sigue
      if (matchMedia('(pointer: fine)').matches) {
        c.addEventListener('pointermove', (e) => {
          const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          c.style.setProperty('--mx', `${px * 100}%`); c.style.setProperty('--my', `${py * 100}%`);
          g.to(c, { rotateY: (px - 0.5) * 9, rotateX: (0.5 - py) * 7, duration: 0.5, ease: 'power3.out' });
        });
        c.addEventListener('pointerleave', () => g.to(c, { rotateX: 0, rotateY: 0, duration: 0.9, ease: 'elastic.out(1, 0.5)' }));
      }
    });
    g.from('.firma-vals li', { y: 34, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.firma-vals', start: 'top 85%' } });
    g.from('.firma-team', { opacity: 0, letterSpacing: '0.5em', duration: 1.2, ease: 'power2.out', scrollTrigger: { trigger: '.firma-team', start: 'top 92%' } });
  } else { ws.forEach((w) => w.classList.add('on')); cards.forEach((c) => c.classList.add('is-in')); }
}
// las secciones fijadas cambian el alto de la página: se recalculan los disparadores al terminar de cargar
if (motion) addEventListener('load', () => ST.refresh());

// el render aéreo del barrio se descubre al bajar y se mueve más lento que la página
if (motion && document.querySelector('.barrio')) {
  g.fromTo('.barrio-fig', { clipPath: 'inset(12% 8% 12% 8%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: '.barrio', start: 'top 85%', end: 'top 15%', scrub: true } });
  g.fromTo('.barrio-fig img', { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.barrio', start: 'top bottom', end: 'bottom top', scrub: true } });
  g.from('.barrio-copy > *', { y: 36, opacity: 0, duration: 1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.barrio', start: 'top 40%' } });
}

// ================================================================== animación v2 (azul)
// scroll suave (Lenis) sincronizado con ScrollTrigger; se detiene mientras el recorrido 3D está abierto
let lenis = null;
if (motion && window.Lenis && matchMedia('(pointer: fine)').matches) {
  lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 3.2), wheelMultiplier: 0.95 });
  lenis.on('scroll', ST.update);
  g.ticker.add((t) => lenis.raf(t * 1000));
  g.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -10, duration: 1.6 }); }
  }));
  new MutationObserver(() => (document.body.classList.contains('tour-open') ? lenis.stop() : lenis.start()))
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.querySelectorAll('.map, .mp-frame, .corte-fig').forEach((el) => el.setAttribute('data-lenis-prevent', ''));
}

if (motion) {
  // títulos: cada palabra sube desde una máscara, una tras otra
  document.querySelectorAll('h2:not(.wh):not(.sr):not(.firma-name)').forEach((h) => {
    if (h.dataset.words) return;
    h.dataset.words = '1';
    h.removeAttribute('data-reveal');
    h.innerHTML = h.textContent.trim().split(/\s+/).map((w) => `<span class="wm"><span class="wi">${w}</span></span>`).join(' ');
    g.from(h.querySelectorAll('.wi'), { yPercent: 115, duration: 1.1, stagger: 0.05, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%' } });
  });

  // kickers: las letras se separan al entrar
  g.utils.toArray('.hero-kicker').forEach((k) => g.from(k, { letterSpacing: '0.6em', opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: k, start: 'top 92%' } }));


  // cinta: corre sola y acelera / cambia de sentido con el scroll
  const mq = document.querySelector('.mq-track');
  if (mq) {
    mq.style.animation = 'none';
    const loop = g.to(mq, { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });
    let dir = 1;
    ST.create({ onUpdate: (st) => {
      if (st.direction !== dir) dir = st.direction;
      const boost = 1 + Math.min(6, Math.abs(st.getVelocity()) / 400);
      g.to(loop, { timeScale: dir * boost, duration: 0.3, overwrite: true });
      g.to(loop, { timeScale: dir, duration: 1.4, delay: 0.3, ease: 'power2.out' });
    } });
  }

  // portada: el título se abre y se desvanece al bajar
  g.to('.hero-title', { letterSpacing: '0.16em', opacity: 0.15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // cifras de la frase: entran escalonadas
  g.from('.figures > div', { y: 50, opacity: 0, duration: 1, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.figures', start: 'top 88%' } });

  // tarjetas del día y filas de acabados
  g.from('.swatches li', { x: -30, opacity: 0, duration: 0.8, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: '.swatches', start: 'top 85%' } });
  g.from('.zone-list li', { x: -40, opacity: 0, duration: 0.8, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.zone-list', start: 'top 85%' } });
  g.from('.areas tr', { y: 16, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out', scrollTrigger: { trigger: '.apts-grid', start: 'top 80%' } });

}


// ================================================================== v4
// números de sección: cada rótulo lleva su número en orden (01, 02, …)
(() => {
  let n = 0;
  document.querySelectorAll('main section .hero-kicker, footer.closing .hero-kicker, .mp .hero-kicker').forEach((k) => {
    if (k.closest('.hero')) return;
    n++;
    const sp = document.createElement('span'); sp.className = 'kn'; sp.textContent = String(n).padStart(2, '0');
    k.prepend(sp);
  });
})();

if (motion) {
  // portada: al bajar, la foto se enmarca y se aleja (pasa de pantalla completa a lámina)
  g.fromTo('.hero-media', { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(7% 5% 12% 5%)', ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // galería horizontal: la sección queda fija y las fotos corren de lado
  const gal = document.querySelector('.gal');
  if (gal && matchMedia('(min-width: 901px)').matches) {
    const track = gal.querySelector('.gal-track'), items = [...gal.querySelectorAll('.gal-item')];
    const cnt = gal.querySelector('.gal-count b'), bar = gal.querySelector('.gal-bar i');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    g.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: {
      trigger: gal, pin: '.gal-pin', start: 'top top', end: () => `+=${dist() * 1.15}`, scrub: 0.7, invalidateOnRefresh: true,
      onUpdate: (st) => { bar.style.transform = `scaleX(${st.progress})`; cnt.textContent = String(Math.min(items.length, 1 + Math.floor(st.progress * items.length))).padStart(2, '0'); }
    } });
    items.forEach((it) => g.fromTo(it.querySelector('img'), { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: gal, start: 'top top', end: () => `+=${dist() * 1.15}`, scrub: true } }));
  } else if (gal) {
    gal.querySelector('.gal-track').style.cssText = 'overflow-x:auto;scroll-snap-type:x mandatory;width:auto';
    gal.querySelectorAll('.gal-item').forEach((it) => { it.style.scrollSnapAlign = 'start'; it.querySelector('img').style.transform = 'none'; });
  }

  // mosaico de interiores: las piezas entran escalonadas desde un leve zoom
  g.utils.toArray('.bt').forEach((b, i) => {
    g.from(b, { opacity: 0, y: 40, duration: 1.1, delay: i * 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.bento-grid', start: 'top 82%' } });
    g.fromTo(b.querySelector('img'), { scale: 1.14 }, { scale: 1, duration: 1.8, delay: i * 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.bento-grid', start: 'top 82%' } });
  });
  // rótulos numerados: la línea crece al entrar
  g.utils.toArray('.hero-kicker').forEach((k) => g.from(k, { opacity: 0, x: -20, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: k, start: 'top 92%' } }));
  addEventListener('load', () => ST.refresh());
}
