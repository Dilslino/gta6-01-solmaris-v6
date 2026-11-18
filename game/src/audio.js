// Solmaris — audio: synthesized WebAudio music and effects. No audio files;
// every sound is generated. Original sunset-synthwave loop.
const AudioSys = {
  ctx: null, master: null, musicGain: null, engineOsc: null, engineGain: null,
  sirenOsc: null, sirenGain: null, sirenLFO: null, started: false, stepFlip: false,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = G.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      // Engine: sawtooth through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const ef = this.ctx.createBiquadFilter();
      ef.type = 'lowpass'; ef.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(ef); ef.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: triangle two-tone via LFO on frequency.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 750;
      this.sirenLFO = this.ctx.createOscillator();
      this.sirenLFO.frequency.value = 0.9;
      const lg = this.ctx.createGain(); lg.gain.value = 180;
      this.sirenLFO.connect(lg); lg.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); this.sirenLFO.start();
      this.started = true;
      this.musicLoop();
    } catch (e) { /* audio unavailable: game stays silent, never errors */ }
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  setMuted(m) {
    G.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
  },

  // Am — F — C — G pad arpeggio, scheduled ahead in a loop.
  musicLoop() {
    if (!this.ctx) return;
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
    let step = 0;
    const tick = () => {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + 0.08;
      const chord = chords[Math.floor(step / 4) % 4];
      const note = chord[step % 3] * 2;
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = note;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(g); g.connect(this.musicGain);
      o.start(t0); o.stop(t0 + 1.0);
      if (step % 8 === 0) { // soft bass pulse
        const b = this.ctx.createOscillator(); b.type = 'sine'; b.frequency.value = chord[0] / 2;
        const bg = this.ctx.createGain();
        bg.gain.setValueAtTime(0.0001, t0);
        bg.gain.exponentialRampToValueAtTime(0.6, t0 + 0.05);
        bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
        b.connect(bg); bg.connect(this.musicGain);
        b.start(t0); b.stop(t0 + 1.7);
      }
      step += 1;
      setTimeout(tick, 300);
    };
    tick();
  },

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); o.type = type || 'square'; o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.25, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  },

  noise(dur, vol, filterFreq) {
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
      const g = this.ctx.createGain(); g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t0);
    } catch (e) { /* ignore */ }
  },

  shoot() { this.noise(0.14, 0.5, 2800); this.blip(180, 0.08, 'square', 0.2); },
  punch() { this.noise(0.09, 0.4, 700); },
  crash() { this.noise(0.25, 0.5, 400); this.blip(70, 0.2, 'sine', 0.4); },
  pickup() { this.blip(660, 0.1, 'sine', 0.3); setTimeout(() => this.blip(990, 0.14, 'sine', 0.3), 90); },
  step() { this.stepFlip = !this.stepFlip; this.noise(0.05, 0.07, this.stepFlip ? 500 : 380); },
  jingle() { const n = [523, 659, 784, 1046]; n.forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.35), i * 110)); },
  fail() { const n = [392, 330, 262]; n.forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.2), i * 140)); },
  siren(on) { if (this.sirenGain && this.ctx) this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.3); },
  engine(speed, inCar) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + Math.abs(speed) * 0.0022 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 3.2, t, 0.1);
  },
};
