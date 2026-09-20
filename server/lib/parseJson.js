// Loose JSON parsing for model output + normalization helpers.

import { AiError, AI_CODES } from '../providers/AiError.js';

/** Strip markdown code fences if the model wrapped its answer in them. */
function stripFences(s) {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return m ? m[1] : s;
}

/** Extract the first balanced {...} block (handles preamble/postamble). */
function extractObject(s) {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * Parse model output that should be a JSON object. Forgiving passes in order:
 * balanced {...} block, whole text, first-"{" to last-"}" slice, then a
 * sanitized slice (smart quotes, single-quoted keys, trailing commas).
 * Throws BAD_RESPONSE AiError when nothing parseable remains.
 */
export function parseJsonLoose(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw badResponse();
  }
  const cleaned = stripFences(text).trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const sliced = start !== -1 && end > start ? cleaned.slice(start, end + 1) : null;
  const block = extractObject(cleaned);
  const candidates = [];
  if (block) candidates.push(block);
  candidates.push(cleaned);
  if (sliced && sliced !== block && sliced !== cleaned) candidates.push(sliced);
  // Strict passes first so valid JSON is never touched by sanitizing.
  for (const c of candidates) {
    try {
      const v = JSON.parse(c);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch {
      /* try next candidate */
    }
  }
  // Forgiving pass on the sliced object.
  if (sliced) {
    try {
      const v = JSON.parse(sanitize(sliced));
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch {
      /* fall through to BAD_RESPONSE */
    }
  }
  throw badResponse();
}

function badResponse() {
  return new AiError(
    AI_CODES.BAD_RESPONSE,
    'The AI gave back an answer I could not understand. Try again, or type the concept instead.',
    { status: 502, retryable: false }
  );
}

/** Convert smart quotes to plain quotes. */
function toPlainQuotes(s) {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

/**
 * Best-effort JSON repair for near-miss model output: single-quoted
 * strings/keys become double-quoted, trailing commas before } or ] are
 * dropped. Only used after strict parsing failed.
 */
function sanitize(s) {
  let out = toPlainQuotes(s);
  out = out.replace(
    /'([^'\\]*(?:\\.[^'\\]*)*)'/g,
    (_, inner) => `"${inner.replace(/"/g, '\\"')}"`
  );
  out = out.replace(/,\s*([}\]])/g, '$1');
  return out;
}

/**
 * Last-resort fallback when the model answered in plain prose: treat its
 * real words as the transcription (max 300 chars) with middling confidence
 * and force lowConfidence, so the teacher lands on the editable
 * "I couldn't read this clearly" card pre-filled with model output.
 */
export function plainTextFallback(text) {
  const cleaned = String(text || '')
    .replace(/```(?:\w+)?\s*([\s\S]*?)\s*```/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  return {
    interpretation: {
      contentType: 'text',
      transcription: cleaned,
      concept: '',
      subject: '',
      keyTerms: [],
      visualElements: '',
      confidence: 0.5,
    },
    lowConfidence: true,
  };
}

const clamp01 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
};

const CONTENT_TYPES = ['math', 'diagram', 'text', 'mixed', 'unclear'];

/** Validate/normalize fields, clamp confidence, default missing fields. */
export function normalizeInterpretation(obj) {
  const o = obj && typeof obj === 'object' ? obj : {};
  const contentType = CONTENT_TYPES.includes(o.contentType) ? o.contentType : 'unclear';
  const transcription = typeof o.transcription === 'string' ? o.transcription : '';
  const concept = typeof o.concept === 'string' ? o.concept : '';
  const interpretation = {
    contentType,
    transcription,
    concept,
    subject: typeof o.subject === 'string' ? o.subject : '',
    keyTerms: Array.isArray(o.keyTerms)
      ? o.keyTerms.filter((t) => typeof t === 'string').slice(0, 20)
      : [],
    visualElements: typeof o.visualElements === 'string' ? o.visualElements : '',
    confidence: clamp01(o.confidence),
  };
  const lowConfidence =
    interpretation.contentType === 'unclear' ||
    interpretation.confidence < 0.4 ||
    (!interpretation.transcription.trim() && !interpretation.concept.trim());
  return { interpretation, lowConfidence };
}
