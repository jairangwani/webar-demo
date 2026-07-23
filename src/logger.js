// logger.js — session tracking + cloud logging.
//
// Goals:
//  - Give every visitor a persistent anonymous userId + a per-visit sessionId
//    (this is the lightweight "who is doing what" tracking — no passwords).
//  - Capture device info, permission results, errors, and key events.
//  - Keep a local copy (survives reload) viewable in-app (Copy / Download).
//  - Push a self-contained snapshot to the cloud so a test can be diagnosed
//    remotely, without the user having to hand-report anything.

import { CONFIG } from './config.js';

const LS_UID = 'webar_uid';
const LS_LOG = 'webar_log_';   // + sessionId

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    ('x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
}

function parseDevice() {
  const ua = navigator.userAgent;
  const iOS = /iP(hone|ad|od)/.test(ua);
  const iosVer = (ua.match(/OS (\d+)[_.](\d+)/) || []).slice(1).join('.') || null;
  return {
    ua,
    platform: navigator.platform,
    iOS,
    iosVersion: iosVer,
    isSafari: /^((?!chrome|android|crios|fxios).)*safari/i.test(ua),
    screen: `${window.screen.width}x${window.screen.height}`,
    dpr: window.devicePixelRatio,
    lang: navigator.language,
    online: navigator.onLine,
  };
}

class Logger {
  constructor() {
    this.userId = localStorage.getItem(LS_UID) || uid();
    localStorage.setItem(LS_UID, this.userId);
    this.sessionId = uid();
    this.startedAt = new Date().toISOString();
    this.device = parseDevice();
    this.events = [];
    this.cloud = CONFIG.LOG_ENDPOINT ? 'pending' : 'disabled';
    this._dirty = false;

    this._hookErrors();
    this.event('session_start', { url: location.href });

    // Periodic flush (only when there's something new) + flush on leave.
    this._timer = setInterval(() => { if (this._dirty) this.flush(); }, 15000);
    const leave = () => this.flush(true);
    window.addEventListener('pagehide', leave);
    window.addEventListener('visibilitychange', () => { if (document.hidden) leave(); });
  }

  _hookErrors() {
    window.addEventListener('error', (e) => {
      this.log('error', 'window.onerror', { message: e.message, source: e.filename, line: e.lineno, col: e.colno });
      this.flush();
    });
    window.addEventListener('unhandledrejection', (e) => {
      this.log('error', 'unhandledrejection', { reason: String(e.reason && (e.reason.message || e.reason)) });
      this.flush();
    });
  }

  log(level, msg, data) {
    const entry = { t: new Date().toISOString(), level, msg, ...(data ? { data } : {}) };
    this.events.push(entry);
    this._dirty = true;
    // Mirror to console with a tag so it also shows in Safari's dev inspector.
    const tag = `[webar:${level}]`;
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(tag, msg, data || '');
    this._persistLocal();
    return entry;
  }

  info(msg, data) { return this.log('info', msg, data); }
  warn(msg, data) { return this.log('warn', msg, data); }
  error(msg, data) { return this.log('error', msg, data); }
  event(name, data) { return this.log('event', name, data); }

  _persistLocal() {
    try {
      localStorage.setItem(LS_LOG + this.sessionId, JSON.stringify(this.snapshot()));
    } catch { /* quota — ignore */ }
  }

  snapshot() {
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      sentAt: new Date().toISOString(),
      device: this.device,
      cloud: this.cloud,
      eventCount: this.events.length,
      events: this.events,
    };
  }

  // Send a self-contained snapshot. Each POST holds the FULL session so
  // reading the newest request for a sessionId gives the complete picture.
  flush(useBeacon = false) {
    if (!CONFIG.LOG_ENDPOINT) return;
    const body = JSON.stringify(this.snapshot());
    this._dirty = false;
    try {
      if (useBeacon && navigator.sendBeacon) {
        // Beacon survives page unload and needs no CORS response.
        navigator.sendBeacon(CONFIG.LOG_ENDPOINT, new Blob([body], { type: 'application/json' }));
        this.cloud = 'sent';
        return;
      }
      // no-cors: the POST still delivers even without CORS headers on the sink;
      // we just can't read the response status.
      fetch(CONFIG.LOG_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body,
      }).then(() => { this.cloud = 'sent'; })
        .catch(() => { this.cloud = 'failed'; });
    } catch {
      this.cloud = 'failed';
    }
  }

  // Human-readable dump for the in-app viewer / clipboard.
  getText() {
    const s = this.snapshot();
    const head =
      `WebAR log\nuser=${s.userId}\nsession=${s.sessionId}\n` +
      `device=${s.device.iOS ? 'iOS ' + (s.device.iosVersion || '?') : s.device.platform} ` +
      `${s.device.isSafari ? 'Safari' : ''} ${s.device.screen} dpr${s.device.dpr}\n` +
      `cloud=${s.cloud}\nstarted=${s.startedAt}\n----\n`;
    const lines = s.events.map((e) =>
      `${e.t.slice(11, 19)} ${e.level.toUpperCase().padEnd(5)} ${e.msg}` +
      (e.data ? '  ' + JSON.stringify(e.data) : '')
    );
    return head + lines.join('\n');
  }
}

export const logger = new Logger();
