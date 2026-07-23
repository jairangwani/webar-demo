# 📋 Tasks — webar-demo
> `[ ]` open · `[>]` later · `[x]` done · _in progress = a live session lock (set automatically, not by hand)_

## Done
- [x] Prove iPhone browser can open camera + sensors (gyro overlay demo)
- [x] ARKit Quick Look real-floor test (USDZ) on iPhone
- [x] Real 8th Wall SLAM world-tracking AR working on iPhone (tap floor → place object → walk around)
- [x] On-device debug console + cloud logging to diagnose remotely
- [x] Fix world-tracking crash (preload SLAM chunk) + cache-busting
- [x] Comprehensive docs (README) + push to private repo

## Open (next upgrades)
- [ ] Replace the placeholder cone with real glTF models in `world.html`
- [ ] Add our own HTML/CSS UI over the AR (buttons that open other pages)
- [ ] Add multiple object types + a simple content picker
- [ ] Stand up a permanent cloud log backend (replace webhook.site free tier)

## Later
- [>] Persistent world anchors across sessions (VPS: Lightship / Immersal) for outdoor / same-spot content
- [>] Semantic attachment (tree / road / specific object) — ML detection layer on top of SLAM
- [>] Consolidate hosting: GitHub Pro private-repo Pages, or a deploy Action (private → public)
- [>] Review 8th Wall engine-binary limited-use license before commercial launch
