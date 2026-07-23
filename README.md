# WebAR System — browser AR on iPhone (no native app)

A working web-app that does **augmented reality in the browser** — including real
**world-tracking on iPhone Safari** (which has no WebXR). Built to prove the
capability, then grow into a custom AR product.

**Status: working and live.** All three modes below run on a real iPhone.

| Mode | What it is | Ours or theirs? | Real floor tracking |
|---|---|---|---|
| **World-tracking AR** (`world.html`) | Our custom 3D scene on the real **8th Wall SLAM** engine — tap the floor, place objects, walk around them | **100% ours** (engine is a plug-in) | ✅ real SLAM |
| **ARKit Quick Look** (`index.html` → AR button) | Apple's built-in AR viewer showing a USDZ model on the floor | **Apple's** viewer, our model | ✅ real ARKit |
| **Gyro overlay** (`index.html` → overlay) | Camera + 3D via gyroscope only — *no* floor sensing (a rough guess) | **Ours** | ❌ (no surface sensing) |

## Live URLs
- App: **https://jairangwani.github.io/webar-demo/**
- World-tracking AR (the real one): **https://jairangwani.github.io/webar-demo/world.html**

## Is this open source? What do we own?
- **All the code *we* wrote is ours and in this repo** — every demo, the scene,
  tap-to-place, logging, UI. Yours to change freely.
- **three.js** and **A-Frame** (the 3D frameworks): open-source, MIT licensed.
- **The 8th Wall SLAM engine** (`@8thwall/engine-binary`, loaded from CDN): **free
  to use, but NOT open source** — it's a compiled binary under a *limited-use
  license*. We don't have (or need) its source; we call it. **Review its license
  before a commercial launch** (github.com/8thwall/engine). Its helper libs
  (`@8thwall/xrextras`) are MIT.
- **ARKit Quick Look**: Apple's system viewer — we only supply the USDZ model.

So: we own our app end-to-end; the hard "AR brain" (SLAM) is a free third-party
engine we plug in. Nothing here requires a paid account today.

## How the real world-tracking works (`world.html` + `src/world.js`)
The 8th Wall engine runs **SLAM** on the camera video: it tracks feature points
frame-to-frame to know how the phone moves in space, establishes the ground plane
at `y=0`, and holds 6-DoF tracking. We drop content onto that plane and it stays
anchored in the real world as you walk around it. Built on **A-Frame** (`xrweb`
component = world tracking); tap-to-place raycasts the tap against an invisible
ground plane and spawns an object at the hit point.

### Integration gotchas we hit (read before touching `world.html`)
These cost real debugging — documented so future-you doesn't repeat them:
1. **three.js must be r125, as a global.** The engine expects `window.THREE` at
   r125. We use **A-Frame 1.2.0**, which ships exactly r125. Do *not* load a
   modern ESM three.js here.
2. **You MUST preload the SLAM chunk.** The OSS engine lazy-loads SLAM as a
   separate chunk; without it, `xrweb` crashes on init ("Failure loading node").
   Fixed with `data-preload-chunks="slam"` on the engine `<script>` tag.
3. **`crossorigin="anonymous"`** on the engine script — otherwise cross-origin
   errors show as a useless "Script error. @:0".
4. **SLAM is mobile-only.** On desktop the engine correctly reports
   `isDeviceBrowserSupported:false` — that's expected, not a bug. Test on a phone.
5. **iOS Safari caches aggressively.** After deploying, bump the `?v=N` query on
   `world.js` (and open `world.html?v=N`) or Safari serves the stale page.

## Logging & on-device debug (so failures are never invisible)
- `world.html` has a **green on-screen debug console** (top of screen, above the
  loading spinner) showing every lifecycle event + error live on the phone.
- It also **silently posts to a cloud sink** (webhook.site) so a test can be
  diagnosed remotely. Read a session:
  ```
  curl -s "https://webhook.site/token/<TOKEN>/requests?sorting=newest&per_page=60"
  ```
  (current token is in `src/world.js` → `LOG_ENDPOINT`). Watch for
  `✓ REALITY_READY` = tracking live; `✗ REALITY_ERROR` = the reason it failed.
- The main demo (`index.html`) uses `src/logger.js` (anonymous userId + sessionId,
  device/permission/error capture) posting to the same style of sink.
- **Note:** webhook.site free tier is rate-limited / ~7-day retention — fine for
  testing, swap for a permanent backend for production.

## File map
```
index.html        landing (2 buttons) + gyro-overlay demo
world.html        REAL 8th Wall SLAM world-tracking AR   ← the product path
src/
  world.js        A-Frame components: world tracking + tap-to-place + debug/cloud log
  main.js         gyro-overlay orchestrator
  camera.js scene.js content.js tracking.js text-label.js  gyro-overlay modules
  logger.js       session tracking + cloud logging (gyro demo)
  config.js styles.css
models/toy_car.usdz   model for Apple AR Quick Look
server.mjs        zero-dep static server for local testing
```

## Deploy
Hosted on **GitHub Pages** (free — requires the repo be public; see note below).
```
git add -A
git -c user.email="jairangwani@gmail.com" commit -m "..."   # commit hook requires this identity
git push origin main        # Pages rebuilds in ~30s
```
After any `world.*` change, bump `?v=N` (cache-bust) and re-test on the phone.

## Upgrade roadmap
- [ ] Custom content in `world.html`: swap the cone for glTF models, add text/UI, multiple object types.
- [ ] Our own HTML/CSS UI over the AR (buttons that open other pages — fully possible on this path).
- [ ] Permanent cloud log backend (replace webhook.site).
- [ ] Persistent anchors across sessions (VPS: Niantic Lightship / Immersal) for outdoor / same-spot content.
- [ ] Semantic attachment (tree / road / specific object) — needs an ML detection layer on top of SLAM.
- [ ] Review 8th Wall limited-use license terms before commercial launch.

## Note on private repo + live URL
GitHub Pages on a free plan needs a **public** repo. This code lives in a private
repo for development; to keep the live test URL working, the public
`jairangwani/webar-demo` repo mirrors it as the deploy target. Options to
consolidate: GitHub Pro (private-repo Pages) or a deploy Action. See `spine/tasks.md`.
