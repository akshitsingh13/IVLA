// Which NVIDIA models actually work for MY key right now?
//
// Run from the ivla/server folder:
//   node scripts/probe-models.js                      catalog + check config/models.js (free)
//   node scripts/probe-models.js <ids...>             text probe, 1 request per model
//   node scripts/probe-models.js --image <ids...>     image probe, 1-2 requests per model
//   add --nothink to prepend a "/no_think" system message (for reasoning models)
//
// Being in the catalog does NOT mean a model is usable: probe it.
// Reads NVIDIA_API_KEY from server/.env. Never prints the key.

import dotenv from "dotenv";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { MODELS } from "../config/models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const key = process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim();
const BASE =
  process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"; // override = testing only
const MODELS_URL = `${BASE}/models`;
const CHAT_URL = `${BASE}/chat/completions`;
const TIMEOUT_MS = 90000;

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const ids = args.filter((a) => !a.startsWith("--"));
const imageMode = flags.has("--image");
const noThink = flags.has("--nothink");

const out = (s) => process.stdout.write(s);
const redact = (s) =>
  String(s)
    .replace(/nvapi-[A-Za-z0-9_\-]+/g, "[KEY]")
    .replace(/\s+/g, " ")
    .slice(0, 160);

// ---------- tiny PNG (white 128x128 with a red 48x48 square) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function testPng() {
  const W = 128;
  const H = 128;
  const rows = [];
  for (let y = 0; y < H; y++) {
    const row = Buffer.alloc(1 + W * 3, 255);
    row[0] = 0; // filter type: none
    if (y >= 40 && y < 88) {
      for (let x = 40; x < 88; x++) {
        row[1 + x * 3] = 220;
        row[2 + x * 3] = 20;
        row[3 + x * 3] = 20;
      }
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- one chat request, summarised ----------
async function chat(body) {
  const t0 = Date.now();
  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ms = Date.now() - t0;
    const text = await res.text();
    if (!res.ok)
      return {
        ok: false,
        line: `HTTP ${res.status}  ${ms}ms  ${redact(text)}`,
      };
    let msg = {};
    let finish = null;
    try {
      const j = JSON.parse(text);
      msg = j.choices?.[0]?.message ?? {};
      finish = j.choices?.[0]?.finish_reason ?? null;
    } catch {
      /* ignore */
    }
    const content =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((p) => (p && p.text) || "").join("")
          : "";
    const reasoning = msg.reasoning_content ?? msg.reasoning ?? "";
    let line = `HTTP ${res.status}  ${ms}ms  finish=${finish}  reply=${JSON.stringify(content.slice(0, 60))}`;
    if (reasoning)
      line += `  [reasoning text: ${String(reasoning).length} chars]`;
    if (!content.trim())
      line += `  [EMPTY reply; message keys: ${Object.keys(msg).join(",") || "none"}]`;
    return { ok: true, empty: !content.trim(), content, line };
  } catch (e) {
    const why =
      e && e.name === "TimeoutError"
        ? `timed out after ${TIMEOUT_MS / 1000}s`
        : redact(e && e.message);
    return { ok: false, line: `FAILED  ${Date.now() - t0}ms  ${why}` };
  }
}

const sysMsgs = () =>
  noThink ? [{ role: "system", content: "/no_think" }] : [];
const base = { max_tokens: 256, temperature: 0, stream: false };

async function probeText(model) {
  const r = await chat({
    model,
    ...base,
    messages: [
      ...sysMsgs(),
      { role: "user", content: "Reply with the single word OK." },
    ],
  });
  out(`${r.line}\n`);
}

async function probeImage(model) {
  const dataUrl = `data:image/png;base64,${testPng().toString("base64")}`;
  const q =
    "What color is the filled square in this image? Reply with one word.";
  const verdict = (r) =>
    r.ok && /red/i.test(r.content || "") ? "  << READ THE IMAGE CORRECTLY" : "";

  out("    A (image_url) -> ");
  const a = await chat({
    model,
    ...base,
    messages: [
      ...sysMsgs(),
      {
        role: "user",
        content: [
          { type: "text", text: q },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  out(`${a.line}${verdict(a)}\n`);
  if (a.ok && !a.empty) return;

  out("    B (<img> tag) -> ");
  const b = await chat({
    model,
    ...base,
    messages: [
      ...sysMsgs(),
      { role: "user", content: `${q} <img src="${dataUrl}" />` },
    ],
  });
  out(`${b.line}${verdict(b)}\n`);
}

// ---------- main ----------
out(`API key: ${key ? "configured" : "MISSING"}\n`);

if (ids.length === 0) {
  try {
    const res = await fetch(MODELS_URL, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`catalog request returned HTTP ${res.status}`);
    const all = ((await res.json()).data || []).map((m) => m.id).sort();
    out(
      `Catalog: ${all.length} models listed.\n\nModels in config/models.js:\n`,
    );
    const configured = [
      ...new Set(
        [
          MODELS.vision.primary,
          MODELS.vision.fallback,
          MODELS.text.primary,
          MODELS.text.fallback,
        ].filter(Boolean),
      ),
    ];
    for (const id of configured)
      out(`  ${all.includes(id) ? "listed " : "MISSING"}  ${id}\n`);
    out("\n(Listed != usable. Probe a model to be sure.)\n");
  } catch (e) {
    out(`Could not read the catalog: ${redact(e.message)}\n`);
  }
  out(
    "\nExamples:\n  node scripts/probe-models.js <model-id> ...\n  node scripts/probe-models.js --image <model-id> ...\n",
  );
} else if (!key) {
  out("No API key found. Put NVIDIA_API_KEY in server/.env first.\n");
} else {
  out(
    `\n${imageMode ? "Image" : "Text"} probe, ${ids.length} model(s) (a result line appears as each finishes):\n`,
  );
  for (const id of ids) {
    out(`\n  ${id}\n`);
    if (imageMode) {
      await probeImage(id);
    } else {
      out("    ");
      await probeText(id);
    }
  }
  out("\nDone.\n");
}
