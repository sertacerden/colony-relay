// Original procedural score and effects: no external audio downloads or runtime dependencies.
const NOTE = midi => 440 * 2 ** ((midi - 69) / 12);
const HALF_BEAT = 60 / 72 / 2;
const CHORDS = [[57, 60, 64, 71], [53, 57, 60, 67], [48, 55, 59, 64], [55, 59, 62, 69]];
const MELODIES = [[76, 71, 72, 79], [76, 72, 69, 67], [74, 71, 67, 76], [74, 69, 71, 67]];
const PREF_KEY = 'colony-audio-v1';
export const AUDIO_DEFAULTS = { music: .38, effects: .65, muted: false };

export class GameAudio {
  constructor({ context = null, storage = null, automatic = true } = {}) {
    this.ctx = null; this.automatic = automatic; this.storage = storage;
    if (!storage) { try { this.storage = globalThis.localStorage; } catch { /* privacy mode */ } }
    this.settings = { ...AUDIO_DEFAULTS };
    try {
      const saved = JSON.parse(this.storage?.getItem(PREF_KEY) || 'null');
      for (const key of ['music', 'effects']) if (Number.isFinite(saved?.[key])) this.settings[key] = Math.max(0, Math.min(1, saved[key]));
      if (typeof saved?.muted === 'boolean') this.settings.muted = saved.muted;
    } catch { /* use defaults */ }
    this.voices = new Set(); this.cooldowns = new Map(); this.stepIndex = 0;
    this.nextStep = 0; this.hidden = false; this.ducked = false; this.timer = null;
    if (context) this.setup(context);
  }
  setup(ctx) {
    this.ctx = ctx;
    this.music = ctx.createGain(); this.effects = ctx.createGain(); this.master = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14; this.compressor.knee.value = 16;
    this.compressor.ratio.value = 4; this.compressor.attack.value = .008; this.compressor.release.value = .25;
    this.music.connect(this.master); this.effects.connect(this.master);
    this.master.connect(this.compressor); this.compressor.connect(ctx.destination);
    this.delay = ctx.createDelay(2); this.delay.delayTime.value = HALF_BEAT * 1.5;
    this.feedback = ctx.createGain(); this.feedback.gain.value = .25;
    this.echo = ctx.createGain(); this.echo.gain.value = .18;
    this.echoFilter = ctx.createBiquadFilter(); this.echoFilter.type = 'lowpass'; this.echoFilter.frequency.value = 1800;
    this.delay.connect(this.echoFilter); this.echoFilter.connect(this.feedback); this.feedback.connect(this.delay);
    this.echoFilter.connect(this.echo); this.echo.connect(this.music);
    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const samples = this.noiseBuffer.getChannelData(0); let seed = 9081;
    for (let i = 0; i < samples.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; samples[i] = seed / 2147483648 - 1; }
    this.applySettings(true);
  }
  // Call synchronously inside a click/key handler, before awaiting any network request.
  async unlock() {
    try {
      if (!this.ctx) {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Context) return false;
        this.setup(new Context({ latencyHint: 'interactive' }));
      }
      if (this.ctx.state !== 'running' && this.ctx.resume) await this.ctx.resume();
      if (this.hidden) { await this.ctx.suspend?.(); return false; }
      this.startScheduler(); return true;
    } catch { return false; } // Audio failure never prevents joining or moving.
  }
  set(key, value) {
    if (key === 'muted') this.settings.muted = !!value;
    else if (['music', 'effects'].includes(key) && Number.isFinite(value)) this.settings[key] = Math.max(0, Math.min(1, value));
    this.applySettings();
    try { this.storage?.setItem(PREF_KEY, JSON.stringify(this.settings)); } catch { /* storage optional */ }
  }
  applySettings(immediate = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [param, target] of [[this.master.gain, this.settings.muted || this.hidden ? 0 : .75],
      [this.music.gain, this.settings.music * 3 * (this.ducked ? .45 : 1)], [this.effects.gain, this.settings.effects]]) {
      param.cancelScheduledValues(now);
      if (immediate) param.setValueAtTime(target, now); else param.setTargetAtTime(target, now, .08);
    }
  }
  duck(value) { this.ducked = value; this.applySettings(); }
  setHidden(value) {
    this.hidden = value; this.applySettings();
    if (!this.ctx) return;
    if (value) {
      clearInterval(this.timer); this.timer = null;
      this.stopVoices(); this.cooldowns.clear();
      this.ctx.suspend?.().catch(() => {});
    } else {
      this.nextStep = this.ctx.currentTime + .08;
      // Some browsers require the next user gesture to resume; unlock() handles it.
      this.ctx.resume?.().then(() => { if (!this.hidden) this.startScheduler(); }).catch(() => {});
    }
  }
  startScheduler() {
    if (!this.automatic || this.timer || this.hidden || this.ctx.state !== 'running') return;
    this.nextStep = this.ctx.currentTime + .08;
    this.schedule(); this.timer = setInterval(() => this.schedule(), 100);
  }
  schedule() {
    if (this.hidden || this.ctx.state !== 'running') return;
    if (this.nextStep < this.ctx.currentTime - .3) this.nextStep = this.ctx.currentTime + .05;
    while (this.nextStep < this.ctx.currentTime + .3) {
      if (!this.settings.muted && this.settings.music > 0) this.musicStep(this.stepIndex, this.nextStep);
      this.stepIndex++; this.nextStep += HALF_BEAT;
    }
  }
  voice({ time = this.ctx.currentTime, duration = .2, frequency = 440, endFrequency = frequency,
    type = 'sine', gain = .1, attack = .005, pan = 0, cutoff = 3000,
    filterType = 'lowpass', bus = 'effects', echo = false, noise = false, detune = 0 }) {
    if (!this.ctx || this.voices.size >= 64) return;
    const ctx = this.ctx, source = noise ? ctx.createBufferSource() : ctx.createOscillator();
    if (noise) { source.buffer = this.noiseBuffer; source.loop = true; }
    else {
      source.type = type; source.detune.value = detune;
      source.frequency.setValueAtTime(Math.max(15, frequency), time);
      source.frequency.exponentialRampToValueAtTime(Math.max(15, endFrequency), time + duration);
    }
    const filter = ctx.createBiquadFilter(); filter.type = filterType; filter.frequency.value = cutoff; filter.Q.value = .55;
    const envelope = ctx.createGain(), panner = ctx.createStereoPanner(); panner.pan.value = pan;
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + Math.min(attack, duration * .4));
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(panner); panner.connect(this[bus]);
    if (echo) panner.connect(this.delay);
    const voice = { source, nodes: [source, filter, envelope, panner] }; this.voices.add(voice);
    source.onended = () => { voice.nodes.forEach(n => n.disconnect()); this.voices.delete(voice); };
    source.start(time); source.stop(time + duration + .03);
  }
  musicStep(index, time) {
    const chordIndex = Math.floor(index / 16) % 4, within = index % 16;
    const chord = CHORDS[chordIndex];
    if (within === 0) {
      chord.forEach((midi, i) => {
        for (const side of [-1, 1]) this.voice({ time, duration: HALF_BEAT * 19,
          frequency: NOTE(midi), type: 'triangle', gain: .023, attack: 1.7, pan: side * .48,
          detune: side * 5, cutoff: 850 + i * 160, bus: 'music' });
      });
    }
    if (within === 0 || within === 8) {
      this.voice({ time, duration: 2.7, frequency: NOTE(chord[0] - 12), gain: .075, attack: .035, cutoff: 200, bus: 'music' });
      this.voice({ time, duration: .24, frequency: 100, endFrequency: 44, gain: .12, cutoff: 250, bus: 'music' });
    }
    // Sparse, softly swung electric-piano motif; vary the register every second phrase.
    if ([2, 7, 10, 14].includes(within)) {
      const noteIndex = [2, 7, 10, 14].indexOf(within);
      const midi = MELODIES[chordIndex][noteIndex] - (Math.floor(index / 64) % 2 ? 12 : 0);
      const when = time + (within % 2 ? .035 : 0);
      this.voice({ time: when, duration: 2.6, frequency: NOTE(midi), gain: .065, attack: .016,
        pan: noteIndex % 2 ? .3 : -.3, bus: 'music', echo: true });
      this.voice({ time: when, duration: .55, frequency: NOTE(midi) * 2, gain: .012, bus: 'music', echo: true });
    }
    if (within % 4 === 2) this.voice({ time, duration: .065, noise: true, gain: .012,
      filterType: 'highpass', cutoff: 6500, pan: .25, bus: 'music' });
    if (within === 4 || within === 12) this.voice({ time, duration: .13, noise: true, gain: .025,
      filterType: 'bandpass', cutoff: 1300, pan: -.2, bus: 'music' });
  }
  play(name, { gain = 1, pan = 0 } = {}) {
    if (!this.ctx || this.ctx.state !== 'running' || this.hidden || this.settings.muted || this.settings.effects <= 0) return;
    const time = this.ctx.currentTime;
    const cooldown = name === 'step' ? .17 : .12;
    if (time - (this.cooldowns.get(name) ?? -100) < cooldown) return;
    this.cooldowns.set(name, time);
    const tone = (frequency, duration, volume, extra = {}) => this.voice({ time, frequency, duration, gain: volume * gain, pan, ...extra });
    const noise = (duration, volume, cutoff, extra = {}) => tone(440, duration, volume, { noise: true, cutoff, ...extra });
    const chime = notes => notes.forEach((midi, i) => tone(NOTE(midi), .65, .11, { time: time + i * .13 }));
    switch (name) {
      case 'boing': tone(140,.32,.11,{endFrequency:650,type:'triangle'});tone(600,.25,.055,{time:time+.2,endFrequency:180});break;
      case 'oops': tone(440,.2,.08,{endFrequency:280});tone(270,.3,.075,{time:time+.18,endFrequency:95});break;
      case 'bonk': tone(190,.12,.1,{endFrequency:60});noise(.08,.04,800);break;
      case 'step': noise(.08, .065, 650, { filterType: 'bandpass' }); tone(120, .07, .07, { endFrequency: 65 }); break;
      case 'jump': tone(180, .18, .09, { endFrequency: 380 }); noise(.14, .025, 1800); break;
      case 'land': tone(110, .17, .11, { endFrequency: 45 }); noise(.13, .06, 1000); break;
      case 'dash': noise(.28, .15, 1800, { filterType: 'bandpass' }); tone(520, .25, .065, { endFrequency: 100 }); break;
      case 'wallrun': noise(.32, .045, 900, { filterType: 'bandpass' }); break;
      case 'terminal': chime([72, 79]); break;
      case 'bridge-open': tone(95, .8, .11, { endFrequency: 210, type: 'triangle', attack: .12 }); noise(.55, .05, 650); break;
      case 'bridge-close': tone(160, .5, .09, { endFrequency: 50 }); noise(.3, .06, 800); break;
      case 'latch': chime([60, 67, 72, 76]); break;
      case 'checkpoint': chime([76, 79, 84]); break;
      case 'respawn': tone(260, .45, .065, { endFrequency: 90 }); break;
      case 'sector': chime([60, 64, 67, 74]); break;
      case 'complete': chime([60, 64, 67, 72, 79, 84]); break;
      case 'camera': tone(650, .065, .035, { endFrequency: 480 }); break;
      case 'ui': tone(540, .06, .035, { endFrequency: 680 }); break;
    }
  }
  stopVoices() {
    for (const voice of this.voices) {
      try { voice.source.stop(); } catch { /* already ended */ }
      voice.nodes.forEach(node => node.disconnect());
    }
    this.voices.clear();
  }
  dispose() {
    clearInterval(this.timer); this.timer = null; this.stopVoices();
    this.ctx?.close?.().catch(() => {});
  }
}
