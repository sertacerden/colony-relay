import { PROTOCOL, EMOTES } from './config.js';
export function parseJoin(v) {
  if (!v || v.protocol !== PROTOCOL || typeof v.room !== 'string'
    || !/^[A-Z0-9]{6}$/.test(v.room) || typeof v.token !== 'string'
    || !/^[a-zA-Z0-9-]{32,80}$/.test(v.token) || typeof v.name !== 'string') return null;
  return { room: v.room, token: v.token, name: v.name.trim().slice(0, 20) || 'Gezgin', create: v.create === true };
}
export function parseInput(v, epoch) {
  if (!v || !Number.isSafeInteger(v.seq) || v.seq < 1 || v.epoch !== epoch
    || !Number.isFinite(v.x) || !Number.isFinite(v.z) || !Number.isFinite(v.yaw)
    || Math.abs(v.x) > 1 || Math.abs(v.z) > 1 || Math.abs(v.yaw) > Math.PI * 2) return null;
  for (const key of ['sprint', 'jump', 'dash', 'interact']) if (typeof v[key] !== 'boolean') return null;
  if (v.emote != null && (typeof v.emote !== 'string' || !Object.hasOwn(EMOTES, v.emote))) return null;
  return { seq: v.seq, epoch, x: v.x, z: v.z, yaw: v.yaw,
    sprint: v.sprint, jump: v.jump, dash: v.dash, interact: v.interact, emote: v.emote ?? null };
}
