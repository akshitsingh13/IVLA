// NVIDIA OpenAI-compatible chat (vision + text). Built-in fetch only.

import { MODELS, NVIDIA_CHAT_URL } from '../config/models.js';
import { AiError, AI_CODES, httpError, timeoutError, networkError, redact } from './AiError.js';
import { withRetry } from './withRetry.js';
import { countNvidiaCall } from '../lib/usage.js';
import { budgetExceeded } from '../lib/budget.js';

function getKey() {
  const key = process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim();
  return key || null;
}

function retryAfterMs(res) {
  const v = res.headers.get('retry-after');
  if (!v) return null;
  const secs = Number(v);
  if (Number.isFinite(secs)) return secs * 1000;
  const date = Date.parse(v);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

/**
 * chat({ model, messages, maxTokens, temperature, jsonMode, timeoutMs })
 * Returns the assistant's text content. Throws AiError on any failure.
 * NOTE: jsonMode is accepted for future use but currently prompt-enforced:
 * we do NOT send response_format because support varies across NVIDIA-hosted
 * models; prompts demand raw JSON and parseJsonLoose() handles the rest.
 */
export async function chat({
  model,
  messages,
  maxTokens = 800,
  temperature = 0.2,
  jsonMode = false,
  timeoutMs = 20000,
} = {}) {
  void jsonMode;
  const key = getKey();
  if (!key) {
    const { notConfigured } = await import('./AiError.js');
    throw notConfigured();
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  countNvidiaCall(); // every actual outbound NVIDIA request, incl. retries
  try {
    const res = await fetch(NVIDIA_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, stream: false }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw httpError(res.status, { retryAfterMs: retryAfterMs(res) });
    }
    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new AiError(
        AI_CODES.BAD_RESPONSE,
        'The AI sent back something unreadable. Try again, or type the concept instead.',
        { status: 502, retryable: false, detail: redact(String(e && e.message)) }
      );
    }
    const content = json?.choices?.[0]?.message?.content;
    const text = Array.isArray(content)
      ? content
          .filter((p) => p && p.type === 'text')
          .map((p) => p.text)
          .join('')
      : typeof content === 'string'
        ? content
        : '';
    if (!text || !text.trim()) {
      throw new AiError(
        AI_CODES.UNREADABLE,
        "The AI came back empty — it could not read that. Try circling again, or type the concept instead.",
        { status: 502, retryable: false }
      );
    }
    return text;
  } catch (err) {
    if (err instanceof AiError) {
      console.error(
        `[IVLA] chat model=${model} failed code=${err.code} upstream=${err.upstreamStatus ?? err.status ?? 'n/a'}`,
        redact(err.detail)
      );
      throw err;
    }
    if (err && err.name === 'AbortError') throw timeoutError(`model=${model}`);
    throw networkError(redact(err && err.message));
  } finally {
    clearTimeout(timer);
  }
}

const NO_FALLBACK = new Set([AI_CODES.NOT_CONFIGURED, AI_CODES.AUTH]);

/**
 * Primary model with one retry -> fallback model with one retry.
 * At most 4 outbound calls, enforced by the per-click budget shared across
 * every task in the route. chatFn is injectable so probes can verify
 * fallback order without network.
 */
export async function chatWithFallback(
  { kind, messages, maxTokens, temperature, timeoutMs, budget },
  chatFn = chat
) {
  const conf = MODELS[kind];
  if (!conf) throw new Error(`Unknown model kind: ${kind}`);
  const sequence = [conf.primary, ...(conf.fallback ? [conf.fallback] : [])];
  // Budget gate: every attempt (initial or retry, primary or fallback)
  // consumes one unit before any network happens.
  const counted = async (args) => {
    if (budget) {
      if (budget.used >= budget.max) throw budgetExceeded();
      budget.used += 1;
    }
    return chatFn(args);
  };
  let lastErr = null;
  for (const model of sequence) {
    try {
      return {
        text: await withRetry(
          (attempt) => {
            console.log(`[IVLA] ${kind} attempt ${attempt + 1} model=${model}`);
            return counted({ model, messages, maxTokens, temperature, timeoutMs });
          },
          { retries: 1 }
        ),
        model,
      };
    } catch (err) {
      lastErr = err;
      console.error(
        `[IVLA] ${kind} model=${model} failed code=${err && err.code} ` +
          `upstream=${(err && (err.upstreamStatus ?? err.status)) ?? 'n/a'}` +
          (err && err.repeated ? ' (repeated: model unavailable, failing over)' : '')
      );
      if (err && (NO_FALLBACK.has(err.code) || err.noFallback)) throw err; // fallback cannot help
    }
  }
  throw lastErr;
}
