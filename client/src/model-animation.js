import { AnimationMixer, LoopRepeat, LoopOnce } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { EMOTES } from '../../shared/config.js';
import { MODEL_ASSETS } from './asset-config.js';
const sources=new Map();
const loader=new GLTFLoader();
export async function attachModel(avatar,skin){
  const spec=MODEL_ASSETS[skin];if(!spec)return;
  try{
    if(!sources.has(spec.url))sources.set(spec.url,loader.loadAsync(spec.url));
    const gltf=await sources.get(spec.url);
    if(avatar.userData.disposed)return;
    const root=clone(gltf.scene);root.scale.setScalar(spec.scale||1);root.position.y=spec.y??-.82;root.rotation.y=spec.rotationY??Math.PI;
    root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    avatar.add(root);const mixer=new AnimationMixer(root),actions=new Map();
    for(const [key,name] of Object.entries(spec.clips || {})){
      const clip=gltf.animations.find(c=>c.name===name);if(!clip)continue;
      const action=mixer.clipAction(clip);action.setLoop(EMOTES[key]?LoopOnce:LoopRepeat,EMOTES[key]?1:Infinity);action.clampWhenFinished=true;actions.set(key,action);
    }
    if(!actions.has('idle')){avatar.remove(root);mixer.uncacheRoot(root);return;}
    avatar.userData.external={root,mixer,actions,current:null};
  }catch(error){console.warn('Karakter modeli yüklenemedi; yerleşik tasarım kullanılıyor.',error);}
}
export function animateModel(avatar,state,dt){
  const ext=avatar.userData.external;if(!ext)return false;
  const key=state.emote || state.animation;
  const action=ext.actions.get(key);
  // Missing funny clips use the complete built-in avatar, not an unanimated imported rig.
  const active=!!action && !(state.knockLeft>0);
  ext.root.visible=active;for(const child of avatar.children)if(child!==ext.root)child.visible=!active && !child.userData.effect;
  if(!active)return false;
  if(ext.current!==action){const old=ext.current;action.reset().play();if(old)action.crossFadeFrom(old,.18,false);ext.current=action;}
  ext.mixer.update(Math.min(.05,Math.max(0,dt)));
  if(state.emote){const duration=EMOTES[state.emote],elapsed=duration-state.emoteLeft;action.time=Math.min(action.getClip().duration,elapsed/duration*action.getClip().duration);ext.mixer.update(0);}
  return true;
}
export function releaseModel(avatar){
  avatar.userData.disposed=true;const ext=avatar.userData.external;if(!ext)return;
  ext.mixer.stopAllAction();ext.mixer.uncacheRoot(ext.root);
  // Clones share cached geometry/materials; only skeleton GPU data belongs to this instance.
  ext.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});
}
