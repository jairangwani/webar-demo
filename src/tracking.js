// tracking.js — THE SWAP POINT.
//
// Everything else in this app talks to a "tracking provider" through one tiny
// interface. To scale up to full positional AR later, you write a new provider
// (e.g. EightWallTracking) that implements the same three methods and swap which
// one main.js imports. Nothing in scene/content/camera has to change.
//
//   interface TrackingProvider {
//     async requestPermission(): 'granted' | 'denied' | 'unsupported'
//     start(): void
//     applyTo(camera): void   // called every frame; sets camera pose
//   }
//
// v1 provider below = OrientationTracking. It uses the phone's gyroscope
// (DeviceOrientation) to ROTATE the camera. This proves camera + sensors +
// permissions + rendering all work on iPhone. It does NOT track position
// (walking), because iOS Safari has no WebXR. That's exactly the capability
// 8th Wall's engine adds in the next provider.

import * as THREE from 'three';

export class OrientationTracking {
  constructor() {
    this.enabled = false;
    this.deviceOrientation = null;   // latest {alpha,beta,gamma}
    this.screenOrientation = 0;      // degrees

    // Reusable math objects (allocating per-frame would create GC churn).
    this._zee = new THREE.Vector3(0, 0, 1);
    this._euler = new THREE.Euler();
    this._q0 = new THREE.Quaternion();
    // -90° about X: rotate so "camera looks out the back of the device".
    this._q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

    this._onDeviceOrientation = (e) => { this.deviceOrientation = e; };
    this._onScreenOrientation = () => {
      this.screenOrientation = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    };
  }

  // iOS 13+ gates motion sensors behind an explicit permission call that MUST
  // run inside a user gesture (the Start tap).
  async requestPermission() {
    const D = window.DeviceOrientationEvent;
    if (!D) return 'unsupported';
    if (typeof D.requestPermission === 'function') {
      try {
        const res = await D.requestPermission();
        return res === 'granted' ? 'granted' : 'denied';
      } catch {
        return 'denied';
      }
    }
    // Non-iOS browsers don't require the prompt.
    return 'granted';
  }

  start() {
    this._onScreenOrientation();
    window.addEventListener('orientationchange', this._onScreenOrientation);
    window.addEventListener('deviceorientation', this._onDeviceOrientation, true);
    this.enabled = true;
  }

  stop() {
    window.removeEventListener('orientationchange', this._onScreenOrientation);
    window.removeEventListener('deviceorientation', this._onDeviceOrientation, true);
    this.enabled = false;
  }

  // Called every frame. Turns the raw sensor angles into the camera's rotation.
  // Math is the well-known three.js DeviceOrientationControls quaternion recipe.
  applyTo(camera) {
    if (!this.enabled || !this.deviceOrientation) return;

    const d = this.deviceOrientation;
    const alpha = d.alpha ? THREE.MathUtils.degToRad(d.alpha) : 0; // Z
    const beta  = d.beta  ? THREE.MathUtils.degToRad(d.beta)  : 0; // X
    const gamma = d.gamma ? THREE.MathUtils.degToRad(d.gamma) : 0; // Y
    const orient = this.screenOrientation ? THREE.MathUtils.degToRad(this.screenOrientation) : 0;

    this._euler.set(beta, alpha, -gamma, 'YXZ');   // device euler order
    camera.quaternion.setFromEuler(this._euler);
    camera.quaternion.multiply(this._q1);          // look out the back
    camera.quaternion.multiply(this._q0.setFromAxisAngle(this._zee, -orient)); // screen rotation

    // Position stays at the origin — this provider is rotation-only.
    // A positional provider (8th Wall) would also set camera.position here.
  }

  get statusLabel() {
    return this.deviceOrientation ? 'gyro: live' : 'gyro: waiting…';
  }
}
