// Client API layer. All errors normalized to { code, message, canTypeInstead }.
// Never show raw stacks or provider messages in the UI.

function normalizeError(err, fallbackMessage) {
  if (err && typeof err === 'object' && err.code) return err;
  if (err && err.name === 'AbortError') {
    return { code: 'ABORTED', message: 'Cancelled.', canTypeInstead: false };
  }
  return {
    code: 'NETWORK',
    message:
      (err && err.message) ||
      fallbackMessage ||
      'Could not reach the board server. Try again, or type the concept instead.',
    canTypeInstead: true,
  };
}

async function post(path, body, { signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw normalizeError(err);
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const e = (json && json.error) || {};
    throw {
      code: e.code || 'BAD_RESPONSE',
      message: e.message || 'Something went wrong. Try again, or type the concept instead.',
      canTypeInstead: e.canTypeInstead !== false,
    };
  }
  return json;
}

export const interpret = (imageDataUrl, gradeLevel, opts) =>
  post('/api/interpret', { imageDataUrl, gradeLevel }, opts);

export const explain = (interpretation, gradeLevel, opts) =>
  post('/api/explain', { interpretation, gradeLevel }, opts);

/** One round trip: interpret then explain (short-circuits on low confidence). */
export const textFromImage = (imageDataUrl, gradeLevel, opts) =>
  post('/api/text-from-image', { imageDataUrl, gradeLevel }, opts);

export const textFromText = (text, gradeLevel, opts) =>
  post('/api/text-from-text', { text, gradeLevel }, opts);

export const imageFromImage = (imageDataUrl, gradeLevel, opts, extra = {}) =>
  post('/api/image-from-image', { imageDataUrl, gradeLevel, ...extra }, opts);

export const imageFromText = (text, gradeLevel, opts) =>
  post('/api/image-from-text', { text, gradeLevel }, opts);

export async function getUsage({ signal } = {}) {
  try {
    const res = await fetch('/api/usage', { signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
