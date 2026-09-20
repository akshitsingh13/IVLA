// explain({ interpretation, gradeLevel }) -> text model.
// Input is the interpretation object, NEVER the raw image.

import { chatWithFallback } from '../providers/nvidiaChat.js';
import { explainPrompt } from '../prompts/explain.js';
import { parseJsonLoose } from '../lib/parseJson.js';

const str = (v) => (typeof v === 'string' ? v : '');

/**
 * Normalize parsed output. Exported for probes.
 * If parsing failed, fall back to the raw model text as the explanation —
 * plain real model output, not fake content.
 */
export function normalizeExplanation(parsed, rawText) {
  if (parsed && typeof parsed === 'object') {
    return {
      explanation: str(parsed.explanation).slice(0, 2000),
      example: str(parsed.example).slice(0, 500),
      checkQuestion: str(parsed.checkQuestion).slice(0, 500),
    };
  }
  const cleaned = String(rawText || '')
    .replace(/```(?:json)?\s*([\s\S]*?)\s*```/i, '$1')
    .trim()
    .slice(0, 2000);
  return { explanation: cleaned, example: '', checkQuestion: '' };
}

export async function explain({ interpretation, gradeLevel = 'auto', budget }) {
  const messages = [
    { role: 'user', content: explainPrompt({ gradeLevel, interpretation }) },
  ];
  const { text } = await chatWithFallback(
    { kind: 'text', messages, maxTokens: 500, temperature: 0.3, timeoutMs: 20000, budget },
  );
  try {
    return normalizeExplanation(parseJsonLoose(text), text);
  } catch (err) {
    if (err && err.code === 'BAD_RESPONSE') return normalizeExplanation(null, text);
    throw err;
  }
}
