// Generate search queries suitable for Wikimedia Commons based on interpretation output.
// Returns primary query (detailed educational query) and fallback query (compact diagram query).

export function buildWikimediaQuery({ interpretation, gradeLevel = 'auto' } = {}) {
  if (!interpretation) return { primaryQuery: '', fallbackQuery: '' };

  const concept = (interpretation.concept || '').trim();
  const transcription = (interpretation.transcription || '').trim();
  const subject = (interpretation.subject || '').trim();
  const keyTerms = Array.isArray(interpretation.keyTerms) ? interpretation.keyTerms.filter(Boolean) : [];
  const visualElements = (interpretation.visualElements || '').trim();

  // Core topic
  let topic = concept;
  if (!topic && transcription && transcription.length < 60) {
    topic = transcription;
  }
  if (!topic && keyTerms.length > 0) {
    topic = keyTerms[0];
  }
  if (!topic) return { primaryQuery: '', fallbackQuery: '' };

  const topicLower = topic.toLowerCase();

  // Primary educational qualifier matching Phase 3 exact examples
  let primaryQualifier = 'diagram';

  if (topicLower.includes('water cycle') || (topicLower.includes('cycle') && topicLower.includes('water'))) {
    primaryQualifier = 'labeled educational diagram';
  } else if (topicLower.includes('heart')) {
    primaryQualifier = 'anatomical cross-section diagram';
  } else if (topicLower.includes('photosynthesis')) {
    primaryQualifier = 'process educational illustration';
  } else if (topicLower.includes('binary search')) {
    primaryQualifier = 'algorithm diagram';
  } else if (topicLower.includes('newton') || topicLower.includes('laws of motion')) {
    primaryQualifier = 'diagram';
  } else if (topicLower.includes('cycle')) {
    primaryQualifier = 'labeled diagram';
  } else if (subject.toLowerCase() === 'biology' || subject.toLowerCase() === 'medicine' || topicLower.includes('anatomy') || topicLower.includes('cell') || topicLower.includes('brain')) {
    primaryQualifier = 'cross-section diagram';
  } else if (topicLower.includes('algorithm') || topicLower.includes('search') || topicLower.includes('sort') || topicLower.includes('tree')) {
    primaryQualifier = 'algorithm diagram';
  } else if (visualElements.toLowerCase().includes('diagram') || visualElements.toLowerCase().includes('chart')) {
    primaryQualifier = 'diagram';
  }

  // Construct primary query avoiding repetition
  const primaryParts = [topic];
  for (const w of primaryQualifier.split(/\s+/)) {
    if (!topicLower.includes(w.toLowerCase())) {
      primaryParts.push(w);
    }
  }
  const primaryQuery = primaryParts.join(' ').trim();

  // Compact fallback query (e.g., "Water cycle diagram", "Photosynthesis diagram")
  let fallbackQuery = `${topic} diagram`;
  if (topicLower.includes('diagram')) {
    fallbackQuery = topic;
  }

  return { primaryQuery, fallbackQuery };
}
