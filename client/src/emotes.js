import { EMOTES } from '../../shared/config.js';
/** Shared animation clock comes from remaining server time, never Date.now(). */
export function emotePose(state) {
  const duration = EMOTES[state.emote];
  if (!duration || !(state.emoteLeft > 0)) return null;
  const elapsed = Math.max(0, duration - state.emoteLeft);
  const weight = Math.min(1, elapsed / .25, state.emoteLeft / .3);
  if (state.emote === 'dance') {
    const beat = elapsed * Math.PI * 2 * 1.2;
    return { weight, lift: Math.abs(Math.sin(beat)) * .065, lean: Math.sin(beat) * .12,
      turn: Math.sin(beat * .5) * .2, leftLeg: Math.sin(beat) * .3, rightLeg: -Math.sin(beat) * .3,
      leftArm: [-.9 + Math.sin(beat) * .55, 0, -.45],
      rightArm: [-.9 - Math.sin(beat) * .55, 0, .45], smoke: false };
  }
  if (state.emote === 'wave') return { weight, lift: 0, lean: -.04, turn: 0, leftLeg: 0, rightLeg: 0,
    leftArm: [0, 0, 0], rightArm: [0, 0, 2.6 + Math.sin(elapsed * 12) * .35], smoke: false };
  const phase = elapsed % 4.2;
  // Raise hand, hold near the face, lower; small reusable puffs drift upward on exhale.
  const raise = Math.max(0, Math.min(1, phase / .8, (3.1 - phase) / .7));
  return { weight, lift: 0, lean: -.035, turn: 0, leftLeg: 0, rightLeg: 0,
    leftArm: [0, 0, -.08], rightArm: [raise * 2.05, 0, -raise * .57],
    smoke: true, puffPhase: phase, raise };
}
