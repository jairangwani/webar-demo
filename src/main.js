// main.js — orchestrates camera + tracking + scene + content, wires logging,
// and handles the motion-permission retry flow.

import { startCamera } from './camera.js';
import { createScene } from './scene.js';
import { buildContent } from './content.js';
import { OrientationTracking } from './tracking.js';   // <-- swap for 8th Wall later
import { logger } from './logger.js';

const $ = (id) => document.getElementById(id);
const gate = $('gate'), startBtn = $('startBtn'), hint = $('hint');
const statusEl = $('status'), video = $('camera'), logsBtn = $('logsBtn');
const motionHelp = $('motionHelp'), logsView = $('logsView');

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
    `id: ${logger.userId.slice(0, 8)}`,
  ].join('<br>');
}

async function requestMotion() {
  const perm = await tracking.requestPermission();
  report.motion = perm;
  logger.event('motion_permission', { result: perm });
  logger.flush();
  if (perm === 'granted') {
    tracking.start();
    motionHelp.hidden = true;
  } else {
    // denied or unsupported — show help + retry, keep the experience running.
    motionHelp.hidden = false;
    hint.textContent = 'Motion ' + perm + ' — see the on-screen steps.';
  }
  refreshHUD();
  return perm;
}

async function start() {
  startBtn.disabled = true;
  hint.textContent = '';
  logsBtn.hidden = false;
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
  let frames = 0, lastFps = performance.now();
  renderer.setAnimationLoop(() => {
    tracking.applyTo(camera);

    // First time we actually get gyro data: calibrate the floor content to face
    // the user, and log it so we can confirm tracking went live on-device.
    if (!calibrated && tracking.hasData) {
      content.calibrate(camera);
      calibrated = true;
      logger.event('gyro_live_calibrated');
      logger.flush();
    }

    content.update(camera);
    renderer.render(scene, camera);

    // sample fps roughly every 5s (keeps cloud traffic light)
    frames++;
    const now = performance.now();
    if (now - lastFps >= 5000) {
      logger.event('fps', { fps: Math.round((frames * 1000) / (now - lastFps)), calibrated });
      frames = 0; lastFps = now;
    }
  });
  logger.event('loop_started');
  logger.flush();
}

// --- Retry / dismiss motion help ---
$('retryMotion').addEventListener('click', async () => {
  logger.event('motion_retry');
  await requestMotion();
});
$('dismissMotion').addEventListener('click', () => {
  motionHelp.hidden = true;
  logger.event('motion_dismissed');
});

// --- Logs viewer ---
function openLogs() {
  $('logsText').textContent = logger.getText();
  logsView.hidden = false;
}
logsBtn.addEventListener('click', openLogs);
$('closeLogs').addEventListener('click', () => { logsView.hidden = true; });
$('copyLogs').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(logger.getText()); $('copyLogs').textContent = 'Copied ✓'; }
  catch { $('copyLogs').textContent = 'Copy failed'; }
  setTimeout(() => { $('copyLogs').textContent = 'Copy'; }, 1500);
});
$('downloadLogs').addEventListener('click', () => {
  const blob = new Blob([logger.getText()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `webar-log-${logger.sessionId.slice(0, 8)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
});

startBtn.addEventListener('click', start, { once: true });
refreshHUD();
