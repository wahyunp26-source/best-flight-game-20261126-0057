// Zephyr Rings — HUD: DOM readouts, gate banner, centre flashes, and a
// little canvas artificial horizon so the panel feels like a real cockpit.

export class Hud {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'score', 'combo', 'time', 'best-combo', 'gate-banner',
      'gate-arrow', 'gate-dist', 'flash', 'spd', 'alt', 'hdg',
      'start-screen', 'end-screen', 'grade', 'final-score', 'end-kicker',
      'r-gates', 'r-perfect', 'r-combo', 'r-crash', 'r-bonus', 'crash-flash']) {
      this.el[id] = document.getElementById(id);
    }
    this.att = document.getElementById('attitude').getContext('2d');
    this.lastComboShown = -1;
  }

  showHud(on) { this.el.hud.classList.toggle('hidden', !on); }
  showStart(on) { this.el['start-screen'].classList.toggle('hidden', !on); }
  showEnd(on) { this.el['end-screen'].classList.toggle('hidden', !on); }

  flash(html) {
    const f = this.el.flash;
    f.innerHTML = html;
    f.classList.remove('show');
    void f.offsetWidth; // restart the animation
    f.classList.add('show');
  }

  crashFlash() {
    const f = this.el['crash-flash'];
    f.style.opacity = '1';
    setTimeout(() => { f.style.opacity = '0'; }, 130);
  }

  update(state, plane, nextRing) {
    this.el.score.textContent = state.score.toLocaleString('en-US');
    const comboTxt = `COMBO ×${Math.max(1, state.combo)}`;
    if (this.el.combo.textContent !== comboTxt) {
      this.el.combo.textContent = comboTxt;
      this.el.combo.classList.remove('pop'); void this.el.combo.offsetWidth;
      this.el.combo.classList.add('pop');
    }
    this.el['best-combo'].textContent = `BEST ×${Math.max(1, state.bestCombo)}`;

    const t = Math.max(0, Math.ceil(state.timeLeft));
    this.el.time.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.el.time.classList.toggle('low', state.timeLeft < 20 && state.phase === 'playing');

    const total = state.totalRings;
    const done = state.passed + state.missed;
    this.el['gate-banner'].textContent = nextRing
      ? `GATE ${Math.min(done + 1, total)} / ${total}`
      : 'FINISH';

    if (nextRing) {
      const toRing = nextRing.center.clone().sub(plane.pos);
      const dist = Math.round(toRing.length());
      this.el['gate-dist'].textContent = `${dist} m`;
      // Screen-space arrow: bearing of the ring relative to the nose.
      const bearing = Math.atan2(toRing.x, -toRing.z);
      let rel = bearing - plane.heading;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      // ➤ points right at 0deg; rotate so up = straight ahead.
      this.el['gate-arrow'].style.transform = `rotate(${(-90 + rel * 180 / Math.PI).toFixed(1)}deg)`;
      this.el['gate-arrow'].style.opacity = Math.abs(rel) > 2.6 ? '0.25' : '1';
    }

    this.el.spd.textContent = plane.speedKnots();
    this.el.alt.textContent = plane.altitudeFeet().toLocaleString('en-US');
    this.el.hdg.textContent = `${String(plane.headingDeg()).padStart(3, '0')}°`;
    this.drawAttitude(plane);
  }

  drawAttitude(plane) {
    const g = this.att, W = 132, C = W / 2;
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.clip();
    g.translate(C, C);
    g.rotate(-plane.bank);
    const pitchPx = plane.pitch * 52;
    // Sky and ground.
    g.fillStyle = '#3f8fd2'; g.fillRect(-W, -W + pitchPx, W * 2, W);
    g.fillStyle = '#7a5a34'; g.fillRect(-W, pitchPx, W * 2, W);
    // Pitch ladder.
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
    for (const p of [-20, -10, 10, 20]) {
      const y = pitchPx - p * 2.6, w = p % 20 === 0 ? 26 : 16;
      g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke();
    }
    g.fillStyle = '#ffffff';
    g.fillRect(-1.5, -W, 3, 14); // top marker
    g.restore();
    // Fixed aircraft symbol.
    g.strokeStyle = '#ffd75e'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(C - 40, C); g.lineTo(C - 12, C); g.lineTo(C, C + 8); g.lineTo(C + 12, C); g.lineTo(C + 40, C);
    g.stroke();
    g.fillStyle = '#ffd75e';
    g.beginPath(); g.arc(C, C, 3.4, 0, Math.PI * 2); g.fill();
  }

  showResults(state, grade, kicker) {
    this.el['end-kicker'].textContent = kicker;
    this.el.grade.textContent = grade;
    this.el['final-score'].textContent = state.score.toLocaleString('en-US');
    this.el['r-gates'].textContent = `${state.passed} / ${state.totalRings}`;
    this.el['r-perfect'].textContent = state.perfects;
    this.el['r-combo'].textContent = `×${Math.max(1, state.bestCombo)}`;
    this.el['r-crash'].textContent = state.crashes;
    this.el['r-bonus'].textContent = `+${state.timeBonus.toLocaleString('en-US')}`;
    this.showEnd(true);
  }
}
