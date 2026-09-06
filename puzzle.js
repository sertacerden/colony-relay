export const near=(p,target,radius=2.4)=>Math.hypot(p.x-target.x,p.y-target.y,p.z-target.z)<=radius;
export function newPuzzle(latched=false) {
  return {open:latched,latched,holderId:null,activeUntil:0,cooldownUntil:0,participants:[],revision:0,
    motionTime:0,plateSince:null,charge:0,downIds:[],startedAt:0,deliveries:{}};
}
const atPlate=(p,plate)=>p.motor.state.grounded&&Math.abs(p.motor.state.position.x-plate.x)<.9
  &&Math.abs(p.motor.state.position.z-plate.z)<.9&&Math.abs(p.motor.state.position.y-(plate.y+.76))<.35;
function latch(puzzle,a,b) {
  puzzle.latched=true;puzzle.open=true;puzzle.participants=[a,b];puzzle.holderId=null;puzzle.activeUntil=0;
}
export function updatePuzzle(puzzle,players,level,now,dt=1/60) {
  const type=level.puzzleType||'relay';
  if(puzzle.open||puzzle.latched)puzzle.motionTime+=dt;
  if(puzzle.latched)return false;
  const before=[puzzle.open,puzzle.latched,puzzle.holderId].join(':');
  if(type==='plates') {
    const a=players.find(p=>atPlate(p,level.plates[0]));
    const b=players.find(p=>p.id!==a?.id&&atPlate(p,level.plates[1]));
    if(a&&b){puzzle.plateSince??=now;puzzle.charge=Math.min(1,(now-puzzle.plateSince)/(level.plateHold||1));
      if(puzzle.charge>=1)latch(puzzle,a.id,b.id);
    }else{puzzle.plateSince=null;puzzle.charge=0;}
  }else if(type==='timed') {
    const previousDown=new Set(puzzle.downIds);
    puzzle.downIds=players.filter(p=>p.interact).map(p=>p.id);
    const operator=players.find(p=>p.id===puzzle.holderId);
    if(puzzle.holderId&&!operator){puzzle.open=false;puzzle.activeUntil=0;puzzle.holderId=null;puzzle.deliveries={};}
    if(puzzle.open&&now>=puzzle.activeUntil){puzzle.open=false;puzzle.cooldownUntil=now+.5;}
    if(!puzzle.open&&now>=puzzle.cooldownUntil){
      const a=players.find(p=>p.interact&&!previousDown.has(p.id)&&near(p.motor.state.position,level.terminalA));
      if(a){puzzle.holderId=a.id;puzzle.startedAt=now;puzzle.activeUntil=now+level.bridgeSeconds;
        puzzle.open=true;puzzle.deliveries={};}
    }
    if(puzzle.open)for(const p of players){
      const s=p.motor.state;
      if(p.id!==puzzle.holderId&&p.dashAt>=puzzle.startedAt&&p.dashEpoch===s.epoch
        &&p.dashPosition?.z<-10&&p.dashPosition.z>-32&&Math.abs(p.dashPosition.x)<2.5
        &&s.grounded&&s.position.z<=-32&&s.position.z>=-44)
        puzzle.deliveries[p.id]=s.epoch;
    }
    const b=players.find(p=>p.id!==puzzle.holderId&&p.interact&&near(p.motor.state.position,level.terminalB)
      &&Object.hasOwn(puzzle.deliveries,p.id)&&puzzle.deliveries[p.id]===p.motor.state.epoch);
    if(b&&players.some(p=>p.id===puzzle.holderId))latch(puzzle,puzzle.holderId,b.id);
  }else{
    let holder=players.find(p=>p.id===puzzle.holderId);
    if(puzzle.holderId&&(!holder||!holder.interact||!near(holder.motor.state.position,level.terminalA)||now>=puzzle.activeUntil)){
      puzzle.holderId=null;puzzle.open=false;puzzle.activeUntil=0;puzzle.cooldownUntil=now+1;holder=null;
    }
    if(!holder&&now>=puzzle.cooldownUntil){
      holder=players.find(p=>p.interact&&near(p.motor.state.position,level.terminalA));
      if(holder){puzzle.holderId=holder.id;puzzle.activeUntil=now+(level.holdSeconds||8);puzzle.open=true;}
    }
    if(holder&&puzzle.open){
      const b=players.find(p=>p.id!==holder.id&&p.interact&&near(p.motor.state.position,level.terminalB));
      if(b)latch(puzzle,holder.id,b.id);
    }
  }
  const changed=before!==[puzzle.open,puzzle.latched,puzzle.holderId].join(':');
  if(changed)puzzle.revision++;
  return changed;
}
