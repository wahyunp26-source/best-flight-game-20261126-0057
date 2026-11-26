// Zephyr Rings — input: WASD / arrow keys, Shift boost, Space brake, and
// pointer steering (move the mouse and the plane leans toward it).

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0; this.mouseY = 0;
    this.mouseActiveUntil = -1;
    this.boost = false; this.brake = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (this.onKey) this.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.mouseY = ((e.clientY - r.top) / r.height) * 2 - 1;
      this.mouseActiveUntil = performance.now() + 2600;
    });
  }

  // Returns { pitch, roll, boost, brake } with pitch/roll in -1..1.
  // pitch positive = climb (arcade style: up means up).
  read(now) {
    let pitch = 0, roll = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) roll -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) roll += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) pitch += 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) pitch -= 1;

    // Pointer steering blends in while the mouse is fresh.
    if (now < this.mouseActiveUntil && roll === 0 && pitch === 0) {
      roll = clamp(this.mouseX * 1.15);
      pitch = clamp(-this.mouseY * 0.95);
    }
    return {
      pitch, roll,
      boost: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      brake: this.keys.has('Space'),
    };
  }
}

function clamp(v) { return Math.max(-1, Math.min(1, v)); }
