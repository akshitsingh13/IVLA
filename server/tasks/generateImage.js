// generateImage({ prompt }) -> NVIDIA FLUX, on failure -> Pollinations,
// on failure -> throw AiError. Returns { imageDataUrl, provider }.

import { AiError, AI_CODES } from '../providers/AiError.js';
import { generateImage as nvidia } from '../providers/nvidiaImage.js';
import { generateImage as pollinations } from '../providers/pollinations.js';

export async function generateImage({ prompt, budget }) {
  try {
    const imageDataUrl = await nvidia({ prompt, budget });
    return { imageDataUrl, provider: 'nvidia' };
  } catch (nvidiaErr) {
    console.error('[IVLA] nvidia image failed, trying Pollinations:', nvidiaErr.code);
    // NOT_CONFIGURED/AUTH cannot be fixed by the fallback.
    if (nvidiaErr.code === 'NOT_CONFIGURED' || nvidiaErr.code === 'AUTH') throw nvidiaErr;
    try {
      const imageDataUrl = await pollinations({ prompt });
      return { imageDataUrl, provider: 'pollinations' };
    } catch (pollErr) {
      console.error('[IVLA] pollinations also failed:', pollErr.code);
      throw new AiError(
        AI_CODES.BUSY,
        'Both image services failed right now. Try again in a moment, or type the concept instead.',
        { status: 502, retryable: false }
      );
    }
  }
}
