/**
 * LoadingScreen — pantalla de carga con la marca Aurea Residencial mientras se descargan los datos de
 * Catastro, el modelo de Revit y la ortofoto. La barra es una línea de ladrillo que crece bajo la marca.
 */
export class LoadingScreen {
  constructor() {
    const el = document.createElement('div');
    el.className = 'ls-wrap';
    el.innerHTML = `
      <div class="ls-mark"><span class="ls-word">Aurea</span><span class="ls-res">Residencial</span></div>
      <div class="ls-bar"><i></i></div>
      <div class="ls-msg" role="status">Preparando la escena…</div>
      <img class="ls-logo" src="./assets/branding/jmc-logo-wide.png" alt="Un proyecto de JMC Arquitectura">`;
    document.body.appendChild(el);
    this.el = el;
    this.bar = el.querySelector('.ls-bar i');
    this.msg = el.querySelector('.ls-msg');
  }

  set(p, msg) {
    this.bar.style.transform = `scaleX(${p})`;
    if (msg) this.msg.textContent = msg;
  }

  done() {
    this.set(1, 'Listo');
    setTimeout(() => this.el.classList.add('out'), 250);
    setTimeout(() => this.el.remove(), 1400);
  }
}
