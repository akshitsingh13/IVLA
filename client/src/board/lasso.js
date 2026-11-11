// Lasso (AI Circle) helpers: pure + testable. DOM canvas is only touched inside
// captureRegion, which renders board elements clipped to the lasso path.

import { renderAll } from './renderer.js';
import { drawBackground } from './backgrounds.js';
import { getElementBounds } from './elements.js';

export const LASSO_MIN_POINTS = 10;
export const LASSO_MIN_SIZE = 40; // CSS px per side
export const LASSO_MIN_LENGTH = 120; // total path length in CSS px
export const LASSO_PADDING = 12; // capture padding in CSS px
export const CAPTURE_MAX_SIDE = 1024; // longest output side in px

export function pathLength(points) {
  if (!points || points.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/** Reject accidental lassos: too few points, tiny box, or too-short path. */
export function isValidLasso(points) {
  if (!points || points.length < LASSO_MIN_POINTS) return false;
  const b = getBounds(points, 0);
  if (!b) return false;
  if (b.w < LASSO_MIN_SIZE || b.h < LASSO_MIN_SIZE) return false;
  if (pathLength(points) < LASSO_MIN_LENGTH) return false;
  return true;
}

/**
 * Bounding box of a point path with padding, optionally clamped to canvas.
 * Returns { x, y, w, h } in CSS px.
 */
export function getBounds(points, padding = LASSO_PADDING, canvasSize = null) {
  if (!points || points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = padding || 0;
  let x = minX - pad;
  let y = minY - pad;
  let w = maxX - minX + pad * 2;
  let h = maxY - minY + pad * 2;
  if (canvasSize) {
    // Clamp to the canvas so we never capture outside the board.
    x = Math.max(0, x);
    y = Math.max(0, y);
    w = Math.min(canvasSize.w - x, w);
    h = Math.min(canvasSize.h - y, h);
  }
  return { x, y, w: Math.max(0, w), h: Math.max(0, h) };
}

function tracePath(ctx, path, dx = 0, dy = 0) {
  ctx.beginPath();
  path.forEach((p, i) => {
    const x = p.x + dx;
    const y = p.y + dy;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath(); // auto-close: connect last point to first
}

/**
 * Capture the lasso region as a PNG data URL.
 * - Fills white first, clips to the lasso path (outside stays white),
 *   renders only board elements (never the lasso overlay / UI).
 * - Crops to the padded bounding box, downscales so longest side <= 1024.
 * - Detects empty captures (every pixel white).
 * Returns { dataUrl, bounds, isEmpty }.
 */
export function captureRegion(elements, path, canvasSize, dpr = 1, background = 'white') {
  const bounds = getBounds(path, LASSO_PADDING, canvasSize);
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) {
    return { dataUrl: null, bounds, isEmpty: true };
  }
  if (typeof document === 'undefined') {
    return { dataUrl: null, bounds, isEmpty: true };
  }

  // Quick check: if no elements are inside the lasso bounds, mark empty immediately.
  const hasIntersectingElements = (elements || []).some((el) => {
    const eb = getElementBounds(el);
    if (!eb) return false;
    return (
      eb.x <= bounds.x + bounds.w &&
      eb.x + eb.w >= bounds.x &&
      eb.y <= bounds.y + bounds.h &&
      eb.y + eb.h >= bounds.y
    );
  });
  if (!hasIntersectingElements) {
    return { dataUrl: null, bounds: { ...bounds }, isEmpty: true };
  }

  const scale = Math.max(1, dpr || 1);

  // Offscreen canvas sized to the cropped bounds (device pixels).
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.round(bounds.w * scale));
  off.height = Math.max(1, Math.round(bounds.h * scale));
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { dataUrl: null, bounds, isEmpty: true };

  // Work in CSS px: scale for DPR, then shift so bounds origin is (0,0).
  ctx.scale(scale, scale);
  ctx.translate(-bounds.x, -bounds.y);

  // Outer fill
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);

  // Clip to the closed lasso path: everything outside stays white, which
  // masks surrounding noise so a vision model only sees circled content.
  tracePath(ctx, path);
  ctx.clip();

  // Draw background inside the clip
  const canvasW = canvasSize ? canvasSize.w : bounds.x + bounds.w;
  const canvasH = canvasSize ? canvasSize.h : bounds.y + bounds.h;
  drawBackground(ctx, canvasW, canvasH, background);

  // Render board elements
  renderAll(ctx, elements || []);
  ctx.restore();

  // Downscale if the longest side exceeds the cap.
  let out = off;
  const longest = Math.max(off.width, off.height);
  if (longest > CAPTURE_MAX_SIDE) {
    const k = CAPTURE_MAX_SIDE / longest;
    const small = document.createElement('canvas');
    small.width = Math.round(off.width * k);
    small.height = Math.round(off.height * k);
    const sctx = small.getContext('2d');
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, small.width, small.height);
    sctx.drawImage(off, 0, 0, small.width, small.height);
    out = small;
  }

  const dataUrl = out.toDataURL('image/png');
  return { dataUrl, bounds: { ...bounds }, isEmpty: false };
}
