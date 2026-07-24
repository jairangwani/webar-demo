# Backend — Gemini vision proxy

Our own scalable serverless proxy so the Gemini API key stays **server-side** (never in
the phone app). The client (`../src/world.js`) POSTs a camera frame here; we call Gemini
and return structured objects.

- **Live:** `https://ar-backend-three.vercel.app/api/analyze` (POST only; a browser GET returns `405` — expected).
- **Deployed from:** `C:\Users\jaira\Desktop\code\ar-backend` (this folder is the version-controlled copy — keep them identical).
- **Vercel project:** `ar-backend` (its stable alias `ar-backend-three.vercel.app` is public; deployment-hash URLs are auth-walled).

## API
`POST /api/analyze`  ·  body `{ "image": "<base64 jpeg, no data: prefix>", "mimeType": "image/jpeg" }`
→ `{ objects: [ { label, description, box_2d:[ymin,xmin,ymax,xmax] 0-1000 } ], model, tokens }`
CORS is `*`.

## Config
- Env `GEMINI_API_KEY` (set on Vercel) — the key from `messenger/data/.gemini-key`.
- Env `GEMINI_MODEL` (optional) — defaults to `gemini-3.5-flash`. Do NOT use `gemini-3-pro-preview` (not on the `generateContent` endpoint).

## Deploy / update
```
cd C:\Users\jaira\Desktop\code\ar-backend   # the deploy folder
# keep it in sync with this backend/ copy first
vercel deploy --prod --yes
# to (re)set the key:  printf "%s" "<key>" | vercel env add GEMINI_API_KEY production
```
