// NVIDIA FLUX image generation. Exact response shape is uncertain, so the
// first call logs the SHAPE (key names + types only, never content or key)
// and extractImage() handles the likely shapes.

import { NVIDIA_IMAGE_URL, MODELS } from '../config/models.js';
import { AiError, AI_CODES, httpError, timeoutError, networkError, redact } from './AiError.js';
import { withRetry } from './withRetry.js';
import { countNvidiaCall } from '../lib/usage.js';
import { budgetExceeded } from '../lib/budget.js';

let shapeLogged = false;

function shapeOf(value, depth = 0) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0 || depth > 1) return `array(len=${value.length})`;
    return `array(len=${value.length})[${shapeOf(value[0], depth + 1)}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => {
      if (typeof v === 'string') return `${k}:string(len=${v.length})`;
      return `${k}:${shapeOf(v, depth + 1)}`;
    });
    return `{${entries.join(', ')}}`;
  }
  return typeof value;
}

/**
 * Try the likely response shapes; return a data:..;base64,.. URL.
 * Throws BAD_RESPONSE if none match. Exported for probes.
 */
export function extractImage(json) {
  const b64re = /^[A-Za-z0-9+/=\s]+$/;
  const toUrl = (b64, mime = 'image/png') => {
    const clean = String(b64).replace(/\s+/g, '');
    if (clean.length < 100 || !b64re.test(clean)) return null;
    return `data:${mime};base64,${clean}`;
  };
  // Shape 1: { artifacts: [{ base64, mimeType? }] }
  const art = json?.artifacts?.[0];
  if (art && typeof art.base64 === 'string') {
    const url = toUrl(art.base64, art.mimeType || 'image/png');
    if (url) return url;
  }
  // Shape 2: { data: [{ b64_json }] }
  const d = json?.data?.[0];
  if (d && typeof d.b64_json === 'string') {
    const url = toUrl(d.b64_json);
    if (url) return url;
  }
  // Shape 3: { image: "<b64>" | "data:...;base64,..." }
  if (typeof json?.image === 'string') {
    if (json.image.startsWith('data:image/')) return json.image;
    const url = toUrl(json.image);
    if (url) return url;
  }
  throw new AiError(
    AI_CODES.BAD_RESPONSE,
    'The image service answered in a format I do not understand. Try again, or type the concept instead.',
    { status: 502, retryable: false }
  );
}

/**
 * Detect a recognized response whose image slot is present but EMPTY
 * (empty string / null / whitespace). Returns { empty, finishReason }.
 * finishReason is service metadata (e.g. why generation stopped), never
 * image data. Exported for probes.
 */
export function findEmptyImage(json) {
  const reasonOf = (obj) =>
    obj?.finishReason ?? obj?.finish_reason ?? json?.finishReason ?? json?.finish_reason ?? null;
  const isBlank = (v) => v == null || (typeof v === 'string' && v.trim() === '');
  const art = json?.artifacts?.[0];
  if (art && isBlank(art.base64)) return { empty: true, finishReason: reasonOf(art) };
  const d = json?.data?.[0];
  if (d && isBlank(d.b64_json)) return { empty: true, finishReason: reasonOf(d) };
  if (typeof json?.image === 'string' && json.image.trim() === '') {
    return { empty: true, finishReason: reasonOf(json) };
  }
  return { empty: false, finishReason: null };
}

/** Empty-result error: must NOT be retried on NVIDIA (wastes quota). */
function emptyImageError() {
  const err = new AiError(
    AI_CODES.BAD_RESPONSE,
    'The image service returned an empty image. Try again, or type the concept instead.',
    { status: 502, retryable: false }
  );
  err.noNvidiaRetry = true; // belt-and-braces: isRetryable() always refuses these
  return err;
}

/** generateImage({ prompt, budget }) -> data URL string. 60s timeout, 1 retry. */
export async function generateImage({ prompt, budget }) {
  const key = process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim();
  if (!key) {
    const { notConfigured } = await import('./AiError.js');
    throw notConfigured();
  }
  return withRetry(
    async (attempt) => {
      if (budget) {
        if (budget.used >= budget.max) throw budgetExceeded();
        budget.used += 1;
      }
      console.log(`[IVLA] image attempt ${attempt + 1} model=${MODELS.image.primary}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      countNvidiaCall();
      try {
        const res = await fetch(NVIDIA_IMAGE_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          // No seed (results vary), no image (text-to-image).
          body: JSON.stringify({ prompt, width: 1024, height: 1024, steps: 4 }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const h = res.headers.get('retry-after');
          throw httpError(res.status, { retryAfterMs: h ? Number(h) * 1000 || null : null });
        }
        let json;
        try {
          json = await res.json();
        } catch (e) {
          throw new AiError(
            AI_CODES.BAD_RESPONSE,
            'The image service sent back something unreadable. Try again, or type the concept instead.',
            { status: 502, retryable: false, detail: redact(String(e && e.message)) }
          );
        }
        if (!shapeLogged) {
          shapeLogged = true;
          console.log('[IVLA] NVIDIA image response shape:', shapeOf(json));
        }
        const empty = findEmptyImage(json);
        if (empty.empty) {
          // Log the finishReason VALUE itself plus the prompt head so we can
          // see why generation stopped. Never the key, never image data.
          console.error(
            `[IVLA] nvidia image empty base64 finishReason=${JSON.stringify(empty.finishReason)?.slice(0, 200)} ` +
              `promptHead=${JSON.stringify(String(prompt).slice(0, 200))}`
          );
          throw emptyImageError(); // no NVIDIA retry: straight to the fallback
        }
        return extractImage(json);
      } catch (err) {
        if (err instanceof AiError) {
          console.error(
            `[IVLA] image model=${MODELS.image.primary} failed code=${err.code} upstream=${err.upstreamStatus ?? err.status ?? 'n/a'}`,
            redact(err.detail)
          );
          throw err;
        }
        if (err && err.name === 'AbortError') throw timeoutError('image model');
        throw networkError(redact(err && err.message));
      } finally {
        clearTimeout(timer);
      }
    },
    { retries: 1 }
  );
}
