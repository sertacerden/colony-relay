import * as THREE from 'three';
export class CameraRig {
  constructor(camera) {
    this.camera = camera; this.thirdPerson = true; this.distance = 4.5;
    this.ray = new THREE.Raycaster(); this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.head = new THREE.Vector3(); this.forward = new THREE.Vector3(); this.desired = new THREE.Vector3();
    this.delta = new THREE.Vector3();
  }
  toggle() { this.thirdPerson = !this.thirdPerson; }
  update(position, input, dt, solids, avatar) {
    const smooth = 1 - Math.exp(-12 * dt);
    this.distance = THREE.MathUtils.lerp(this.distance, this.thirdPerson ? 4.5 : 0, smooth);
    this.euler.set(input.pitch, input.yaw, 0);
    this.camera.quaternion.setFromEuler(this.euler);
    this.head.set(position.x, position.y + 0.53, position.z);
    this.forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.desired.copy(this.head).addScaledVector(this.forward, -this.distance);
    this.desired.y += this.distance * 0.12;
    this.delta.subVectors(this.desired, this.head);
    const length = this.delta.length();
    if (length > 0.02) {
      this.ray.set(this.head, this.delta.normalize()); this.ray.far = length + 0.2;
      const hit = this.ray.intersectObjects(solids.filter(m => m.visible), false)[0];
      if (hit) this.desired.copy(this.head).addScaledVector(this.delta, Math.max(0, hit.distance - 0.25));
    }
    // Distance is smoothed, obstruction correction is immediate to prevent clipping.
    this.camera.position.copy(this.desired);
    avatar.visible = this.distance > 0.65 && this.camera.position.distanceTo(this.head) > 0.65;
  }
}
