// Step-2 probes: parseJsonLoose + fallback order (mocked chat, no network).
// Run: node server/scripts/probe-step2.js
import { parseJsonLoose, normalizeInterpretation } from '../lib/parseJson.js';
import { chatWithFallback } from '../providers/nvidiaChat.js';
import { createBudget } from '../lib/budget.js';
import { MODELS } from '../config/models.js';

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

console.log('parseJsonLoose:');
{
  const fenced = '```json\n{"a": 1}\n```';
  check('strips code fences', parseJsonLoose(fenced).a === 1);
  const preamble = 'Here you go:\n{"concept": "fractions", "confidence": 0.9} hope that helps';
  const p = parseJsonLoose(preamble);
  check('extracts object with preamble', p.concept === 'fractions');
  try {
    parseJsonLoose('no json here at all');
    check('garbage throws', false);
  } catch (e) {
    check('garbage throws', e.code === 'BAD_RESPONSE');
  }
  try {
    parseJsonLoose('');
    check('empty throws', false);
  } catch (e) {
    check('empty throws', e.code === 'BAD_RESPONSE');
  }
  const missing = normalizeInterpretation(parseJsonLoose('{"transcription": "x+y"}'));
  check('missing fields defaulted', missing.interpretation.concept === '' && missing.interpretation.confidence === 0);
  const over = normalizeInterpretation({ confidence: 5, transcription: 't', concept: 'c', contentType: 'math' });
  check('confidence clamped to 1', over.interpretation.confidence === 1);
  const under = normalizeInterpretation({ confidence: -2, transcription: '', concept: '' });
  check('low confidence flagged (empty)', under.lowConfidence === true);
  const unclear = normalizeInterpretation({ contentType: 'unclear', confidence: 0.9, transcription: 't', concept: 'c' });
  check('unclear flagged despite confidence', unclear.lowConfidence === true);
  const good = normalizeInterpretation({ contentType: 'math', confidence: 0.8, transcription: '2+2', concept: 'addition' });
  check('good read not flagged', good.lowConfidence === false);
}

console.log('chatWithFallback (mocked):');
{
  const calls = [];
  const mock = async ({ model }) => {
    calls.push(model);
    if (model === MODELS.vision.primary) {
      const e = new Error('busy');
      e.status = 503;
      throw e;
    }
    return 'fallback-ok';
  };
  const r = await chatWithFallback({ kind: 'vision', messages: [] }, mock);
  check(
    'primary with one retry, then fallback',
    r.text === 'fallback-ok' &&
      calls.length === 3 && // 1 initial + 1 retry on primary, then fallback
      calls[0] === MODELS.vision.primary &&
      calls[1] === MODELS.vision.primary &&
      calls[2] === MODELS.vision.fallback
  );
}
{
  // AUTH must NOT trigger fallback.
  const calls = [];
  const mock = async ({ model }) => {
    calls.push(model);
    const e = new Error('bad key');
    e.code = 'AUTH';
    e.retryable = false;
    throw e;
  };
  try {
    await chatWithFallback({ kind: 'text', messages: [] }, mock);
    check('AUTH throws', false);
  } catch (e) {
    check('AUTH throws without fallback', e.code === 'AUTH' && calls.length === 1);
  }
}

console.log('call budget (mocked, no network):');
{
  // Budget of 2: primary attempt + retry consume it; fallback never fires.
  const budget = createBudget(2);
  let calls = 0;
  const mock = async () => {
    calls += 1;
    const e = new Error('busy');
    e.status = 503;
    throw e;
  };
  let thrown = null;
  try {
    await chatWithFallback({ kind: 'vision', messages: [], budget }, mock);
  } catch (e) {
    thrown = e;
  }
  check(
    'budget caps attempts (2 calls, BUSY, no fallback)',
    calls === 2 && budget.used === 2 && thrown && thrown.code === 'BUSY' && thrown.noFallback === true
  );
}
{
  // A success consumes exactly one unit.
  const budget = createBudget(4);
  const r = await chatWithFallback({ kind: 'text', messages: [], budget }, async () => 'hi');
  check('success consumes one unit', r.text === 'hi' && budget.used === 1);
}

console.log(`\nstep2: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
