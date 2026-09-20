// Retry policy: at most ONE retry per model (2 attempts max), and only for
// 429 / 502 / 503 / 504 / timeouts. Never 400/401/403/404/500, never plain
// network errors. A BUSY that repeats identically across both attempts marks
// the model as unavailable (err.repeated = true) so the caller fails over.

export const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

/** What identifies a repeated failure: code + upstream HTTP status. */
export function errorSignature(err) {
  const code = (err && (err.code || err.name)) || 'Error';
  const st = (err && (err.upstreamStatus ?? err.status)) ?? '-';
  return `${code}|${st}`;
}

export function isRetryable(err) {
  if (!err || typeof err !== 'object') return false;
  if (err.noNvidiaRetry) return false; // e.g. empty image result: never repeat
  if (err.code === 'TIMEOUT') return true;
  if (err.name === 'AbortError') return true;
  if (err.code === 'RATE_LIMITED') return true; // 429 by construction
  if (err.code === 'BUSY') {
    // 500 is deliberately excluded: only 502/503/504 are retried.
    return RETRYABLE_STATUSES.has(err.upstreamStatus ?? err.status);
  }
  if (err.code === 'NETWORK') return false;
  if (!err.code && typeof err.status === 'number') {
    return RETRYABLE_STATUSES.has(err.status);
  }
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run fn(attempt) with up to `retries` retries and exponential backoff
 * plus jitter. Honors err.retryAfterMs (Retry-After header) when present.
 */
export async function withRetry(fn, { retries = 1, baseDelayMs = 1000 } = {}) {
  let attempt = 0;
  let prevSig = null;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (err) {
      const sig = errorSignature(err);
      if (sig === prevSig && err && typeof err === 'object') {
        err.repeated = true;
      }
      prevSig = sig;
      if (!isRetryable(err) || attempt >= retries) throw err;
      let delay = baseDelayMs * 2 ** attempt + Math.random() * 250;
      if (err && typeof err.retryAfterMs === 'number' && err.retryAfterMs >= 0) {
        delay = err.retryAfterMs;
      }
      await sleep(delay);
      attempt += 1;
    }
  }
}
