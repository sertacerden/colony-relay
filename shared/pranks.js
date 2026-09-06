import { DT } from './config.js';
// Authored, bounded motion: no large rigid-body pile or client-controlled forces.
export function obstaclePose(o,time) {
  const phase=time*o.speed+(o.phase||0);
  if(o.type==='pendulum'){
    const angle=Math.sin(phase)*.85;
    return {x:o.position.x+Math.sin(angle)*o.length,y:o.position.y-Math.cos(angle)*o.length,z:o.position.z,angle};
  }
  return {...o.position,angle:phase};
}
const distanceSegment=(p,a,b)=>{
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy,p.z-a.z-t*dz);
};
export function obstacleHit(o,position,previous,time){
  for(let i=0;i<=4;i++){
    const t=i/4,q=obstaclePose(o,time-DT+DT*t);
    const p={x:previous.x+(position.x-previous.x)*t,y:previous.y+(position.y-previous.y)*t,z:previous.z+(position.z-previous.z)*t};
    for(const offset of [-.5,0,.5]){
      const c={...p,y:p.y+offset};
      if(o.type==='pendulum') {if(Math.hypot(c.x-q.x,c.y-q.y,c.z-q.z)<o.radius+.32)return true;}
      else {
        const dx=Math.cos(q.angle)*o.length,dz=Math.sin(q.angle)*o.length;
        if(distanceSegment(c,{x:q.x-dx,y:q.y,z:q.z-dz},{x:q.x+dx,y:q.y,z:q.z+dz})<o.radius+.32)return true;
      }
    }
  }
  return false;
}
export function newPranks(){return {drops:{},buttons:{},reveals:{}};}
export function prankNotice(state,kind){state.prank=kind;state.prankLeft=3;state.prankSeq=(state.prankSeq||0)+1;}
export function launchMotor(motor,kind,velocity){
  const s=motor.state;
  s.knockX=velocity.x;s.knockZ=velocity.z;s.vy=velocity.y;s.grounded=false;s.coyote=0;s.dashLeft=0;
  s.knockLeft=.7;s.emote=null;s.emoteLeft=0;prankNotice(s,kind);
}
export function processPranks(level,world,player,previous,time){
  const s=player.motor.state;
  player.trapCooldowns ||= {};
  for(const o of level.obstacles || []) {
    if((player.trapCooldowns[o.id]||0)>time || !obstacleHit(o,s.position,previous,time))continue;
    player.trapCooldowns[o.id]=time+1.4;
    const q=obstaclePose(o,time),dx=s.position.x-q.x,dz=s.position.z-q.z,n=Math.hypot(dx,dz)||1;
    launchMotor(player.motor,o.type,{x:dx/n*10,y:6,z:Math.abs(dz)<.1?10:dz/n*10});
  }
  for(const trap of level.traps || []){
    const p=s.position,near=Math.hypot(p.x-trap.position.x,p.y-trap.position.y,p.z-trap.position.z)<trap.radius;
    if(!near || (player.trapCooldowns[trap.id]||0)>time)continue;
    if(trap.type==='drop'){
      if(!player.interact || player.prankDown || (world.buttons[trap.id]||0)>time)continue;
      player.trapCooldowns[trap.id]=time+5;world.buttons[trap.id]=time+5;
      world.drops[trap.floorId]=time+2.6;prankNotice(s,'drop');
    } else if(trap.type==='launch' && s.grounded) {
      player.trapCooldowns[trap.id]=time+3;
      launchMotor(player.motor,'launch',{x:0,y:8,z:14});
    } else if(trap.type==='fake' && p.y<trap.position.y+.5) {
      player.trapCooldowns[trap.id]=time+5;prankNotice(s,'fake');
    }
  }
  for(const wall of level.invisibleWalls || []){
    const p=s.position,b=wall.position,size=wall.size;
    if(Math.abs(p.x-b.x)<size.x/2+.42&&Math.abs(p.z-b.z)<size.z/2+.42&&Math.abs(p.y-b.y)<size.y/2+ .8){
      world.reveals[wall.id]=time+1.3;
      if((player.trapCooldowns[wall.id]||0)<=time){player.trapCooldowns[wall.id]=time+4;prankNotice(s,'maze');}
    }
  }
  player.prankDown=player.interact;
}
