import './style.css';
import * as THREE from 'three';
import { SKINS, EMOTE_LABELS, MOTION_LABELS, PRANK_MESSAGES } from '../../shared/characters.js';
import { ExpressiveUI } from './expressive-ui.js';
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
let expressive, selectedSkin='courier';
let view, scene, motor, level, rig, input, net, snapshot, snapshotAt = 0;
let playerId = null, roomEpoch = null, seq = 0, pending = [], connectedOnce = false;
let simulationTime = 0, simulationMotion = 0;
function advancePhysics(command) {
  simulationTime += DT;
  if(snapshot?.puzzle.open || snapshot?.puzzle.latched) simulationMotion += DT;
  scene.prepare(simulationTime,{...snapshot?.puzzle,motionTime:simulationMotion},false,snapshot?.pranks);
  motor.step(command);
}
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
  snapshot = next; simulationTime = next.time; simulationMotion = next.puzzle.motionTime || 0;
  motor.restore(self.state); scene.prepare(simulationTime,next.puzzle,true,next.pranks);
  // Restore ALL movement state, not just position: cooldown, dash vector, coyote, wall timer.
  for (const entry of pending) { advancePhysics(entry.command); }
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
    view.avatar(p.id,p.skin);
  }
  for (const id of remote.keys()) if (!next.players.some(p => p.id === id)) {
    remote.delete(id); view.removePlayer(id);
  }
  snapshot = next; snapshotAt = receivedAt;
  if (next.completed) {
    pause(); $('pause-title').textContent = 'Ekip güvenli bölgeye ulaştı';
    $('pause-copy').textContent = '25 sektörlük yolculuğu tamamladınız. Görev ilerlemeniz kaydediliyor.';
  }
}
function paintHud(now) {
  if (!snapshot || !motor) return;
  $('sector-label').textContent = `SEKTÖR ${String(snapshot.sector + 1).padStart(2, '0')} / ${SECTORS.length}`;
  $('sector-name').textContent = level.name;
  $('copy-room').textContent = snapshot.room;
  $('team-count').textContent = `${snapshot.players.length} / 6 gezgin`;
  const text = snapshot.puzzle.latched ? 'Geçiş sabitlendi. Yeşil kayıt noktasından parkura ilerleyin. Çıkışta buluşun.'
    : snapshot.puzzle.open ? 'Köprü aktif! Bir gezgin B terminalinde E’ye basarak geçişi sabitlesin.'
    : snapshot.players.length < 2 ? 'Hareketleri deneyebilirsin. Geçiş için oda kodunu bir arkadaşınla paylaş.'
    : level.hint;
  $('objective').textContent = snapshot.puzzle.latched ? `${level.hint} · Kontrol noktası ${snapshot.players.find(p=>p.id===playerId)?.checkpoint || 0}/${level.checkpoints.length}. Çıkışta buluşun.` : level.puzzleType === 'plates' ? `İki ayrı plakaya aynı anda basın · %${Math.round(snapshot.puzzle.charge*100)}` : snapshot.puzzle.open && level.puzzleType === 'operator' ? 'Taşıyıcı çalışıyor, kontrollü lazer kapalı. Koşucu B’den dönüş yolunu açsın.' : text;
  const time = snapshot.time + Math.min(.25, (now - snapshotAt) / 1000);
  const duration = level.puzzleType === 'timed' ? 3 : level.holdSeconds;
  const remaining = snapshot.puzzle.latched ? duration : Math.max(0, snapshot.puzzle.activeUntil - time);
  $('bridge-time').style.width = `${remaining / duration * 100}%`;
  $('camera-mode').textContent = rig.thirdPerson ? 'DIŞ KAMERA' : 'GÖZ KAMERASI';
  $('motion').textContent = EMOTE_LABELS[motor.state.emote] || MOTION_LABELS[motor.state.animation] || 'DİNLENİYOR';
  $('dash-meter').style.width = `${(1 - motor.state.cooldown / MOVE.dashCooldown) * 100}%`;
  $('network-stat').textContent = net.joined ? `${latency} ms · onay` : 'BAĞLANTI YOK';
  $('save-status').textContent = { saved: 'İlerleme kaydedildi', saving: 'Kaydediliyor…', error: 'Kayıt başarısız · tekrar denenecek', unsaved: 'Henüz kaydedilmedi' }[snapshot.saveStatus];
  let hint = '';
  if (!snapshot.puzzle.latched && near(motor.state.position, level.terminalA)) hint = level.puzzleType === 'timed' ? 'E · 3 saniyelik köprü. Koşucu köprü üstünde atılmalı!' : level.puzzleType === 'plates' ? 'İki gezgin iki ayrı plakada 1 saniye beklesin' : `E BASILI TUT · Güç ver (${level.holdSeconds} sn)`;
  if (!snapshot.puzzle.latched && near(motor.state.position, level.terminalB)) hint = 'E · Başarılı geçişi sabitle ve arkadaşına dönüş yolunu aç';
  if (!input.coarse && input.enabled && !document.pointerLockElement) hint = 'Etrafa bakmak için oyun alanına tıkla';
  if (!net.joined) hint = 'Bağlantı kesildi. Yeniden katılman bekleniyor…';
  const fakeButton=level.traps.find(t=>t.type==='drop'&&near(motor.state.position,t.position));
  if(fakeButton)hint='E · Kestirmeyi aç';
  $('interact-hint').textContent = hint;
  $('troll-message').textContent = motor.state.prankLeft>0 ? PRANK_MESSAGES[motor.state.prank] || '' : '';
  $('troll-message').hidden=!$('troll-message').textContent;
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
        advancePhysics(command);
        soundEvents.movement(before, motor.state, command, now);
        if (command.emote && motor.state.emote) rig.thirdPerson = true;
      }
      accumulator -= DT;
    }
    if (steps > 5) accumulator = 0;
    visualError.multiplyScalar(Math.exp(-14 * dt));
    renderPosition.copy(motor.state.position).add(visualError);
    const avatar = view.avatar(playerId,snapshot.players.find(p=>p.id===playerId)?.skin || selectedSkin);
    view.pose(avatar, { ...motor.state, position: renderPosition, yaw: input.yaw }, now / 1000);
    rig.update(renderPosition, input, dt, view.solids, avatar);
    for (const [id, buffer] of remote) {
      const state = buffer.sample(now); if (state) view.pose(view.players.get(id), state, now / 1000);
    }
    if (now - lastHud > 100) { paintHud(now); lastHud = now; }
  } else if (!connectedOnce) {
    view.camera.position.set(10 + Math.sin(now * .00008), 5, 13);
    view.camera.lookAt(2, 1, -4);
    const preview=view.avatar('preview',selectedSkin);
    view.pose(preview,{position:{x:4,y:.84,z:2},yaw:Math.PI-.25,animation:'idle',emote:'dance',emoteLeft:8-(now/1000)%8},now/1000);
  } else if (now - lastHud > 100) { paintHud(now); lastHud = now; }
  if(snapshot) view.updateDynamics(simulationTime,{...snapshot.puzzle,motionTime:simulationMotion},snapshot.pranks);
  expressive?.update(snapshot,motor?{state:motor.state}:null,now/1000);
  view.render(dt);
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
  try { net.connect({ room, token: token(), name: $('name').value, skin:selectedSkin, create }); }
  catch { failure('Tarayıcı oturum depolaması kullanılamıyor. Normal bir sekmede tekrar dene.'); }
}
async function boot() {
  await initPhysics();
  view = new WorldView($('world')); view.load(buildLevel(0)); rig = new CameraRig(view.camera);
  expressive=new ExpressiveUI();
  const picker=$('skin-picker');
  try{const saved=localStorage.getItem('mahalle-skin');if(SKINS.some(s=>s.id===saved))selectedSkin=saved;}catch{}
  for(const skin of SKINS){const button=document.createElement('button');button.type='button';button.textContent=skin.name;button.style.setProperty('--skin-color',skin.color);button.setAttribute('aria-pressed',String(skin.id===selectedSkin));button.addEventListener('click',()=>{selectedSkin=skin.id;try{localStorage.setItem('mahalle-skin',skin.id);}catch{}for(const b of picker.children)b.setAttribute('aria-pressed',String(b===button));sound.play('ui');});picker.append(button);}
  input = new Input($('world'), toggleCamera, pause);
  net = new Network({
    onStatus: message => { $('connection').textContent = message; }, onError: failure,
    onJoin: reply => {
      view.removePlayer('preview');
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
  $('graphics-quality').value = view.graphics.preference;
  $('graphics-quality').addEventListener('change', e => view.graphics.set(e.target.value));
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
