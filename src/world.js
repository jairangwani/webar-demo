// world.js — REAL world-tracking AR (8th Wall SLAM) via A-Frame, PLUS the
// "Analyze" feature: tap Analyze → snapshot the camera → our Gemini backend
// identifies what you're looking at → info cards are anchored in 3D on the
// real surfaces (floor/near the object) and stay put as you move.

/* global AFRAME, THREE */

// ---------- config ----------
const BACKEND_URL = 'https://ar-backend-three.vercel.app/api/analyze';
const LOG_ENDPOINT = 'https://webhook.site/b264cdd4-dfc3-45e2-a9ec-ae5fe1fcc71d';
const CAPTURE_MAX = 640;   // downscale long edge before upload (speed + cost)

// ---------- logging (on-screen + cloud) ----------
const sessionId = (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now());
const buffer = [];
let debugEl = null;
const clog = (msg, data) => {
  const body = JSON.stringify({ app: 'world', sessionId, t: new Date().toISOString(), msg, data: data || null, ua: navigator.userAgent });
  try { if (navigator.sendBeacon) navigator.sendBeacon(LOG_ENDPOINT, new Blob([body], { type: 'text/plain' })); } catch (e) {}
};
const render = () => { if (!debugEl) debugEl = document.getElementById('debug'); if (debugEl) { debugEl.textContent = buffer.join('\n'); debugEl.scrollTop = debugEl.scrollHeight; } };
const dbg = (msg, data) => { const line = new Date().toISOString().slice(11, 19) + '  ' + msg + (data !== undefined ? '  ' + safe(data) : ''); buffer.push(line); if (buffer.length > 300) buffer.shift(); render(); clog(msg, data); };
function safe(x) { try { return typeof x === 'object' ? JSON.stringify(x) : String(x); } catch (e) { return String(x); } }
document.addEventListener('DOMContentLoaded', () => { debugEl = document.getElementById('debug'); render(); });
window.addEventListener('error', (e) => dbg('WINDOW_ERROR ' + e.message + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => dbg('REJECT ' + safe(e.reason && (e.reason.message || e.reason))));
dbg('script_loaded');

// ---------- capture the camera frame ----------
function captureFrame() {
  const video = document.querySelector('video');
  if (!video || !video.videoWidth) return null;
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = Math.min(1, CAPTURE_MAX / Math.max(vw, vh));
  const w = Math.round(vw * scale), h = Math.round(vh * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(video, 0, 0, w, h);
  const dataUrl = c.toDataURL('image/jpeg', 0.7);
  return { b64: dataUrl.split(',')[1], w, h };
}

// ---------- info card as a canvas-textured plane ----------
function makeCardEntity(label, description) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const W = 512, pad = 26;
  ctx.font = '600 34px -apple-system, "Segoe UI", Roboto, sans-serif';
  const titleLines = wrap(ctx, label, W - pad * 2);
  ctx.font = '400 24px -apple-system, "Segoe UI", Roboto, sans-serif';
  const bodyLines = wrap(ctx, description, W - pad * 2);
  const H = pad * 2 + titleLines.length * 40 + 10 + bodyLines.length * 32;
  canvas.width = W; canvas.height = H;

  // background
  roundRect(ctx, 0, 0, W, H, 22); ctx.fillStyle = 'rgba(12,18,30,0.90)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(124,242,154,0.55)'; ctx.stroke();
  // title
  ctx.textBaseline = 'top'; ctx.fillStyle = '#7CFC9A';
  ctx.font = '600 34px -apple-system, "Segoe UI", Roboto, sans-serif';
  let y = pad; titleLines.forEach((l) => { ctx.fillText(l, pad, y); y += 40; });
  // body
  y += 10; ctx.fillStyle = '#eaf0ff';
  ctx.font = '400 24px -apple-system, "Segoe UI", Roboto, sans-serif';
  bodyLines.forEach((l) => { ctx.fillText(l, pad, y); y += 32; });

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const worldW = 0.5;                         // 50 cm wide
  const worldH = worldW * (H / W);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, worldH),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
  );
  const el = document.createElement('a-entity');
  el.setObject3D('mesh', mesh);
  el.setAttribute('billboard', '');
  return el;
}
function wrap(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/); const lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines.slice(0, 8);
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

if (window.AFRAME) {
  dbg('aframe_present', { v: AFRAME.version, three: window.THREE && THREE.REVISION });

  // Always face the camera.
  AFRAME.registerComponent('billboard', {
    tick() { const cam = this.el.sceneEl && this.el.sceneEl.camera; if (cam) this.el.object3D.quaternion.copy(cam.quaternion); },
  });

  // Lifecycle logging.
  AFRAME.registerComponent('cloud-log', {
    init() {
      const s = this.el;
      dbg('scene_init', { xrweb: !!(AFRAME.components && AFRAME.components.xrweb) });
      s.addEventListener('realityready', () => dbg('✓ REALITY_READY — camera + tracking live'));
      s.addEventListener('realityerror', (e) => dbg('✗ REALITY_ERROR', { m: safe((e.detail && (e.detail.message || e.detail.name)) || e.detail) }));
    },
  });

  // The Analyze feature.
  AFRAME.registerComponent('analyze', {
    init() {
      this.raycaster = new THREE.Raycaster();
      this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      this.busy = false;
      const btn = document.getElementById('analyzeBtn');
      if (btn) btn.addEventListener('click', () => this.run());
    },
    setStatus(t) { const s = document.getElementById('analyzeStatus'); if (s) s.textContent = t || ''; },
    async run() {
      if (this.busy) return;
      const frame = captureFrame();
      if (!frame) { this.setStatus('camera not ready'); dbg('analyze_no_frame'); return; }
      this.busy = true;
      this.setStatus('Analyzing…');
      dbg('analyze_start', { w: frame.w, h: frame.h });

      // Snapshot the camera pose at capture time so placement is correct even if the user moves.
      const cam = this.el.sceneEl.camera;
      const snap = cam.clone();
      snap.position.copy(cam.getWorldPosition(new THREE.Vector3()));
      snap.quaternion.copy(cam.getWorldQuaternion(new THREE.Quaternion()));
      snap.updateMatrixWorld(true);

      try {
        const res = await fetch(BACKEND_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: frame.b64, mimeType: 'image/jpeg' }),
        });
        const data = await res.json();
        const objects = (data && data.objects) || [];
        dbg('analyze_result', { n: objects.length, model: data && data.model, tokens: data && data.tokens });
        if (!objects.length) { this.setStatus('Nothing recognized — try again'); this.busy = false; return; }
        objects.forEach((o) => this.place(o, snap));
        this.setStatus(`Placed ${objects.length}. Walk around — tags stay put.`);
      } catch (e) {
        dbg('analyze_error', { e: String(e && e.message || e) });
        this.setStatus('Analyze failed — check connection');
      }
      this.busy = false;
    },
    place(obj, snap) {
      const b = obj.box_2d || [0, 0, 1000, 1000];        // [ymin,xmin,ymax,xmax] 0-1000
      const cx = (b[1] + b[3]) / 2 / 1000;                // 0..1 from left
      const cy = (b[0] + b[2]) / 2 / 1000;                // 0..1 from top
      const ndc = new THREE.Vector2(cx * 2 - 1, -(cy * 2 - 1));
      this.raycaster.setFromCamera(ndc, snap);

      const hit = new THREE.Vector3();
      let point = this.raycaster.ray.intersectPlane(this.ground, hit);
      if (!point || this.raycaster.ray.origin.distanceTo(hit) > 12) {
        // ray doesn't hit the floor ahead (object is high / on a wall) → place ~2.5 m along the ray
        point = this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(2.5));
      }
      const card = makeCardEntity(obj.label, obj.description);
      card.setAttribute('position', `${point.x.toFixed(3)} ${(point.y + 0.35).toFixed(3)} ${point.z.toFixed(3)}`);
      this.el.appendChild(card);
      dbg('placed', { label: obj.label, at: { x: +point.x.toFixed(2), z: +point.z.toFixed(2) } });
    },
  });
} else {
  dbg('NO_AFRAME — A-Frame failed to load');
}
