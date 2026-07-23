// text-label.js — makes a floating text label as a textured plane.
// Uses a <canvas> texture so there's no font file to load (robust on mobile).

import * as THREE from 'three';

export function makeTextLabel(text, {
  color = '#ffffff',
  bg = 'rgba(20,26,40,0.85)',
  fontSize = 64,
  padding = 28,
  worldHeight = 0.35,   // metres tall in the scene
} = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const font = `600 ${fontSize}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.font = font;
  const textW = Math.ceil(ctx.measureText(text).width);

  canvas.width = textW + padding * 2;
  canvas.height = fontSize + padding * 2;

  // Redraw at final size (resizing the canvas reset the context).
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 20);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, padding, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;

  const aspect = canvas.width / canvas.height;
  const geo = new THREE.PlaneGeometry(worldHeight * aspect, worldHeight);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  return new THREE.Mesh(geo, mat);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
