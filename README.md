# AR Analyze — point your phone, identify anything, pinned in AR

A **browser-based AR app (no native app, works on iPhone *and* Android)**. Point
your phone at a scene, tap **Analyze**, and in ~2 seconds a **vision LLM (Gemini)**
identifies the objects and drops **info cards anchored in 3D space** — a dot sits on
each object, its label floats in nearby empty space with a leader line, and tapping a
card opens a full-detail 2D sheet. Real SLAM world-tracking keeps everything pinned as
you walk around.

> **New here? This README is the single source of truth.** Read it top to bottom and
> you'll know what this is, where everything lives, how it works, and how to deploy.

---

## Live URLs

| What | URL | Notes |
|---|---|---|
| **Beta app (share this)** | **https://lookar.vercel.app** | Clean URL, opens straight into AR Analyze. Public. |
| Dev / source app | https://jairangwani.github.io/webar-demo/world.html?v=7 | GitHub Pages (canonical source). Bump `?v=N` after changes. |
| Backend API | https://ar-backend-three.vercel.app/api/analyze | POST-only Gemini proxy. Visiting in a browser correctly returns `405` — that is not a bug. |

## Repos & local folders

| | Location |
|---|---|
| Public repo (GitHub Pages source) | `github.com/jairangwani/webar-demo` |
| Private dev repo (mirror) | `github.com/jairangwani/webar-system` |
| Client code (local) | `C:\Users\jaira\Desktop\code\webar-demo` |
| Backend code (local) | `C:\Users\jaira\Desktop\code\webar-demo\backend` (also deployed from `C:\Users\jaira\Desktop\code\ar-backend`) |
| Vercel deploy copy of the app | `C:\Users\jaira\Desktop\code\lookar` (web files copied here; its `index.html` = `world.html`) |

---

## Architecture (the whole pipeline)

```
  PHONE (world.html)                         OUR BACKEND (Vercel)           GOOGLE
  ┌───────────────────────────┐   POST      ┌─────────────────────┐        ┌──────────────┐
  │ A-Frame 1.2.0 + THREE r125 │  {image}    │ /api/analyze        │        │ Gemini 3.5   │
  │ 8th Wall engine (SLAM)     │ ──────────▶ │ (api/analyze.js)    │ ─────▶ │ Flash        │
  │ tap Analyze:               │             │ adds GEMINI_API_KEY │        │ (vision)     │
  │  • capture camera frame    │             │ (server-side only)  │ ◀───── │ structured   │
  │  • snapshot camera pose    │ ◀────────── │ returns objects[]   │        │ JSON out     │
  │ place cards in 3D          │  {objects}  └─────────────────────┘        └──────────────┘
  │ tap card → 2D info sheet   │
  └───────────────────────────┘
```

The **API key never touches the phone** — it lives only as a Vercel env var on the
backend, so the app scales to many users without exposing the key.

---

## Credentials & model

- **Gemini API key** (Jai's shared key): `C:\Users\jaira\Desktop\jai\systems\messenger\data\.gemini-key`
  (also in `provider-keys.json`). It is set as the Vercel env var **`GEMINI_API_KEY`** on the
  `ar-backend` project. **Never put it in client code.**
- **Model:** **`gemini-3.5-flash`** via the standard `v1beta` `generateContent` endpoint.
  ~1,200 tokens per analysis = a fraction of a cent. ⚠️ `gemini-3-pro-preview` is **not**
  available on `generateContent` (Google moved it to the Interactions API) — stick to
  `gemini-3.5-flash` / `gemini-2.5-flash` on the classic endpoint. Change the model via
  `GEMINI_MODEL` env var or the default in `backend/api/analyze.js`.

---

## File map

```
webar-demo/                 (client — GitHub Pages source)
  world.html               THE AR ANALYZE APP (also copied to lookar/index.html)
  index.html               landing page (links to world.html + the ARKit/gyro tests) — Pages only
  src/
    world.js               ★ everything for Analyze: frame capture, backend call, 3D card
                             placement (dot + leader line + non-overlap layout), billboard,
                             2D info sheet, on-device + cloud logging
    camera.js scene.js content.js tracking.js text-label.js logger.js config.js styles.css
                             ← legacy gyro-overlay demo (index.html "experimental" button). Kept, not used by Analyze.
  models/toy_car.usdz      model for the iOS ARKit Quick Look test (index.html)
  server.mjs               zero-dep local static server (node server.mjs)
  backend/                 copy of the Gemini proxy (version-controlled here; deployed from ../ar-backend)
    api/analyze.js         the serverless function
    package.json  README.md
  spine/tasks.md           roadmap / task list
  CLAUDE.md                orientation pointer for a new agent (points here)
```

---

## How AR Analyze works (step by step — all in `src/world.js`)

1. **8th Wall SLAM** starts on load (the `xrweb` A-Frame component). Camera + world tracking go live (`REALITY_READY`).
2. **Tap Analyze** → `captureFrame()` grabs the live `<video>` camera frame, downscales the long edge to 640px, JPEG base64.
3. **Snapshot the camera pose** (position + quaternion) so placement is correct even if the user moves during the ~2s call.
4. **POST** `{image}` to the backend → Gemini → returns `objects: [{ label, description, box_2d:[ymin,xmin,ymax,xmax] 0-1000 }]`.
5. **`placeAll()`** lays everything out:
   - `anchorPoint()` raycasts each object's box-centre to the floor plane (y=0), clamped to 0.7–4 m → a **green dot on the object**.
   - Labels are sorted and assigned screen-space slots with a **minimum gap** (no overlap), **pushed up into empty space** above the objects, each connected to its dot by a **leader line**.
   - The `billboard` component makes cards **face the camera** (using the camera's *world* quaternion) and **auto-scales them to a constant readable size** regardless of distance.
6. **Tap a card** → `openSheet()` slides up a **2D bottom sheet** with the full description.

Cards/dots are anchored at fixed **world** points, so they stay pinned as you walk (SLAM).

---

## ⚠️ Gotchas (hard-won — read before editing)

1. **three.js must be r125 as a global** — the 8th Wall engine expects `window.THREE` r125. We use **A-Frame 1.2.0** (ships r125). Do NOT load modern ESM three here.
2. **Preload the SLAM chunk** — `data-preload-chunks="slam"` on the `xr.js` `<script>` is required, or `xrweb` crashes on init ("Failure loading node").
3. **`crossorigin="anonymous"`** on `xr.js` — otherwise cross-origin errors show as a useless "Script error. @:0".
4. **SLAM is mobile-only** — on desktop the engine reports `isDeviceBrowserSupported:false` (expected, not a bug). Test on a real phone.
5. **iOS Safari caches hard** — after any change, **bump `?v=N`** on the `world.js` script tag in `world.html` (and `index.html`) or the phone serves a stale file.
6. **Vercel protection** — deployment-*hash* URLs are auth-walled; only the **stable project alias** is public. The old **`webar-demo`** Vercel project has strict protection (its alias is walled too) — **deploy the app to the `lookar` project**, and the backend stays on the public `ar-backend` project.
7. **Gemini model** — `gemini-3-pro-preview` 404s on `generateContent`; use `gemini-3.5-flash`.

---

## Deploy

**Commit identity:** a git hook requires the author be `jairangwani@gmail.com`. Always:
`unset GIT_AUTHOR_EMAIL GIT_COMMITTER_EMAIL` then commit with `-c user.email="jairangwani@gmail.com"`.

**Client → GitHub Pages (dev/source):**
```
# in webar-demo/, after bumping ?v=N in world.html & index.html
git add -A && git commit -m "..." && git push origin main && git push private main   # Pages rebuilds ~30s
```

**Client → beta (lookar.vercel.app):**
```
cp webar-demo/{world.html,index.html} webar-demo/src/... into lookar/   # sync web files (index.html = world.html)
cd lookar && vercel deploy --prod --yes                                 # auto-aliases lookar.vercel.app
```
(Keep `lookar` in sync with the Pages version whenever you ship a change.)

**Backend → Vercel (`ar-backend-three.vercel.app`):**
```
cd ar-backend && vercel deploy --prod --yes
# key is already set; to change: printf "%s" "<key>" | vercel env add GEMINI_API_KEY production && vercel deploy --prod --yes
```

---

## Logging & debugging (how to diagnose a phone test remotely)

- **On device:** tap the **Log** button (top-right in `world.html`) — a green console shows every event live.
- **Remotely:** the app also posts each session to a webhook.site sink. Read the latest:
  ```
  curl "https://webhook.site/token/b264cdd4-dfc3-45e2-a9ec-ae5fe1fcc71d/requests?sorting=newest&per_page=30"
  ```
  Watch for `✓ REALITY_READY` (tracking live), `analyze_result` (Gemini returned N objects), `placed` (cards placed).
  (Free tier ≈ 7-day retention — swap for a permanent backend for production.)

---

## Roadmap (next features)

- [ ] Smarter placement: depth-aware "float in the nearest *real* empty pocket" + occlusion handling (current is a leader-line screen-space layout; true depth needs a depth sensor / VPS).
- [ ] Tune spacing/size constants if cards still crowd (`MIN_GAP`, billboard scale, card `worldW` in `src/world.js`).
- [ ] Persistent anchors across sessions / same real-world spot outdoors → VPS (Niantic Lightship / Immersal).
- [ ] Custom domain for the beta URL (point a domain at the `lookar` Vercel project).
- [ ] Permanent cloud log backend (replace the webhook.site free tier).
- [ ] Review the 8th Wall `engine-binary` limited-use license before any commercial launch.
- [ ] Much more product functionality (per Jai) — this is v1 of the "point & identify" core.

## What each piece is (ours vs third-party)

- **Our app + backend** — 100% ours (this repo). MIT-nothing, just our code.
- **A-Frame + three.js** — MIT open source.
- **8th Wall engine-binary** — free, but a *limited-use* license (not OSS); loaded from CDN, keyless.
- **Gemini** — Google's API; metered by token via our key.
