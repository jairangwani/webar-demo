// world.js — REAL world-tracking AR using the 8th Wall SLAM engine, via A-Frame.
//
// The engine runs SLAM on the camera feed and pins content to the real floor,
// staying anchored as you walk around it. This is the real thing (not the gyro
// guess). A-Frame 1.2.0 provides THREE r125, which the engine expects.
//
// Two A-Frame components:
//   cloud-log        — silent telemetry so a phone failure is diagnosable remotely
//   tap-place-ground — tap the detected floor to drop an object there

/* global AFRAME, THREE */

// --- tiny silent cloud logger (same webhook sink as the main demo) ---
const LOG_ENDPOINT = 'https://webhook.site/c299b7e3-e551-4cde-acdb-454476fc040d';
const sessionId = (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now());
const clog = (msg, data) => {
  const body = JSON.stringify({ app: 'world', sessionId, t: new Date().toISOString(), msg, data: data || null, ua: navigator.userAgent });
  try {
    // text/plain is CORS-safelisted → no preflight.
    if (navigator.sendBeacon) navigator.sendBeacon(LOG_ENDPOINT, new Blob([body], { type: 'text/plain' }));
    else fetch(LOG_ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true, body });
  } catch (e) { /* best-effort */ }
};
window.addEventListener('error', (e) => clog('window_error', { message: e.message, src: e.filename, line: e.lineno }));
window.addEventListener('unhandledrejection', (e) => clog('unhandledrejection', { reason: String(e.reason && (e.reason.message || e.reason)) }));

if (window.AFRAME) {
  // Report the engine lifecycle so I can see, remotely, how far a test got.
  AFRAME.registerComponent('cloud-log', {
    init() {
      const scene = this.el;
      clog('world_boot', { aframe: AFRAME.version, three: window.THREE && THREE.REVISION, xrweb: !!(AFRAME.components && AFRAME.components.xrweb) });
      scene.addEventListener('realityready', () => clog('reality_ready'));                       // camera + tracking live
      scene.addEventListener('camerastatuschange', (e) => clog('camera_status', e.detail || null));
      scene.addEventListener('realityerror', (e) => clog('reality_error', { message: String((e.detail && (e.detail.message || e.detail.name)) || e.detail) }));
    },
  });

  // Tap the floor → drop an object anchored in the real world.
  AFRAME.registerComponent('tap-place-ground', {
    init() {
      this.count = 0;
      this.el.addEventListener('click', (e) => {
        const pt = e.detail && e.detail.intersection && e.detail.intersection.point;
        if (!pt) return;
        const obj = document.createElement('a-entity');
        obj.setAttribute('geometry', 'primitive: cone; radiusBottom: 0.12; radiusTop: 0; height: 0.32; segmentsRadial: 24');
        obj.setAttribute('material', 'color: #ff7a59; metalness: 0.1; roughness: 0.4');
        obj.setAttribute('position', `${pt.x} ${pt.y + 0.16} ${pt.z}`);
        obj.setAttribute('shadow', 'cast: true');
        this.el.appendChild(obj);

        // a little blue disc base so it reads as "sitting on the floor"
        const base = document.createElement('a-entity');
        base.setAttribute('geometry', 'primitive: cylinder; radius: 0.14; height: 0.02');
        base.setAttribute('material', 'color: #6ea8ff; roughness: 0.6');
        base.setAttribute('position', `${pt.x} ${pt.y + 0.01} ${pt.z}`);
        this.el.appendChild(base);

        this.count++;
        clog('object_placed', { n: this.count, at: { x: +pt.x.toFixed(2), z: +pt.z.toFixed(2) } });
        const tip = document.getElementById('tip');
        if (tip) tip.textContent = `Placed ${this.count}. Walk around it — it should stay put. Tap the floor to add more.`;
      });
    },
  });
} else {
  clog('no_aframe');
}
