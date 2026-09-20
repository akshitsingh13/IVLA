// Tiny in-memory cache (successful results only) + in-flight guard.
// Keyed by SHA-256 of route + input + gradeLevel. Max ~50 entries.

import crypto from 'node:crypto';

const MAX_ENTRIES = 50;
const cache = new Map(); // key -> value (insertion-ordered; oldest first)
const inflight = new Map(); // key -> pending promise

export function sha256hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

/** Hash big inputs (like data URLs) so keys stay small. */
export function cacheKey(parts) {
  return sha256hex(JSON.stringify(parts));
}

export function cacheSize() {
  return cache.size;
}

export function clearCache() {
  cache.clear();
}

/**
 * Run fn() once per key: concurrent identical requests share the in-flight
 * promise (double-tap guard); completed successes are cached. Only call fn's
 * result is cached when fn resolves — rejections are never cached.
 */
export async function deduped(key, fn) {
  if (cache.has(key)) {
    const v = cache.get(key);
    cache.delete(key); // refresh LRU position
    cache.set(key, v);
    return { value: structuredClone(v), fromCache: true };
  }
  if (inflight.has(key)) {
    return { value: structuredClone(await inflight.get(key)), fromCache: true };
  }
  const p = (async () => {
    const value = await fn();
    cache.set(key, value);
    if (cache.size > MAX_ENTRIES) {
      cache.delete(cache.keys().next().value); // evict oldest
    }
    return value;
  })();
  inflight.set(key, p);
  try {
    return { value: structuredClone(await p), fromCache: false };
  } finally {
    if (inflight.get(key) === p) inflight.delete(key);
  }
}
