// Local image-prompt fallback probes. No network, no live API calls.
// Run: node server/scripts/probe-prompt-fallback.js
import { buildImagePrompt, localImagePrompt } from '../tasks/buildImagePrompt.js';
import { AiError } from '../providers/AiError.js';

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

const EXPECTED =
  'Simple flat educational illustration of fractions, clean white background, ' +
  'bright colors, large simple shapes, no text or labels, classroom style';

console.log('localImagePrompt:');
{
  check(
    'uses concept, exact template',
    localImagePrompt({ concept: 'fractions', transcription: 'x' }) === EXPECTED
  );
  check(
    'falls back to transcription',
    localImagePrompt({ concept: '', transcription: 'water cycle' }).includes('of water cycle,')
  );
  const long = localImagePrompt({ concept: 'x'.repeat(200) });
  check('concept truncated to 80 chars', long.includes(`of ${'x'.repeat(80)},`));
  check(
    'empty interpretation stays grammatical',
    localImagePrompt({}).includes('of the topic,')
  );
}

console.log('buildImagePrompt fallback path (mocked chatFn):');
{
  const realLog = console.log;
  const logs = [];
  console.log = (...a) => logs.push(a.map(String).join(' '));

  const timeout = async () => {
    throw new AiError('TIMEOUT', 'slow', { status: 504, retryable: true });
  };
  const busy = async () => {
    const e = new AiError('BUSY', 'busy', { status: 502, retryable: true });
    e.upstreamStatus = 503;
    throw e;
  };
  let outTimeout = null;
  let outBusy = null;
  let outOk = null;
  let threwNonAi = null;
  try {
    outTimeout = await buildImagePrompt(
      { interpretation: { concept: 'fractions', transcription: '' } },
      timeout
    );
    outBusy = await buildImagePrompt(
      { interpretation: { concept: '', transcription: 'volcanoes' } },
      busy
    );
    outOk = await buildImagePrompt(
      { interpretation: { concept: 'x' } },
      async () => 'Image prompt: "A sunny meadow"'
    );
    try {
      await buildImagePrompt({ interpretation: { concept: 'x' } }, async () => {
        throw new TypeError('boom');
      });
    } catch (e) {
      threwNonAi = e;
    }
  } finally {
    console.log = realLog;
  }
  const logText = logs.join('\n');
  check('TIMEOUT -> local prompt, no throw', outTimeout === EXPECTED);
  check('BUSY -> local prompt from transcription', outBusy.includes('of volcanoes,'));
  check('fallback usage logged', logText.includes('using local fallback prompt'));
  check('success path returns cleaned model text', outOk === 'A sunny meadow');
  check('non-AiError still throws', threwNonAi instanceof TypeError);
}

console.log(`\nfallback: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
