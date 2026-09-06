export function dynamicPosition(item, time) {
  const p={...item.position}, m=item.motion;
  if(m) p[m.axis]+=Math.sin(time*Math.PI*2/m.period+(m.phase||0))*m.amplitude;
  return p;
}
export function laserState(laser,time,puzzle={}) {
  const phase=((time+(laser.phase||0))%laser.period)/laser.period;
  return { active:!(laser.controlled&&(puzzle.open||puzzle.latched))&&phase<laser.duty,
    position:{...laser.position,y:laser.position.y+Math.sin(time*1.8+(laser.phase||0))*(laser.sweep||0)} };
}
export function hazardHit(level,p,previous,time,puzzle) {
  return level.lasers.some(laser=>{
    const state=laserState(laser,time,puzzle); if(!state.active)return false;
    const q=state.position,s=laser.size;
    return Math.min(p.x,previous.x)-.32<=q.x+s.x/2 && Math.max(p.x,previous.x)+.32>=q.x-s.x/2
      && Math.min(p.y,previous.y)-.82<=q.y+s.y/2 && Math.max(p.y,previous.y)+.82>=q.y-s.y/2
      && Math.min(p.z,previous.z)-.32<=q.z+s.z/2 && Math.max(p.z,previous.z)+.32>=q.z-s.z/2;
  });
}
