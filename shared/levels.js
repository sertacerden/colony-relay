const box = (id, x, y, z, sx, sy, sz, kind = 'floor') =>
  ({ id, position: { x, y, z }, size: { x: sx, y: sy, z: sz }, kind });
export const SECTORS = [
  { name: 'Uyanış İskelesi', accent: '#5ce7f2', gap: 2.4, width: 5 },
  { name: 'Bakım Omurgası', accent: '#b5f56a', gap: 3.2, width: 3.8 },
  { name: 'Reaktör Yaklaşımı', accent: '#ffad66', gap: 4.1, width: 3.1 }
];
export function buildLevel(index = 0) {
  const spec = SECTORS[index];
  if (!spec) throw new Error('Unknown sector');
  const boxes = [box('arrival', 0, -0.5, -2, 14, 1, 20),
    box('landing', 0, -0.5, -38, 14, 1, 12),
    box('wall-left', -7.2, 2, -3, 0.4, 5, 18, 'wall'),
    box('wall-right', 7.2, 2, -3, 0.4, 5, 18, 'wall')];
  let z = -44;
  for (let i = 0; i < 5; i++) {
    z -= spec.gap + 2;
    boxes.push(box(`jump-${i}`, i % 2 ? 1.3 : -1.3, -0.5, z, spec.width, 1, 4));
    z -= 2;
  }
  // Optional wall-run line alongside jumps, reachable from landing platform.
  boxes.push(box('run-wall', 3.4, 2.5, (-44 + z) / 2, 0.4, 6, -44 - z, 'wall'));
  const exitZ = z - 6;
  boxes.push(box('exit', 0, -0.5, exitZ, 12, 1, 12));
  boxes.push(box('exit-gate', 0, 2.5, exitZ + 2, 12, 6, 0.5, 'gate'));
  return { index, ...spec, boxes,
    bridge: box('bridge', 0, -0.35, -22, 4.2, 0.7, 20, 'bridge'),
    terminalA: { x: -2.2, y: 0.9, z: -8.5 },
    terminalB: { x: 2.2, y: 0.9, z: -36 },
    spawn: { x: 0, y: 1.1, z: 3 },
    checkpoint: { x: 0, y: 1.1, z: -39 },
    exit: { x: 0, y: 1, z: exitZ - 2 },
    fallY: -14 };
}
