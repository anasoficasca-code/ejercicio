/* Aurea Residencial · interacciones del brochure (sin librerías, salvo Leaflet para el mapa).
 * Momentos: la frase que se ilumina palabra por palabra y los capítulos del día; nada más se mueve con el scroll. */

// Contacto de la sala de ventas. Con whatsapp (indicativo y número, sin espacios) el formulario abre
// WhatsApp; si no, abre el correo de la persona dirigido a `correo`.
const CONTACTO = { correo: '', whatsapp: '' };

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// ------------------------------------------------------------------ momento 1: la frase se ilumina
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

// ------------------------------------------------------------------ momento 2: capítulos del día
const chapters = document.querySelector('.chapters');
const pics = [...document.querySelectorAll('.ch-pic')];
const texts = [...document.querySelectorAll('.ch-text')];
const jumps = [...document.querySelectorAll('.ch-jump button')];
const N = pics.length;
let current = -1;

function showChapter(i) {
  if (i === current) return;
  current = i;
  texts.forEach((t, k) => t.classList.toggle('on', k === i));
  jumps.forEach((b, k) => b.setAttribute('aria-current', k === i));
}

function frame() {
  // frase: cada palabra pasa a tinta al cruzar la mitad de la pantalla (y vuelve al subir)
  if (!reduce && wh) {
    const r = wh.getBoundingClientRect(), vh = innerHeight;
    const t = clamp((vh * 0.85 - r.top) / Math.max(1, vh * 0.4 + r.height));
    const k = Math.round(t * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < k));
  }
  // capítulos: cada foto descubre la siguiente desde abajo y se asienta desde un leve zoom
  if (!reduce && chapters) {
    const r = chapters.getBoundingClientRect();
    const span = chapters.offsetHeight - innerHeight;
    const p = clamp(-r.top / span) * (N - 1);             // 0 .. N-1
    pics.forEach((img, i) => {
      if (i === 0) return;
      const w = clamp((p - (i - 1)) / 0.55);               // la cortina dura algo más de la mitad del capítulo
      const e = 1 - Math.pow(1 - w, 3);
      img.style.clipPath = `inset(${(1 - e) * 100}% 0 0 0)`;
      img.style.transform = `scale(${1.06 - 0.06 * e})`;
    });
    showChapter(Math.min(N - 1, Math.floor(p + 0.45)));
  }
}
let ticking = false;
const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame(); }); } };
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
if (reduce) { words.forEach((w) => w.classList.add('on')); texts.forEach((t) => t.classList.add('on')); }
showChapter(0);
frame();

// los botones de hora llevan al capítulo
jumps.forEach((b) => b.addEventListener('click', () => {
  const i = +b.dataset.ch;
  const top = chapters.getBoundingClientRect().top + scrollY;
  const span = chapters.offsetHeight - innerHeight;
  scrollTo({ top: top + span * (i / (N - 1)), behavior: reduce ? 'auto' : 'smooth' });
}));

// ------------------------------------------------------------------ tipologías
const tabs = [...document.querySelectorAll('.tab')];
function selectTab(t) {
  tabs.forEach((x) => {
    const on = x === t;
    x.classList.toggle('is-on', on);
    x.setAttribute('aria-selected', on);
    x.tabIndex = on ? 0 : -1;
    document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    n.focus(); selectTab(n);
  });
});

// ------------------------------------------------------------------ zonas: al señalar un nombre se destaca su foto
const mosaic = document.querySelector('.mosaic');
const zoneBtns = [...document.querySelectorAll('.zone-list button')];
const zonePics = [...mosaic.querySelectorAll('.pic')];
const focusZone = (i) => {
  mosaic.classList.toggle('focus', i != null);
  zonePics.forEach((p) => p.classList.toggle('on', +p.dataset.z === i));
  zoneBtns.forEach((b) => b.classList.toggle('on', +b.dataset.z === i));
};
zoneBtns.forEach((b) => {
  const i = +b.dataset.z;
  b.addEventListener('mouseenter', () => focusZone(i));
  b.addEventListener('focus', () => focusZone(i));
  b.addEventListener('click', () => focusZone(i));
  b.addEventListener('mouseleave', () => focusZone(null));
  b.addEventListener('blur', () => focusZone(null));
});

// ------------------------------------------------------------------ mapa
const LAT = 4.6438909, LNG = -74.0692778;
if (window.L) {
  const map = L.map('map', { scrollWheelZoom: false, attributionControl: true }).setView([LAT, LNG], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  L.circle([LAT, LNG], { radius: 500, color: '#a3472c', weight: 1, fillColor: '#a3472c', fillOpacity: 0.06, dashArray: '4 6' })
    .addTo(map).bindTooltip('500 m, unos 6 minutos a pie', { sticky: true });
  L.marker([LAT, LNG], { title: 'Aurea Residencial', icon: L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }) })
    .addTo(map).bindPopup('<b>Aurea Residencial</b><br>Calle 56 con Carrera 18, Galerías');
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
  const texto = `Hola, quiero agendar una visita a Aurea Residencial.\nNombre: ${d.nombre}\nCelular: ${d.celular}\nTipo de apartamento: ${d.tipo}`;
  if (CONTACTO.whatsapp) {
    window.open(`https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    msg.textContent = 'Abrimos WhatsApp con tu mensaje listo. Solo falta enviarlo.';
  } else {
    location.href = `mailto:${CONTACTO.correo}?subject=${encodeURIComponent('Visita a Aurea Residencial')}&body=${encodeURIComponent(texto)}`;
    msg.textContent = 'Abrimos tu correo con el mensaje listo. Solo falta enviarlo.';
  }
});
