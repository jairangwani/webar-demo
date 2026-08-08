// Probe: can Nano Banana (Gemini image) return a TRUE alpha-transparent cutout?
// Decides whether the cutout module can be one generative call, or needs a
// dedicated segmentation/matting step. ASCII-only output (Windows console).
import fs from 'node:fs';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first'); // Node fetch stalls on IPv6 to googleapis here

const key =fs.readFileSync('C:/Users/jaira/Desktop/jai/systems/messenger/data/.gemini-key', 'utf8').trim();
const SRC = 'C:/Users/jaira/Desktop/code/webar-demo/design/references/kpix-lens_scan-info-page.jpg';
const OUT_DIR = 'C:/Users/jaira/Desktop/code/webar-demo/design/probe-out';
fs.mkdirSync(OUT_DIR, { recursive: true });

// 1. Which image-capable models does this key actually see?
const list = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`);
const lj = await list.json();
const imageModels = (lj.models || [])
  .filter(m => /image/i.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent'))
  .map(m => m.name.replace('models/', ''));
console.log('IMAGE MODELS VISIBLE:', imageModels.join(', ') || '(none)');

const b64 = fs.readFileSync(SRC).toString('base64');
const PROMPT =
  'Extract ONLY the black lowrider car from this photo. Return it as a clean product-style ' +
  'cutout on a FULLY TRANSPARENT background (real alpha channel, no white, no checkerboard). ' +
  'Re-orient it to a three-quarter front view, wheels level, as if photographed in a studio.';

function alphaReport(buf) {
  const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isPng) return `not-a-PNG (starts ${buf.slice(0, 4).toString('hex')}) -> no alpha possible`;
  const colorType = buf[25]; // IHDR: 8 sig + 4 len + 4 type + 4 w + 4 h + 1 depth = byte 25
  const names = { 0: 'gray', 2: 'RGB', 3: 'palette', 4: 'gray+ALPHA', 6: 'RGBA' };
  const hasTRNS = buf.includes(Buffer.from('tRNS'));
  return `PNG colorType=${colorType} (${names[colorType] || '?'}) tRNS=${hasTRNS} -> alpha channel ${colorType === 6 || colorType === 4 || hasTRNS ? 'PRESENT' : 'ABSENT'}`;
}

for (const model of imageModels) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text: PROMPT }] }],
      }),
    });
    if (!r.ok) { console.log(`${model}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`); continue; }
    const j = await r.json();
    const parts = j?.candidates?.[0]?.content?.parts || [];
    const img = parts.find(p => p.inlineData || p.inline_data);
    if (!img) { console.log(`${model}: no image returned (text: ${(parts[0]?.text || '').slice(0, 120)})`); continue; }
    const d = img.inlineData || img.inline_data;
    const buf = Buffer.from(d.data, 'base64');
    const f = `${OUT_DIR}/cutout_${model}.${(d.mimeType || d.mime_type || '').includes('png') ? 'png' : 'bin'}`;
    fs.writeFileSync(f, buf);
    console.log(`${model}: mime=${d.mimeType || d.mime_type} bytes=${buf.length}`);
    console.log(`   ${alphaReport(buf)}`);
    console.log(`   saved ${f}`);
  } catch (e) {
    console.log(`${model}: ERR ${e.message}`);
  }
}
