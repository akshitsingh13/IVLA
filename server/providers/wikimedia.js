// Wikimedia Commons MediaWiki Action API client and ranking engine
// Endpoint: https://commons.wikimedia.org/w/api.php
// Complies with Wikimedia Access policy:
// - Custom User-Agent identifying IVLA + contact
// - Concurrency <= 3
// - Respects Retry-After (429/503)
// - LRU caching + duplicate request deduplication

import { AiError, AI_CODES } from './AiError.js';
import { cacheKey, deduped } from '../lib/cache.js';

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'IVLA/1.0 (Interactive Visual Learning Assistant; https://github.com/akshitsingh13/IVLA)';

const ALLOWED_IMAGE_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];

// Concurrency limiter for Wikimedia API requests (max 3 concurrent)
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    await new Promise((resolve) => this.queue.push(resolve));
    this.current++;
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    }
  }
}

const wikimediaSemaphore = new Semaphore(3);

// Helper to strip HTML tags from Commons metadata
function cleanHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Perform a single HTTP request to Wikimedia API with concurrency control & Retry-After handling.
 */
async function fetchCommons(params, attempt = 1) {
  await wikimediaSemaphore.acquire();
  try {
    const url = new URL(COMMONS_API_URL);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (res.status === 429 || res.status === 503) {
      const retryAfterHeader = res.headers.get('Retry-After');
      let waitMs = 1500;
      if (retryAfterHeader) {
        const parsedSec = Number.parseInt(retryAfterHeader, 10);
        if (!Number.isNaN(parsedSec)) {
          waitMs = Math.min(parsedSec * 1000, 10000);
        }
      }
      if (attempt <= 2) {
        console.warn(`[IVLA wikimedia] Rate limited (${res.status}), waiting ${waitMs}ms before retry...`);
        await new Promise((r) => setTimeout(r, waitMs));
        return fetchCommons(params, attempt + 1);
      }
      throw new AiError(
        AI_CODES.BUSY,
        'Wikimedia Commons is busy. Please try again in a few moments.',
        { status: 503, retryable: true }
      );
    }

    if (!res.ok) {
      throw new AiError(
        AI_CODES.BAD_RESPONSE,
        `Wikimedia Commons returned HTTP ${res.status}`,
        { status: 502, retryable: true }
      );
    }

    const data = await res.json();
    return data;
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError(
      AI_CODES.NETWORK,
      'Could not reach Wikimedia Commons. Check internet connectivity.',
      { status: 502, retryable: true }
    );
  } finally {
    wikimediaSemaphore.release();
  }
}

/**
 * Lightweight heuristic scoring for an educational image result.
 */
function scoreImage(item, queryWords) {
  let score = 0;
  const title = (item.title || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  const cats = (item.categories || '').toLowerCase();

  // 1. Keyword relevance in title and description
  for (const word of queryWords) {
    if (word.length <= 2) continue;
    if (title.includes(word)) score += 8;
    if (desc.includes(word)) score += 4;
    if (cats.includes(word)) score += 3;
  }

  // 2. English / international label preference (slight bump for en labels or unlocalized)
  if (title.includes('-en') || title.includes('_en') || title.includes(' en.') || !title.match(/-[a-z]{2}\./)) {
    score += 5;
  }

  // 3. Strong educational preference: diagrams, illustrations, charts, schemas
  const educationalIndicators = [
    'diagram', 'schema', 'illustration', 'cross-section', 'anatomy',
    'structure', 'cycle', 'chart', 'flowchart', 'infographic', 'drawing',
    'educational', 'labeled'
  ];
  for (const ind of educationalIndicators) {
    if (title.includes(ind)) score += 10;
    if (desc.includes(ind)) score += 6;
    if (cats.includes(ind)) score += 5;
  }

  // 4. File type preference: SVG is crisp & ideal for diagrams, PNG next
  if (title.endsWith('.svg')) score += 14;
  else if (title.endsWith('.png')) score += 8;
  else if (title.endsWith('.jpg') || title.endsWith('.jpeg')) score += 4;
  else if (title.endsWith('.webp')) score += 3;

  // 5. Resolution preference: favor clear, readable images; penalize tiny ones
  const w = item.width || 0;
  const h = item.height || 0;
  if (w >= 600 && h >= 400) score += 6;
  if (w < 200 || h < 200) score -= 20;

  // 6. Penalize non-educational indicators & noise
  const noiseIndicators = ['stamp', 'coin', 'monument', 'plaque', 'tombstone', 'signature', 'logo', 'portrait', 'tomb', 'gravestone'];
  for (const noise of noiseIndicators) {
    if (title.includes(noise)) score -= 15;
  }

  // 7. License presence bonus
  if (item.license && item.license !== 'Unknown') score += 4;

  return score;
}

/**
 * Execute search query against Wikimedia Commons API and extract parsed image candidates.
 */
async function queryCommonsPages(searchQuery) {
  const params = {
    action: 'query',
    generator: 'search',
    gsrsearch: searchQuery,
    gsrnamespace: '6', // File: namespace
    gsrlimit: '20',    // Request 20 candidates for filtering and ranking
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size',
    iiurlwidth: '800', // Request 800px width thumbnail
    format: 'json',
  };

  const data = await fetchCommons(params);
  const pages = Object.values(data?.query?.pages || {});
  return pages;
}

/**
 * Search Wikimedia Commons and return ranked, standardized visual discovery results.
 * @param {string} query Search terms
 * @param {number} limit Maximum results to return (default 4)
 * @param {string} fallbackQuery Optional secondary query if primary has 0 valid image results
 * @returns {Promise<{ results: Array<StandardizedImage>, totalFound: number, activeQuery: string }>}
 */
export async function searchWikimediaCommons(query, limit = 4, fallbackQuery = '') {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return { results: [], totalFound: 0, activeQuery: '' };

  const cacheId = cacheKey(['wikimedia-commons-v2', cleanQuery, fallbackQuery, limit]);

  const { value } = await deduped(cacheId, async () => {
    let pages = await queryCommonsPages(cleanQuery);
    let activeQuery = cleanQuery;

    // Filter to valid image extensions (exclude PDF, DjVu, audio, video)
    let imagePages = pages.filter((p) => {
      const lower = (p.title || '').toLowerCase();
      return ALLOWED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
    });

    // If 0 image files found and fallbackQuery exists, query with fallback
    if (imagePages.length === 0 && fallbackQuery && fallbackQuery.toLowerCase() !== cleanQuery.toLowerCase()) {
      const fallbackPages = await queryCommonsPages(fallbackQuery);
      const fallbackImages = fallbackPages.filter((p) => {
        const lower = (p.title || '').toLowerCase();
        return ALLOWED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
      });
      if (fallbackImages.length > 0) {
        imagePages = fallbackImages;
        activeQuery = fallbackQuery;
      }
    }

    if (imagePages.length === 0) {
      return { results: [], totalFound: 0, activeQuery };
    }

    const queryWords = activeQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const parsedItems = [];
    const seenUrls = new Set();

    for (const page of imagePages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;

      // Ensure valid image URL
      const thumbnailUrl = info.thumburl || info.url;
      const imageUrl = info.url || thumbnailUrl;
      if (!thumbnailUrl || !imageUrl) continue;

      // Deduplicate exact images
      if (seenUrls.has(imageUrl)) continue;
      seenUrls.add(imageUrl);

      // Extract metadata
      const ext = info.extmetadata || {};
      const rawTitle = page.title || '';
      // Strip "File:" prefix
      const title = rawTitle.replace(/^File:/i, '').replace(/_/g, ' ');

      const desc = cleanHtml(ext.ImageDescription?.value || ext.ObjectName?.value || '');
      const categories = cleanHtml(ext.Categories?.value || '');
      const creator = cleanHtml(ext.Artist?.value || ext.Credit?.value || 'Wikimedia Commons contributor');
      const license = ext.LicenseShortName?.value || ext.UsageTerms?.value || ext.License?.value || 'Creative Commons';
      const licenseUrl = ext.LicenseUrl?.value || 'https://commons.wikimedia.org';
      const pageUrl = info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`;
      const attribution = cleanHtml(ext.Attribution?.value || `${title} by ${creator} (${license})`);

      const item = {
        id: `commons_${page.pageid || Math.abs(page.title.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))}`,
        title,
        description: desc,
        categories,
        thumbnailUrl,
        imageUrl,
        pageUrl,
        width: info.width || info.thumbwidth || 800,
        height: info.height || info.thumbheight || 600,
        thumbWidth: info.thumbwidth || 800,
        thumbHeight: info.thumbheight || 600,
        creator: creator.slice(0, 150),
        license: license.slice(0, 80),
        licenseUrl,
        attribution: attribution.slice(0, 250),
        source: 'Wikimedia Commons',
      };

      item._score = scoreImage(item, queryWords);
      parsedItems.push(item);
    }

    // Sort descending by score
    parsedItems.sort((a, b) => b._score - a._score);

    // Pick top high-quality results
    const topResults = parsedItems.slice(0, limit).map((item) => {
      const { _score, description, categories, thumbWidth, thumbHeight, ...clean } = item;
      return clean;
    });

    return {
      results: topResults,
      totalFound: parsedItems.length,
      activeQuery,
    };
  });

  return value;
}
