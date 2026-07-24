# 📋 Tasks — webar-demo (AR Analyze)
> `[ ]` open · `[>]` later · `[x]` done · _in progress = a live session lock (set automatically, not by hand)_
> Full context in `../README.md` (the source of truth).

## Done (v1 — the "point & identify" core)
- [x] iPhone browser AR proven (camera + sensors + render)
- [x] Real 8th Wall SLAM world-tracking (iOS + Android)
- [x] AR Analyze: tap Analyze → Gemini vision backend → objects identified
- [x] Our own scalable backend (Vercel proxy, key server-side) — `ar-backend-three.vercel.app`
- [x] Info cards anchored in 3D; title-only card + tap → 2D bottom info sheet
- [x] Smart placement: dot on object + leader line + non-overlapping label layout, billboard + constant size
- [x] Clean beta URL for testers: `lookar.vercel.app` (no github/name)
- [x] Full docs: README.md, CLAUDE.md, backend/README.md

## Open (next)
- [ ] Depth-aware placement (float labels into real empty pockets; occlusion) — needs depth/VPS
- [ ] Tune spacing/size constants if cards crowd (`MIN_GAP`, billboard scale, card `worldW` in src/world.js)
- [ ] Custom domain for the beta URL (point a domain at the `lookar` Vercel project)
- [ ] Permanent cloud log backend (replace webhook.site free tier)

## Later
- [>] Persistent anchors across sessions / same real-world spot outdoors (VPS: Lightship / Immersal)
- [>] Semantic attachment to specific things (tree/road/person) beyond SLAM planes — needs extra ML
- [>] "Much more functionality" (per Jai) — this is v1 of the core
- [>] Review 8th Wall engine-binary limited-use license before commercial launch
