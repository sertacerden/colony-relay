export const DT = 1 / 60;
export const SNAPSHOT_EVERY = 3;
export const MAX_PLAYERS = 6;
export const PROTOCOL = 2;
export const LEVEL_VERSION = 2;
export const EMOTES = Object.freeze({ dance: 8, wave: 3, smoke: 9 });
export const MOVE = Object.freeze({ walk: 5.8, sprint: 9, jump: 9, gravity: 24,
  dashSpeed: 19, dashDuration: 0.16, dashCooldown: 1.2, wallDuration: 1.15,
  wallGravity: 3, radius: 0.32, halfHeight: 0.5 });
export const idleInput = (epoch = 0) => ({ seq: 0, epoch, x: 0, z: 0, yaw: 0,
  sprint: false, jump: false, dash: false, interact: false, emote: null });
