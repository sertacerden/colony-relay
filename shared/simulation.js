import RAPIER from '@dimforge/rapier3d-compat';
import { DT, MOVE, EMOTES } from './config.js';
import { dynamicPosition } from './dynamics.js';
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
    this.moving = new Map();
    for (const b of [...level.boxes, ...(level.invisibleWalls || []), level.bridge, ...(level.movers || [])]) {
      const c = this.world.createCollider(RAPIER.ColliderDesc
        .cuboid(b.size.x / 2, b.size.y / 2, b.size.z / 2)
        .setTranslation(b.position.x, b.position.y, b.position.z));
      this.solids.add(c.handle);
      this.boxes.set(b.id, c);
      if(b.motion)this.moving.set(b.id,{item:b,previous:{...b.position},position:{...b.position},delta:{x:0,y:0,z:0}});
    }
    this.setPuzzle({ open: false, latched: false });
    this.prepare(0, {open:false,latched:false}, true);
  }
  setPuzzle(puzzle) {
    this.boxes.get('bridge').setEnabled(puzzle.latched || (puzzle.open && this.level.puzzleType !== 'operator'));
    this.boxes.get('exit-gate').setEnabled(!puzzle.latched);
  }
  prepare(time,puzzle,reset=false,pranks={}) {
    for(const trap of this.level.traps || [])if(trap.type==='drop')this.boxes.get(trap.floorId)?.setEnabled(!(pranks.drops?.[trap.floorId]>time));
    this.setPuzzle(puzzle);
    for(const [id,m] of this.moving){
      m.previous=m.position;
      m.position=dynamicPosition(m.item,m.item.motion.controlled?puzzle.motionTime||0:time);
      if(reset)m.previous=m.position;
      m.delta={x:m.position.x-m.previous.x,y:m.position.y-m.previous.y,z:m.position.z-m.previous.z};
      this.boxes.get(id).setTranslation(m.position);
    }
    this.world.step();
  }
  carry(position) {
    for(const m of this.moving.values()){
      const p=m.previous,s=m.item.size;
      if(Math.abs(position.y-.82-(p.y+s.y/2))<.14
        &&Math.abs(position.x-p.x)<s.x/2+.15&&Math.abs(position.z-p.z)<s.z/2+.15)return m.delta;
    }
    return {x:0,y:0,z:0};
  }
  step() { this.world.step(); }
  free() { this.world.free(); }
}

export function initialState(position, epoch = 0) {
  return { position: { ...position }, vy: 0, grounded: false, coyote: 0,
    dashLeft: 0, cooldown: 0, dashX: 0, dashZ: -1, wallLeft: MOVE.wallDuration,
    knockX:0, knockZ:0, knockLeft:0, prank:null, prankLeft:0, prankSeq:0,
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
    s.knockLeft=Math.max(0,(s.knockLeft||0)-dt);
    s.prankLeft=Math.max(0,(s.prankLeft||0)-dt);
    if(!s.prankLeft)s.prank=null;
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
    if(s.grounded){
      const carry=this.scene.carry(s.position);
      // The platform collider is already at its new height. Lift the rider out
      // of that swept surface before querying movement; authored lifts have clear headroom.
      if(carry.y>0){s.position.y+=carry.y;this.collider.setTranslation(s.position);}
      else desired.y+=carry.y;
      desired.x+=carry.x;desired.z+=carry.z;
    }
    if(s.knockLeft>0){desired.x+=s.knockX*dt;desired.z+=s.knockZ*dt;s.knockX*=Math.exp(-2*dt);s.knockZ*=Math.exp(-2*dt);}
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
    if (Object.hasOwn(EMOTES, input.emote) && s.knockLeft<=0 && s.grounded && !moving
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
