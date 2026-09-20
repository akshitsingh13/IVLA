// Request validators. Throw AiError (BAD_RESPONSE, HTTP 400) on invalid input.
// Never include the key or raw provider text in messages.

import { AiError, AI_CODES } from '../providers/AiError.js';

export const GRADE_LEVELS = ['auto', 'primary', 'middle', 'high', 'college'];
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // ~4 MB decoded PNG
export const MAX_TEXT_CHARS = 500;

function badRequest(message) {
  return new AiError(AI_CODES.BAD_RESPONSE, message, { status: 400, retryable: false });
}

export function validateGradeLevel(value) {
  if (value === undefined || value === null || value === '') return 'auto';
  if (GRADE_LEVELS.includes(value)) return value;
  throw badRequest(
    `Grade level must be one of: ${GRADE_LEVELS.join(', ')}. Or type the concept instead.`
  );
}

/** Must be a data:image/png;base64,... URL decoding to under ~4 MB. */
export function validateImageDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('data:image/png;base64,')) {
    throw badRequest(
      'That image did not come through correctly. Circle the area again — or type the concept instead.'
    );
  }
  const b64 = value.slice('data:image/png;base64,'.length);
  if (b64.length < 100) {
    throw badRequest(
      'That image looks empty. Circle an area with some drawing in it — or type the concept instead.'
    );
  }
  // Base64 is ~4/3 the size of the decoded bytes.
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw badRequest(
      'That image is too large for the AI to read. Circle a smaller area — or type the concept instead.'
    );
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) {
    throw badRequest(
      'That image data looks corrupted. Circle the area again — or type the concept instead.'
    );
  }
  return value;
}

/** Typed concept text: 1..500 chars. */
export function validateText(value, { max = MAX_TEXT_CHARS, name = 'Text' } = {}) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest(`${name} is empty. Type the concept first — a word or two is enough.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${name} is too long (max ${max} characters). Shorten it a little.`);
  }
  return trimmed;
}

/** Interpretation object passed to /api/explain: must be an object; normalize. */
export function validateInterpretation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest(
      'There is nothing to explain yet. Read the board first — or type the concept instead.'
    );
  }
  return {
    contentType: typeof value.contentType === 'string' ? value.contentType : 'unclear',
    transcription: typeof value.transcription === 'string' ? value.transcription.slice(0, 2000) : '',
    concept: typeof value.concept === 'string' ? value.concept.slice(0, MAX_TEXT_CHARS) : '',
    subject: typeof value.subject === 'string' ? value.subject.slice(0, 200) : '',
    keyTerms: Array.isArray(value.keyTerms)
      ? value.keyTerms.filter((t) => typeof t === 'string').slice(0, 20)
      : [],
    visualElements:
      typeof value.visualElements === 'string' ? value.visualElements.slice(0, 2000) : '',
    confidence: Number.isFinite(Number(value.confidence))
      ? Math.min(1, Math.max(0, Number(value.confidence)))
      : 0,
    lowConfidence: value.lowConfidence === true,
  };
}
