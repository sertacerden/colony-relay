import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStore, validateSave } from '../server/src/storage.js';
test('atomic save reload and stale write rejection', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'colony-test-'));
  try {
    const store = new FileStore(dir);
    const record = { room: 'TEST01', schemaVersion: 1, levelVersion: 1, sector: 1,
      roster: { guest: { checkpoint: 1 } }, puzzle: { latched: true } };
    assert.equal(await store.load('TEST01'), null);
    assert.equal(await store.save(record, 0), 1);
    const saved = validateSave(await new FileStore(dir).load('TEST01'));
    assert.equal(saved.sector, 1); assert.equal(saved.puzzle.latched, true);
    await assert.rejects(store.save(record, 0), /conflict/);
    assert.equal(await store.save(record, 1), 2);
    assert.throws(() => validateSave({ ...record, levelVersion: 99 }), /Incompatible/);
    await assert.rejects(store.load('../../bad'), /Invalid/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
