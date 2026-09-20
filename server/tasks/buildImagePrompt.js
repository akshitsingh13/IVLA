// buildImagePrompt({ interpretation, gradeLevel }) -> text model -> prompt string.
// If the text model fails (any AiError after retries + fallback), build the
// prompt locally from the interpretation with NO api call, so the image
// request still proceeds to the image model instead of failing outright.

import { chatWithFallback } from '../providers/nvidiaChat.js';
import { AiError, AI_CODES } from '../providers/AiError.js';
import { imagePromptPrompt } from '../prompts/imagePrompt.js';

/** Strip quotes, fences and preamble so only the prompt remains. Exported for probes. */
export function cleanImagePrompt(text) {
  let s = String(text || '').trim();
  s = s.replace(/```(?:\w+)?\s*([\s\S]*?)\s*```/g, '$1').trim();
  s = s.replace(/^(?:image prompt|prompt|here(?:'s| is)[^:]*):\s*/i, '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.slice(0, 600);
}

/**
 * Local fallback prompt: no API call. Concept (else transcription),
 * truncated to 80 chars. Exported for probes.
 */
export function localImagePrompt(interpretation) {
  const i = interpretation || {};
  const topic =
    String(i.concept || i.transcription || i.subject || 'the topic')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
      .trim() || 'the topic';
  return (
    `Simple flat educational illustration of ${topic}, clean white background, ` +
    `bright colors, large simple shapes, no text or labels, classroom style`
  );
}

export async function buildImagePrompt(
  { interpretation, gradeLevel = 'auto', budget },
  chatFn
) {
  const messages = [
    { role: 'user', content: imagePromptPrompt({ gradeLevel, interpretation }) },
  ];
  try {
    const { text } = await chatWithFallback(
      { kind: 'text', messages, maxTokens: 200, temperature: 0.5, timeoutMs: 20000, budget },
      chatFn
    );
    const cleaned = cleanImagePrompt(text);
    if (!cleaned) {
      throw new AiError(
        AI_CODES.BAD_RESPONSE,
        'The AI could not describe an illustration for that. Try again, or type the concept instead.',
        { status: 502, retryable: false }
      );
    }
    return cleaned;
  } catch (err) {
    if (err instanceof AiError) {
      console.log(
        `[IVLA] buildImagePrompt: text model failed (${err.code}); using local fallback prompt`
      );
      return localImagePrompt(interpretation);
    }
    throw err; // programming bugs stay loud
  }
}
