// Step-3 probes: normalizeExplanation (no network).
// Run: node server/scripts/probe-step3.js
import { normalizeExplanation } from '../tasks/explain.js';

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

console.log('normalizeExplanation:');
{
  const out = normalizeExplanation(
    { explanation: 'Fractions are parts.', example: 'Half a pizza.', checkQuestion: 'What is 1/2 of 4?' },
    'raw'
  );
  check(
    'keeps parsed fields',
    out.explanation === 'Fractions are parts.' && out.checkQuestion === 'What is 1/2 of 4?'
  );
  const partial = normalizeExplanation({ explanation: 'Only this.' }, 'raw');
  check('missing fields default to empty', partial.example === '' && partial.checkQuestion === '');
  const fallback = normalizeExplanation(null, '```json\nPlain model words here.\n```');
  check('raw text fallback (fences stripped)', fallback.explanation === 'Plain model words here.');
  const empty = normalizeExplanation(null, '');
  check('empty raw text -> empty explanation', empty.explanation === '');
}

console.log(`\nstep3: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
