// POST /api/analyze  — our own scalable proxy to Gemini vision.
// The Gemini API key lives ONLY here (Vercel env var), never in the phone app.
// Body: { image: "<base64 jpeg, no data: prefix>", mimeType?: "image/jpeg" }
// Returns: { objects: [ { label, description, box_2d:[ymin,xmin,ymax,xmax] 0-1000 } ] }

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const SCHEMA = {
  type: 'object',
  properties: {
    objects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          description: { type: 'string' },
          box_2d: { type: 'array', items: { type: 'integer' } },
        },
        required: ['label', 'description', 'box_2d'],
      },
    },
  },
  required: ['objects'],
};

const PROMPT =
  'You are the vision engine for an augmented-reality app. Identify the main real-world ' +
  'objects a user is pointing their phone at (ignore tiny background clutter; at most 5 objects). ' +
  'For EACH object return: "label" (2-4 words), "description" (rich, factual, useful — for vehicles ' +
  'include make, model, approximate year and horsepower if identifiable; for electronics include brand/' +
  'model and key specs; otherwise the most interesting true facts, ~1-2 sentences), and "box_2d" as ' +
  '[ymin,xmin,ymax,xmax] normalized 0-1000. Return ONLY JSON matching the schema.';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'server missing GEMINI_API_KEY' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const image = body && body.image;
    const mimeType = (body && body.mimeType) || 'image/jpeg';
    if (!image) return res.status(400).json({ error: 'missing image' });

    const gReq = {
      contents: [{ parts: [
        { inline_data: { mime_type: mimeType, data: image } },
        { text: PROMPT },
      ] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const gRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gReq),
    });
    if (!gRes.ok) {
      const t = await gRes.text();
      return res.status(502).json({ error: 'gemini_error', status: gRes.status, detail: t.slice(0, 400) });
    }
    const data = await gRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{"objects":[]}';
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { objects: [] }; }
    const usage = data.usageMetadata || {};
    return res.status(200).json({
      objects: parsed.objects || [],
      model: MODEL,
      tokens: { in: usage.promptTokenCount, out: usage.candidatesTokenCount },
    });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', detail: String(e && e.message || e) });
  }
}
