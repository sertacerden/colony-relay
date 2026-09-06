import './style.css';
import * as THREE from 'three';
import { DT, MOVE } from '../../shared/config.js';
import { buildLevel, SECTORS } from '../../shared/levels.js';
import { initPhysics, PhysicsScene, CharacterMotor } from '../../shared/simulation.js';
import { WorldView } from './world.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { Network, RemoteBuffer } from './network.js';
import { GameAudio } from './audio.js';
import { GameAudioEvents } from './audio-events.js';

const $ = id => document.getElementById(id);
const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 2.4;
const colors = ['#65e9f3', '#c3fa7a', '#f4a36d', '#b39afa', '#f68bac', '#f8dc81'];
let view, scene, motor, level, rig, input, net, snapshot, snapshotAt = 0;
let playerId = null, roomEpoch = null, seq = 0, pending = [], connectedOnce = false;
let accumulator = 0, lastFrame = performance.now(), lastHud = 0, latency = 0;
const remote = new Map(), visualError = new THREE.Vector3(), renderPosition = new THREE.Vector3();
const btns = [...document.querySelectorAll('#join-form button')];
const sound = new GameAudio();
const soundEvents = new GameAudioEvents(name => sound.play(name));
function paintAudioSettings() {
  for (const key of ['music', 'effects']) {
    $(`${key}-volume`).value = Math.round(sound.settings[key] * 100);
    $(`${key}-value`).textContent = `${Math.round(sound.settings[key] * 100)}%`;
  }
  $('mute-audio').textContent = sound.settings.muted ? 'Sesi aç · M' : 'Sesi kapat · M';
  $('mute-audio').setAttribute('aria-pressed', String(sound.settings.muted));
}
function toggleMute() { sound.set('muted', !sound.settings.muted); paintAudioSettings(); }
function toggleCamera() { rig.toggle(); sound.play('camera'); }
function setBusy(busy) { btns.forEach(button => button.disabled = busy); }
function pause() {
  if (!playerId) return;
  input.enabled = false; input.clear(); $('pause').hidden = false;
  sound.duck(true);
  if (document.pointerLockElement) document.exitPointerLock();
}
function resume() {
  if (!net.joined) return;
  $('pause').hidden = true; input.enabled = true; input.capture();
  sound.duck(false); $('audio-controls').open = false;
}
function failure(message) {
  $('error').textContent = message; setBusy(false);
  if (connectedOnce) {
    pause(); $('pause-title').textContent = 'Bağlantı kurulamadı'; $('pause-copy').textContent = message;
  }
}
function updateSnapshot(next, reset = false) {
  const self = next.players.find(p => p.id === playerId);
  if (!self) return;
  // Snapshot changes alone trigger world cues; prediction replay stays silent.
  soundEvents.snapshot(next, playerId, reset);
  const receivedAt = performance.now();
  const changedLevel = !scene || roomEpoch !== next.epoch || level.index !== next.sector;
  if (changedLevel) {
    motor?.dispose(); scene?.free(); level = buildLevel(next.sector); scene = new PhysicsScene(level);
    motor = new CharacterMotor(scene, self.state.position); view.load(level); roomEpoch = next.epoch;
    for (const id of remote.keys()) view.removePlayer(id); remote.clear(); reset = true;
  }
  scene.setPuzzle(next.puzzle); view.setPuzzle(next.puzzle);
  const oldPosition = { ...motor.state.position };
  if (reset || motor.state.epoch !== self.state.epoch) {
    pending = []; net.batch = []; seq = 0; visualError.set(0, 0, 0); accumulator = 0;
  } else {
    const acked = pending.find(p => p.command.seq === self.state.seq);
    if (acked) latency = Math.round(receivedAt - acked.sentAt);
    pending = pending.filter(p => p.command.seq > self.state.seq);
  }
  motor.restore(self.state); scene.step();
  // Restore ALL movement state, not just position: cooldown, dash vector, coyote, wall timer.
  for (const entry of pending) { motor.step(entry.command); scene.step(); }
  if (!reset) {
    visualError.x += oldPosition.x - motor.state.position.x;
    visualError.y += oldPosition.y - motor.state.position.y;
    visualError.z += oldPosition.z - motor.state.position.z;
    if (visualError.lengthSq() > 9) visualError.set(0, 0, 0);
  }
  for (const p of next.players) {
    if (p.id === playerId) continue;
    if (!remote.has(p.id)) remote.set(p.id, new RemoteBuffer());
    remote.get(p.id).push(p.state, next.time, receivedAt);
    view.avatar(p.id, colors[next.players.indexOf(p) % colors.length]);
  }
  for (const id of remote.keys()) if (!next.players.some(p => p.id === id)) {
    remote.delete(id); view.removePlayer(id);
  }
  snapshot = next; snapshotAt = receivedAt;
  if (next.completed) {
    pause(); $('pause-title').textContent = 'Ekip güvenli bölgeye ulaştı';
    $('pause-copy').textContent = 'Üç örnek sektörü tamamladınız. Görev ilerlemeniz kaydediliyor.';
  }
}
function paintHud(now) {
  if (!snapshot || !motor) return;
  $('sector-label').textContent = `SEKTÖR ${String(snapshot.sector + 1).padStart(2, '0')} / ${SECTORS.length}`;
  $('sector-name').textContent = level.name;
  $('copy-room').textContent = snapshot.room;
  $('team-count').textContent = `${snapshot.players.length} / 6 gezgin`;
  const text = snapshot.puzzle.latched ? 'Geçiş sabitlendi. Yeşil checkpoint üzerinden parkura ilerleyin. Çıkışta buluşun.'
    : snapshot.puzzle.open ? 'Köprü aktif! Bir gezgin B terminalinde E’ye basarak geçişi sabitlesin.'
    : snapshot.players.length < 2 ? 'Hareketleri deneyebilirsin. Geçiş için oda kodunu bir arkadaşınla paylaş.'
    : 'Bir gezgin A terminalinde E’yi basılı tutsun. Diğeri köprüden B’ye geçsin.';
  $('objective').textContent = text;
  const time = snapshot.time + Math.min(.25, (now - snapshotAt) / 1000);
  const remaining = snapshot.puzzle.latched ? 8 : Math.max(0, snapshot.puzzle.activeUntil - time);
  $('bridge-time').style.width = `${remaining / 8 * 100}%`;
  $('camera-mode').textContent = rig.thirdPerson ? 'TPS' : 'FPS';
  $('motion').textContent = ({ dance: 'DANS', wave: 'SELAM', smoke: 'SİGARA' })[motor.state.emote] || motor.state.animation.toUpperCase();
  $('dash-meter').style.width = `${(1 - motor.state.cooldown / MOVE.dashCooldown) * 100}%`;
  $('network-stat').textContent = net.joined ? `${latency} ms · onay` : 'BAĞLANTI YOK';
  $('save-status').textContent = { saved: 'İlerleme kaydedildi', saving: 'Kaydediliyor…', error: 'Kayıt başarısız · tekrar denenecek', unsaved: 'Henüz kaydedilmedi' }[snapshot.saveStatus];
  let hint = '';
  if (!snapshot.puzzle.latched && near(motor.state.position, level.terminalA)) hint = 'E BASILI TUT · Köprüye güç ver (8 sn)';
  if (!snapshot.puzzle.latched && near(motor.state.position, level.terminalB)) hint = 'E · Ekip arkadaşın A’yı tutarken geçişi sabitle';
  if (!input.coarse && input.enabled && !document.pointerLockElement) hint = 'Etrafa bakmak için oyun alanına tıkla';
  if (!net.joined) hint = 'Bağlantı kesildi. Yeniden katılman bekleniyor…';
  $('interact-hint').textContent = hint;
  // textContent avoids treating remote player names as markup.
  const list = snapshot.players.map(p => `${p.id === playerId ? 'Sen · ' : ''}${p.name}${p.checkpoint ? ' ✓' : ''}`);
  if ($('roster').dataset.text !== list.join('|')) {
    $('roster').replaceChildren(...list.map(name => { const li = document.createElement('li'); li.textContent = name; return li; }));
    $('roster').dataset.text = list.join('|');
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
  if (document.hidden) { accumulator = 0; return; }
  if (motor && net.joined) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= DT && steps++ < 5) {
      // Stop predicting indefinitely into a stalled network.
      if (pending.length < 90) {
        const command = input.sample(++seq, motor.state.epoch);
        pending.push({ command, sentAt: now }); net.send(command);
        const before = { ...motor.state };
        motor.step(command); scene.step();
        soundEvents.movement(before, motor.state, command, now);
        if (command.emote && motor.state.emote) rig.thirdPerson = true;
      }
      accumulator -= DT;
    }
    if (steps > 5) accumulator = 0;
    visualError.multiplyScalar(Math.exp(-14 * dt));
    renderPosition.copy(motor.state.position).add(visualError);
    const avatar = view.avatar(playerId);
    view.pose(avatar, { ...motor.state, position: renderPosition, yaw: input.yaw }, now / 1000);
    rig.update(renderPosition, input, dt, view.solids, avatar);
    for (const [id, buffer] of remote) {
      const state = buffer.sample(now); if (state) view.pose(view.players.get(id), state, now / 1000);
    }
    if (now - lastHud > 100) { paintHud(now); lastHud = now; }
  } else if (!connectedOnce) {
    view.camera.position.set(24 + Math.sin(now * .00008) * 3, 18, 16);
    view.camera.lookAt(-1, -1, -29);
  } else if (now - lastHud > 100) { paintHud(now); lastHud = now; }
  view.render();
}
function token() {
  let value = sessionStorage.getItem('colony-token');
  if (!value) {
    value = [...crypto.getRandomValues(new Uint8Array(24))].map(n => n.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('colony-token', value);
  }
  return value;
}
function enter(create) {
  if (!$('name').reportValidity()) return;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const room = create ? [...crypto.getRandomValues(new Uint8Array(6))].map(n => alphabet[n % alphabet.length]).join('') : $('room').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(room)) return failure('6 karakterli oda kodunu yaz.');
  $('room').value = room; $('error').textContent = ''; setBusy(true);
  sound.play('ui');
  try { net.connect({ room, token: token(), name: $('name').value, create }); }
  catch { failure('Tarayıcı oturum depolaması kullanılamıyor. Normal bir sekmede tekrar dene.'); }
}
async function boot() {
  await initPhysics();
  view = new WorldView($('world')); view.load(buildLevel(0)); rig = new CameraRig(view.camera);
  input = new Input($('world'), toggleCamera, pause);
  net = new Network({
    onStatus: message => { $('connection').textContent = message; }, onError: failure,
    onJoin: reply => {
      playerId = reply.id; connectedOnce = true; seq = 0; pending = [];
      updateSnapshot(reply.snapshot, true);
      $('lobby').hidden = true; $('hud').hidden = false; document.body.classList.add('playing');
      $('pause-title').textContent = 'Görev sürüyor'; $('pause-copy').textContent = 'Diğer gezginler oynamaya devam eder.';
      resume(); setBusy(false);
    }, onSnapshot: updateSnapshot
  });
  $('create').addEventListener('click', () => enter(true));
  $('join-form').addEventListener('submit', e => { e.preventDefault(); enter(false); });
  $('resume').addEventListener('click', resume);
  $('leave').addEventListener('click', () => { net.leave(); location.reload(); });
  $('world').addEventListener('click', () => { if (input.enabled) input.capture(); });
  $('touch-camera').addEventListener('click', toggleCamera);
  $('touch-menu').addEventListener('click', pause);
  $('copy-room').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(snapshot.room); $('connection').textContent = 'ODA KODU KOPYALANDI'; }
    catch { $('connection').textContent = `ODA: ${snapshot.room}`; }
  });
  $('room').value = (new URLSearchParams(location.search).get('room') || '').slice(0, 6);
  paintAudioSettings();
  const unlockAudio = () => {
    sound.unlock().then(ok => { $('audio-note').textContent = ok ? 'M · Tüm sesleri aç / kapat' : 'Sesi başlatmak için tekrar tıkla.'; });
  };
  document.addEventListener('pointerdown', unlockAudio, { capture: true });
  document.addEventListener('keydown', e => {
    if (!e.repeat) unlockAudio();
    if (e.code === 'KeyM' && !e.repeat && !e.target.closest?.('input,textarea,select,[contenteditable="true"]')) {
      e.preventDefault(); toggleMute();
    }
  });
  $('mute-audio').addEventListener('click', toggleMute);
  for (const key of ['music', 'effects']) $(`${key}-volume`).addEventListener('input', e => {
    sound.set(key, Number(e.target.value) / 100); paintAudioSettings();
  });
  $('audio-controls').addEventListener('toggle', () => { if ($('audio-controls').open && input.enabled) pause(); });
  document.querySelectorAll('[data-emote]').forEach(button => button.addEventListener('click', () => {
    if (!net.joined) return;
    resume(); input.pulses.add(button.dataset.emote); sound.play('ui');
  }));
  document.addEventListener('visibilitychange', () => sound.setHidden(document.hidden));
  window.addEventListener('pagehide', () => sound.setHidden(true));
  window.addEventListener('pageshow', () => sound.setHidden(document.hidden));
  $('boot').hidden = true; requestAnimationFrame(frame);
}
boot().catch(error => { console.error(error); $('boot').textContent = '3D motoru başlatılamadı. WebGL2 ve donanım hızlandırmasının açık olduğunu kontrol et.'; });
