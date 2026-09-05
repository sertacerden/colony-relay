export class Input {
  constructor(canvas, onCamera, onPause) {
    this.keys = new Set(); this.pulses = new Set(); this.yaw = 0; this.pitch = -0.08;
    this.enabled = false; this.coarse = matchMedia('(pointer:coarse)').matches;
    this.canvas = canvas;
    const clear = () => { this.keys.clear(); this.pulses.clear(); };
    window.addEventListener('keydown', e => {
      if (!this.enabled) return;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyE', 'KeyQ', 'KeyV'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) this.pulses.add(e.code);
      if (e.code === 'KeyV' && !e.repeat) onCamera();
      if (e.code === 'Escape') onPause();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { clear(); if (this.enabled) onPause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clear(); if (this.enabled) onPause(); } });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && this.enabled && !this.coarse) onPause(); });
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement === canvas && this.enabled) this.look(e.movementX, e.movementY);
    });
    let touch = null;
    canvas.addEventListener('pointerdown', e => {
      if (!this.enabled || e.pointerType === 'mouse') return;
      touch = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (touch?.id !== e.pointerId) return;
      this.look((e.clientX - touch.x) * 1.8, (e.clientY - touch.y) * 1.8);
      touch.x = e.clientX; touch.y = e.clientY;
    });
    const endLook = e => { if (touch?.id === e.pointerId) touch = null; };
    canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);
    document.querySelectorAll('[data-hold],[data-pulse]').forEach(button => {
      button.addEventListener('pointerdown', e => {
        e.preventDefault(); if (!this.enabled) return; button.setPointerCapture(e.pointerId);
        if (button.dataset.hold) this.keys.add(button.dataset.hold);
        if (button.dataset.pulse) this.pulses.add(button.dataset.pulse);
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event,
        () => this.keys.delete(button.dataset.hold));
    });
    this.clear = clear;
  }
  look(dx, dy) {
    this.yaw = ((this.yaw - dx * 0.0022 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch - dy * 0.0022));
  }
  sample(seq, epoch) {
    const k = this.keys;
    const command = { seq, epoch, yaw: this.yaw,
      x: this.enabled ? Number(k.has('KeyD')) - Number(k.has('KeyA')) : 0,
      z: this.enabled ? Number(k.has('KeyS')) - Number(k.has('KeyW')) : 0,
      sprint: this.enabled && (k.has('ShiftLeft') || k.has('ShiftRight')),
      jump: this.enabled && this.pulses.has('Space'), dash: this.enabled && this.pulses.has('KeyQ'),
      interact: this.enabled && k.has('KeyE') };
    this.pulses.clear(); return command;
  }
  async capture() {
    if (this.coarse) return;
    try { await this.canvas.requestPointerLock(); } catch { /* Esc or browser gesture policy; click canvas to retry. */ }
  }
}
