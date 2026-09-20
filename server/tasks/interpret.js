// interpret({ imageDataUrl, gradeLevel }) -> vision model -> { interpretation, lowConfidence }.

import { chatWithFallback } from '../providers/nvidiaChat.js';
import { interpretPrompt, interpretSystem } from '../prompts/interpret.js';
import { parseJsonLoose, normalizeInterpretation, plainTextFallback } from '../lib/parseJson.js';

export async function interpret({ imageDataUrl, gradeLevel = 'auto', budget }) {
  const messages = [
    { role: 'system', content: interpretSystem() },
    {
      role: 'user',
      content: [
        { type: 'text', text: interpretPrompt({ gradeLevel }) },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];
  const { text } = await chatWithFallback(
    { kind: 'vision', messages, maxTokens: 800, temperature: 0.1, timeoutMs: 30000, budget },
  );
  let parsed;
  try {
    parsed = parseJsonLoose(text);
  } catch (err) {
    if (err && err.code === 'BAD_RESPONSE') {
      // Last resort: the model's plain words become the transcription, so the
      // teacher gets the editable low-confidence card instead of an error.
      // Log the first 200 chars server-side for debugging (never the key,
      // never the image data — just the reply text).
      console.error(
        '[IVLA] interpret: JSON parse failed; using plain-text fallback. Raw head:',
        String(text).slice(0, 200)
      );
      return plainTextFallback(text);
    }
    throw err;
  }
  return normalizeInterpretation(parsed);
}
