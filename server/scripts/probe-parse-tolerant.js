// Tolerant-interpret probes: forgiving parser + plain-text fallback.
// No network, no live API calls. Run: node server/scripts/probe-parse-tolerant.js
import { parseJsonLoose, plainTextFallback } from '../lib/parseJson.js';

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

console.log('tolerant parsing:');
{
  // Prose-only: unparseable -> BAD_RESPONSE, fallback carries real words.
  const prose = 'The board shows the word fractions written twice with an arrow between them.';
  let threw = null;
  try {
    parseJsonLoose(prose);
  } catch (e) {
    threw = e;
  }
  check('prose-only throws BAD_RESPONSE', threw && threw.code === 'BAD_RESPONSE');
  const fb = plainTextFallback(prose);
  check(
    'fallback transcribes prose, low confidence',
    fb.lowConfidence === true &&
      fb.interpretation.confidence === 0.5 &&
      fb.interpretation.contentType === 'text' &&
      fb.interpretation.transcription.includes('fractions')
  );
}
{
  // Long prose is capped at 300 chars.
  const fb = plainTextFallback('word '.repeat(200));
  check('fallback transcription capped at 300', fb.interpretation.transcription.length <= 300);
}
{
  // JSON with preamble and postamble.
  const p = parseJsonLoose(
    'Sure, here is what I see:\n{"contentType": "math", "transcription": "2+2=4", "concept": "addition", "confidence": 0.8}\nHope that helps!'
  );
  check('preamble/postamble parsed', p.concept === 'addition');
}
{
  // Trailing commas.
  const p = parseJsonLoose(
    '{"contentType": "math", "transcription": "2+2", "concept": "addition", "keyTerms": ["plus",], "confidence": 0.8,}'
  );
  check('trailing commas tolerated', p.concept === 'addition' && p.keyTerms[0] === 'plus');
}
{
  // Single-quoted keys and values.
  const p = parseJsonLoose("{'contentType': 'text', 'transcription': 'hello', 'concept': 'greeting'}");
  check('single quotes tolerated', p.concept === 'greeting');
}
{
  // Smart quotes.
  const p = parseJsonLoose('\u201CcontentType\u201D: \u201Ctext\u201D, \u201Cconcept\u201D: \u201Cfractions\u201D'.replace(/^/, '{').replace(/$/, '}'));
  check('smart quotes tolerated', p.concept === 'fractions');
}
{
  // Empty reply still throws (nothing to transcribe; chat layer reports it first).
  let threw = null;
  try {
    parseJsonLoose('   ');
  } catch (e) {
    threw = e;
  }
  check('empty reply throws BAD_RESPONSE', threw && threw.code === 'BAD_RESPONSE');
}
{
  // Fenced reply.
  const p = parseJsonLoose('```json\n{"contentType": "diagram", "concept": "water cycle", "confidence": 0.7}\n```');
  check('fences stripped', p.concept === 'water cycle');
}

console.log(`\ntolerant: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
