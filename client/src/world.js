import * as THREE from 'three';
export class WorldView {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#081523');
    this.scene.fog = new THREE.FogExp2('#081523', 0.009);
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, 220);
    this.scene.add(new THREE.HemisphereLight('#afedff', '#161e38', 2.4));
    const sun = new THREE.DirectionalLight('#c9fbff', 3); sun.position.set(20, 40, 10); this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#768bff', 1.5); fill.position.set(-30, 5, -30); this.scene.add(fill);
    this.cube = new THREE.BoxGeometry(1, 1, 1);
    this.materials = {
      floor: new THREE.MeshStandardMaterial({ color: '#233c50', roughness: .9, metalness: .25 }),
      wall: new THREE.MeshStandardMaterial({ color: '#355369', roughness: .8 }),
      gate: new THREE.MeshStandardMaterial({ color: '#ff9860', emissive: '#f5722c', emissiveIntensity: .5, transparent: true, opacity: .7 }),
      bridge: new THREE.MeshStandardMaterial({ color: '#69edf2', emissive: '#29acb8', emissiveIntensity: .7 }),
      accent: new THREE.MeshBasicMaterial({ color: '#66eff2' }),
      terminal: new THREE.MeshStandardMaterial({ color: '#b8f478', emissive: '#66b934', emissiveIntensity: .4 }),
      dark: new THREE.MeshStandardMaterial({ color: '#102232', roughness: 1 })
    };
    this.players = new Map();
    this.makeSpace();
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }
  makeSpace() {
    let seed = 481;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const vertices = [];
    for (let i = 0; i < 650; i++) vertices.push((random() - .5) * 350, random() * 120 + 4, (random() - .75) * 280);
    const stars = new THREE.BufferGeometry(); stars.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#a5d4ed', size: .17, sizeAttenuation: true })));
    const planet = new THREE.Mesh(new THREE.IcosahedronGeometry(23, 1),
      new THREE.MeshStandardMaterial({ color: '#597487', roughness: 1, flatShading: true }));
    planet.position.set(52, 39, -120); this.scene.add(planet);
    const debris = new THREE.InstancedMesh(this.cube, this.materials.dark, 45);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 45; i++) {
      const side = i % 2 ? 1 : -1;
      dummy.position.set(side * (15 + random() * 35), -8 - random() * 15, 10 - random() * 150);
      dummy.scale.set(1 + random() * 4, 1 + random() * 6, 1 + random() * 4);
      dummy.rotation.set(random(), random(), random()); dummy.updateMatrix(); debris.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(debris);
  }
  box(group, position, size, material) {
    const mesh = new THREE.Mesh(this.cube, material);
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
    this.materials.accent.color.set(level.accent);
    for (const b of level.boxes) {
      const mesh = this.box(this.levelGroup, b.position, b.size, this.materials[b.kind]);
      this.solids.push(mesh); if (b.kind === 'gate') this.gate = mesh;
    }
    this.bridge = this.box(this.levelGroup, level.bridge.position, level.bridge.size, this.materials.bridge);
    this.solids.push(this.bridge);
    const floors = level.boxes.filter(b => b.kind === 'floor');
    const strips = new THREE.InstancedMesh(this.cube, this.materials.accent, floors.length * 2);
    const dummy = new THREE.Object3D();
    let n = 0;
    for (const floor of floors) for (const side of [-1, 1]) {
      dummy.position.set(floor.position.x + side * (floor.size.x / 2 - .12), .025, floor.position.z);
      dummy.scale.set(.08, .04, floor.size.z - .3); dummy.updateMatrix(); strips.setMatrixAt(n++, dummy.matrix);
    }
    this.levelGroup.add(strips);
    for (const [index, p] of [level.terminalA, level.terminalB].entries()) {
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
    this.box(this.levelGroup, { x: 0, y: .02, z: level.checkpoint.z }, { x: 2, y: .04, z: 2 }, this.materials.terminal);
    for (const x of [-4.5, 4.5]) this.box(this.levelGroup,
      { x, y: 2.5, z: level.exit.z }, { x: .35, y: 5, z: .4 }, this.materials.accent);
    this.box(this.levelGroup, { x: 0, y: 5, z: level.exit.z }, { x: 9.35, y: .35, z: .4 }, this.materials.accent);
    this.setPuzzle({ open: false, latched: false });
  }
  setPuzzle(puzzle) { this.bridge.visible = puzzle.open || puzzle.latched; this.gate.visible = !puzzle.latched; }
  avatar(id, color = '#6eedf2') {
    if (this.players.has(id)) return this.players.get(id);
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: .85 });
    this.box(group, { x: 0, y: -.05, z: 0 }, { x: .52, y: .66, z: .34 }, mat);
    this.box(group, { x: 0, y: .5, z: 0 }, { x: .43, y: .4, z: .43 }, mat);
    this.box(group, { x: 0, y: .51, z: -.225 }, { x: .34, y: .15, z: .03 }, this.materials.dark);
    const left = this.box(group, { x: -.15, y: -.59, z: 0 }, { x: .2, y: .44, z: .22 }, mat);
    const right = this.box(group, { x: .15, y: -.59, z: 0 }, { x: .2, y: .44, z: .22 }, mat);
    group.userData = { legs: [left, right], material: mat }; this.scene.add(group); this.players.set(id, group); return group;
  }
  pose(avatar, state, time) {
    avatar.position.copy(state.position); avatar.rotation.y = state.yaw;
    avatar.rotation.z = state.animation === 'wallrun' ? .2 : 0;
    const moving = state.animation === 'walk' || state.animation === 'run';
    const swing = moving ? Math.sin(time * (state.animation === 'run' ? 19 : 12)) * .65 : state.animation === 'jump' ? .3 : 0;
    avatar.userData.legs[0].rotation.x = swing; avatar.userData.legs[1].rotation.x = -swing;
  }
  removePlayer(id) {
    const avatar = this.players.get(id); if (!avatar) return;
    this.scene.remove(avatar); avatar.userData.material.dispose(); this.players.delete(id);
  }
  render() { this.renderer.render(this.scene, this.camera); }
}
