import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { Server } from 'socket.io';
import { initPhysics } from '../../shared/simulation.js';
import { DT, SNAPSHOT_EVERY } from '../../shared/config.js';
import { parseJoin } from '../../shared/protocol.js';
import { Room } from './room.js';
import { FileStore, DynamoStore, validateSave } from './storage.js';

export async function createGameServer({ store, autoTick = true } = {}) {
  await initPhysics();
  store ||= process.env.SAVE_DRIVER === 'dynamo' ? await DynamoStore.create() : new FileStore();
  const root = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  // Resolve from server/src: ../../ is project root.
  const dist = resolve(root);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.glb':'model/gltf-binary', '.gltf':'model/gltf+json', '.json':'application/json', '.riv':'application/octet-stream', '.mjs':'text/javascript' };
  const http = createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      const path = resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!path.startsWith(dist + sep)) { res.writeHead(403); return res.end(); }
      const bytes = await readFile(path);
      res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': pathname.startsWith('/assets/') ? 'public,max-age=31536000,immutable' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(404); res.end('Sayfa bulunamadı. Oyun derlemesi henüz hazır olmayabilir.'); }
  });
  const origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3001').split(',');
  const io = new Server(http, { maxHttpBufferSize: 8192, pingTimeout: 10_000,
    cors: { origin: origins, methods: ['GET', 'POST'] },
    allowRequest: (req, callback) => callback(null, !req.headers.origin || origins.includes(req.headers.origin)) });
  const rooms = new Map(), loading = new Map();
  const maxRooms = Math.max(1, Number(process.env.MAX_ROOMS) || 32);
  async function getRoom(id, create) {
    if (rooms.has(id)) { if (create) throw new Error('Oda kodu kullanımda.'); return rooms.get(id); }
    if (loading.has(id)) { if (create) throw new Error('Oda kodu kullanımda.'); return loading.get(id); }
    if (rooms.size + loading.size >= maxRooms) throw new Error('Sunucu oda sınırına ulaştı.');
    const promise = (async () => {
      const saved = validateSave(await store.load(id));
      if (saved && create) throw new Error('Oda kodu kullanımda.');
      if (!saved && !create) throw new Error('Oda bulunamadı. Kodu kontrol et.');
      const room = new Room(id, io, store, saved);
      rooms.set(id, room); return room;
    })().finally(() => loading.delete(id));
    loading.set(id, promise); return promise;
  }
  io.on('connection', socket => {
    let joining = false, attempts = 0;
    socket.on('join', async (raw, ack) => {
      if (typeof ack !== 'function') return;
      if (joining || socket.data.room || ++attempts > 10) return ack({ ok: false, error: 'Katılım sınırı. Yeniden bağlan.' });
      const request = parseJoin(raw);
      if (!request) return ack({ ok: false, error: 'Geçersiz oda veya protokol.' });
      joining = true;
      try {
        const room = await getRoom(request.room, request.create);
        if (!socket.connected) return;
        ack({ ok: true, ...room.join(socket, request) });
      } catch (error) { ack({ ok: false, error: error.message }); }
      finally { joining = false; }
    });
    socket.on('inputs', batch => rooms.get(socket.data.room)?.receive(socket.data.player, batch));
    socket.on('disconnect', () => rooms.get(socket.data.room)?.disconnect(socket.data.player, socket));
  });
  let last = performance.now(), accumulator = 0;
  const tick = () => {
    const now = performance.now(); accumulator += Math.min(0.1, (now - last) / 1000); last = now;
    let steps = 0;
    while (accumulator >= DT && steps++ < 5) {
      for (const room of rooms.values()) {
        room.step();
        if (room.tick % SNAPSHOT_EVERY === 0) io.to(room.id).volatile.emit('snapshot', room.snapshot());
      }
      accumulator -= DT;
    }
    if (steps > 5) accumulator = 0;
  };
  const timer = autoTick ? setInterval(tick, 8) : null;
  const cleanup = setInterval(async () => {
    for (const [id, room] of rooms) {
      if (!room.players.size && Date.now() - room.lastOccupied > 120_000) {
        try {
          await room.save();
          if (room.dirty || room.players.size) continue;
          room.free(); rooms.delete(id);
        } catch { /* preserve unsaved room for next retry */ }
      }
    }
  }, 30_000);
  return { http, io, rooms, async close() {
    clearInterval(timer); clearInterval(cleanup);
    // Stop input first, then drain save queues before releasing WASM worlds.
    io.disconnectSockets(true);
    for (const room of rooms.values()) {
      if (room.saving) await room.saving.catch(() => {});
      room.retryAt = 0;
      await room.save(); room.free();
    }
    await new Promise(resolveClose => io.close(resolveClose));
  } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const game = await createGameServer();
  const port = Number(process.env.PORT) || 3001;
  game.http.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`Colony Relay listening on :${port}`));
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
    if (closing) return; closing = true;
    try { await game.close(); process.exit(0); } catch (e) { console.error(e); process.exit(1); }
  });
}
