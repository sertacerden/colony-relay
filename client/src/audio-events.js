// Kept separate from rendering so server corrections never replay one-shot sounds.
export class GameAudioEvents {
  constructor(play) { this.play = play; this.previous = null; this.nextStep = 0; this.nextScrape = 0; }
  snapshot(next, playerId, reset = false) {
    const self = next.players.find(p => p.id === playerId);
    const previous = this.previous;
    if (previous && !reset && previous.room === next.room) {
      const before = previous.players.find(p => p.id === playerId);
      if (!previous.completed && next.completed) this.play('complete');
      else if (previous.sector !== next.sector) this.play('sector');
      else {
        if (self && before && self.state.epoch !== before.state.epoch) this.play('respawn');
        else if(self && before && self.state.prankSeq>before.state.prankSeq)this.play(self.state.prank==='launch'?'boing':self.state.prank==='drop'||self.state.prank==='fake'?'oops':'bonk');
        if (self && before && self.checkpoint > before.checkpoint) this.play('checkpoint');
        if (!previous.puzzle.latched && next.puzzle.latched) this.play('latch');
        else if (!previous.puzzle.open && next.puzzle.open) { this.play('terminal'); this.play('bridge-open'); }
        else if (previous.puzzle.open && !next.puzzle.open) this.play('bridge-close');
      }
    }
    this.previous = next;
  }
  movement(before, after, command, now) {
    if (before.epoch !== after.epoch) return;
    if (command.jump && after.vy > before.vy + 2) this.play('jump');
    if (command.dash && after.cooldown > before.cooldown) this.play('dash');
    if (!before.grounded && after.grounded && before.vy < -2.5) this.play('land');
    const moved = Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z);
    if (after.grounded && moved > .008 && !after.emote && now >= this.nextStep) {
      this.play('step'); this.nextStep = now + (after.animation === 'run' ? 280 : 410);
    }
    if (after.animation === 'wallrun' && now >= this.nextScrape) {
      this.play('wallrun'); this.nextScrape = now + 320;
    }
  }
}
