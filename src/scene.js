// scene.js — owns three.js setup: renderer, scene, camera, resize.
// The renderer canvas is transparent so the camera <video> shows through.

import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    70,                                   // fov roughly matches a phone camera
    window.innerWidth / window.innerHeight,
    0.01,
    1000,
  );

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);    // fully transparent background
  document.body.appendChild(renderer.domElement);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
}
