import * as THREE from 'three';
import { Graphics, panelTextures } from './graphics.js';
import { dynamicPosition, laserState } from '../../shared/dynamics.js';
import { skinById } from '../../shared/characters.js';
import { obstaclePose } from '../../shared/pranks.js';
import { attachModel, animateModel, releaseModel } from './model-animation.js';
import { emotePose } from './emotes.js';
export class WorldView {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .86;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#bdced0');
    this.scene.fog = new THREE.FogExp2('#bdced0', 0.006);
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, 220);
    this.scene.add(new THREE.HemisphereLight('#e9f2ed', '#667356', 1.35));
    const sun = new THREE.DirectionalLight('#fff0d4', 2.1); sun.position.set(20, 40, 10); this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#adcbcf', .35); fill.position.set(-30, 5, -30); this.scene.add(fill);
    this.cube = new THREE.BoxGeometry(1, 1, 1);
    this.round = new THREE.IcosahedronGeometry(1,1);
    this.cone = new THREE.ConeGeometry(1,1,8);
    this.cylinder = new THREE.CylinderGeometry(1,1,1,8);
    this.puffGeometry = new THREE.IcosahedronGeometry(1, 0);
    this.cigaretteMaterial = new THREE.MeshStandardMaterial({ color: '#dedbcf', roughness: 1 });
    this.emberMaterial = new THREE.MeshBasicMaterial({ color: '#fb9860' });
    const panels=panelTextures();
    this.materials = {
      floor: new THREE.MeshStandardMaterial({ ...panels, color: '#b4a38a', metalness:.08 }),
      wall: new THREE.MeshStandardMaterial({ ...panels, color: '#b7bdad', metalness:.15 }),
      gate: new THREE.MeshStandardMaterial({ color: '#ff9860', emissive: '#f5722c', emissiveIntensity: .03, transparent: true, opacity: .7 }),
      bridge: new THREE.MeshStandardMaterial({ color: '#69edf2', emissive: '#29acb8', emissiveIntensity: .06 }),
      accent: new THREE.MeshStandardMaterial({ color: '#66eff2', emissive:'#66eff2',emissiveIntensity:.04 }),
      terminal: new THREE.MeshStandardMaterial({ color: '#b8f478', emissive: '#66b934', emissiveIntensity: .03 }),
      hazard: new THREE.MeshStandardMaterial({color:'#ff6354',emissive:'#ff382c',emissiveIntensity:.08}),
      dark: new THREE.MeshStandardMaterial({ color: '#354d48', roughness: 1 }),
      wood:new THREE.MeshStandardMaterial({...panels,color:'#a47f56',metalness:0}),
      leaf:new THREE.MeshStandardMaterial({color:'#7a9c6f',roughness:1}),
      cream:new THREE.MeshStandardMaterial({color:'#f0dec1',roughness:.9}),
      roof:new THREE.MeshStandardMaterial({color:'#bd8471',roughness:.9}),
      invisible:new THREE.MeshStandardMaterial({color:'#badbe0',transparent:true,opacity:.24,roughness:.8,depthWrite:false})
    };
    this.players = new Map();
    this.makeEarth();
    this.graphics=new Graphics(this,sun);
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      this.graphics.resize();
    });
  }
  makeEarth() {
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.MeshStandardMaterial({color:'#87a18a',roughness:1}));
    ground.rotation.x=-Math.PI/2;ground.position.set(0,-17,-300);ground.receiveShadow=true;this.scene.add(ground);
    const river=new THREE.Mesh(new THREE.PlaneGeometry(28,1200),new THREE.MeshStandardMaterial({color:'#83aeb5',roughness:.5,metalness:.05}));
    river.rotation.x=-Math.PI/2;river.position.set(0,-16.95,-300);this.scene.add(river);
    const hills=new THREE.InstancedMesh(this.round,this.materials.leaf,32),clouds=new THREE.InstancedMesh(this.round,this.materials.cream,36);
    const d=new THREE.Object3D();
    for(let i=0;i<32;i++){
      d.position.set((i%2?1:-1)*(80+i%4*15),-15,-i*22);d.scale.set(25+i%3*10,14+i%5*5,35);d.updateMatrix();hills.setMatrixAt(i,d.matrix);
    }
    for(let i=0;i<36;i++){
      d.position.set((i%6-3)*32,40+i%3*6,-Math.floor(i/6)*100);d.scale.set(10+i%4*3,2.5,5);d.updateMatrix();clouds.setMatrixAt(i,d.matrix);
    }
    this.scene.add(hills,clouds);
  }
  label(text,position,width=3) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f1e9d4';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#57726b';ctx.lineWidth=10;ctx.strokeRect(5,5,502,118);
    ctx.fillStyle='#304b43';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,76,475);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthWrite:false}));sprite.position.copy(position);sprite.scale.set(width,width/4,1);this.levelGroup.add(sprite);return sprite;
  }
  prop(group,geometry,position,size,material) {
    const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(position);mesh.scale.copy(size);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  box(group, position, size, material) {
    const mesh = new THREE.Mesh(this.cube, material);
    mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.position.copy(position); mesh.scale.copy(size); group.add(mesh); return mesh;
  }
  load(level) {
    if (this.levelGroup) {
      this.levelGroup.traverse(object => {
        if (object.isSprite) { object.material.map.dispose(); object.material.dispose(); }
        if (object.isInstancedMesh) object.dispose();
      });
      this.scene.remove(this.levelGroup);
    }
    this.levelGroup = new THREE.Group(); this.scene.add(this.levelGroup);
    this.level = level; this.solids = [];
    this.materials.accent.color.set(level.accent);this.materials.accent.emissive.set(level.accent);
    for (const b of level.boxes) {
      const mesh = this.box(this.levelGroup, b.position, b.size, this.materials[b.kind]);
      this.solids.push(mesh); if (b.kind === 'gate') this.gate = mesh;
    }
    this.bridge = this.box(this.levelGroup, level.bridge.position, level.bridge.size, this.materials.bridge);
    this.solids.push(this.bridge);
    const floors = level.boxes.filter(b => b.kind === 'floor' && !level.traps.some(t=>t.type==='drop'&&t.floorId===b.id));
    const strips = new THREE.InstancedMesh(this.cube, this.materials.accent, floors.length * 2);
    const dummy = new THREE.Object3D();
    let n = 0;
    for (const floor of floors) for (const side of [-1, 1]) {
      dummy.position.set(floor.position.x + side * (floor.size.x / 2 - .12), floor.position.y+floor.size.y/2+.025, floor.position.z);
      dummy.scale.set(.08, .04, floor.size.z - .3); dummy.updateMatrix(); strips.setMatrixAt(n++, dummy.matrix);
    }
    this.levelGroup.add(strips);
    for (const [index, p] of (level.puzzleType==='plates'?[]:[level.terminalA, level.terminalB]).entries()) {
      this.box(this.levelGroup, { x: p.x, y: .4, z: p.z }, { x: 1, y: .8, z: .9 }, this.materials.dark);
      const screen = this.box(this.levelGroup, { x: p.x, y: 1, z: p.z }, { x: .9, y: .6, z: .15 }, this.materials.terminal);
      screen.rotation.x = -.3;
      // A/B marks use compact in-world canvas labels, no raster downloads.
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#c1fc77'; ctx.font = 'bold 80px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(index ? 'B' : 'A', 64, 88);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
      sprite.position.set(p.x, 2.5, p.z); sprite.scale.set(1, 1, 1); this.levelGroup.add(sprite);
    }
    for(const p of level.checkpoints)this.box(this.levelGroup,{x:p.x,y:p.y-.84,z:p.z},{x:2,y:.04,z:2},this.materials.terminal);
    for (const side of [-1,1])this.box(this.levelGroup,{x:level.exit.x+side*4.5,y:level.exit.y+1.5,z:level.exit.z},{x:.35,y:5,z:.4},this.materials.accent);
    this.box(this.levelGroup,{x:level.exit.x,y:level.exit.y+4,z:level.exit.z},{x:9.35,y:.35,z:.4},this.materials.accent);
    this.movers=new Map();for(const b of level.movers){const mesh=this.box(this.levelGroup,b.position,b.size,this.materials.floor);this.movers.set(b.id,mesh);this.solids.push(mesh);}
    this.lasers=new Map();for(const b of level.lasers){this.lasers.set(b.id,this.box(this.levelGroup,b.position,b.size,this.materials.hazard));}
    if(level.puzzleType==='plates')for(const p of level.plates)this.box(this.levelGroup,p,{x:1.8,y:.12,z:1.8},this.materials.terminal);
    this.obstacleViews=new Map();
    for(const o of level.obstacles){
      const group=new THREE.Group();this.levelGroup.add(group);
      if(o.type==='pendulum'){
        this.box(group,{x:o.position.x,y:o.position.y+.25,z:o.position.z},{x:11,y:.35,z:.4},this.materials.wood);
        for(const side of [-1,1])this.box(group,{x:o.position.x+side*5,y:o.position.y-2.5,z:o.position.z},{x:.3,y:5.5,z:.4},this.materials.wood);
        const arm=new THREE.Group();arm.position.copy(o.position);group.add(arm);
        this.prop(arm,this.cylinder,{x:0,y:-o.length/2,z:0},{x:.055,y:o.length,z:.055},this.materials.dark);
        this.prop(arm,this.round,{x:0,y:-o.length,z:0},{x:o.radius,y:o.radius,z:o.radius},this.materials.roof);
        this.obstacleViews.set(o.id,arm);
      }else{
        this.prop(group,this.cylinder,{x:o.position.x,y:o.position.y-.2,z:o.position.z},{x:.35,y:1,z:.35},this.materials.dark);
        const arm=new THREE.Group();arm.position.copy(o.position);group.add(arm);
        this.box(arm,{x:0,y:0,z:0},{x:o.length*2,y:o.radius*2,z:o.radius*2},this.materials.roof);
        for(const side of [-1,1])this.box(arm,{x:side*o.length,y:0,z:0},{x:.45,y:.6,z:.7},this.materials.cream);
        this.obstacleViews.set(o.id,arm);
      }
    }
    this.dropViews=new Map();this.invisibleViews=new Map();
    for(const trap of level.traps){
      if(trap.type==='drop'){
        const floor=level.boxes.find(b=>b.id===trap.floorId),mesh=this.solids[level.boxes.indexOf(floor)];this.dropViews.set(trap.floorId,mesh);
        this.prop(this.levelGroup,this.cylinder,trap.position,{x:.35,y:.25,z:.35},this.materials.roof);
        this.label('KESİNLİKLE KESTİRME',{...trap.position,y:trap.position.y+1.2},3);
      }
      if(trap.type==='launch'){
        this.box(this.levelGroup,trap.position,{x:1.4,y:.12,z:1.4},this.materials.roof);
        this.label('HIZLI TESLİMAT',{...trap.position,y:trap.position.y+1.8},2.5);
      }
    }
    for(const f of level.fakePlatforms){this.box(this.levelGroup,f.position,f.size,this.materials.floor);this.label('BURASI SAĞLAM',{...f.position,y:f.position.y+1.9},2.5);}
    for(const wall of level.invisibleWalls){const mesh=this.box(this.levelGroup,wall.position,wall.size,this.materials.invisible);mesh.castShadow=false;mesh.visible=false;this.invisibleViews.set(wall.id,mesh);this.solids.push(mesh);}
    for(const p of level.routePoints)if(p.maze)this.label('BELEDİYE: YOL AÇIK',{x:p.x,y:p.y+3,z:p.z+11},4);
    this.label(level.name,{x:0,y:3,z:1},5);
    this.label('BİRLİKTE ÇIKIŞ',{...level.exit,y:level.exit.y+3},4);
    this.makeNeighborhood(level);
    this.setPuzzle({ open: false, latched: false });
    this.updateDynamics(0,{});
  }
  setPuzzle(puzzle) { this.bridge.visible = puzzle.latched || (puzzle.open && this.level.puzzleType!=='operator'); this.gate.visible = !puzzle.latched; }
  updateDynamics(time,puzzle,pranks={}) {
    for(const o of this.level.obstacles){const q=obstaclePose(o,time),arm=this.obstacleViews.get(o.id);if(o.type==='pendulum')arm.rotation.z=q.angle;else arm.rotation.y=-q.angle;}
    for(const [id,mesh] of this.dropViews)mesh.visible=!(pranks.drops?.[id]>time);
    for(const [id,mesh] of this.invisibleViews)mesh.visible=pranks.reveals?.[id]>time;
    for(const b of this.level.movers)this.movers.get(b.id).position.copy(dynamicPosition(b,b.motion.controlled?puzzle.motionTime||0:time));
    for(const b of this.level.lasers){const state=laserState(b,time,puzzle),mesh=this.lasers.get(b.id);mesh.position.copy(state.position);mesh.visible=state.active;}
  }
  makeNeighborhood(level) {
    const count=level.routePoints.length*2,trees=new THREE.InstancedMesh(this.round,this.materials.leaf,count),trunks=new THREE.InstancedMesh(this.cylinder,this.materials.wood,count),houses=new THREE.InstancedMesh(this.cube,this.materials.cream,count),roofs=new THREE.InstancedMesh(this.cone,this.materials.roof,count);
    const d=new THREE.Object3D();let i=0;
    for(const [n,p] of level.routePoints.entries())for(const side of [-1,1]){
      const x=p.x+side*(13+n%3*4),z=p.z;
      d.position.set(x,-4,z);d.scale.set(.22,8,.22);d.updateMatrix();trunks.setMatrixAt(i,d.matrix);
      d.position.set(x,.5+n%3,z);d.scale.set(2.5,2.7+n%2,2.5);d.updateMatrix();trees.setMatrixAt(i,d.matrix);
      d.position.set(x+side*7,-8,z+4);d.scale.set(5,10+n%4,5);d.updateMatrix();houses.setMatrixAt(i,d.matrix);
      d.position.y=-2.5+n%4*.5;d.scale.set(4,2,4);d.updateMatrix();roofs.setMatrixAt(i,d.matrix);i++;
    }
    for(const mesh of [trees,trunks,houses,roofs]){mesh.castShadow=true;mesh.receiveShadow=true;this.levelGroup.add(mesh);}
    // Small planters frame safe checkpoints, never obstruct the parkour collider path.
    for(const p of level.checkpoints)for(const side of [-1,1]){
      this.box(this.levelGroup,{x:p.x+side*2.8,y:p.y-.8,z:p.z},{x:.7,y:.5,z:.7},this.materials.roof);
      this.prop(this.levelGroup,this.round,{x:p.x+side*2.8,y:p.y-.15,z:p.z},{x:.65,y:.65,z:.65},this.materials.leaf);
    }
  }
  avatar(id, skinId = 'courier') {
    if(this.players.has(id) && this.players.get(id).userData.skin!==skinId)this.removePlayer(id);
    if (this.players.has(id)) return this.players.get(id);
    const skin=skinById(skinId),color=skin.color;
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: .85 });
    const detail=new THREE.MeshStandardMaterial({color:skin.detail,roughness:.9});
    this.box(group, { x: 0, y: -.05, z: 0 }, { x: .52, y: .66, z: .34 }, mat);
    const head=this.box(group, { x: 0, y: .5, z: 0 }, { x: .5, y: .44, z: .46 }, mat);
    const eyes=[];
    for(const side of [-1,1])eyes.push(this.box(group,{x:side*.12,y:.55,z:-.24},{x:.075,y:.085,z:.03},this.materials.dark));
    this.box(group,{x:0,y:.39,z:-.24},{x:.12,y:.025,z:.03},this.materials.dark);
    if(skin.shape==='cap'){
      this.box(group,{x:0,y:.75,z:0},{x:.6,y:.14,z:.55},detail);this.box(group,{x:0,y:.71,z:-.3},{x:.48,y:.05,z:.3},detail);
      this.box(group,{x:0,y:-.05,z:.3},{x:.48,y:.55,z:.25},detail);
    }
    if(skin.shape==='frog')for(const side of [-1,1]){
      this.prop(group,this.round,{x:side*.23,y:.77,z:-.05},{x:.17,y:.18,z:.15},mat);
      this.box(group,{x:side*.23,y:.8,z:-.2},{x:.07,y:.08,z:.03},this.materials.dark);
    }
    if(skin.shape==='mushroom'){
      this.prop(group,this.round,{x:0,y:.76,z:0},{x:.64,y:.25,z:.6},mat);
      for(const side of [-1,1])this.box(group,{x:side*.3,y:.91,z:-.15},{x:.16,y:.04,z:.15},detail);
    }
    if(skin.shape==='cone'){
      this.prop(group,this.cone,{x:0,y:.8,z:0},{x:.36,y:.6,z:.36},mat);
      this.box(group,{x:0,y:.56,z:0},{x:.75,y:.08,z:.66},detail);
    }
    if(skin.shape==='television'){
      head.scale.set(.73,.53,.5);this.box(group,{x:0,y:.51,z:-.255},{x:.58,y:.38,z:.035},detail);
      for(const side of [-1,1]){eyes[side===-1?0:1].position.z=-.28;const antenna=this.box(group,{x:side*.2,y:.9,z:0},{x:.035,y:.3,z:.035},this.materials.dark);antenna.rotation.z=side*.6;}
    }
    if(skin.shape==='pigeon'){
      this.prop(group,this.cone,{x:0,y:.48,z:-.35},{x:.13,y:.25,z:.13},this.materials.roof).rotation.x=-Math.PI/2;
      this.box(group,{x:0,y:.03,z:.24},{x:.42,y:.55,z:.18},detail);
    }
    const left = this.box(group, { x: -.15, y: -.59, z: 0 }, { x: .2, y: .44, z: .22 }, mat);
    const right = this.box(group, { x: .15, y: -.59, z: 0 }, { x: .2, y: .44, z: .22 }, mat);
    const arms = [-1, 1].map(side => {
      const pivot = new THREE.Group(); pivot.position.set(side * .36, .22, 0); group.add(pivot);
      this.box(pivot, { x: 0, y: -.22, z: 0 }, { x: .16, y: .46, z: .18 }, mat);
      return pivot;
    });
    const cigarette = new THREE.Group(); cigarette.position.set(0, -.43, -.08); arms[1].add(cigarette);
    this.box(cigarette, { x: 0, y: 0, z: -.055 }, { x: .027, y: .027, z: .16 }, this.cigaretteMaterial);
    this.box(cigarette, { x: 0, y: 0, z: -.14 }, { x: .029, y: .029, z: .015 }, this.emberMaterial);
    cigarette.visible = false;
    const puffMaterial = new THREE.MeshBasicMaterial({ color: '#c6d1db', transparent: true, opacity: .15, depthWrite: false });
    const puffs = Array.from({ length: 4 }, () => {
      const puff = new THREE.Mesh(this.puffGeometry, puffMaterial); puff.userData.effect=true;puff.visible = false; group.add(puff); return puff;
    });
    group.userData = { skin:skinId, detail, head, eyes, legs: [left, right], arms, cigarette, puffs, puffMaterial, material: mat };
    this.scene.add(group); this.players.set(id, group);attachModel(group,skinId); return group;
  }
  pose(avatar, state, time) {
    const dt=avatar.userData.poseTime==null?0:Math.max(0,time-avatar.userData.poseTime);avatar.userData.poseTime=time;
    avatar.scale.set(1,1,1);
    avatar.position.copy(state.position); avatar.rotation.y = state.yaw;
    avatar.rotation.z = state.animation === 'wallrun' ? .2 : 0;
    const moving = state.animation === 'walk' || state.animation === 'run';
    const swing = moving ? Math.sin(time * (state.animation === 'run' ? 19 : 12)) * .95 : state.animation === 'jump' ? .55 : 0;
    avatar.userData.legs[0].rotation.x = swing; avatar.userData.legs[1].rotation.x = -swing;
    const { arms, cigarette, puffs } = avatar.userData;
    arms[0].rotation.set(-swing * .7, 0, -.08); arms[1].rotation.set(swing * .7, 0, .08);
    cigarette.visible = false; puffs.forEach(p => p.visible = false);
    const bounce=moving?Math.abs(Math.sin(time*(state.animation==='run'?19:12)))*.075:Math.sin(time*2)*.018;
    avatar.position.y+=bounce;avatar.userData.head.rotation.z=moving?Math.sin(time*12)*.08:0;
    const blink=Math.sin(time*.8)> .998;for(const eye of avatar.userData.eyes)eye.scale.y=blink?.012:.085;
    const pose = emotePose(state);
    if (pose) {
      const w = pose.weight;
      avatar.position.y += pose.lift * w; avatar.rotation.z = pose.lean * w; avatar.rotation.y += pose.turn * w;
      avatar.userData.legs[0].rotation.x = pose.leftLeg * w; avatar.userData.legs[1].rotation.x = pose.rightLeg * w;
      for (const [i, rotation] of [pose.leftArm, pose.rightArm].entries()) arms[i].rotation.set(...rotation.map(n => n * w));
      cigarette.visible = pose.smoke && w > .1;
      if (pose.smoke) puffs.forEach((puff, i) => {
        const age = pose.puffPhase - 2.05 - i * .22;
        puff.visible = age > 0 && age < 1.2 && w > .2;
        if (puff.visible) {
          puff.position.set(.09 + Math.sin(age * 3 + i) * .07, .49 + age * .35, -.42 - age * .17);
          puff.scale.setScalar(.025 + age * .07);
        }
      });
    }
    if(state.knockLeft>0){avatar.rotation.z=Math.sin(time*28)*.5;arms[0].rotation.x=time*18;arms[1].rotation.x=-time*18;avatar.scale.set(1.12,.85,1.12);}
    if(state.emote==='flop'){const w=pose?.weight||0;avatar.scale.set(1+w*.15,1-w*.15,1+w*.15);}
    animateModel(avatar,state,dt);
  }
  removePlayer(id) {
    const avatar = this.players.get(id); if (!avatar) return;
    releaseModel(avatar);this.scene.remove(avatar); avatar.userData.material.dispose();avatar.userData.detail.dispose(); avatar.userData.puffMaterial.dispose(); this.players.delete(id);
  }
  render(dt=1/60) { this.graphics.render(dt); }
}
