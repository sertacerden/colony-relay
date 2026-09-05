import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, PhysicsScene, CharacterMotor } from '../shared/simulation.js';
import { buildLevel, SECTORS } from '../shared/levels.js';
import { idleInput, DT } from '../shared/config.js';
import { newPuzzle, updatePuzzle } from '../server/src/puzzle.js';
await initPhysics();
test('two players physically cross and latch every sample sector within its 8 second window', () => {
  for (let index = 0; index < SECTORS.length; index++) {
    const level = buildLevel(index), scene = new PhysicsScene(level), puzzle = newPuzzle();
    const a = { id: 'a', motor: new CharacterMotor(scene, level.spawn), interact: false };
    const b = { id: 'b', motor: new CharacterMotor(scene, { ...level.spawn, x: 1 }), interact: false };
    let time = 0;
    const steer = (p, target, interact) => {
      const pos = p.motor.state.position, dx = target.x - pos.x, dz = target.z - pos.z;
      const d = Math.hypot(dx, dz);
      p.interact = interact;
      p.motor.step({ ...idleInput(), x: d > .2 ? dx / d : 0, z: d > .2 ? dz / d : 0, sprint: true, interact });
    };
    const tick = () => { time += DT; updatePuzzle(puzzle, [a, b], level, time); scene.setPuzzle(puzzle); scene.step(); };
    for (let i = 0; i < 120; i++) { steer(a, level.terminalA, false); steer(b, level.spawn, false); tick(); }
    const began = time;
    for (let i = 0; i < 460 && !puzzle.latched; i++) {
      steer(a, level.terminalA, true);
      steer(b, b.motor.state.position.z > -33 ? { x: 0, z: -34 } : level.terminalB, true);
      tick();
      assert.ok(b.motor.state.position.y > -.1, 'runner must remain on the bridge');
    }
    assert.equal(puzzle.latched, true, `sector ${index} should be solvable`);
    assert.ok(time - began < 8);
    // Return operator can cross after the latch, with no third player.
    for (let i = 0; i < 260; i++) {
      steer(a, a.motor.state.position.z > -33 ? { x: 0, z: -34 } : level.checkpoint, false);
      steer(b, level.terminalB, false); tick();
    }
    assert.ok(a.motor.state.position.z < -36 && a.motor.state.position.y > 0);
    a.motor.dispose(); b.motor.dispose(); scene.free();
  }
});
