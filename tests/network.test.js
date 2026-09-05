import test from 'node:test';
import assert from 'node:assert/strict';
import { io as client } from 'socket.io-client';
import { createGameServer } from '../server/src/index.js';
import { parseInput } from '../shared/protocol.js';
import { idleInput } from '../shared/config.js';
class MemoryStore {
  constructor() { this.map = new Map(); }
  async load(id) { return this.map.get(id) || null; }
  async save(item, expected) {
    if ((this.map.get(item.room)?.version || 0) !== expected) throw new Error('conflict');
    this.map.set(item.room, structuredClone({ ...item, version: expected + 1 })); return expected + 1;
  }
}
test('6 real Socket.IO clients, seventh rejected, rooms isolated, reconnect restores identity', async () => {
  const game = await createGameServer({ store: new MemoryStore(), autoTick: false });
  await new Promise(resolve => game.http.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${game.http.address().port}`;
  const sockets = [];
  const open = async (n, room = 'TEST01', create = false) => {
    const socket = client(url, { transports: ['websocket'], forceNew: true, reconnection: false }); sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    const reply = await socket.timeout(2000).emitWithAck('join', { protocol: 1, room, create,
      name: `Player ${n}`, token: `test-token-${String(n).padStart(32, '0')}` });
    return { socket, reply };
  };
  try {
    const players = [];
    for (let n = 0; n < 6; n++) players.push(await open(n, 'TEST01', n === 0));
    assert.ok(players.every(p => p.reply.ok));
    assert.equal((await open(6)).reply.ok, false);
    const other = await open(7, 'OTHER1', true); assert.equal(other.reply.ok, true);
    const room = game.rooms.get('TEST01');
    let leaked = false; other.socket.once('snapshot', () => { leaked = true; });
    const snapPromise = new Promise(resolve => players[0].socket.once('snapshot', resolve));
    game.io.to('TEST01').emit('snapshot', room.snapshot());
    assert.equal((await snapPromise).players.length, 6);
    const p = room.players.get(players[0].reply.id);
    const command = { ...idleInput(p.motor.state.epoch), seq: 1, z: -1 };
    players[0].socket.emit('inputs', [command]);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(p.queue.length, 1); room.step(); assert.equal(p.motor.state.seq, 1);
    assert.equal(leaked, false);
    const oldId = players[0].reply.id;
    players[0].socket.disconnect(); await new Promise(resolve => setTimeout(resolve, 30));
    const rejoined = await open(0); assert.equal(rejoined.reply.ok, true); assert.equal(rejoined.reply.id, oldId);
    assert.equal(room.players.size, 6);
    assert.equal((await fetch(`${url}/health`)).status, 200);
  } finally { sockets.forEach(socket => socket.disconnect()); await game.close(); }
});
test('protocol rejects invalid movement, old epoch and client-supplied position', () => {
  const valid = { ...idleInput(3), seq: 1 };
  assert.ok(parseInput(valid, 3));
  assert.equal(parseInput({ ...valid, x: Infinity }, 3), null);
  assert.equal(parseInput({ ...valid, x: 10 }, 3), null);
  assert.equal(parseInput(valid, 4), null);
  assert.equal(parseInput({ ...valid, jump: 'true' }, 3), null);
  assert.equal(parseInput({ ...valid, position: { x: 999 } }, 3).position, undefined);
});
