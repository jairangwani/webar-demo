// world.js — REAL world-tracking AR (8th Wall SLAM, iOS + Android) + "Analyze":
// tap Analyze → our Gemini backend identifies what you're looking at → a small
// TITLE-ONLY card is anchored in 3D on the real surface. Tap a card → a proper
// 2D info sheet slides up from the bottom with the full details.

/* global AFRAME, THREE */

// ---------- config ----------
const BACKEND_URL = 'https://ar-backend-three.vercel.app/api/analyze';
const LOG_ENDPOINT = 'https://webhook.site/b264cdd4-dfc3-45e2-a9ec-ae5fe1fcc71d';
const CAPTURE_MAX = 640;

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
window.addEventListener('error', (e) => dbg('WINDOW_ERROR ' + e.message + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => dbg('REJECT ' + safe(e.reason && (e.reason.message || e.reason))));
dbg('script_loaded');

// ---------- the 2D info sheet (bottom) ----------
function openSheet(title, body) {
  const s = document.getElementById('infoSheet');
  if (!s) return;
  document.getElementById('infoTitle').textContent = title || '';
  document.getElementById('infoBody').textContent = body || '';
  s.hidden = false;
  requestAnimationFrame(() => s.classList.add('open'));
  dbg('sheet_open', { title });
}
function closeSheet() {
  const s = document.getElementById('infoSheet');
  if (!s) return;
  s.classList.remove('open');
  setTimeout(() => { s.hidden = true; }, 250);
}
document.addEventListener('DOMContentLoaded', () => {
  debugEl = document.getElementById('debug'); render();
  const close = document.getElementById('infoClose');
  const back = document.getElementById('sheetBackdrop');
  if (close) close.addEventListener('click', closeSheet);
  if (back) back.addEventListener('click', closeSheet);
});

// ---------- capture the camera frame ----------
function captureFrame() {
  const video = document.querySelector('video');
  if (!video || !video.videoWidth) return null;
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = Math.min(1, CAPTURE_MAX / Math.max(vw, vh));
  const w = Math.round(vw * scale), h = Math.round(vh * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(video, 0, 0, w, h);
  return { b64: c.toDataURL('image/jpeg', 0.7).split(',')[1], w, h };
}

// ---------- TITLE-ONLY card as a canvas-textured plane ----------
function makeCardEntity(label) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const W = 512, pad = 30;
  ctx.font = '700 52px -apple-system, "Segoe UI", Roboto, sans-serif';
  const titleLines = wrap(ctx, label, W - pad * 2).slice(0, 2);
  const subH = 40;
  const H = pad * 2 + titleLines.length * 60 + subH;
  canvas.width = W; canvas.height = H;

  roundRect(ctx, 0, 0, W, H, 26); ctx.fillStyle = 'rgba(12,18,30,0.92)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(124,242,154,0.7)'; ctx.stroke();
  ctx.textBaseline = 'top'; ctx.fillStyle = '#ffffff';
  ctx.font = '700 52px -apple-system, "Segoe UI", Roboto, sans-serif';
  let y = pad; titleLines.forEach((l) => { ctx.fillText(l, pad, y); y += 60; });
  ctx.fillStyle = '#7CFC9A'; ctx.font = '600 26px -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('ⓘ  tap for details', pad, y + 4);

  const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 4;
  const worldW = 0.42, worldH = worldW * (H / W);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  const el = document.createElement('a-entity');
  el.setObject3D('mesh', mesh);
  el.classList.add('card');            // tappable via the camera raycaster
  el.setAttribute('billboard', '');
  return el;
}
function wrap(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/); const lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

if (window.AFRAME) {
  dbg('aframe_present', { v: AFRAME.version, three: window.THREE && THREE.REVISION });

  // Always face the user (using WORLD orientation — 8th Wall keeps the device
  // pose on the world transform) and keep a constant readable on-screen size
  // regardless of how far the card is.
  AFRAME.registerComponent('billboard', {
    init() { this._q = new THREE.Quaternion(); this._cp = new THREE.Vector3(); this._op = new THREE.Vector3(); },
    tick() {
      const cam = this.el.sceneEl && this.el.sceneEl.camera; if (!cam) return;
      cam.getWorldQuaternion(this._q); this.el.object3D.quaternion.copy(this._q);
      cam.getWorldPosition(this._cp); this.el.object3D.getWorldPosition(this._op);
      const d = this._cp.distanceTo(this._op);
      const s = Math.min(3.2, Math.max(0.6, d / 1.5));   // constant apparent size
      this.el.object3D.scale.set(s, s, s);
    },
  });

  AFRAME.registerComponent('cloud-log', {
    init() {
      const s = this.el;
      dbg('scene_init', { xrweb: !!(AFRAME.components && AFRAME.components.xrweb) });
      s.addEventListener('realityready', () => dbg('✓ REALITY_READY — camera + tracking live'));
      s.addEventListener('realityerror', (e) => dbg('✗ REALITY_ERROR', { m: safe((e.detail && (e.detail.message || e.detail.name)) || e.detail) }));
    },
  });

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
      this.busy = true; this.setStatus('Analyzing…'); dbg('analyze_start', { w: frame.w, h: frame.h });

      const cam = this.el.sceneEl.camera;
      const snap = cam.clone();
      snap.position.copy(cam.getWorldPosition(new THREE.Vector3()));
      snap.quaternion.copy(cam.getWorldQuaternion(new THREE.Quaternion()));
      snap.updateMatrixWorld(true);

      try {
        const res = await fetch(BACKEND_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: frame.b64, mimeType: 'image/jpeg' }) });
        const data = await res.json();
        const objects = (data && data.objects) || [];
        dbg('analyze_result', { n: objects.length, model: data && data.model, tokens: data && data.tokens });
        if (!objects.length) { this.setStatus('Nothing recognized — try again'); this.busy = false; return; }
        objects.forEach((o, i) => this.place(o, snap, i));
        this.setStatus(`Found ${objects.length}. Tap a card for details.`);
      } catch (e) { dbg('analyze_error', { e: String(e && e.message || e) }); this.setStatus('Analyze failed — check connection'); }
      this.busy = false;
    },
    place(obj, snap, i) {
      const b = obj.box_2d || [0, 0, 1000, 1000];
      const cx = (b[1] + b[3]) / 2 / 1000, cy = (b[0] + b[2]) / 2 / 1000;
      const ndc = new THREE.Vector2(cx * 2 - 1, -(cy * 2 - 1));
      this.raycaster.setFromCamera(ndc, snap);
      const origin = this.raycaster.ray.origin, dir = this.raycaster.ray.direction;

      // Distance toward the object: use the floor hit if there is one, but CLAMP
      // to a comfortable readable range so cards are never tiny-and-far or huge.
      let dist = 2.0;
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.ground, hit)) dist = origin.distanceTo(hit);
      dist = Math.max(1.1, Math.min(dist, 3.0));

      const point = origin.clone().add(dir.clone().multiplyScalar(dist));
      point.y += 0.15 + (i || 0) * 0.28;   // lift + stagger so multiple cards don't overlap

      const card = makeCardEntity(obj.label);
      card.setAttribute('position', `${point.x.toFixed(3)} ${point.y.toFixed(3)} ${point.z.toFixed(3)}`);
      card.addEventListener('click', () => openSheet(obj.label, obj.description));
      this.el.appendChild(card);
      dbg('placed', { label: obj.label, dist: +dist.toFixed(2) });
    },
  });
} else {
  dbg('NO_AFRAME — A-Frame failed to load');
}
