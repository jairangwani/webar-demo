// main.js — orchestrates camera + tracking + scene + content. Logging is SILENT
// and cloud-only (no in-app UI): you just open + test, and I read the session
// from the cloud. The only on-screen chrome is a tiny status HUD and a slim
// motion banner that appears ONLY if motion sensors are blocked.

import { startCamera } from './camera.js';
import { createScene } from './scene.js';
import { buildContent } from './content.js';
import { OrientationTracking } from './tracking.js';   // <-- swap for 8th Wall later
import { logger } from './logger.js';

const $ = (id) => document.getElementById(id);
const gate = $('gate'), startBtn = $('startBtn'), hint = $('hint');
const statusEl = $('status'), video = $('camera');
const motionBanner = $('motionBanner'), motionMsg = $('motionMsg');

const tracking = new OrientationTracking();
const report = { camera: '…', motion: '…' };
let calibrated = false;

function refreshHUD() {
  statusEl.hidden = false;
  statusEl.innerHTML = [
    `camera: ${report.camera}`,
    `motion: ${report.motion}`,
    tracking.statusLabel,
    `cloud: ${logger.cloud}`,
  ].join('<br>');
}

async function requestMotion() {
  const perm = await tracking.requestPermission();
  report.motion = perm;
  logger.event('motion_permission', { result: perm, hasRequestApi: typeof (window.DeviceOrientationEvent || {}).requestPermission === 'function' });
  logger.flush();
  if (perm === 'granted') {
    tracking.start();
    motionBanner.hidden = true;
  } else {
    motionMsg.innerHTML = perm === 'unsupported'
      ? 'This browser reports no motion sensors.'
      : 'Motion sensors are off. Enable <b>Settings ▸ Safari ▸ Motion &amp; Orientation Access</b>, then';
    motionBanner.hidden = false;
  }
  refreshHUD();
  return perm;
}

async function start() {
  startBtn.disabled = true;
  hint.textContent = '';
  logger.event('start_tapped');

  // 1) Camera
  try {
    const { settings } = await startCamera(video);
    report.camera = `on (${settings.width || '?'}×${settings.height || '?'})`;
    logger.event('camera_ok', settings);
  } catch (err) {
    report.camera = 'FAILED';
    logger.error('camera_failed', { name: err.name, message: err.message });
    logger.flush();
    hint.textContent = 'Camera blocked. Needs HTTPS + Safari, and you must Allow camera access.';
    startBtn.disabled = false;
    refreshHUD();
    return;
  }

  // 2) Motion permission (iOS prompts here, inside the tap)
  await requestMotion();

  // 3) Scene + content
  const { scene, camera, renderer } = createScene();
  const content = buildContent(scene);
  logger.event('scene_built');

  gate.style.display = 'none';
  refreshHUD();
  setInterval(refreshHUD, 500);

  // 4) Frame loop
  let frames = 0, lastFps = performance.now(), sampledOrientation = false;
  renderer.setAnimationLoop(() => {
    tracking.applyTo(camera);

    if (tracking.hasData) {
      // Log one real orientation sample so I can confirm sensor data is genuine.
      if (!sampledOrientation) {
        const d = tracking.deviceOrientation;
        logger.event('orientation_sample', { alpha: Math.round(d.alpha), beta: Math.round(d.beta), gamma: Math.round(d.gamma) });
        sampledOrientation = true;
      }
      // First real data → drop the floor content in front of the user.
      if (!calibrated) {
        content.calibrate(camera);
        calibrated = true;
        logger.event('gyro_live_calibrated');
        logger.flush();
      }
    }

    content.update(camera);
    renderer.render(scene, camera);

    frames++;
    const now = performance.now();
    if (now - lastFps >= 5000) {
      logger.event('fps', { fps: Math.round((frames * 1000) / (now - lastFps)), calibrated, motion: report.motion });
      frames = 0; lastFps = now;
    }
  });
  logger.event('loop_started');
  logger.flush();
}

// Motion banner actions
$('retryMotion').addEventListener('click', async () => {
  logger.event('motion_retry');
  await requestMotion();
});
$('dismissMotion').addEventListener('click', () => {
  motionBanner.hidden = true;
  logger.event('motion_dismissed');
});

startBtn.addEventListener('click', start, { once: true });
// HUD stays hidden until Start, so the landing screen is clean.
