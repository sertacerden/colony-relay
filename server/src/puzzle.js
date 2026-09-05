export const near = (p, target, radius = 2.4) => Math.hypot(
  p.x - target.x, p.y - target.y, p.z - target.z) <= radius;
export function newPuzzle(latched = false) {
  return { open: latched, latched, holderId: null, activeUntil: 0, cooldownUntil: 0,
    participants: [], revision: 0 };
}
/** Call exclusively inside the room's simulation tick. Client cannot set puzzle state. */
export function updatePuzzle(puzzle, players, level, now) {
  if (puzzle.latched) return false;
  const before = JSON.stringify(puzzle);
  let holder = players.find(p => p.id === puzzle.holderId);
  if (holder && (!holder.interact || !near(holder.motor.state.position, level.terminalA)
    || now >= puzzle.activeUntil)) {
    puzzle.holderId = null; puzzle.open = false; puzzle.activeUntil = 0;
    puzzle.cooldownUntil = now + 1; holder = null;
  }
  if (!holder && now >= puzzle.cooldownUntil) {
    holder = players.find(p => p.interact && near(p.motor.state.position, level.terminalA));
    if (holder) {
      puzzle.holderId = holder.id; puzzle.activeUntil = now + 8; puzzle.open = true;
    }
  }
  if (holder && puzzle.open) {
    const receiver = players.find(p => p.id !== holder.id && p.interact
      && near(p.motor.state.position, level.terminalB));
    if (receiver) {
      puzzle.latched = true; puzzle.open = true;
      puzzle.participants = [holder.id, receiver.id];
      puzzle.holderId = null; puzzle.activeUntil = 0;
    }
  }
  // Includes the disconnected-holder case.
  if (!holder && puzzle.holderId) {
    puzzle.holderId = null; puzzle.open = false; puzzle.activeUntil = 0;
  }
  const changed = before !== JSON.stringify(puzzle);
  if (changed) puzzle.revision++;
  return changed;
}
