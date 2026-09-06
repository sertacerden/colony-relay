import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function panelTextures() {
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=256;
  const c=canvas.getContext('2d'); c.fillStyle='#c1c7cc';c.fillRect(0,0,256,256);
  c.strokeStyle='#525f6b';c.lineWidth=4;c.strokeRect(3,3,250,250);
  c.lineWidth=1;c.strokeRect(12,12,232,232);
  for(const x of [20,236])for(const y of [20,236]){c.fillStyle='#53616c';c.fillRect(x-2,y-2,4,4);}
  for(let i=0;i<30;i++){c.fillStyle=`rgba(60,75,85,${.03+(i%4)*.015})`;c.fillRect((i*73)%240,(i*37)%240,15+i%12,1);}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const bump=new THREE.CanvasTexture(canvas);
  return {map,bumpMap:bump,bumpScale:.018,roughness:.72,metalness:.55};
}
export class Graphics {
  constructor(view,sun) {
    this.view=view;this.sun=sun;this.slow=0;this.shadowTime=0;
    const generator=new THREE.PMREMGenerator(view.renderer), room=new RoomEnvironment();
    this.environment=generator.fromScene(room,.04);view.scene.environment=this.environment.texture;
    room.dispose();generator.dispose();view.scene.environmentIntensity=.45;
    sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.0003;sun.shadow.normalBias=.045;
    Object.assign(sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:120});
    view.scene.add(sun.target);view.renderer.shadowMap.type=THREE.PCFShadowMap;view.renderer.shadowMap.autoUpdate=false;
    let saved='auto';try{saved=localStorage.getItem('colony-graphics')||saved;}catch{}
    this.set(saved);
  }
  set(preference) {
    this.preference=['auto','low','balanced','high'].includes(preference)?preference:'auto';
    try{localStorage.setItem('colony-graphics',this.preference);}catch{}
    this.configure(this.preference==='auto' ? (navigator.deviceMemory && navigator.deviceMemory<=4 ? 'low':'balanced'):this.preference);
  }
  configure(quality) {
    this.quality=quality;this.slow=0;
    if(this.composer){for(const pass of this.composer.passes)pass.dispose?.();this.composer.dispose();}
    this.composer=null;this.ao=null;
    const {renderer,scene,camera}=this.view;
    renderer.shadowMap.enabled=quality!=='low';renderer.shadowMap.needsUpdate=true;
    if(quality!=='low') {
      this.composer=new EffectComposer(renderer);this.composer.addPass(new RenderPass(scene,camera));
      if(quality==='high') {
        this.ao=new SSAOPass(scene,camera,1,1,8);this.ao.kernelRadius=4;this.ao.minDistance=.005;this.ao.maxDistance=.12;
        this.composer.addPass(this.ao);
      }
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1,1),.25,.3,1.1));
      this.composer.addPass(new OutputPass());
    }
    this.resize();
  }
  resize() {
    const {renderer}=this.view;
    const budget=this.quality==='low'?1100000: this.quality==='high'?2200000:1600000;
    const ratio=Math.min(devicePixelRatio,this.quality==='low'?1:1.5,Math.sqrt(budget/(innerWidth*innerHeight)));
    renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight);
    this.composer?.setPixelRatio(ratio);this.composer?.setSize(innerWidth,innerHeight);
    this.ao?.setSize(Math.max(1,Math.floor(innerWidth*ratio/2)),Math.max(1,Math.floor(innerHeight*ratio/2)));
  }
  render(dt) {
    this.shadowTime+=dt;
    if(this.shadowTime>1/15) {
      this.shadowTime=0;const p=this.view.camera.position;
      this.sun.target.position.set(p.x,0,p.z-10);this.sun.position.set(p.x+20,40,p.z+10);
      this.view.renderer.shadowMap.needsUpdate=true;
    }
    if(this.preference==='auto' && this.quality!=='low') {
      this.slow=dt>.027?this.slow+dt:Math.max(0,this.slow-dt*.5);
      if(this.slow>4)this.configure('low');
    }
    if(this.composer)this.composer.render(dt);else this.view.renderer.render(this.view.scene,this.view.camera);
  }
}
