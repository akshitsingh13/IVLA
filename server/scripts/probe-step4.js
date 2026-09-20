// Step-4 probes: cache + in-flight guard (no network).
// Run: node server/scripts/probe-step4.js
import { deduped, cacheKey, cacheSize, clearCache } from '../lib/cache.js';

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

console.log('cache:');
{
  clearCache();
  let calls = 0;
  const k = cacheKey(['text-from-text', 'auto', 'abc']);
  const a = await deduped(k, async () => {
    calls += 1;
    return { v: 1 };
  });
  const b = await deduped(k, async () => {
    calls += 1;
    return { v: 1 };
  });
  check('identical requests hit cache (1 execution)', calls === 1 && a.value.v === 1 && b.fromCache === true);
  check('stable key for same input', cacheKey(['r', 'g', 'x']) === cacheKey(['r', 'g', 'x']));
  check('different input, different key', cacheKey(['r', 'g', 'x']) !== cacheKey(['r', 'g', 'y']));
}
{
  clearCache();
  let calls = 0;
  const k = cacheKey(['fail', 'auto', 'x']);
  for (let i = 0; i < 2; i++) {
    try {
      await deduped(k, async () => {
        calls += 1;
        throw new Error('nope');
      });
    } catch {
      /* expected */
    }
  }
  check('failures are NOT cached', calls === 2);
}
{
  clearCache();
  let calls = 0;
  const k = cacheKey(['inflight', 'auto', 'x']);
  const slow = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 50));
    return { v: 7 };
  };
  const [a, b] = await Promise.all([deduped(k, slow), deduped(k, slow)]);
  check('concurrent identical share one execution', calls === 1 && a.value.v === 7 && b.value.v === 7);
}
{
  clearCache();
  for (let i = 0; i < 55; i++) {
    await deduped(cacheKey(['r', 'g', i]), async () => ({ i }));
  }
  check('cache capped at ~50', cacheSize() <= 50);
  clearCache();
}

console.log(`\nstep4: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
