/**
 * LoadingScreen — pantalla de carga con la marca JMC Arquitectura mientras se descargan los datos
 * de Catastro, la ortofoto y se arma la escena.
 */
export class LoadingScreen {
  constructor() {
    const el = document.createElement('div');
    el.className = 'ls-wrap';
    el.innerHTML = `
      <img class="ls-logo" src="./assets/branding/jmc-logo-wide.png" alt="JMC Arquitectura">
      <div class="ls-title">Apartaestudios Galerías</div>
      <div class="ls-sub">Ejercicio Profesional 2 · Estudio de mercado · Calle 56 # 17-53</div>
      <div class="ls-bar"><i></i></div>
      <div class="ls-msg">Preparando la escena…</div>`;
    document.body.appendChild(el);
    this.el = el;
    this.bar = el.querySelector('.ls-bar i');
    this.msg = el.querySelector('.ls-msg');
  }

  set(p, msg) {
    this.bar.style.width = `${Math.round(p * 100)}%`;
    if (msg) this.msg.textContent = msg;
  }

  done() {
    this.set(1, 'Listo');
    setTimeout(() => this.el.classList.add('out'), 250);
    setTimeout(() => this.el.remove(), 1400);
  }
}
