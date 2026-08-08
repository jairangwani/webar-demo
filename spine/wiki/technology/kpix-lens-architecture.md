---
name: kpix-lens-architecture
description: Production architecture for the KPIX LENS scan-and-identify AR app (CBS Bay Area lowrider parade) — modules, dedup strategy, cutout pipeline, scale plan
category: technology
status: draft
created: 2026-08-08
---

# KPIX LENS — production architecture

Design references: `design/references/kpix-lens_scan-info-page.jpg`, `design/references/kpix-lens_history-page.jpg`
(Julie Montes / CBS News Bay Area, received via Jorgen Steinheim 2026-08-07.)

---

## 0. The fact that shapes everything

The mockup card reads:

> *1964 Chevrolet Impala Convertible. Owned by Jose Alverez and restored in 2021. Paint from
> Tropical Glitz. 1st Place finisher at the San Jose Lowrider Festival 2023.*

**None of that is in the pixels.** Owner name, restoration year, paint shop, award history — no
vision model can produce these, and any model asked to will *invent* them. A hallucinated owner
name on a car, shown to that owner's face at a CBS-sponsored parade, is the worst possible failure
mode of this product.

So the system is **curated-first, AI-fallback**, not AI-only:

| Path | Trigger | Card quality |
|---|---|---|
| **Registered** | object matches a pre-indexed record | Full mockup fidelity — owner, year, awards, approved cutout |
| **Unregistered** | no match | Generic AI card — "1964 Chevrolet Impala, convertible, ~1964" + AI cutout. No invented provenance. |

The registered path is the product. The AI path is the graceful degradation. Do not let the demo's
AI-does-everything framing hide that.

### The bounded-event advantage

A parade has a **roster**. ~100-200 entrants, all of whom already fill in a registration form to
participate. Piggyback on that form (add: owner name, restoration year, paint shop, awards, 3 photos)
and the open-world recognition problem collapses into **closed-set retrieval over ~150 items** — which
is dramatically more accurate, cheaper, and lets us ship the whole index to the device (see §9).

---

## 1. Module map

```
 CLIENT (phone browser)                    EDGE / API                    ASYNC WORKERS
 ---------------------                     ----------                    -------------
 1 Capture + SLAM track  ──frame──┐
 2 Detect (on-device)             │
   -> rounded corner brackets     │
 3 Tap a bracket ─────────crop────┼──> 4 RESOLVE ──hit──> 6 Content store
 8 Card renderer <────────────────┘        │                  (curated CMS)
 9 Event pack cache                        │
10 History                                 └──miss──> 5 ENRICH queue
                                                        - identify
                                                        - cutout (7)
                                                        - write back
```

1. **Capture & Track** — existing `world.html` + 8th Wall SLAM. Camera feed, world anchors.
2. **Detect** — on-device object detection. Draws the brackets. No network, no cost.
3. **Interaction** — tap a bracket to commit to a resolve.
4. **Resolve** — identity lookup. *The core module.* §3.
5. **Enrich** — async generation on cache miss. §4.
6. **Content store** — curated records + registry CMS. §5.
7. **Cutout pipeline** — transparent PNG production. §6.
8. **Card renderer** — the mockup UI, billboarded in 3D.
9. **Event pack** — offline pre-cache. §9.
10. **History** — per-user scan log (mockup page 2).
11. **Sponsor slot** — bartable, served as data + impression counted.
12. **Moderation, privacy, cost control, observability.** §10.

---

## 2. Detect — why on-device, and why brackets-first is the right instinct

Jai's proposal (brackets appear on Analyze, then tapping a bracket triggers the expensive work) is
architecturally correct and should be kept. Rationale:

- Brackets must appear in **<100ms** or the app feels like a form submission, not a lens.
- A cloud round-trip per frame at parade scale is both too slow and too expensive.
- Detection ("there is a car here") is a *solved, tiny* model problem. Identification ("it is
  Jose's '64") is the expensive one. Splitting them means we pay only for objects a user actually
  cares about — typically 1 in 5 of the ones detected.

Implementation: TF.js COCO-SSD or a YOLO-nano exported to WebGL/WASM, ~5-10MB, runs 10-30fps on a
modern iPhone. Filter to relevant COCO classes (car, truck, motorcycle, person-excluded).

**Cost effect:** detection becomes free and unlimited; billing attaches only to taps.

---

## 3. Resolve — "how do we know it's already in our database?"

This is the crux question and the answer is **not** "ask an LLM if it has seen this before." It is
vector similarity search, backed by cheap deterministic keys.

Every tap runs a **cheap recognition pass**. Only a miss runs the **expensive generation pass**.

### 3a. Signals, in order of strength

| Signal | Strength for this use case | Notes |
|---|---|---|
| **License plate OCR** | ★★★★★ | A plate is a *globally unique natural key*. `8ABX599` is the Impala, forever. For a car app this is the single best matcher and it is nearly free. |
| **Visual embedding + ANN** | ★★★★ | CLIP-class embedding of the crop -> cosine similarity over the index. Handles angle/lighting drift. The general-purpose fallback. |
| **Geofence + time window** | ★★★ | A parade is a fixed route in a fixed 4-hour window. Restricting candidates to "this event" cuts the search space from millions to ~150 and kills almost all false positives. |
| **Color histogram / dominant palette** | ★★ | Cheap pre-filter. A black Impala never matches a purple Chevelle. |

Combine as a scored cascade: plate hit → instant confident match. No plate → embedding ANN within
the event geofence → accept above threshold τ, reject below.

### 3b. Thresholds and the two failure modes

- **False merge** (two different cars treated as one) — *worse.* Shows the wrong owner's name.
  Guard with a high τ, plate disagreement as a hard veto, and colour-histogram distance as a veto.
- **False split** (same car indexed twice) — cheap. Costs one extra generation and produces a
  duplicate row, cleanable by a nightly re-clustering job.

Tune τ **asymmetrically**: prefer a false split. Then run offline dedup to merge splits back.

### 3c. Response shape — never block the user

```
tap -> POST /resolve  { crop, geo, eventId, deviceId }

  HIT  200 { status:'resolved', record:{...}, cutoutUrl, source:'curated'|'ai' }   ~150-300ms
  MISS 202 { status:'pending', jobId, provisional:{ label:'Chevrolet Impala',
                                                    coarse:'1960s convertible' } }
```

On a miss the user immediately gets a **provisional card** from the fast vision pass, which then
upgrades in place when the enrich job completes (WebSocket/SSE push, or poll). The card never shows
a spinner as its primary state.

---

## 4. Enrich — the expensive path, run exactly once per object, ever

Queued worker. Steps:

1. **Identify** — Gemini vision on the crop -> make/model/year/type, confidence.
2. **Cutout** — §6.
3. **Describe** — factual, visual-only copy. Explicitly prompted to state *no* provenance it cannot
   see. ("Do not invent owners, dates, awards, or shop names.")
4. **Embed + index** — write vector, plate, palette, geo to the index.
5. **Write** record + cutout to store/CDN.
6. **Push** upgrade to any client waiting on `jobId`.

Latency 5-20s, which is fine because the user already has a card.

**Every subsequent scan of that car by any user is a cache hit.** At a parade with 150 cars and
50,000 scans, the generation cost is bounded by 150, not 50,000. That is the whole economic argument
for this architecture.

---

## 5. Content store

Two tiers behind one interface:

- **Curated** (`registry`): rows created from the event registration form + a CBS-side admin UI.
  Fields: owner, year, make, model, restoration year, paint shop, awards, approved photo,
  approved cutout, verified flag. **Human-reviewed before the event.**
- **Discovered** (`objects`): AI-generated rows from cache misses. Never claim provenance. Flagged
  `verified:false` and visually distinguishable in the card (no owner line).

A registered car should also carry a **pre-generated, hand-approved cutout**. Do not generate the
hero image of the parade's flagship car live on air.

---

## 6. Cutout pipeline — MEASURED FINDINGS, 2026-08-08

Probes: `design/probe-cutout.mjs`, `design/probe-cutout2.mjs`. Outputs in `design/probe-out/`.

### Finding 1 — no Gemini image model returns a real alpha channel

Tested `gemini-2.5-flash-image`, `gemini-3-pro-image`, `gemini-3-pro-image-preview`,
`gemini-3.1-flash-image`, `gemini-3.1-flash-image-preview`, `gemini-3.1-flash-lite-image`,
prompted explicitly for "fully transparent background, real alpha channel".

- `gemini-2.5-flash-image` returned `image/png`, **PNG colorType=2 (RGB), no tRNS — alpha ABSENT.**
  It *painted a picture of a grey-and-white checkerboard* to represent transparency. It also
  hallucinated the bartable sponsor bar back into the frame.
- Every other model returned **`image/jpeg`**, which cannot carry alpha at all.

**Conclusion: "send it to Nano Banana and get a transparent PNG back" does not work.** Matting must
be a separate, deterministic step.

### Finding 2 — flat-chroma generation IS cleanly keyable

Re-prompted for the subject on a flat `RGB(255,0,255)` field, then sampled 8 border pixels:

| Model | Border samples | Verdict |
|---|---|---|
| `gemini-3-pro-image` | 254,1,250 / 252,2,250 / 253,0,249 … | **Clean.** Within a few units of pure magenta — keys trivially. |
| `gemini-3.1-flash-image` | mostly clean, one outlier `96,2,90` | Subject touching border. Usable with a guard. |
| `gemini-2.5-flash-image` | 231,17,206 / 217,56,188 | **Drifts badly.** Not reliably keyable. |

`gemini-3-pro-image` also produced a correct three-quarter re-orientation with no hallucinated
logos. Result image: `design/probe-out/flatkey_gemini-3-pro-image.jpg`.

### The pipeline that follows from this

```
crop -> [quality gate] -> matte -> despill -> alpha-trim -> WebP/AVIF -> CDN
```

**Two matting routes, chosen by crop quality:**

- **Good crop** (unoccluded, reasonable angle): use a *real* matting model — BiRefNet / RMBG /
  SAM-class — on the **actual photograph**. Deterministic, accurate, no invention. **Prefer this.**
- **Bad crop** (occluded, rear-on, motion-blurred, mid-hop): generative re-orientation on flat
  chroma via `gemini-3-pro-image`, then key.

**Why prefer real matting:** generative re-creation *invents details* — wheel spokes, trim, grille
teeth. For a stranger's car that is charming; for Jose's award-winning Impala shown to Jose, it is
wrong. Generative is the fallback, not the default.

### Chroma key colour must be chosen per object

Magenta is safe for a black Impala. It is **not** safe for the purple '66 Chevelle in the history
mockup — keying magenta would punch holes in the car. Pick the key colour per object as the hue
furthest from the crop's dominant palette (magenta / green / cyan candidates, pick by max distance),
and pass it into the prompt. Then despill.

---

## 7. Card renderer

Straight port of the mockup. Notes:

- Anchor billboarded to the SLAM anchor, ~1.2m in front, scaled by distance so text stays legible.
- Cutout hero image sits **above** the description block, per mockup.
- Registered cards show the owner line; discovered cards omit it entirely (not "unknown").
- Sponsor bar is data-driven per event, with impression events counted server-side.

---

## 8. History

Anonymous `deviceId` (already exists in `src/logger.js`) -> append-only scan log. Thumbnail, title,
truncated description, relative timestamp, deep link. Server-side so it survives a browser cache
clear; merges into an account if/when auth is added. Scott called this "not necessary" — it is the
cheapest of the three screens and the highest retention value. Build it, but last.

---

## 9. The event pack — the single biggest reliability win

**The risk nobody costs in:** 10,000 people on a closed street, one or two cell sites, everyone
using a camera app. Bandwidth at a parade is functionally a brownout.

**Mitigation:** on app open (or on entering the geofence), download an **event pack**:

- all ~150 registered records (JSON, small)
- their cutouts (WebP, ~40-80KB each -> ~10MB total)
- their embeddings + plate strings (~150 x 512 floats -> trivial)

Then run the **entire resolve step on-device** for registered cars: embed the crop locally, cosine
against 150 in-memory vectors, render from local cache. **Zero network per scan, zero cost, works
with no signal.** Only unregistered objects need the network at all.

This turns the demo from "works on wifi" into "works in the crowd", and it is only possible because
the event is bounded (§0).

---

## 10. Cross-cutting

**Privacy.** Crowd frames contain faces and plates. Do not persist raw frames beyond the resolve
call. Plate OCR is used as a matching key — for *registered* vehicles that is consented via the
registration form; for unregistered ones, hash it rather than storing it, or drop it. Faces: never
store, never index. Get this reviewed before launch — it is a CBS-branded product in California.

**Moderation.** Users will point this at people, at signage, at things you would not want on a
CBS-branded screen. Need a refusal path in the vision prompt, a blocklist of classes (person, minors,
weapons), and a report button on every card.

**Cost control.** Per-device rate limit, per-event daily budget cap, and a kill switch that degrades
to registered-only (no generation) if spend spikes. A viral TV mention can produce 50k scans in 20
minutes.

**Observability.** The metric that matters is **cache hit rate**. If it is >95%, unit economics are
essentially zero. If it drops, either matching is broken or the event is unbounded. Alert on it.
Also track: resolve p50/p95, generation queue depth, false-merge reports.

---

## 11. Build order

1. **Registry + curated path.** The CBS registration form -> records -> cards. No AI at all.
   This alone delivers the mockup for every registered car. *Highest value, lowest risk.*
2. **On-device detect + brackets.** Makes it feel like a lens.
3. **Resolve with plate + embedding** over the registry. Closed-set retrieval.
4. **Event pack / offline.** Makes it survive the actual parade.
5. **Enrich path** for unregistered objects. AI fallback.
6. **History page.**
7. **Sponsor slot + impression reporting.**

Note that steps 1-4 ship a fully working product with **no generative AI in the live path at all**.
That is deliberate: it is the version that cannot embarrass anyone on air.

---

## Open questions for Jorgen / CBS

- Do we get the parade registration data, and can the form be extended? (Determines whether §0's
  curated path is even possible.)
- Who owns content accuracy sign-off — CBS or us?
- Is this native or web? (Mockup shows an App Store back-affordance; our stack is web/8th Wall.)
- Is bartable a fixed sponsor or a rotating slot?
- Expected concurrent users, and is there event wifi?
