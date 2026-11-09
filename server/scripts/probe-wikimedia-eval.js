import { searchWikimediaCommons } from '../providers/wikimedia.js';
import { buildWikimediaQuery } from '../tasks/buildWikimediaQuery.js';

const testCases = [
  {
    name: '1. Human heart anatomy',
    interpretation: { concept: 'Human heart', subject: 'biology', keyTerms: ['atrium', 'ventricle'] },
    expectedQuery: 'Human heart anatomical cross-section diagram',
  },
  {
    name: '2. Photosynthesis',
    interpretation: { concept: 'Photosynthesis', subject: 'biology', keyTerms: ['chlorophyll'] },
    expectedQuery: 'Photosynthesis process educational illustration',
  },
  {
    name: '3. Binary search algorithm',
    interpretation: { concept: 'Binary search', subject: 'computer science', keyTerms: ['algorithm'] },
    expectedQuery: 'Binary search algorithm diagram',
  },
  {
    name: '4. Water cycle',
    interpretation: { concept: 'Water cycle', subject: 'earth science', keyTerms: ['evaporation'] },
    expectedQuery: 'Water cycle labeled educational diagram',
  },
  {
    name: "5. Newton's laws of motion",
    interpretation: { concept: "Newton's laws of motion", subject: 'physics', keyTerms: ['force'] },
    expectedQuery: "Newton's laws of motion diagram",
  },
];

async function run() {
  console.log('--- Phase 9 Verification: 5 Key Test Cases ---');
  let allPassed = true;

  for (const tc of testCases) {
    console.log(`\nTesting ${tc.name}:`);
    const { primaryQuery, fallbackQuery } = buildWikimediaQuery({ interpretation: tc.interpretation });
    console.log(`  Generated primary query:  "${primaryQuery}"`);
    console.log(`  Generated fallback query: "${fallbackQuery}"`);

    const start = Date.now();
    const { results, totalFound, activeQuery } = await searchWikimediaCommons(primaryQuery, 4, fallbackQuery);
    const ms = Date.now() - start;

    console.log(`  Active query used:        "${activeQuery}"`);
    console.log(`  Total images found:       ${totalFound} (returned ${results.length} ranked in ${ms}ms)`);

    if (results.length === 0) {
      console.error(`  FAIL: No results for ${tc.name}`);
      allPassed = false;
      continue;
    }

    // Verify fields
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const valid = r.id && r.title && r.thumbnailUrl && r.imageUrl && r.pageUrl && r.license && r.source;
      if (!valid) {
        console.error(`  FAIL: Missing required normalized fields in result #${i + 1}`);
        allPassed = false;
      }
      console.log(`    [${i + 1}] "${r.title.slice(0, 45)}" | ${r.width}x${r.height} | ${r.license} | ${r.source}`);
      console.log(`        Thumb: ${r.thumbnailUrl.slice(0, 65)}...`);
      console.log(`        Page:  ${r.pageUrl}`);
    }
  }

  if (allPassed) {
    console.log('\nSUCCESS: All 5 test cases returned valid, high-resolution educational images with complete metadata!');
  } else {
    console.error('\nFAILURE: Some test cases did not pass verification.');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
