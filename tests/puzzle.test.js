import test from 'node:test';
import assert from 'node:assert/strict';
import { newPuzzle, updatePuzzle } from '../server/src/puzzle.js';
import { buildLevel } from '../shared/levels.js';
import { initPhysics, PhysicsScene } from '../shared/simulation.js';
await initPhysics();
const level = buildLevel(0);
const player = (id, position, interact = true) => ({ id, interact, motor: { state: { position: { ...position } } } });
test('remote activation denied; bridge expires; holder disconnect closes it', () => {
  const puzzle = newPuzzle(), a = player('a', level.spawn);
  updatePuzzle(puzzle, [a], level, 0); assert.equal(puzzle.open, false);
  a.motor.state.position = level.terminalA;
  updatePuzzle(puzzle, [a], level, 1); assert.equal(puzzle.open, true);
  updatePuzzle(puzzle, [a], level, 9.1); assert.equal(puzzle.open, false);
  updatePuzzle(puzzle, [a], level, 11); assert.equal(puzzle.open, true);
  updatePuzzle(puzzle, [], level, 12); assert.equal(puzzle.open, false);
});
test('two distinct players latch bridge and open physical exit gate', () => {
  const puzzle = newPuzzle(), scene = new PhysicsScene(level);
  const a = player('a', level.terminalA), b = player('b', level.terminalB);
  assert.equal(scene.boxes.get('bridge').isEnabled(), false);
  assert.equal(scene.boxes.get('exit-gate').isEnabled(), true);
  updatePuzzle(puzzle, [a], level, 0); scene.setPuzzle(puzzle);
  assert.equal(scene.boxes.get('bridge').isEnabled(), true);
  updatePuzzle(puzzle, [a, b], level, 1); scene.setPuzzle(puzzle);
  assert.equal(puzzle.latched, true);
  assert.deepEqual(puzzle.participants, ['a', 'b']);
  assert.equal(scene.boxes.get('exit-gate').isEnabled(), false);
  updatePuzzle(puzzle, [], level, 100); assert.equal(puzzle.open, true);
  scene.free();
});
test('one player moving between terminals never latches', () => {
  const puzzle = newPuzzle(), a = player('a', level.terminalA);
  updatePuzzle(puzzle, [a], level, 0);
  a.motor.state.position = level.terminalB;
  updatePuzzle(puzzle, [a], level, .1);
  assert.equal(puzzle.latched, false);
});
