# Temel kodların tam dökümü

Bu dosya proje kaynaklarından üretilmiştir. Kodlar `npm ci` ile yüklenen proje bağımlılıklarıyla birlikte çalışır. Kaynak dosyalar ZIP içindedir; kodları yeniden kopyalamak gerekmez.

## Karakter kontrolcüsü ve fizik dünyası

Kaynak: `shared/simulation.js`

```javascript
import RAPIER from '@dimforge/rapier3d-compat';
import { DT, MOVE } from './config.js';
export { RAPIER };
let initialized;
export function initPhysics() { return initialized ??= RAPIER.init(); }

export class PhysicsScene {
  constructor(level) {
    this.level = level;
    this.world = new RAPIER.World({ x: 0, y: -MOVE.gravity, z: 0 });
    this.world.timestep = DT;
    this.solids = new Set();
    this.boxes = new Map();
    for (const b of [...level.boxes, level.bridge]) {
      const c = this.world.createCollider(RAPIER.ColliderDesc
        .cuboid(b.size.x / 2, b.size.y / 2, b.size.z / 2)
        .setTranslation(b.position.x, b.position.y, b.position.z));
      this.solids.add(c.handle);
      this.boxes.set(b.id, c);
    }
    this.setPuzzle({ open: false, latched: false });
    this.world.step();
  }
  setPuzzle(puzzle) {
    this.boxes.get('bridge').setEnabled(puzzle.open || puzzle.latched);
    this.boxes.get('exit-gate').setEnabled(!puzzle.latched);
  }
  step() { this.world.step(); }
  free() { this.world.free(); }
}

export function initialState(position, epoch = 0) {
  return { position: { ...position }, vy: 0, grounded: false, coyote: 0,
    dashLeft: 0, cooldown: 0, dashX: 0, dashZ: -1, wallLeft: MOVE.wallDuration,
    yaw: 0, animation: 'idle', epoch, seq: 0 };
}

/** Shared by authoritative server and local prediction. All times in seconds. */
export class CharacterMotor {
  constructor(scene, spawn) {
    this.scene = scene;
    this.collider = scene.world.createCollider(RAPIER.ColliderDesc
      .capsule(MOVE.halfHeight, MOVE.radius).setTranslation(spawn.x, spawn.y, spawn.z));
    this.controller = scene.world.createCharacterController(0.02);
    this.controller.enableAutostep(0.25, 0.2, false);
    this.controller.enableSnapToGround(0.18);
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4);
    this.state = initialState(spawn);
  }
  restore(state) {
    this.state = structuredClone(state);
    this.collider.setTranslation(state.position);
  }
  wallNormal(dx, dz) {
    const w = this.scene.world;
    const p = this.state.position;
    // Two horizontal probes, fixed cost; only map solids, never other players.
    for (const side of [-1, 1]) {
      const ray = new RAPIER.Ray(p, { x: dz * side, y: 0, z: -dx * side });
      const hit = w.castRayAndGetNormal(ray, 0.8, true, undefined, undefined,
        this.collider, undefined, c => this.scene.solids.has(c.handle));
      if (hit && Math.abs(hit.normal.y) < 0.2) return hit.normal;
    }
    return null;
  }
  step(input) {
    const s = this.state;
    const dt = DT;
    s.yaw = input.yaw;
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.dashLeft = Math.max(0, s.dashLeft - dt);
    if (s.grounded) { s.coyote = 0.1; s.wallLeft = MOVE.wallDuration; }
    else s.coyote = Math.max(0, s.coyote - dt);
    let x = input.x, z = input.z;
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    const sin = Math.sin(s.yaw), cos = Math.cos(s.yaw);
    let dx = x * cos + z * sin, dz = -x * sin + z * cos;
    const moving = length > 0.05;
    const normal = !s.grounded && moving && input.sprint && s.wallLeft > 0
      ? this.wallNormal(dx / Math.max(length, 1), dz / Math.max(length, 1)) : null;
    let wallRunning = !!normal && s.dashLeft <= 0;
    if (input.jump && (s.coyote > 0 || wallRunning)) {
      s.vy = MOVE.jump; s.coyote = 0; s.grounded = false;
      if (wallRunning) {
        s.dashX = normal.x * 0.8 + dx * 0.4;
        s.dashZ = normal.z * 0.8 + dz * 0.4;
        s.dashLeft = 0.12;
        s.wallLeft = 0;
        wallRunning = false;
      }
    }
    if (input.dash && s.cooldown <= 0) {
      const n = Math.hypot(dx, dz);
      s.dashX = n > 0.01 ? dx / n : -sin;
      s.dashZ = n > 0.01 ? dz / n : -cos;
      s.dashLeft = MOVE.dashDuration; s.cooldown = MOVE.dashCooldown;
      s.vy = Math.max(0, s.vy);
      wallRunning = false;
    }
    if (wallRunning) {
      s.wallLeft = Math.max(0, s.wallLeft - dt);
      const dot = dx * normal.x + dz * normal.z;
      dx -= dot * normal.x; dz -= dot * normal.z;
      s.vy = Math.max(-1.5, s.vy - MOVE.wallGravity * dt);
    } else if (s.dashLeft <= 0) s.vy = Math.max(-35, s.vy - MOVE.gravity * dt);
    const speed = input.sprint ? MOVE.sprint : MOVE.walk;
    const dashing = s.dashLeft > 0;
    const desired = { x: (dashing ? s.dashX * MOVE.dashSpeed : dx * speed) * dt,
      y: s.vy * dt, z: (dashing ? s.dashZ * MOVE.dashSpeed : dz * speed) * dt };
    this.controller.computeColliderMovement(this.collider, desired, undefined,
      undefined, c => this.scene.solids.has(c.handle));
    const corrected = this.controller.computedMovement();
    s.position = { x: s.position.x + corrected.x, y: s.position.y + corrected.y,
      z: s.position.z + corrected.z };
    this.collider.setTranslation(s.position);
    s.grounded = this.controller.computedGrounded();
    if (s.grounded && s.vy < 0 || desired.y > 0 && corrected.y < desired.y * 0.5) s.vy = 0;
    s.animation = dashing ? 'dash' : wallRunning ? 'wallrun' : !s.grounded ? 'jump'
      : moving ? (input.sprint ? 'run' : 'walk') : 'idle';
    if (input.seq) s.seq = input.seq;
    return s;
  }
  dispose() {
    this.scene.world.removeCharacterController(this.controller);
    this.scene.world.removeCollider(this.collider, false);
  }
}

```

## FPS/TPS kamera

Kaynak: `client/src/camera.js`

```javascript
import * as THREE from 'three';
export class CameraRig {
  constructor(camera) {
    this.camera = camera; this.thirdPerson = true; this.distance = 4.5;
    this.ray = new THREE.Raycaster(); this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.head = new THREE.Vector3(); this.forward = new THREE.Vector3(); this.desired = new THREE.Vector3();
    this.delta = new THREE.Vector3();
  }
  toggle() { this.thirdPerson = !this.thirdPerson; }
  update(position, input, dt, solids, avatar) {
    const smooth = 1 - Math.exp(-12 * dt);
    this.distance = THREE.MathUtils.lerp(this.distance, this.thirdPerson ? 4.5 : 0, smooth);
    this.euler.set(input.pitch, input.yaw, 0);
    this.camera.quaternion.setFromEuler(this.euler);
    this.head.set(position.x, position.y + 0.53, position.z);
    this.forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.desired.copy(this.head).addScaledVector(this.forward, -this.distance);
    this.desired.y += this.distance * 0.12;
    this.delta.subVectors(this.desired, this.head);
    const length = this.delta.length();
    if (length > 0.02) {
      this.ray.set(this.head, this.delta.normalize()); this.ray.far = length + 0.2;
      const hit = this.ray.intersectObjects(solids.filter(m => m.visible), false)[0];
      if (hit) this.desired.copy(this.head).addScaledVector(this.delta, Math.max(0, hit.distance - 0.25));
    }
    // Distance is smoothed, obstruction correction is immediate to prevent clipping.
    this.camera.position.copy(this.desired);
    avatar.visible = this.distance > 0.65 && this.camera.position.distanceTo(this.head) > 0.65;
  }
}

```

## İstemci ağ katmanı

Kaynak: `client/src/network.js`

```javascript
import { io } from 'socket.io-client';
import { PROTOCOL } from '../../shared/config.js';
export class Network {
  constructor({ onJoin, onSnapshot, onStatus, onError }) {
    this.socket = io({ autoConnect: false, reconnectionDelay: 700, reconnectionDelayMax: 3000 });
    this.joined = false; this.batch = []; this.lastTick = -1;
    this.socket.on('connect', () => {
      onStatus('Odaya bağlanılıyor…');
      this.socket.timeout(6000).emit('join', { ...this.request, protocol: PROTOCOL }, (error, reply) => {
        if (error || !reply?.ok) {
          this.joined = false; this.socket.disconnect();
          onError(error ? 'Katılım yanıtı alınamadı. Oda koduyla tekrar katıl.' : reply.error); return;
        }
        this.request.create = false; this.joined = true; this.id = reply.id; this.lastTick = -1; this.batch = [];
        onStatus('BAĞLANDI'); onJoin(reply);
      });
    });
    this.socket.on('snapshot', snapshot => {
      if (!this.joined || snapshot.tick <= this.lastTick) return;
      this.lastTick = snapshot.tick; onSnapshot(snapshot);
    });
    this.socket.on('disconnect', reason => {
      this.joined = false; this.batch = []; onStatus('YENİDEN BAĞLANIYOR…');
      if (reason === 'io server disconnect') onError('Sunucu bağlantıyı kapattı. Oda koduyla tekrar katıl.');
    });
    this.socket.on('connect_error', () => onStatus('SUNUCUYA ULAŞILAMIYOR · TEKRAR DENENİYOR'));
  }
  connect(request) { this.request = request; this.socket.connect(); }
  send(command) {
    if (!this.joined || !this.socket.connected) return;
    this.batch.push(command);
    if (this.batch.length >= 3) {
      // Reliable ordered input batches; snapshot delivery may be volatile.
      this.socket.emit('inputs', this.batch); this.batch = [];
    }
  }
  leave() { this.joined = false; this.socket.disconnect(); }
}

/** 100 ms render buffer; at most 50 ms extrapolation, then freeze. */
export class RemoteBuffer {
  constructor() { this.frames = []; }
  push(state, time, receivedAt) {
    if (this.frames.length && this.frames.at(-1).state.epoch !== state.epoch) this.frames = [];
    this.frames.push({ state, time, receivedAt });
    if (this.frames.length > 12) this.frames.shift();
  }
  sample(now) {
    if (!this.frames.length) return null;
    const latest = this.frames.at(-1);
    const target = latest.time + Math.min((now - latest.receivedAt) / 1000, .15) - .1;
    let a = this.frames[0], b = latest;
    for (let i = 1; i < this.frames.length; i++) {
      b = this.frames[i]; if (b.time >= target) break; a = b;
    }
    if (a === b && this.frames.length >= 2 && target > latest.time) a = this.frames.at(-2);
    const t = a.time === b.time ? 1 : Math.max(0, Math.min(2, (target - a.time) / (b.time - a.time)));
    const p = a.state.position, q = b.state.position;
    const angle = Math.atan2(Math.sin(b.state.yaw - a.state.yaw), Math.cos(b.state.yaw - a.state.yaw));
    return { ...b.state, position: { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t,
      z: p.z + (q.z - p.z) * t }, yaw: a.state.yaw + angle * Math.min(t, 1) };
  }
}

```

## Sunucu oda ve snapshot mantığı

Kaynak: `server/src/room.js`

```javascript
import { createHash } from 'node:crypto';
import { DT, MAX_PLAYERS, LEVEL_VERSION, idleInput, PROTOCOL } from '../../shared/config.js';
import { buildLevel, SECTORS } from '../../shared/levels.js';
import { PhysicsScene, CharacterMotor, initialState } from '../../shared/simulation.js';
import { parseInput } from '../../shared/protocol.js';
import { near, newPuzzle, updatePuzzle } from './puzzle.js';

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
      const checkpoint = record?.sector === this.sector && record.checkpoint === 1 && this.puzzle.latched ? 1 : 0;
      const spawn = checkpoint ? this.level.checkpoint : this.level.spawn;
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
      p.motor.step(input);
      if (p.motor.state.position.y < this.level.fallY) {
        const epoch = p.motor.state.epoch + 1;
        p.motor.restore(initialState(p.checkpoint ? this.level.checkpoint : this.level.spawn, epoch));
        p.queue = []; p.receivedSeq = 0; p.interact = false;
      }
      if (this.puzzle.latched && !p.checkpoint && near(p.motor.state.position, this.level.checkpoint, 5)) {
        p.checkpoint = 1; this.updateRoster(p); this.dirty = true;
      }
    }
    if (updatePuzzle(this.puzzle, active, this.level, this.time)) {
      this.scene.setPuzzle(this.puzzle);
      if (this.puzzle.latched) this.dirty = true;
    }
    this.scene.step();
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

```

## Co-op terminal ve kapı

Kaynak: `server/src/puzzle.js`

```javascript
export const near = (p, target, radius = 2.4) => Math.hypot(
  p.x - target.x, p.y - target.y, p.z - target.z) <= radius;
export function newPuzzle(latched = false) {
  return { open: latched, latched, holderId: null, activeUntil: 0, cooldownUntil: 0,
    participants: [], revision: 0 };
}
/** Call exclusively inside the room's simulation tick. Client cannot set puzzle state. */
export function updatePuzzle(puzzle, players, level, now) {
  if (puzzle.latched) return false;
  const before = JSON.stringify(puzzle);
  let holder = players.find(p => p.id === puzzle.holderId);
  if (holder && (!holder.interact || !near(holder.motor.state.position, level.terminalA)
    || now >= puzzle.activeUntil)) {
    puzzle.holderId = null; puzzle.open = false; puzzle.activeUntil = 0;
    puzzle.cooldownUntil = now + 1; holder = null;
  }
  if (!holder && now >= puzzle.cooldownUntil) {
    holder = players.find(p => p.interact && near(p.motor.state.position, level.terminalA));
    if (holder) {
      puzzle.holderId = holder.id; puzzle.activeUntil = now + 8; puzzle.open = true;
    }
  }
  if (holder && puzzle.open) {
    const receiver = players.find(p => p.id !== holder.id && p.interact
      && near(p.motor.state.position, level.terminalB));
    if (receiver) {
      puzzle.latched = true; puzzle.open = true;
      puzzle.participants = [holder.id, receiver.id];
      puzzle.holderId = null; puzzle.activeUntil = 0;
    }
  }
  // Includes the disconnected-holder case.
  if (!holder && puzzle.holderId) {
    puzzle.holderId = null; puzzle.open = false; puzzle.activeUntil = 0;
  }
  const changed = before !== JSON.stringify(puzzle);
  if (changed) puzzle.revision++;
  return changed;
}

```

## Input doğrulaması

Kaynak: `shared/protocol.js`

```javascript
import { PROTOCOL } from './config.js';
export function parseJoin(v) {
  if (!v || v.protocol !== PROTOCOL || typeof v.room !== 'string'
    || !/^[A-Z0-9]{6}$/.test(v.room) || typeof v.token !== 'string'
    || !/^[a-zA-Z0-9-]{32,80}$/.test(v.token) || typeof v.name !== 'string') return null;
  return { room: v.room, token: v.token, name: v.name.trim().slice(0, 20) || 'Gezgin', create: v.create === true };
}
export function parseInput(v, epoch) {
  if (!v || !Number.isSafeInteger(v.seq) || v.seq < 1 || v.epoch !== epoch
    || !Number.isFinite(v.x) || !Number.isFinite(v.z) || !Number.isFinite(v.yaw)
    || Math.abs(v.x) > 1 || Math.abs(v.z) > 1 || Math.abs(v.yaw) > Math.PI * 2) return null;
  for (const key of ['sprint', 'jump', 'dash', 'interact']) if (typeof v[key] !== 'boolean') return null;
  return { seq: v.seq, epoch, x: v.x, z: v.z, yaw: v.yaw,
    sprint: v.sprint, jump: v.jump, dash: v.dash, interact: v.interact };
}

```
