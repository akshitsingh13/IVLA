// Image-prompt builder prompt. Grade-level tuning later is a prompt-only change.

export function imagePromptPrompt({ gradeLevel = 'auto', interpretation } = {}) {
  const levelLine =
    gradeLevel && gradeLevel !== 'auto'
      ? `The audience is a ${gradeLevel}-school class.`
      : 'The audience is a general classroom; keep it simple.';
  return [
    'Write ONE image-generation prompt (max about 60 words) for a clean educational illustration of the concept below.',
    levelLine,
    'Requirements for the illustration: simple flat style, white or very light background, high contrast, large simple shapes, classroom-friendly.',
    'NO paragraphs of text in the image. Do NOT request specific labels, numbers, or equations inside the image (image models garble text). Prefer illustrating the concept visually: objects, scenes, simple diagrams.',
    'Concept as understood from the board:',
    JSON.stringify(interpretation || {}),
    'Respond with ONLY the image prompt text, no quotes, no preamble, no markdown.',
  ].join('\n');
}
