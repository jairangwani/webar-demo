# webar-demo — "AR Analyze" WebAR app

## 👋 START HERE (new agent orientation)
**This is a browser AR app: point your phone → tap Analyze → Gemini vision identifies
objects → info cards get pinned in 3D AR space. Works on iOS + Android, no native app.**

**Read `README.md` in this folder first — it is the full source of truth** (what it is,
architecture, file map, how it works, all gotchas, deploy steps, URLs, keys, roadmap).

Fast facts:
- **Beta URL (share):** https://lookar.vercel.app · **Dev:** https://jairangwani.github.io/webar-demo/world.html?v=7
- **The app:** `world.html` + `src/world.js` (that one JS file holds the whole Analyze feature).
- **Backend:** `backend/api/analyze.js` → deployed at `https://ar-backend-three.vercel.app/api/analyze` (Gemini proxy; key server-side only).
- **Model:** `gemini-3.5-flash`. **Key:** `C:\Users\jaira\Desktop\jai\systems\messenger\data\.gemini-key` (as Vercel env `GEMINI_API_KEY`).
- **Top gotchas:** A-Frame 1.2.0 (three r125) · `data-preload-chunks="slam"` required · bump `?v=N` after edits (iOS cache) · deploy the app to the **`lookar`** Vercel project (the old `webar-demo` project is auth-walled). Full list in README.
- Two deploy targets: GitHub Pages (source, `git push origin/private`) + `lookar.vercel.app` (beta, `cd lookar && vercel deploy --prod --yes`).

## 🦴 This project runs on The Spine <!-- spine-protocol:v1 -->
**webar-demo**'s truth lives in **`./spine/`** — tasks in `spine/tasks.md`, docs/blueprints in `spine/wiki/<category>/`.

These invariants are stable (safe to rely on here): **one project = one spine** · `spine/tasks.md` is the ONE
roadmap (add a line when work appears, flip `[ ]`→`[x]` when done, never fork a second list) · docs live under
`spine/wiki/`, never a stray `docs/` home or repo-root dump · a doc describing code carries `documents:` +
`lastVerifiedCommit:` front-matter.

**Branches:** the `spine/` folder is per-branch — checked out on branch X you see branch X's spine natively.
The Spine tracks ONE branch by default; long-running parallel branches are declared (an owned repo →
`manifest.trackedBranches`; a SHARED repo → the Spine's central `engine/tracked-branches.json`, since we must
not commit config to a shared branch). See `workspace/_system/projects/spine/spine/wiki/reference/BRANCH-TRACKING.md`.

**The full, always-current protocol is NOT copied here** (so it can't go stale) — read the one source:
**The Spine → `workspace/_system/projects/spine/spine/wiki/reference/PROTOCOL.md`**. View this project's spine in the 🦴 Spine viewer (the chat app), or render
`./spine/` from any frontend — the data shape is the contract.
