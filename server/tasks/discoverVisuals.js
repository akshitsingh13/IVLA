// Task: discoverVisuals({ imageDataUrl, text, interpretation, gradeLevel })
// 1. Interprets whiteboard content (if not already interpreted)
// 2. Generates targeted educational search query
// 3. Retrieves, filters and ranks Wikimedia Commons visuals

import { interpret } from './interpret.js';
import { buildWikimediaQuery } from './buildWikimediaQuery.js';
import { searchWikimediaCommons } from '../providers/wikimedia.js';

function interpretationFromText(text) {
  return {
    contentType: 'text',
    transcription: text,
    concept: text,
    subject: '',
    keyTerms: [],
    visualElements: '',
    confidence: 1,
    lowConfidence: false,
  };
}

export async function discoverVisuals({
  imageDataUrl,
  text,
  interpretation: passedInterp,
  gradeLevel = 'auto',
  budget,
  limit = 4,
}) {
  let interpretation = passedInterp || null;

  if (!interpretation) {
    if (text) {
      interpretation = interpretationFromText(text);
    } else if (imageDataUrl) {
      const interpResult = await interpret({ imageDataUrl, gradeLevel, budget });
      if (interpResult.lowConfidence) {
        return {
          interpretation: interpResult.interpretation,
          lowConfidence: true,
          query: '',
          results: [],
          totalFound: 0,
        };
      }
      interpretation = interpResult.interpretation;
    }
  }

  if (
    interpretation?.lowConfidence ||
    (!interpretation?.transcription?.trim() && !interpretation?.concept?.trim())
  ) {
    return {
      interpretation,
      lowConfidence: true,
      query: '',
      results: [],
      totalFound: 0,
    };
  }

  // Generate targeted educational query
  const { primaryQuery, fallbackQuery } = buildWikimediaQuery({ interpretation, gradeLevel });
  const query = primaryQuery || (interpretation.concept || interpretation.transcription || '').trim();

  // Search Wikimedia Commons with automatic fallback and lightweight ranking
  const { results, totalFound, activeQuery } = await searchWikimediaCommons(query, limit, fallbackQuery);

  return {
    interpretation,
    lowConfidence: false,
    query: activeQuery || query,
    results,
    totalFound,
  };
}
