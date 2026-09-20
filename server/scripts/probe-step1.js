// Step-1 probes: withRetry + validators. Plain Node, no framework.
// Run: node server/scripts/probe-step1.js
import { withRetry } from '../providers/withRetry.js';
import { AiError } from '../providers/AiError.js';
import {
  validateGradeLevel,
  validateImageDataUrl,
  validateText,
  validateInterpretation,
} from '../lib/validate.js';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}`);
  }
}

console.log('withRetry (max ONE retry: 429/502/503/504/timeouts only):');
{
  // Retries a 503 once, then succeeds on the 2nd attempt.
  let calls = 0;
  const v = await withRetry(
    () => {
      calls += 1;
      if (calls < 2) {
        const e = new AiError('BUSY', 'busy', { status: 502, retryable: true });
        e.upstreamStatus = 503;
        throw e;
      }
      return 'ok';
    },
    { baseDelayMs: 1 }
  );
  check('retries 503 once then succeeds', v === 'ok' && calls === 2);
}
{
  // Does NOT retry a 401.
  let calls = 0;
  try {
    await withRetry(
      () => {
        calls += 1;
        throw new AiError('AUTH', 'no', { status: 500, retryable: false });
      },
      { baseDelayMs: 1 }
    );
    check('does not retry 401 (threw)', false);
  } catch {
    check('does not retry 401 (1 attempt)', calls === 1);
  }
}
{
  // Does NOT retry a 500 (only 502/503/504).
  let calls = 0;
  try {
    await withRetry(
      () => {
        calls += 1;
        const e = new AiError('BUSY', 'busy', { status: 502, retryable: true });
        e.upstreamStatus = 500;
        throw e;
      },
      { baseDelayMs: 1 }
    );
  } catch {
    /* expected */
  }
  check('does not retry 500', calls === 1);
}
{
  // Does NOT retry plain network errors (only timeouts).
  let calls = 0;
  try {
    await withRetry(
      () => {
        calls += 1;
        throw new AiError('NETWORK', 'down', { status: 502, retryable: true });
      },
      { baseDelayMs: 1 }
    );
  } catch {
    /* expected */
  }
  check('does not retry NETWORK', calls === 1);
}
{
  // TIMEOUT is retried once.
  let calls = 0;
  try {
    await withRetry(
      () => {
        calls += 1;
        throw new AiError('TIMEOUT', 'slow', { status: 504, retryable: true });
      },
      { baseDelayMs: 1 }
    );
  } catch {
    /* expected */
  }
  check('retries TIMEOUT once (2 attempts)', calls === 2);
}
{
  // Max attempts = 2 (1 initial + 1 retry) by default.
  let calls = 0;
  try {
    await withRetry(
      () => {
        calls += 1;
        const e = new AiError('BUSY', 'busy', { status: 502, retryable: true });
        e.upstreamStatus = 503;
        throw e;
      },
      { baseDelayMs: 1 }
    );
  } catch {
    /* expected */
  }
  check('max attempts = 2', calls === 2);
}
{
  // Identical BUSY on both attempts flags the model as unavailable.
  let thrown = null;
  try {
    await withRetry(
      () => {
        const e = new AiError('BUSY', 'busy', { status: 502, retryable: true });
        e.upstreamStatus = 503;
        throw e;
      },
      { baseDelayMs: 1 }
    );
  } catch (e) {
    thrown = e;
  }
  check('repeated identical BUSY flagged', thrown && thrown.repeated === true);
}
{
  // Different failures do NOT get the repeated flag.
  let n = 0;
  let thrown = null;
  try {
    await withRetry(
      () => {
        n += 1;
        const e = new AiError('BUSY', n === 1 ? 'a' : 'b', { status: 502, retryable: true });
        e.upstreamStatus = n === 1 ? 503 : 502;
        throw e;
      },
      { baseDelayMs: 1 }
    );
  } catch (e) {
    thrown = e;
  }
  check('differing failures not flagged', thrown && thrown.repeated !== true);
}
{
  // Retry-After honored: immediate-ish when 0ms.
  const t0 = Date.now();
  let calls = 0;
  try {
    await withRetry(
      () => {
        calls += 1;
        const e = new AiError('RATE_LIMITED', 'slow', { status: 429, retryable: true });
        e.retryAfterMs = 5;
        throw e;
      },
      { retries: 1, baseDelayMs: 60000 }
    );
  } catch {
    /* expected */
  }
  check('honors Retry-After over backoff', calls === 2 && Date.now() - t0 < 5000);
}

console.log('validators:');
{
  const tiny = 'data:image/png;base64,' + 'iVBORw0KGgo='.repeat(20);
  check('accepts good png data url', validateImageDataUrl(tiny) === tiny);
  try {
    validateImageDataUrl('data:image/jpeg;base64,abcd');
    check('rejects non-png', false);
  } catch (e) {
    check('rejects non-png', e.code === 'BAD_RESPONSE' && e.status === 400);
  }
  try {
    validateImageDataUrl('data:image/png;base64,' + 'A'.repeat(6 * 1024 * 1024));
    check('rejects oversized', false);
  } catch (e) {
    check('rejects oversized', e.code === 'BAD_RESPONSE');
  }
  try {
    validateText('x'.repeat(501));
    check('rejects 501-char text', false);
  } catch (e) {
    check('rejects 501-char text', e.status === 400);
  }
  check('accepts 500-char text', validateText('x'.repeat(500)).length === 500);
  try {
    validateGradeLevel('kindergarten');
    check('rejects bad grade', false);
  } catch (e) {
    check('rejects bad grade', e.status === 400);
  }
  check('grade defaults to auto', validateGradeLevel(undefined) === 'auto');
  const norm = validateInterpretation({ concept: 'x', confidence: 9 });
  check('clamps confidence to 1', norm.confidence === 1);
  try {
    validateInterpretation('nope');
    check('rejects non-object interpretation', false);
  } catch {
    check('rejects non-object interpretation', true);
  }
}

console.log(`\nstep1: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
