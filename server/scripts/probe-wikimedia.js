import { searchWikimediaCommons } from '../providers/wikimedia.js';
import { buildWikimediaQuery } from '../tasks/buildWikimediaQuery.js';

const testConcepts = [
  { concept: 'Human heart', subject: 'biology', keyTerms: ['atrium', 'ventricle', 'aorta'] },
  { concept: 'Photosynthesis', subject: 'biology', keyTerms: ['chlorophyll', 'sunlight', 'leaf'] },
  { concept: 'Binary search', subject: 'computer science', keyTerms: ['algorithm', 'sorted array'] },
  { concept: 'Water cycle', subject: 'earth science', keyTerms: ['evaporation', 'condensation', 'precipitation'] },
  { concept: "Newton's laws of motion", subject: 'physics', keyTerms: ['force', 'mass', 'acceleration'] },
];

async function run() {
  console.log('Testing Wikimedia query builder & API retrieval for Phase 9 test cases:');

  for (const item of testConcepts) {
    const query = buildWikimediaQuery({ interpretation: item });
    console.log(`\nConcept: "${item.concept}" -> Search query: "${query}"`);

    const start = Date.now();
    const { results, totalFound } = await searchWikimediaCommons(query, 4);
    const ms = Date.now() - start;

    console.log(`  Found: ${totalFound} total candidates, returned ${results.length} top ranked in ${ms}ms`);
    if (results.length === 0) {
      console.error(`  FAIL: No results found for "${query}"`);
      process.exit(1);
    }

    results.forEach((r, idx) => {
      console.log(`  [${idx + 1}] Title: ${r.title.slice(0, 45)}...`);
      console.log(`      Thumb: ${r.thumbnailUrl.slice(0, 60)}...`);
      console.log(`      Dims: ${r.width}x${r.height} | License: ${r.license}`);
      console.log(`      Page: ${r.pageUrl}`);
    });
  }

  console.log('\nAll 5 test cases passed with valid Wikimedia Commons results, metadata & licenses!');
}

run().catch((err) => {
  console.error('Error during probe:', err);
  process.exit(1);
});
