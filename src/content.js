// content.js — everything you SEE. Knows nothing about tracking or the camera.
//
// Floor model: a large grid centred under the viewer so "the floor" is visible
// whichever way you look down. A "focal" sub-group (highlighted tile + box +
// label) is what you point at. Once the gyro is live we CALIBRATE: drop the
// focal group onto the floor in the exact horizontal direction the phone is
// facing, so it reliably appears in front of you and stays put as you move.

import * as THREE from 'three';
import { makeTextLabel } from './text-label.js';
import { CONFIG } from './config.js';

const FLOOR_Y = CONFIG.FLOOR_Y;

export function buildContent(scene) {
  // --- Lighting ---
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(2, 5, 2);
  scene.add(dir);

  // --- Large floor grid, centred under the viewer ---
  const grid = new THREE.GridHelper(12, 24, 0x6ea8ff, 0x35507a);
  grid.position.set(0, FLOOR_Y, 0);
  scene.add(grid);

  // --- Focal group: the thing you point at ---
  const focal = new THREE.Group();

  // highlighted tile flat on the ground
  const tile = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x6ea8ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  );
  tile.rotation.x = -Math.PI / 2;
  tile.position.y = 0.01;
  focal.add(tile);

  // 3D object sitting on the tile
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xff7a59, roughness: 0.4, metalness: 0.1 }),
  );
  box.position.y = 0.2;
  focal.add(box);

  // text label floating above the tile
  const label = makeTextLabel('MYREZE • ON THE FLOOR');
  label.position.y = 0.7;
  focal.add(label);

  // Placed ahead by default; calibrate() moves it to true facing once gyro live.
  focal.position.set(0, FLOOR_Y, -CONFIG.FOCAL_DISTANCE);
  scene.add(focal);

  const fwd = new THREE.Vector3();

  return {
    focal,
    // Drop the focal group onto the floor in the direction the camera faces.
    calibrate(camera) {
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-4) return;   // looking straight up/down — skip
      fwd.normalize();
      focal.position.set(
        fwd.x * CONFIG.FOCAL_DISTANCE,
        FLOOR_Y,
        fwd.z * CONFIG.FOCAL_DISTANCE,
      );
    },
    update(camera) {
      box.rotation.y += 0.01;
      label.quaternion.copy(camera.quaternion);   // billboard toward viewer
    },
  };
}
