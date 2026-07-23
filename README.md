# WebAR Floor Demo (iPhone-first test)

A deliberately small, **modular** WebAR test. It opens the phone camera in the
browser and draws a tile, a 3D box, and a text label lying flat on the floor —
staying aligned as you tilt and turn the phone.

The point of this build is to **de-risk the iPhone**: confirm that camera access,
motion-sensor permissions, and 3D overlay rendering all work in **iOS Safari**,
using only free built-in browser APIs (no 8th Wall account needed yet).

## What it proves — and what it deliberately doesn't

| Capability | This demo | Notes |
|---|---|---|
| Open the camera in iOS Safari | ✅ | `getUserMedia`, rear camera |
| Motion permission flow on iPhone | ✅ | iOS 13+ `requestPermission()` inside the tap |
| Draw 3D content over the camera | ✅ | three.js, transparent canvas |
| Keep content flat on the floor as you **tilt/turn** | ✅ | gyroscope (DeviceOrientation) |
| Stay pinned as you **walk around** it (positional) | ❌ | needs SLAM → the 8th Wall provider |

iOS Safari has **no WebXR**, so true positional tracking (walking around a fixed
object) is exactly what the 8th Wall engine adds next. This demo is the layer
under that, and it's structured so 8th Wall drops in without touching the scene.

## Run it on your iPhone

The iPhone camera + motion sensors require **HTTPS with a valid certificate**.
Serve the folder, then expose it through a tunnel that gives a trusted URL:

```bash
# 1. serve locally
node server.mjs                       # http://localhost:8080

# 2. expose over HTTPS (no account needed) — pick one:
npx cloudflared tunnel --url http://localhost:8080
#   -> gives a https://<random>.trycloudflare.com URL

# 3. open that HTTPS URL in Safari on the iPhone, tap "Start AR",
#    Allow camera + Allow motion when prompted.
```

(Or deploy the folder to any static host — Vercel/Netlify/GitHub Pages — since
it's just static files. There is no build step.)

A small status HUD in the top-left shows `camera`, `motion`, and `gyro` state so
you can see on-device exactly what initialised.

## Architecture — where you scale up

```
index.html        entry + start gate + import map (three.js from CDN)
src/
  main.js         thin orchestrator: camera + tracking + scene + content
  camera.js       live camera feed (getUserMedia)
  tracking.js     >>> THE SWAP POINT <<< tracking provider interface + v1 gyro provider
  scene.js        three.js renderer / camera / resize
  content.js      everything you SEE (tile, box, label) — add objects here
  text-label.js   canvas-texture text helper
  styles.css      layout + HUD
```

**To go to full positional AR:** write `EightWallTracking` implementing the same
three methods as `OrientationTracking`
(`requestPermission()`, `start()`, `applyTo(camera)`) and change one import line
in `main.js`. `scene.js`, `content.js`, and `camera.js` stay untouched.

**To add AR content:** edit `content.js` only. Swap the box for a glTF model with
three's `GLTFLoader`, add more labels, etc.
