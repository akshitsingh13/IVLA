// Step-7 probes: extractImage + cleanImagePrompt + empty-base64 handling.
// No live API calls (fetch is stubbed where needed).
// Run: node server/scripts/probe-step7.js
import { extractImage, findEmptyImage, generateImage } from '../providers/nvidiaImage.js';
import { isRetryable } from '../providers/withRetry.js';
import { createBudget } from '../lib/budget.js';
import { cleanImagePrompt } from '../tasks/buildImagePrompt.js';

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

const B64 = 'iVBORw0KGgo'.repeat(20);

console.log('extractImage:');
{
  const u = extractImage({ artifacts: [{ base64: B64, mimeType: 'image/png' }] });
  check('artifacts[0].base64', u === `data:image/png;base64,${B64}`);
  const u2 = extractImage({ data: [{ b64_json: B64 }] });
  check('data[0].b64_json', u2 === `data:image/png;base64,${B64}`);
  const u3 = extractImage({ image: B64 });
  check('image bare base64', u3 === `data:image/png;base64,${B64}`);
  const withPrefix = `data:image/jpeg;base64,${B64}`;
  check('image data-url passthrough', extractImage({ image: withPrefix }) === withPrefix);
  try {
    extractImage({ something: 'else' });
    check('unknown shape throws', false);
  } catch (e) {
    check('unknown shape throws', e.code === 'BAD_RESPONSE');
  }
  try {
    extractImage({ artifacts: [{ base64: 'x' }] });
    check('too-short base64 throws', false);
  } catch (e) {
    check('too-short base64 throws', e.code === 'BAD_RESPONSE');
  }
}

console.log('cleanImagePrompt:');
{
  check(
    'strips quotes + preamble',
    cleanImagePrompt('Image prompt: "A red apple on a table"') === 'A red apple on a table'
  );
  check(
    'strips fences',
    cleanImagePrompt('```\nA sunny classroom\n```') === 'A sunny classroom'
  );
  check('plain passthrough', cleanImagePrompt('  Simple diagram  ') === 'Simple diagram');
}

console.log('empty base64 (stubbed fetch, no live calls):');
{
  const found = findEmptyImage({ artifacts: [{ base64: '', finishReason: 'CONTENT_FILTERED' }] });
  check(
    'detects empty base64 + finishReason value',
    found.empty === true && found.finishReason === 'CONTENT_FILTERED'
  );
  check('valid base64 not flagged', findEmptyImage({ artifacts: [{ base64: B64 }] }).empty === false);
  check('unknown shape not flagged', findEmptyImage({ something: 'else' }).empty === false);

  // Stub fetch: empty base64 must cause exactly ONE attempt (no NVIDIA retry).
  const realFetch = globalThis.fetch;
  const realKey = process.env.NVIDIA_API_KEY;
  const realError = console.error;
  const realLog = console.log;
  let fetchCalls = 0;
  let sentBody = null;
  const logs = [];
  process.env.NVIDIA_API_KEY = 'nvapi-test-key-999';
  console.error = (...a) => logs.push(a.map(String).join(' '));
  console.log = (...a) => logs.push(a.map(String).join(' '));
  globalThis.fetch = async (url, opts) => {
    fetchCalls += 1;
    try {
      sentBody = JSON.parse(opts.body);
    } catch {
      sentBody = null;
    }
    return { ok: true, headers: { get: () => null }, json: async () => ({ artifacts: [{ base64: '', finishReason: 'CONTENT_FILTERED' }] }) };
  };
  let thrown = null;
  try {
    await generateImage({ prompt: 'A red apple, flat style, white background', budget: createBudget(4) });
  } catch (e) {
    thrown = e;
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
    console.log = realLog;
    if (realKey === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = realKey;
  }
  const logText = logs.join('\n');
  check('empty result: exactly one NVIDIA attempt', fetchCalls === 1);
  check(
    'request is 1024x1024, steps 4, no seed/image',
    sentBody &&
      sentBody.width === 1024 &&
      sentBody.height === 1024 &&
      sentBody.steps === 4 &&
      !('seed' in sentBody) &&
      !('image' in sentBody)
  );
  check('empty result: BAD_RESPONSE + noNvidiaRetry', thrown && thrown.code === 'BAD_RESPONSE' && thrown.noNvidiaRetry === true);
  check('logs finishReason VALUE', logText.includes('CONTENT_FILTERED'));
  check('logs prompt head', logText.includes('A red apple'));
  check('never logs the key', !logText.includes('nvapi-test-key-999'));
  check(
    'noNvidiaRetry refuses retry',
    isRetryable({ code: 'BUSY', upstreamStatus: 503, noNvidiaRetry: true }) === false &&
      isRetryable({ code: 'BUSY', upstreamStatus: 503 }) === true
  );
}

console.log(`\nstep7: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
