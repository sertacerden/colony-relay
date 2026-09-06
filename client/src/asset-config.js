// Optional authored assets; built-in characters and expressive UI work without downloads.
// glb paths are same-origin; animation clips must be baked on that model's rig.
export const MODEL_ASSETS = {
  // courier: { url:'/models/courier.glb', scale:1, y:-.82, rotationY:Math.PI,
  //   clips:{idle:'idle',walk:'walk',run:'run',jump:'jump',dance:'dance',wave:'wave',smoke:'smoke',helicopter:'helicopter',robot:'robot',flop:'flop'} }
};
export const RIVE_ASSET = {
  src:null, // '/ui/mascot.riv'; asset is optional, never silently fetched from a third party.
  stateMachine:'Mahalle',
  inputs:{joined:'oyunda',mood:'duygu',progress:'ilerleme',celebrate:'kutla'}
};
