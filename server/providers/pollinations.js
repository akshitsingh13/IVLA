// OPTIONAL Pollinations fallback for image generation. If it fails that is
// fine — the failure is reported honestly and the teacher types instead.

import { POLLINATIONS_URL } from '../config/models.js';
import { AiError, AI_CODES, redact } from './AiError.js';

/** generateImage({ prompt }) -> data URL string. 30s timeout, no retry here. */
export async function generateImage({ prompt }) {
  const url = `${POLLINATIONS_URL}${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new AiError(
        AI_CODES.NETWORK,
        'The backup image service failed too. Try again, or type the concept instead.',
        { status: 502, retryable: false, detail: `pollinations status ${res.status}` }
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) {
      throw new AiError(
        AI_CODES.BAD_RESPONSE,
        'The backup image service returned an empty image. Try again, or type the concept instead.',
        { status: 502, retryable: false }
      );
    }
    const type = res.headers.get('content-type') || 'image/jpeg';
    const mime = type.startsWith('image/') ? type.split(';')[0] : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err && err.name === 'AbortError') {
      throw new AiError(
        AI_CODES.TIMEOUT,
        'The backup image service took too long. Try again, or type the concept instead.',
        { status: 504, retryable: false, detail: 'pollinations timeout' }
      );
    }
    throw new AiError(
      AI_CODES.NETWORK,
      'The backup image service failed too. Try again, or type the concept instead.',
      { status: 502, retryable: false, detail: redact(err && err.message) }
    );
  } finally {
    clearTimeout(timer);
  }
}
