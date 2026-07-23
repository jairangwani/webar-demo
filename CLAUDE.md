# webar-demo

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
