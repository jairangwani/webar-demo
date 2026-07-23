// world.js — REAL world-tracking AR (8th Wall SLAM) via A-Frame, with a loud
// on-device debug console so any failure is visible on the phone AND cloud-logged.

/* global AFRAME, THREE, XR8 */

// ---------- logging (on-screen + cloud) ----------
const LOG_ENDPOINT = 'https://webhook.site/b264cdd4-dfc3-45e2-a9ec-ae5fe1fcc71d';
const sessionId = (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now());
const buffer = [];
let debugEl = null;

const clog = (msg, data) => {
  const body = JSON.stringify({ app: 'world', sessionId, t: new Date().toISOString(), msg, data: data || null, ua: navigator.userAgent });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(LOG_ENDPOINT, new Blob([body], { type: 'text/plain' }));
    else fetch(LOG_ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true, body });
  } catch (e) { /* best-effort */ }
};

const render = () => {
  if (!debugEl) debugEl = document.getElementById('debug');
  if (debugEl) { debugEl.textContent = buffer.join('\n'); debugEl.scrollTop = debugEl.scrollHeight; }
};
const dbg = (msg, data) => {
  const line = new Date().toISOString().slice(11, 19) + '  ' + msg + (data !== undefined ? '  ' + safe(data) : '');
  buffer.push(line);
  if (buffer.length > 300) buffer.shift();
  render();
  clog(msg, data);
};
function safe(x) { try { return typeof x === 'object' ? JSON.stringify(x) : String(x); } catch (e) { return String(x); } }

document.addEventListener('DOMContentLoaded', () => { debugEl = document.getElementById('debug'); render(); });

// Capture console + uncaught errors so the engine's own messages surface.
['log', 'warn', 'error'].forEach((k) => {
  const orig = console[k] ? console[k].bind(console) : () => {};
  console[k] = (...a) => { try { dbg('[' + k + '] ' + a.map(safe).join(' ')); } catch (e) {} orig(...a); };
});
window.addEventListener('error', (e) => dbg('WINDOW_ERROR ' + e.message + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => dbg('REJECT ' + safe(e.reason && (e.reason.message || e.reason))));

dbg('script_loaded');

// ---------- A-Frame components ----------
if (window.AFRAME) {
  dbg('aframe_present', { v: AFRAME.version, three: window.THREE && THREE.REVISION });

  AFRAME.registerComponent('cloud-log', {
    init() {
      const s = this.el;
      dbg('scene_init', { xrweb_registered: !!(AFRAME.components && AFRAME.components.xrweb) });
      s.addEventListener('loaded', () => dbg('scene_loaded'));
      s.addEventListener('realityready', () => dbg('✓ REALITY_READY — camera + tracking are LIVE'));
      s.addEventListener('camerastatuschange', (e) => dbg('camera_status', e.detail));
      s.addEventListener('realityerror', (e) => dbg('✗ REALITY_ERROR', { m: safe((e.detail && (e.detail.message || e.detail.name)) || e.detail) }));

      // Probe the engine after a few seconds to see WHY it might be stuck.
      setTimeout(() => {
        try {
          dbg('probe.xr8_present', { xr8: !!window.XR8 });
          if (window.XR8 && XR8.XrDevice) {
            const D = XR8.XrDevice;
            const out = {};
            try { out.compatible = D.IsDeviceBrowserCompatible ? D.IsDeviceBrowserCompatible() : 'n/a'; } catch (e) { out.compatible = 'err:' + e.message; }
            try { out.reasons = D.IncompatibilityReasons ? D.IncompatibilityReasons() : 'n/a'; } catch (e) { out.reasons = 'err:' + e.message; }
            try { out.deviceInfo = D.deviceEstimate ? D.deviceEstimate() : 'n/a'; } catch (e) {}
            dbg('probe.device', out);
          }
          if (window.XR8 && XR8.XrPermissions) {
            try { dbg('probe.permissions', XR8.XrPermissions.permissions ? Object.keys(XR8.XrPermissions.permissions()) : 'n/a'); } catch (e) {}
          }
        } catch (e) { dbg('probe_error ' + e.message); }
      }, 5000);
    },
  });

  AFRAME.registerComponent('tap-place-ground', {
    init() {
      this.count = 0;
      this.el.addEventListener('click', (e) => {
        const pt = e.detail && e.detail.intersection && e.detail.intersection.point;
        if (!pt) { dbg('tap_no_hit'); return; }
        const cone = document.createElement('a-entity');
        cone.setAttribute('geometry', 'primitive: cone; radiusBottom: 0.12; radiusTop: 0; height: 0.32; segmentsRadial: 24');
        cone.setAttribute('material', 'color: #ff7a59; metalness: 0.1; roughness: 0.4');
        cone.setAttribute('position', `${pt.x} ${pt.y + 0.16} ${pt.z}`);
        this.el.appendChild(cone);
        const base = document.createElement('a-entity');
        base.setAttribute('geometry', 'primitive: cylinder; radius: 0.14; height: 0.02');
        base.setAttribute('material', 'color: #6ea8ff; roughness: 0.6');
        base.setAttribute('position', `${pt.x} ${pt.y + 0.01} ${pt.z}`);
        this.el.appendChild(base);
        this.count++;
        dbg('object_placed', { n: this.count });
        const tip = document.getElementById('tip');
        if (tip) tip.textContent = `Placed ${this.count}. Walk around it — it should stay put. Tap to add more.`;
      });
    },
  });
} else {
  dbg('NO_AFRAME — A-Frame failed to load');
}
