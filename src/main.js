// main.js — wires the modules together. Deliberately thin: it just orchestrates
// camera + tracking + scene + content and runs the frame loop.

import { startCamera } from './camera.js';
import { createScene } from './scene.js';
import { buildContent } from './content.js';
import { OrientationTracking } from './tracking.js';   // <-- swap this line for 8th Wall later

const gate = document.getElementById('gate');
const startBtn = document.getElementById('startBtn');
const hint = document.getElementById('hint');
const statusEl = document.getElementById('status');
const video = document.getElementById('camera');

// The single tracking provider the whole app depends on.
const tracking = new OrientationTracking();

function setStatus(lines) {
  statusEl.hidden = false;
  statusEl.innerHTML = lines.join('<br>');
}

async function start() {
  startBtn.disabled = true;
  hint.textContent = '';

  const report = { camera: '…', motion: '…' };
  const refresh = () => setStatus([
    `camera: ${report.camera}`,
    `motion: ${report.motion}`,
    tracking.statusLabel,
  ]);

  // 1) Camera — the #1 thing we're de-risking on iPhone.
  try {
    const { settings } = await startCamera(video);
    report.camera = `on (${settings.width || '?'}×${settings.height || '?'})`;
  } catch (err) {
    report.camera = 'FAILED';
    hint.textContent = 'Camera blocked. On iPhone this must be HTTPS + Safari, and you must Allow camera access.';
    startBtn.disabled = false;
    refresh();
    return;
  }

  // 2) Motion permission (iOS 13+ prompts here, inside the tap).
  const perm = await tracking.requestPermission();
  report.motion = perm;
  if (perm === 'granted') {
    tracking.start();
  } else {
    hint.textContent = 'Motion access ' + perm + ' — the view will not follow your phone. Reload and Allow motion to test fully.';
  }

  // 3) Scene + content.
  const { scene, camera, renderer } = createScene();
  const content = buildContent(scene);

  gate.style.display = 'none';
  refresh();
  setInterval(refresh, 500);   // keep the HUD live

  // 4) Frame loop.
  renderer.setAnimationLoop(() => {
    tracking.applyTo(camera);   // provider decides camera pose
    content.update(camera);
    renderer.render(scene, camera);
  });
}

startBtn.addEventListener('click', start, { once: true });
