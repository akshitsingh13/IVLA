// Every AI failure maps to one AiError. userMessage is plain-language and
// honest (shown in the UI); detail stays server-side only, key redacted.

export const AI_CODES = {
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  AUTH: 'AUTH',
  RATE_LIMITED: 'RATE_LIMITED',
  BUSY: 'BUSY',
  TIMEOUT: 'TIMEOUT',
  BAD_RESPONSE: 'BAD_RESPONSE',
  UNREADABLE: 'UNREADABLE',
  NETWORK: 'NETWORK',
};

export class AiError extends Error {
  constructor(code, userMessage, { status = 500, retryable = false, detail = null } = {}) {
    super(userMessage);
    this.name = 'AiError';
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
    this.retryable = retryable;
    this.detail = detail; // never sent to the client
  }
}

export function notConfigured() {
  return new AiError(
    AI_CODES.NOT_CONFIGURED,
    'AI is not configured on this board yet. You can still draw — or type the concept instead.',
    { status: 503, retryable: false }
  );
}

/** Build an AiError from an HTTP status from an upstream provider. */
export function httpError(status, { retryAfterMs = null, detail = null } = {}) {
  const err = ((s) => {
    if (s === 401 || s === 403) {
      return new AiError(
        AI_CODES.AUTH,
        'The AI service refused our key. Please tell your administrator — or type the concept instead.',
        { status: 500, retryable: false }
      );
    }
    if (s === 429) {
      return new AiError(
        AI_CODES.RATE_LIMITED,
        'The AI is getting a lot of requests right now. Wait a moment and try again — or type the concept instead.',
        { status: 429, retryable: true }
      );
    }
    if (s === 400 || s === 404 || s === 422) {
      return new AiError(
        AI_CODES.BAD_RESPONSE,
        'The AI service did not like that request. Try again, or type the concept instead.',
        { status: 502, retryable: false }
      );
    }
    // 500, 502, 503, 504 and anything unexpected: treat as busy (transient).
    return new AiError(
      AI_CODES.BUSY,
      'The AI is busy right now. Try again in a moment, or type the concept instead.',
      { status: 502, retryable: true }
    );
  })(status);
  if (retryAfterMs != null) err.retryAfterMs = retryAfterMs;
  if (detail != null) err.detail = redact(detail);
  err.upstreamStatus = status; // original HTTP status (drives retry decisions)
  return err;
}

export function timeoutError(detail = null) {
  return new AiError(
    AI_CODES.TIMEOUT,
    'The AI took too long to answer. Try again, or type the concept instead.',
    { status: 504, retryable: true, detail: redact(detail) }
  );
}

export function networkError(detail = null) {
  return new AiError(
    AI_CODES.NETWORK,
    'Could not reach the AI service. Check the connection and try again — or type the concept instead.',
    { status: 502, retryable: true, detail: redact(detail) }
  );
}

/** Strip anything key-like before logging or attaching details. */
export function redact(value) {
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    return s
      .replace(/nvapi-[A-Za-z0-9_\-]+/g, '[REDACTED_KEY]')
      .replace(/Bearer\s+[A-Za-z0-9_\-.~+/=]+/gi, 'Bearer [REDACTED]')
      .slice(0, 2000);
  } catch {
    return '[unprintable]';
  }
}
