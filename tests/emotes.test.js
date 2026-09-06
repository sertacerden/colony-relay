import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, PhysicsScene, CharacterMotor } from '../shared/simulation.js';
import { buildLevel } from '../shared/levels.js';
import { idleInput, EMOTES } from '../shared/config.js';
import { parseInput } from '../shared/protocol.js';
import { emotePose } from '../client/src/emotes.js';
await initPhysics();
test('emotes are grounded, time limited and cancelled by gameplay inputs', () => {
  const level = buildLevel(0), scene = new PhysicsScene(level), motor = new CharacterMotor(scene, level.spawn);
  const step = command => { motor.step({ ...idleInput(), ...command }); scene.step(); };
  for (let i = 0; i < 90; i++) step({});
  for (const name of Object.keys(EMOTES)) {
    const start = { ...motor.state.position };
    step({ emote: name }); assert.equal(motor.state.emote, name);
    for (let i = 0; i < 30; i++) step({});
    assert.ok(emotePose(motor.state));
    assert.ok(Math.abs(motor.state.position.x - start.x) < .001, 'cosmetic pose does not move physics');
    step({ interact: true }); assert.equal(motor.state.emote, null);
  }
  step({ emote: 'wave' });
  for (let i = 0; i < 190; i++) step({});
  assert.equal(motor.state.emote, null);
  step({ emote: 'dance' }); step({ x: 1 }); assert.equal(motor.state.emote, null);
  step({ emote: 'smoke' }); step({ jump: true }); assert.equal(motor.state.emote, null);
  step({ emote: 'dance' }); assert.equal(motor.state.emote, null, 'cannot start airborne');
  motor.dispose(); scene.free();
});
test('emote allowlist rejects injected names and malformed types', () => {
  const input = { ...idleInput(1), seq: 1 };
  for (const emote of ['dance', 'wave', 'smoke']) assert.equal(parseInput({ ...input, emote }, 1).emote, emote);
  for (const emote of ['fly', '__proto__', ['dance'], 3, {}]) assert.equal(parseInput({ ...input, emote }, 1), null);
});
