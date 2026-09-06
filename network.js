import { io } from 'socket.io-client';
import { PROTOCOL } from '../../shared/config.js';
export class Network {
  constructor({ onJoin, onSnapshot, onStatus, onError }) {
    this.socket = io({ autoConnect: false, reconnectionDelay: 700, reconnectionDelayMax: 3000 });
    this.joined = false; this.batch = []; this.lastTick = -1;
    this.socket.on('connect', () => {
      onStatus('Odaya bağlanılıyor…');
      this.socket.timeout(6000).emit('join', { ...this.request, protocol: PROTOCOL }, (error, reply) => {
        if (error || !reply?.ok) {
          this.joined = false; this.socket.disconnect();
          onError(error ? 'Katılım yanıtı alınamadı. Oda koduyla tekrar katıl.' : reply.error); return;
        }
        this.request.create = false; this.joined = true; this.id = reply.id; this.lastTick = -1; this.batch = [];
        onStatus('BAĞLANDI'); onJoin(reply);
      });
    });
    this.socket.on('snapshot', snapshot => {
      if (!this.joined || snapshot.tick <= this.lastTick) return;
      this.lastTick = snapshot.tick; onSnapshot(snapshot);
    });
    this.socket.on('disconnect', reason => {
      this.joined = false; this.batch = []; onStatus('YENİDEN BAĞLANIYOR…');
      if (reason === 'io server disconnect') onError('Sunucu bağlantıyı kapattı. Oda koduyla tekrar katıl.');
    });
    this.socket.on('connect_error', () => onStatus('SUNUCUYA ULAŞILAMIYOR · TEKRAR DENENİYOR'));
  }
  connect(request) { this.request = request; this.socket.connect(); }
  send(command) {
    if (!this.joined || !this.socket.connected) return;
    this.batch.push(command);
    if (this.batch.length >= 3) {
      // Reliable ordered input batches; snapshot delivery may be volatile.
      this.socket.emit('inputs', this.batch); this.batch = [];
    }
  }
  leave() { this.joined = false; this.socket.disconnect(); }
}

/** 100 ms render buffer; at most 50 ms extrapolation, then freeze. */
export class RemoteBuffer {
  constructor() { this.frames = []; }
  push(state, time, receivedAt) {
    if (this.frames.length && this.frames.at(-1).state.epoch !== state.epoch) this.frames = [];
    this.frames.push({ state, time, receivedAt });
    if (this.frames.length > 12) this.frames.shift();
  }
  sample(now) {
    if (!this.frames.length) return null;
    const latest = this.frames.at(-1);
    const target = latest.time + Math.min((now - latest.receivedAt) / 1000, .15) - .1;
    let a = this.frames[0], b = latest;
    for (let i = 1; i < this.frames.length; i++) {
      b = this.frames[i]; if (b.time >= target) break; a = b;
    }
    if (a === b && this.frames.length >= 2 && target > latest.time) a = this.frames.at(-2);
    const t = a.time === b.time ? 1 : Math.max(0, Math.min(2, (target - a.time) / (b.time - a.time)));
    const p = a.state.position, q = b.state.position;
    const angle = Math.atan2(Math.sin(b.state.yaw - a.state.yaw), Math.cos(b.state.yaw - a.state.yaw));
    return { ...b.state, position: { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t,
      z: p.z + (q.z - p.z) * t }, yaw: a.state.yaw + angle * Math.min(t, 1),
      emoteLeft: a.state.emote === b.state.emote
        ? Math.max(0, (a.state.emoteLeft || 0) + ((b.state.emoteLeft || 0) - (a.state.emoteLeft || 0)) * t)
        : b.state.emoteLeft };
  }
}
