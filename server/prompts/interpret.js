// INTERPRET prompt. Grade-level tuning later is a prompt-only change.

export function interpretSystem() {
  return [
    'You are a vision reader for a classroom whiteboard.',
    'Reply with a single JSON object only. No explanation before or after.',
  ].join('\n');
}

export function interpretPrompt({ gradeLevel = 'auto' } = {}) {
  const levelLine =
    gradeLevel && gradeLevel !== 'auto'
      ? `The class level is ${gradeLevel}.`
      : 'The class level is unknown; keep any wording simple.';
  return [
    'You are reading a masked crop of a classroom whiteboard. The image has a white background and may contain handwriting, equations, arrows, or diagrams. Areas outside the circled region are masked white: ignore them.',
    'Read it faithfully. Do NOT invent content that is not there. If it is unreadable, say so.',
    levelLine,
    'Respond with ONLY a JSON object, no markdown fences, no extra text, with exactly this shape:',
    '{"contentType": "math | diagram | text | mixed | unclear", "transcription": "exact text and equations as written", "concept": "short name of the topic, or empty string", "subject": "e.g. mathematics, biology, or empty string", "keyTerms": ["..."], "visualElements": "brief description of drawings or diagrams", "confidence": 0.0}',
    'confidence is a number from 0 to 1 for how sure you are. Use "unclear" and low confidence when you cannot read it.',
    'Example of a valid reply (different topic, just showing the format):',
    '{"contentType": "text", "transcription": "photosynthesis", "concept": "photosynthesis", "subject": "biology", "keyTerms": ["chlorophyll", "sunlight"], "visualElements": "leaf sketch with arrows", "confidence": 0.9}',
    'Reply with a single JSON object only. No explanation before or after.',
  ].join('\n');
}
