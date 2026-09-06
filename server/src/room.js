import { createHash } from 'node:crypto';
import { DT, MAX_PLAYERS, LEVEL_VERSION, idleInput, PROTOCOL } from '../../shared/config.js';
import { buildLevel, SECTORS } from '../../shared/levels.js';
import { PhysicsScene, CharacterMotor, initialState } from '../../shared/simulation.js';
import { parseInput } from '../../shared/protocol.js';
import { near, newPuzzle, updatePuzzle } from './puzzle.js';
import { hazardHit } from '../../shared/dynamics.js';

export class Room {
  constructor(id, io, store, saved = null) {
    Object.assign(this, { id, io, store });
    this.players = new Map();
    this.roster = saved?.roster || {};
    this.sector = saved?.sector || 0;
    this.epoch = 1;
    this.time = 0; this.tick = 0;
    this.elapsed = saved?.elapsedSeconds || 0;
    this.version = saved?.version || 0;
    this.completed = saved?.completed || false;
    this.puzzle = newPuzzle(saved?.puzzle?.latched || false);
    this.puzzle.participants = saved?.puzzle?.participants || [];
    this.level = buildLevel(this.sector);
    this.scene = new PhysicsScene(this.level);
    this.scene.setPuzzle(this.puzzle);
    this.lastOccupied = Date.now();
    this.saveStatus = this.version ? 'saved' : 'unsaved';
    this.dirty = false;
  }
  join(socket, { token, name }) {
    const id = createHash('sha256').update(token).digest('hex').slice(0, 24);
    const existing = this.players.get(id);
    if (existing?.socket?.connected) throw new Error('Bu kimlik başka bir sekmede açık.');
    if (!existing && this.players.size >= MAX_PLAYERS) throw new Error('Oda dolu (6 oyuncu).');
    let p = existing;
    if (!p) {
      const record = this.roster[id];
      const checkpoint = record?.sector === this.sector && Number.isInteger(record.checkpoint) && this.puzzle.latched
        ? Math.max(0,Math.min(this.level.checkpoints.length,record.checkpoint)) : 0;
      const spawn = checkpoint ? this.level.checkpoints[checkpoint-1] : this.level.spawn;
      p = { id, name, motor: new CharacterMotor(this.scene, spawn), checkpoint,
        queue: [], receivedSeq: 0, lastInputAt: 0, interact: false, budget: 120, budgetAt: Date.now() };
      this.players.set(id, p);
    }
    p.socket = socket; p.name = name; p.disconnectedAt = 0;
    p.queue = []; p.receivedSeq = 0;
    p.motor.state.seq = 0; p.motor.state.epoch++;
    p.interact = false;
    socket.join(this.id);
    socket.data.room = this.id; socket.data.player = id;
    this.lastOccupied = Date.now();
    this.dirty = true;
    return { protocol: PROTOCOL, id, snapshot: this.snapshot() };
  }
  receive(id, batch) {
    const p = this.players.get(id);
    if (!p || !Array.isArray(batch) || batch.length > 6) return;
    const now = Date.now();
    p.budget = Math.min(120, p.budget + (now - p.budgetAt) * 0.09); p.budgetAt = now;
    for (const raw of batch) {
      if (p.budget < 1) break;
      p.budget--;
      const input = parseInput(raw, p.motor.state.epoch);
      if (!input || input.seq <= p.receivedSeq || p.queue.length >= 12) continue;
      p.receivedSeq = input.seq;
      p.queue.push(input);
      p.lastInputAt = now;
    }
  }
  disconnect(id, socket) {
    const p = this.players.get(id);
    if (p?.socket !== socket) return;
    p.socket = null; p.disconnectedAt = Date.now(); p.queue = []; p.interact = false;
    this.updateRoster(p); this.dirty = true;
    this.save().catch(e => console.error('Save failed:', e.message));
  }
  updateRoster(p) {
    this.roster[p.id] = { name: p.name, sector: this.sector,
      checkpoint: p.checkpoint, updatedAt: new Date().toISOString() };
    // Keep save size bounded; reconnect identity is guest-token based.
    const keys = Object.keys(this.roster);
    if (keys.length > 64) {
      const removable = keys.filter(id => !this.players.has(id));
      removable.sort((a, b) => this.roster[a].updatedAt.localeCompare(this.roster[b].updatedAt));
      for (const id of removable.slice(0, keys.length - 64)) delete this.roster[id];
    }
  }
  step() {
    this.tick++; this.time += DT;
    const active = [...this.players.values()].filter(p => p.socket?.connected);
    if(this.puzzle.open || this.puzzle.latched)this.puzzle.motionTime+=DT;
    this.scene.prepare(this.time,this.puzzle);
    if (active.length) { this.lastOccupied = Date.now(); this.elapsed += DT; }
    for (const p of this.players.values()) {
      if (!p.socket?.connected) {
        if (Date.now() - p.disconnectedAt > 30_000) {
          this.updateRoster(p); p.motor.dispose(); this.players.delete(p.id);
        }
        continue;
      }
      const input = p.queue.shift() || { ...idleInput(p.motor.state.epoch),
        yaw: p.motor.state.yaw, interact: p.interact && Date.now() - p.lastInputAt < 180 };
      p.interact = input.interact;
      const previous={...p.motor.state.position},cooldown=p.motor.state.cooldown;
      p.motor.step(input);
      if(input.dash&&p.motor.state.cooldown>cooldown){p.dashAt=this.time;p.dashEpoch=p.motor.state.epoch;p.dashPosition=previous;}
      if (p.motor.state.position.y < this.level.fallY || hazardHit(this.level,p.motor.state.position,previous,this.time,this.puzzle)) {
        const epoch = p.motor.state.epoch + 1;
        p.motor.restore(initialState(p.checkpoint ? this.level.checkpoints[p.checkpoint-1] : this.level.spawn, epoch));
        p.queue = []; p.receivedSeq = 0; p.interact = false;
      }
      if (this.puzzle.latched && p.checkpoint<this.level.checkpoints.length && p.motor.state.grounded
        &&near(p.motor.state.position, this.level.checkpoints[p.checkpoint], 2.5)) {
        p.checkpoint++; this.updateRoster(p); this.dirty = true;
      }
    }
    if (updatePuzzle(this.puzzle, active, this.level, this.time, 0)) {
      this.scene.setPuzzle(this.puzzle);
      if (this.puzzle.latched) this.dirty = true;
    }
    // Every connected player must reach the exit; a single player cannot complete a sector.
    if (!this.completed && this.puzzle.latched && active.length >= 2
      && active.every(p => near(p.motor.state.position, this.level.exit, 4))) this.advance();
    if (this.tick % 900 === 0) this.dirty = true;
    if (this.dirty && !this.saving) this.save().catch(e => console.error('Save failed:', e.message));
  }
  advance() {
    if (this.sector === SECTORS.length - 1) { this.completed = true; this.dirty = true; return; }
    for (const p of this.players.values()) p.motor.dispose();
    this.scene.free(); this.sector++; this.epoch++;
    this.level = buildLevel(this.sector); this.scene = new PhysicsScene(this.level);
    this.puzzle = newPuzzle();
    for (const p of this.players.values()) {
      const epoch = p.motor.state.epoch + 1;
      p.motor = new CharacterMotor(this.scene, this.level.spawn); p.motor.state.epoch = epoch;
      p.checkpoint = 0; p.queue = []; p.receivedSeq = 0; p.interact = false; this.updateRoster(p);
    }
    this.dirty = true;
  }
  snapshot() {
    return { room: this.id, tick: this.tick, time: this.time, sector: this.sector, epoch: this.epoch,
      elapsed: this.elapsed, completed: this.completed, puzzle: { ...this.puzzle }, saveStatus: this.saveStatus,
      players: [...this.players.values()].filter(p => p.socket?.connected).map(p => ({ id: p.id,
        name: p.name, checkpoint: p.checkpoint, state: structuredClone(p.motor.state) })) };
  }
  record() {
    for (const p of this.players.values()) this.updateRoster(p);
    return { PK: `SESSION#${this.id}`, SK: 'STATE', room: this.id,
      schemaVersion: 1, levelVersion: LEVEL_VERSION, sector: this.sector, completed: this.completed,
      puzzle: { latched: this.puzzle.latched, participants: this.puzzle.participants },
      roster: structuredClone(this.roster), elapsedSeconds: Math.floor(this.elapsed),
      updatedAt: new Date().toISOString() };
  }
  async save() {
    if (this.saving) return this.saving;
    if (this.retryAt && Date.now() < this.retryAt) return;
    this.dirty = false; this.saveStatus = 'saving';
    const record = this.record();
    this.saving = this.store.save(record, this.version).then(version => {
      this.version = version; this.saveStatus = 'saved'; this.retryAt = 0;
    }).catch(error => {
      this.dirty = true; this.saveStatus = 'error'; this.retryAt = Date.now() + 10_000;
      throw error;
    }).finally(() => { this.saving = null; });
    return this.saving;
  }
  free() { for (const p of this.players.values()) p.motor.dispose(); this.scene.free(); }
}
