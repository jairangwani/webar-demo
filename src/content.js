// content.js — everything you actually SEE in the scene lives here.
// This is where you scale up: add more objects, swap the box for a glTF model,
// add more labels, etc. It knows nothing about tracking or the camera.

import * as THREE from 'three';
import { makeTextLabel } from './text-label.js';

// The virtual floor sits ~1.5 m below eye level and a few metres ahead.
const FLOOR_Y = -1.5;
const AHEAD_Z = -3.0;

export function buildContent(scene) {
  const group = new THREE.Group();

  // --- Lighting (the box needs light; the tile/text are unlit) ---
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(2, 5, 2);
  scene.add(dir);

  // --- Grid of tiles lying flat on the floor ---
  const grid = new THREE.GridHelper(6, 12, 0x6ea8ff, 0x35507a);
  grid.position.set(0, FLOOR_Y, AHEAD_Z);
  group.add(grid);

  // --- One highlighted "tile" (a flat panel on the ground) ---
  const tileGeo = new THREE.PlaneGeometry(1, 1);
  const tileMat = new THREE.MeshBasicMaterial({
    color: 0x6ea8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
  });
  const tile = new THREE.Mesh(tileGeo, tileMat);
  tile.rotation.x = -Math.PI / 2;                 // lay it flat
  tile.position.set(0, FLOOR_Y + 0.01, AHEAD_Z);  // just above the grid
  group.add(tile);

  // --- A 3D object sitting ON the tile ---
  const boxGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xff7a59, roughness: 0.4, metalness: 0.1 });
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set(0, FLOOR_Y + 0.2, AHEAD_Z);    // half its height above floor
  group.add(box);

  // --- Text label floating above the tile ---
  const label = makeTextLabel('MYREZE • ON THE FLOOR');
  label.position.set(0, FLOOR_Y + 0.7, AHEAD_Z);
  group.add(label);

  scene.add(group);

  // Return handles so main.js can animate them each frame.
  return {
    group,
    // keep the label turned toward the viewer (billboard)
    update(camera) {
      box.rotation.y += 0.01;
      label.quaternion.copy(camera.quaternion);
    },
  };
}
