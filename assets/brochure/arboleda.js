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
  if (!motion) { preloader.remove(); return; }
  g.timeline()
    .from('.pl-small', { opacity: 0, letterSpacing: '0.9em', duration: 0.9, ease: 'power2.out' })
    .from('.pl-big', { yPercent: 100, duration: 1.0, ease: 'expo.out' }, 0.1)
    .to('.pl-line i', { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, 0.2)
    .to('.pl-name, .pl-line', { yPercent: -40, opacity: 0, duration: 0.5, ease: 'power2.in' }, 1.25)
    .to(preloader, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut', onComplete: () => preloader.remove() }, 1.45)
    .fromTo('.hero-media img', { scale: 1.25 }, { scale: 1, duration: 2.4, ease: 'expo.out' }, 1.5)
    // letra animada: cada letra sube girando levemente, con la segunda línea en cursiva un poco después
    .from('.ht-word .ch', { yPercent: 120, rotate: 8, opacity: 0, duration: 1.2, stagger: 0.05, ease: 'expo.out' }, 1.75)
    .from('.hero-kicker, .hero-fact, .hero .actions, .nav', { opacity: 0, y: 18, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, 2.3)
    // después, el render respira muy despacio (acercamiento suave y continuo)
    .to('.hero-media img', { scale: 1.07, duration: 16, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 3.9);
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
  g.utils.toArray('[data-reveal]').forEach((el) => {
    g.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  // interiores: la foto se asienta desde un leve zoom al entrar (transición en CSS)
  g.utils.toArray('.inside-hero, .inside-pic').forEach((el) => {
    window.ScrollTrigger?.create({ trigger: el, start: 'top 80%', once: true, onEnter: () => el.classList.add('is-in') });
  });

  // fotos: se descubren de abajo hacia arriba y se asientan desde un leve zoom; luego un parallax suave
  g.utils.toArray('.pic').forEach((pic) => {
    const img = pic.querySelector('img');
    g.fromTo(pic, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: { trigger: pic, start: 'top 85%' } });
    const amt = +(pic.dataset.parallax || 6);
    g.fromTo(img, { yPercent: -amt }, { yPercent: amt, ease: 'none', scrollTrigger: { trigger: pic, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // un día en el edificio: la tira corre de lado mientras la sección queda fija; el reloj avanza
  const track = document.querySelector('.day-track');
  const times = ['8:24', '12:24', '4:24', '5:51'];
  const clock = document.querySelector('.dc-time'), bar = document.querySelector('.dc-bar i');
  const dist = () => track.scrollWidth - innerWidth;
  g.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: '.day', pin: '.day-pin', start: 'top top', end: () => `+=${dist() * 1.1}`, scrub: 0.6, invalidateOnRefresh: true,
      onUpdate: (st) => { bar.style.transform = `scaleX(${st.progress})`; clock.textContent = times[Math.min(times.length - 1, Math.floor(st.progress * times.length))]; }
    }
  });
  g.utils.toArray('.day-card img').forEach((img) => {
    g.fromTo(img, { scale: 1.15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.day', start: 'top top', end: () => `+=${dist() * 1.1}`, scrub: true } });
  });

  // recorrido 3D: la ventana se abre a pantalla completa
  g.to('.tour-window', { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: '.tour', start: 'top 70%', end: 'center center', scrub: true } });
  g.to('.tour-window img', { scale: 1, ease: 'none', scrollTrigger: { trigger: '.tour', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  g.from('.tour-copy > *', { y: 30, opacity: 0, stagger: 0.1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.tour', start: 'center 70%' } });

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
      if (!shots[i].classList.contains('contain')) g.fromTo(shots[i].querySelector('img'), { scale: 1.16 }, { scale: 1.04, duration: 2.6, ease: 'expo.out' });
      g.fromTo(steps[i].children, { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.07, ease: 'expo.out', overwrite: true });
    }
    setLevel(levelOf(i));
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

// ------------------------------------------------------------------ recorrido 3D: el edificio navegable dentro del brochure
// El 3D pesa varios MB: se carga solo cuando la persona entra. Mientras está activo la rueda del ratón
// mueve la cámara (no la página); "Volver al brochure" lo deja quieto detrás de la foto.
const tourSec = document.getElementById('recorrido');
if (tourSec) {
  const frame = tourSec.querySelector('.tour-frame');
  const exit = () => {
    tourSec.classList.remove('is-live');
    document.body.classList.remove('tour-open');
    frame.tabIndex = -1;
    document.getElementById('tour-enter').focus();
  };
  document.getElementById('tour-enter').addEventListener('click', () => {
    if (!frame.getAttribute('src')) frame.src = `${frame.dataset.src}?embed=1`;   // sin la intro: ya se vio en el brochure
    tourSec.classList.add('is-live');
    document.body.classList.add('tour-open');
    frame.tabIndex = 0;
    setTimeout(() => frame.focus(), 400);
  });
  document.getElementById('tour-exit').addEventListener('click', exit);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && tourSec.classList.contains('is-live')) exit(); });
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

// ------------------------------------------------------------------ mapa
const LAT = 4.6438909, LNG = -74.0692778;
if (window.L) {
  const map = L.map('map', { scrollWheelZoom: false, attributionControl: true }).setView([LAT, LNG], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  L.circle([LAT, LNG], { radius: 500, color: '#1f4f8f', weight: 1, fillColor: '#1f4f8f', fillOpacity: 0.06, dashArray: '4 6' })
    .addTo(map).bindTooltip('500 m, unos 6 minutos a pie', { sticky: true });
  L.marker([LAT, LNG], { title: 'Distrito Arboleda', icon: L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }) })
    .addTo(map).bindPopup('<b>Distrito Arboleda</b><br>Calle 56 con Carrera 18, Galerías');
} else {
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
