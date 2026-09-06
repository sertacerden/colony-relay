import RAPIER from '@dimforge/rapier3d-compat';
import { DT, MOVE, EMOTES } from './config.js';
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
    yaw: 0, animation: 'idle', emote: null, emoteLeft: 0, epoch, seq: 0 };
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
    s.emoteLeft = Math.max(0, (s.emoteLeft || 0) - dt);
    if (!s.emoteLeft || moving || input.jump || input.dash || input.interact || !s.grounded) {
      s.emote = null; s.emoteLeft = 0;
    }
    if (Object.hasOwn(EMOTES, input.emote) && s.grounded && !moving
      && !input.jump && !input.dash && !input.interact && !dashing) {
      // A repeated press toggles the emote off; durations cannot be supplied by clients.
      s.emote = s.emote === input.emote ? null : input.emote;
      s.emoteLeft = s.emote ? EMOTES[s.emote] : 0;
    }
    if (input.seq) s.seq = input.seq;
    return s;
  }
  dispose() {
    this.scene.world.removeCharacterController(this.controller);
    this.scene.world.removeCollider(this.collider, false);
  }
}
