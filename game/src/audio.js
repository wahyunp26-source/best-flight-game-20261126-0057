// Zephyr Rings — all sound is synthesised with WebAudio: a puttering engine
// whose pitch follows airspeed, wind rush, and little chimes for gates.
// No audio files, nothing to load.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Must be called from a user gesture at least once.
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();

    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    // Engine: two detuned saws through a lowpass, plus a slow putter LFO.
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0.0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 2;
    this.oscA = ctx.createOscillator(); this.oscA.type = 'sawtooth'; this.oscA.frequency.value = 62;
    this.oscB = ctx.createOscillator(); this.oscB.type = 'square'; this.oscB.frequency.value = 31;
    const gB = ctx.createGain(); gB.gain.value = 0.6;
    this.oscA.connect(lp); this.oscB.connect(gB); gB.connect(lp);
    lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.oscA.start(); this.oscB.start();

    // Wind: looped noise buffer through a bandpass.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = ctx.createBufferSource(); this.noise.buffer = buf; this.noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    this.noise.connect(bp); bp.connect(this.windGain); this.windGain.connect(this.master);
    this.noise.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // speedNorm: 0..1 across brake..boost
  engine(speedNorm, running) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 52 + speedNorm * 46;
    this.oscA.frequency.setTargetAtTime(f, t, 0.08);
    this.oscB.frequency.setTargetAtTime(f / 2, t, 0.08);
    this.engineGain.gain.setTargetAtTime(running && !this.muted ? 0.16 : 0.0, t, 0.12);
    this.windGain.gain.setTargetAtTime(running && !this.muted ? 0.02 + speedNorm * 0.11 : 0, t, 0.15);
  }

  blip(freq, dur = 0.14, type = 'sine', vol = 0.22, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  gate(perfect) {
    if (perfect) { this.blip(880, 0.16); this.blip(1174, 0.2, 'sine', 0.22, 0.07); this.blip(1568, 0.3, 'sine', 0.2, 0.14); }
    else { this.blip(740, 0.15); this.blip(988, 0.22, 'sine', 0.2, 0.06); }
  }

  miss() { this.blip(220, 0.25, 'triangle', 0.18); this.blip(174, 0.32, 'triangle', 0.16, 0.08); }

  crash() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const len = ctx.sampleRate * 0.35;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    const g = ctx.createGain(); g.gain.value = 0.5;
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t);
    this.blip(58, 0.4, 'sine', 0.4);
  }

  fanfare() {
    const notes = [523, 659, 784, 1046, 784, 1046];
    notes.forEach((n, i) => this.blip(n, 0.28, 'triangle', 0.2, i * 0.11));
  }
}
