import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, PhysicsScene, CharacterMotor, initialState } from '../shared/simulation.js';
import { buildLevel } from '../shared/levels.js';
import { idleInput, DT } from '../shared/config.js';
await initPhysics();
const step = (scene, motor, command, count = 1) => {
  for (let i = 0; i < count; i++) { motor.step(command); scene.step(); }
};
test('capsule settles, jumps and cannot dash through a wall', () => {
  const level = buildLevel(0), scene = new PhysicsScene(level), motor = new CharacterMotor(scene, level.spawn);
  const idle = idleInput(); step(scene, motor, idle, 90);
  assert.equal(motor.state.grounded, true);
  assert.ok(motor.state.position.y > .8 && motor.state.position.y < .9);
  step(scene, motor, { ...idle, jump: true }); step(scene, motor, idle, 15);
  assert.ok(motor.state.position.y > 2, 'jump should leave ground');
  motor.restore(initialState({ x: 6, y: 1, z: 0 })); scene.step();
  step(scene, motor, { ...idle, x: 1, dash: true });
  step(scene, motor, { ...idle, x: 1, sprint: true }, 30);
  assert.ok(motor.state.position.x < 6.8, 'wall must stop swept dash');
  motor.dispose(); scene.free();
});
test('dash cooldown, normalized diagonal and bounded wall-run', () => {
  const level = buildLevel(0), scene = new PhysicsScene(level), motor = new CharacterMotor(scene, level.spawn);
  const idle = idleInput(); step(scene, motor, idle, 60);
  const p = { ...motor.state.position };
  step(scene, motor, { ...idle, x: 1, z: -1 });
  assert.ok(Math.hypot(motor.state.position.x - p.x, motor.state.position.z - p.z) <= 5.8 * DT + .001);
  step(scene, motor, { ...idle, dash: true }); const cooldown = motor.state.cooldown;
  step(scene, motor, { ...idle, dash: true }); assert.ok(motor.state.cooldown < cooldown);
  motor.restore(initialState({ x: 2.8, y: 2.5, z: -48 })); scene.step();
  step(scene, motor, { ...idle, z: -1, sprint: true }); assert.equal(motor.state.animation, 'wallrun');
  step(scene, motor, { ...idle, z: -1, sprint: true }, 80);
  assert.ok(motor.state.wallLeft < .01 || motor.state.grounded);
  motor.dispose(); scene.free();
});
test('server state restore + replay matches continuous shared simulation', () => {
  const level = buildLevel(0), a = new PhysicsScene(level), b = new PhysicsScene(level);
  const ma = new CharacterMotor(a, level.spawn), mb = new CharacterMotor(b, level.spawn);
  step(a, ma, idleInput(), 60); step(b, mb, idleInput(), 60);
  const commands = Array.from({ length: 35 }, (_, i) => ({ ...idleInput(), seq: i + 1,
    z: -1, x: .1, jump: i === 10, dash: i === 20, sprint: true }));
  for (const command of commands.slice(0, 15)) step(a, ma, command);
  const authoritative = structuredClone(ma.state);
  for (const command of commands.slice(15)) step(a, ma, command);
  mb.restore(authoritative); b.step();
  for (const command of commands.slice(15)) step(b, mb, command);
  assert.ok(Math.hypot(ma.state.position.x - mb.state.position.x,
    ma.state.position.y - mb.state.position.y, ma.state.position.z - mb.state.position.z) < .002);
  ma.dispose(); mb.dispose(); a.free(); b.free();
});
