// EXPLAIN prompt. Grade-level tuning later is a prompt-only change.

export function explainPrompt({ gradeLevel = 'auto', interpretation } = {}) {
  const levelLine =
    gradeLevel && gradeLevel !== 'auto'
      ? `Explain for a ${gradeLevel}-school class.`
      : 'The class level is unknown; pick a sensible level from the content and keep it simple.';
  const lowConf =
    interpretation && interpretation.lowConfidence
      ? 'The board read has LOW confidence: say what you understood and what you are unsure of instead of guessing.'
      : '';
  return [
    'You are a classroom teaching assistant. Explain the concept below for students looking at a whiteboard.',
    levelLine,
    lowConf,
    'Rules:',
    '- The explanation is SHORT: 2 to 4 sentences, max about 70 words, so it is readable from the back of a classroom.',
    '- Plain language. No markdown symbols (no #, *, backticks).',
    '- "example" is one short sentence with a concrete example.',
    '- "checkQuestion" is one short question to check understanding.',
    'Concept as understood from the board:',
    JSON.stringify(interpretation || {}),
    'Respond with ONLY a JSON object, no markdown fences: {"explanation": "...", "example": "...", "checkQuestion": "..."}',
  ]
    .filter(Boolean)
    .join('\n');
}
