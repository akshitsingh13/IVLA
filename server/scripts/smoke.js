// IVLA smoke test. WARNING: spends ~4 of the limited NVIDIA trial requests
// (1 vision + 1 text + 1 text-prompt + 1 image). Run sparingly, only with a
// real key in server/.env. Prints PASS/FAIL plus the response SHAPE only —
// never content, never the key.
// Run: node server/scripts/smoke.js  (from the project root)
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BASE = process.env.SMOKE_BASE || 'http://localhost:3001';

// --- minimal PNG encoder (white W×H, RGBA) so the test needs no libraries ---
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function whitePngDataUrl(w = 64, h = 64) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h, 255); // white; filter byte 0 == None... set per row
  for (let y = 0; y < h; y++) raw[y * stride] = 0;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

// --- shape printer: key names + types + string lengths. NEVER content. ---
function shapeOf(v) {
  if (typeof v === 'string') {
    if (v.startsWith('data:image/')) return `data-url(len=${v.length})`;
    return `string(len=${v.length})`;
  }
  if (typeof v !== 'object' || v === null) return typeof v;
  if (Array.isArray(v)) return `array(len=${v.length})`;
  return `{${Object.entries(v)
    .map(([k, x]) => `${k}:${shapeOf(x)}`)
    .join(', ')}}`;
}

async function post(route, body) {
  const res = await fetch(`${BASE}/api/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const key = (process.env.NVIDIA_API_KEY || '').trim();
if (!key) {
  console.log('SKIP: NVIDIA_API_KEY is empty in server/.env — no live calls made, nothing spent.');
  console.log('Set the key and restart the server to run the smoke test.');
  process.exit(0);
}

console.log('Smoked against', BASE, '(spends ~4 NVIDIA trial requests)');
let fail = 0;

// 1) vision: interpret a tiny generated white PNG (expect unclear/low-confidence shape, not content)
{
  const img = whitePngDataUrl();
  const { status, json } = await post('interpret', { imageDataUrl: img, gradeLevel: 'auto' });
  const ok =
    status === 200 &&
    json.interpretation &&
    typeof json.lowConfidence === 'boolean' &&
    typeof json.interpretation.confidence === 'number';
  console.log(`${ok ? 'PASS' : 'FAIL'} interpret blank png (status ${status}) shape:`, shapeOf(json));
  if (!ok) fail += 1;
}

// 2) text: explain a typed concept
{
  const { status, json } = await post('text-from-text', {
    text: 'photosynthesis',
    gradeLevel: 'middle',
  });
  const ok =
    status === 200 &&
    typeof json.explanation === 'string' &&
    json.explanation.length > 0 &&
    json.lowConfidence === false;
  console.log(`${ok ? 'PASS' : 'FAIL'} text-from-text (status ${status}) shape:`, shapeOf(json));
  if (!ok) fail += 1;
}

// 3) image: illustrate a typed concept
{
  const { status, json } = await post('image-from-text', {
    text: 'water cycle',
    gradeLevel: 'primary',
  });
  const ok =
    status === 200 &&
    typeof json.imageDataUrl === 'string' &&
    json.imageDataUrl.startsWith('data:image/') &&
    ['nvidia', 'pollinations'].includes(json.provider);
  console.log(`${ok ? 'PASS' : 'FAIL'} image-from-text (status ${status}) shape:`, shapeOf(json));
  if (!ok) fail += 1;
}

console.log(fail ? `\nSMOKE: ${fail} FAILED` : '\nSMOKE: all passed');
process.exit(fail ? 1 : 0);
