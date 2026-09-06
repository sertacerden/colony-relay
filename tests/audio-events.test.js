import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudioEvents } from '../client/src/audio-events.js';
import { GameAudio } from '../client/src/audio.js';
const snapshot = () => ({ room: 'TEST01', sector: 0, completed: false, puzzle: { open: false, latched: false },
  players: [{ id: 'me', checkpoint: 0, state: { epoch: 1 } }] });
test('audio cues fire on transitions once, never on join/reconnect baseline', () => {
  const played = [], events = new GameAudioEvents(name => played.push(name));
  let state = snapshot(); events.snapshot(state, 'me', true);
  assert.deepEqual(played, []);
  state = structuredClone(state); state.puzzle.open = true;
  events.snapshot(state, 'me'); events.snapshot(state, 'me');
  assert.deepEqual(played, ['terminal', 'bridge-open']);
  state = structuredClone(state); state.puzzle.latched = true;
  events.snapshot(state, 'me'); events.snapshot(state, 'me');
  assert.equal(played.filter(n => n === 'latch').length, 1);
  events.snapshot(snapshot(), 'me', true); assert.equal(played.includes('bridge-close'), false);
  state = snapshot(); state.players[0].checkpoint = 1; events.snapshot(state, 'me');
  state = structuredClone(state); state.players[0].state.epoch++; events.snapshot(state, 'me');
  assert.deepEqual(played.slice(-2), ['checkpoint', 'respawn']);
});
test('movement cues use successful actions and limit footstep frequency', () => {
  const played = [], events = new GameAudioEvents(name => played.push(name));
  const before = { epoch: 1, position: { x: 0, z: 0 }, grounded: true, vy: 0, cooldown: .5 };
  const after = { ...before, position: { x: .1, z: 0 }, animation: 'run' };
  events.movement(before, after, { dash: true, jump: true }, 0);
  events.movement(before, after, {}, 100); events.movement(before, after, {}, 300);
  assert.deepEqual(played, ['step', 'step']);
  events.movement(before, { ...after, cooldown: 1.2, grounded: false }, { dash: true }, 350);
  assert.equal(played.at(-1), 'dash');
  events.movement(before, { ...after, grounded: false, vy: 9 }, { jump: true }, 400);
  assert.equal(played.at(-1), 'jump');
});
test('audio preferences survive reload and malformed storage falls back safely', () => {
  let saved = '{bad json';
  const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  const audio = new GameAudio({ storage, automatic: false });
  assert.equal(audio.settings.music, .38);
  audio.set('music', 7); audio.set('effects', -.2); audio.set('muted', true);
  const reloaded = new GameAudio({ storage, automatic: false });
  assert.deepEqual(reloaded.settings, { music: 1, effects: 0, muted: true });
});
