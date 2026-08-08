// Probe 2: if the model can't emit alpha, can it emit a CLEANLY KEYABLE flat background?
// Asks for the subject on a uniform chroma field, then we test key-ability by pixel sampling.
import fs from 'node:fs';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const key = fs.readFileSync('C:/Users/jaira/Desktop/jai/systems/messenger/data/.gemini-key', 'utf8').trim();
const SRC = 'C:/Users/jaira/Desktop/code/webar-demo/design/references/kpix-lens_scan-info-page.jpg';
const OUT = 'C:/Users/jaira/Desktop/code/webar-demo/design/probe-out';
const b64 = fs.readFileSync(SRC).toString('base64');

const PROMPT =
  'Isolate ONLY the black lowrider car. Output the car centered, three-quarter front view, ' +
  'wheels level, studio product lighting, filling ~85% of the frame. The ENTIRE background must be ' +
  'ONE FLAT UNIFORM SOLID COLOR: pure magenta RGB(255,0,255). No gradient, no shadow, no floor, ' +
  'no checkerboard, no text, no logos, no watermark. Nothing but the car and the flat magenta field.';

const MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image', 'gemini-3-pro-image'];

for (const model of MODELS) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text: PROMPT }] }],
      }),
    });
    if (!r.ok) { console.log(`${model}: HTTP ${r.status}`); continue; }
    const j = await r.json();
    const p = (j?.candidates?.[0]?.content?.parts || []).find(x => x.inlineData || x.inline_data);
    if (!p) { console.log(`${model}: no image`); continue; }
    const d = p.inlineData || p.inline_data;
    const mime = d.mimeType || d.mime_type;
    const ext = mime.includes('png') ? 'png' : 'jpg';
    const f = `${OUT}/flatkey_${model}.${ext}`;
    fs.writeFileSync(f, Buffer.from(d.data, 'base64'));
    console.log(`${model}: mime=${mime} saved ${f}`);
  } catch (e) { console.log(`${model}: ERR ${e.message}`); }
}
