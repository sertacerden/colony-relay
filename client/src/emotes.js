import { EMOTES } from '../../shared/config.js';
/** Shared animation clock comes from remaining server time, never Date.now(). */
export function emotePose(state) {
  const duration = EMOTES[state.emote];
  if (!duration || !(state.emoteLeft > 0)) return null;
  const elapsed = Math.max(0, duration - state.emoteLeft);
  const weight = Math.min(1, elapsed / .25, state.emoteLeft / .3);
  if (state.emote === 'dance') {
    const beat = elapsed * Math.PI * 2 * 1.2;
    return { weight, lift: Math.abs(Math.sin(beat)) * .16, lean: Math.sin(beat) * .26,
      turn: Math.sin(beat * .5) * .2, leftLeg: Math.sin(beat) * .8, rightLeg: -Math.sin(beat) * .3,
      leftArm: [-1.2 + Math.sin(beat) * .55, 0, -.45],
      rightArm: [-1.2 - Math.sin(beat) * .55, 0, .45], smoke: false };
  }
  if (state.emote === 'wave') return { weight, lift: 0, lean: -.04, turn: 0, leftLeg: 0, rightLeg: 0,
    leftArm: [0, 0, 0], rightArm: [0, 0, 2.6 + Math.sin(elapsed * 12) * .35], smoke: false };
  const beat=elapsed*Math.PI*3;
  if(state.emote==='helicopter')return {weight,lift:.12+Math.abs(Math.sin(beat))*.14,lean:Math.sin(beat)*.25,turn:elapsed*7,leftLeg:.3,rightLeg:-.3,leftArm:[0,0,-1.65],rightArm:[0,0,1.65],smoke:false};
  if(state.emote==='robot'){const snap=Math.round(Math.sin(beat)*2)/2;return {weight,lift:Math.abs(snap)*.07,lean:snap*.2,turn:Math.round(Math.sin(beat*.5)*3)*.2,leftLeg:snap*.7,rightLeg:-snap*.7,leftArm:[snap*1.4,0,-.8],rightArm:[-snap*1.4,0,.8],smoke:false};}
  if(state.emote==='flop')return {weight,lift:-.18+Math.sin(beat)*.13,lean:Math.sin(beat*.65)*.45,turn:Math.sin(beat)*.25,leftLeg:Math.sin(beat)*1.1,rightLeg:Math.cos(beat)*1.1,leftArm:[Math.sin(beat)*1.2,0,-.8],rightArm:[Math.cos(beat)*1.2,0,.8],smoke:false};
  const phase = elapsed % 4.2;
  // Raise hand, hold near the face, lower; small reusable puffs drift upward on exhale.
  const raise = Math.max(0, Math.min(1, phase / .8, (3.1 - phase) / .7));
  return { weight, lift: 0, lean: -.035, turn: 0, leftLeg: 0, rightLeg: 0,
    leftArm: [0, 0, -.08], rightArm: [raise * 2.05, 0, -raise * .57],
    smoke: true, puffPhase: phase, raise };
}
