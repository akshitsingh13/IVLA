// AI routes (mounted under /api). Cache + rate limit + usage arrive in step 4.

import { Router } from 'express';
import { AiError } from '../providers/AiError.js';
import {
  validateGradeLevel,
  validateImageDataUrl,
  validateText,
  validateInterpretation,
} from '../lib/validate.js';
import { interpret } from '../tasks/interpret.js';
import { explain } from '../tasks/explain.js';
import { buildImagePrompt } from '../tasks/buildImagePrompt.js';
import { generateImage } from '../tasks/generateImage.js';
import { deduped, cacheKey, sha256hex } from '../lib/cache.js';
import { getUsage } from '../lib/usage.js';
import { createBudget } from '../lib/budget.js';

const router = Router();

function sendAiError(res, err) {
  if (err instanceof AiError) {
    return res
      .status(err.status)
      .json({ error: { code: err.code, message: err.userMessage, canTypeInstead: true } });
  }
  console.error('[IVLA] unexpected route error:', err);
  return res.status(500).json({
    error: {
      code: 'BAD_RESPONSE',
      message: 'Something unexpected went wrong. Try again, or type the concept instead.',
      canTypeInstead: true,
    },
  });
}

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

// Regenerate means "make a new one": run directly, bypassing the cache
// (but still validating). Everything else goes through deduped().
async function runMaybeFresh(fresh, key, fn) {
  if (fresh) return { value: await fn() };
  return deduped(key, fn);
}

router.post('/interpret', async (req, res) => {
  try {
    const gradeLevel = validateGradeLevel(req.body?.gradeLevel);
    const imageDataUrl = validateImageDataUrl(req.body?.imageDataUrl);
    const key = cacheKey(['interpret', gradeLevel, sha256hex(imageDataUrl)]);
    const budget = createBudget(4); // max 4 outbound NVIDIA calls per click
    const { value } = await deduped(key, () => interpret({ imageDataUrl, gradeLevel, budget }));
    res.json(value);
  } catch (err) {
    sendAiError(res, err);
  }
});

router.post('/explain', async (req, res) => {
  try {
    const gradeLevel = validateGradeLevel(req.body?.gradeLevel);
    const interpretation = validateInterpretation(req.body?.interpretation);
    const key = cacheKey(['explain', gradeLevel, sha256hex(JSON.stringify(interpretation))]);
    const budget = createBudget(4); // max 4 outbound NVIDIA calls per click
    const { value } = await deduped(key, () => explain({ interpretation, gradeLevel, budget }));
    res.json(value);
  } catch (err) {
    sendAiError(res, err);
  }
});

// Interpret then explain in ONE round trip. Low confidence short-circuits:
// no explain call, UI asks the teacher to confirm or type it.
router.post('/text-from-image', async (req, res) => {
  try {
    const gradeLevel = validateGradeLevel(req.body?.gradeLevel);
    const imageDataUrl = validateImageDataUrl(req.body?.imageDataUrl);
    const key = cacheKey(['text-from-image', gradeLevel, sha256hex(imageDataUrl)]);
    const budget = createBudget(4); // max 4 outbound NVIDIA calls per click
    const { value } = await deduped(key, async () => {
      const { interpretation, lowConfidence } = await interpret({ imageDataUrl, gradeLevel, budget });
      if (lowConfidence) return { interpretation, lowConfidence: true };
      const out = await explain({ interpretation, gradeLevel, budget });
      return { interpretation, lowConfidence: false, ...out };
    });
    res.json(value);
  } catch (err) {
    sendAiError(res, err);
  }
});

// Skip INTERPRET: build the interpretation from typed text, then explain.
router.post('/text-from-text', async (req, res) => {
  try {
    const gradeLevel = validateGradeLevel(req.body?.gradeLevel);
    const text = validateText(req.body?.text);
    const key = cacheKey(['text-from-text', gradeLevel, sha256hex(text)]);
    const budget = createBudget(4); // max 4 outbound NVIDIA calls per click
    const { value } = await deduped(key, async () => {
      const interpretation = interpretationFromText(text);
      const out = await explain({ interpretation, gradeLevel, budget });
      return { interpretation, lowConfidence: false, ...out };
    });
    res.json(value);
  } catch (err) {
    sendAiError(res, err);
  }
});

router.get('/usage', (req, res) => {
  res.json(getUsage());
});

// interpret -> buildImagePrompt -> generateImage. Same lowConfidence
// short-circuit as the text flow. An already-validated `interpretation` may
// be passed (the client reads once, then reuses it) to skip a second vision
// call; otherwise we interpret from the image.
router.post('/image-from-image', async (req, res) => {
  try {
    const gradeLevel = validateGradeLevel(req.body?.gradeLevel);
    const imageDataUrl = validateImageDataUrl(req.body?.imageDataUrl);
    const hasInterp =
      req.body?.interpretation && typeof req.body.interpretation === 'object';
    const key = cacheKey([
      'image-from-image',
      gradeLevel,
      sha256hex(imageDataUrl),
      hasInterp ? sha256hex(JSON.stringify(req.body.interpretation)) : '',
    ]);
    const { value } = await runMaybeFresh(req.body?.fresh === true, key, async () => {
      const budget = createBudget(4); // max 4 outbound NVIDIA calls per click
      let interpretation = hasInterp
        ? validateInterpretation(req.body.interpretation)
        : null;
      if (!interpretation) {
        const r = await interpret({ imageDataUrl, gradeLevel, budget });
        if (r.lowConfidence) return { interpretation: r.interpretation, lowConfidence: true };
        interpretation = r.interpretation;
      } else if (
        interpretation.lowConfidence ||
        (!interpretation.transcription.trim() && !interpretation.concept.trim())
      ) {
        return { interpretation, lowConfidence: true };
      }
      const imagePrompt = await buildImagePrompt({ interpretation, gradeLevel, budget });
      const { imageDataUrl: generated, provider } = await generateImage({ prompt: imagePrompt, budget });
      return {
        interpretation,
        lowConfidence: false,
        imagePrompt,
        imageDataUrl: generated,
        provider,
      };
    });
    res.json(value);
  } catch (err) {
    sendAiError(res, err);
  }
});

router.post('/image-from-text', async (req, res) => {
  try {
    const gradeLevel = validateGradeLevel(req.body?.gradeLevel);
    const text = validateText(req.body?.text);
    const key = cacheKey(['image-from-text', gradeLevel, sha256hex(text)]);
    const { value } = await deduped(key, async () => {
      const budget = createBudget(4); // max 4 outbound NVIDIA calls per click
      const interpretation = interpretationFromText(text);
      const imagePrompt = await buildImagePrompt({ interpretation, gradeLevel, budget });
      const { imageDataUrl: generated, provider } = await generateImage({ prompt: imagePrompt, budget });
      return {
        interpretation,
        lowConfidence: false,
        imagePrompt,
        imageDataUrl: generated,
        provider,
      };
    });
    res.json(value);
  } catch (err) {
    sendAiError(res, err);
  }
});

export default router;
