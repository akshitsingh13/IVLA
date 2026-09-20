// Canvas rendering. Single dispatch: drawElement(ctx, element).
import { layoutText } from './elements.js';

// Cache for <img> objects keyed by src so image elements render once loaded.
const _imageCache = new Map();

function getCachedImage(src) {
  if (!src) return null;
  let entry = _imageCache.get(src);
  if (!entry) {
    const img = new Image();
    // Decoded once and cached; when pixels arrive, tell the board to
    // re-render so the image appears without needing another interaction.
    img.onload = () => {
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('ivla-image-loaded'));
        }
      } catch {
        /* noop */
      }
    };
    img.src = src;
    entry = img;
    _imageCache.set(src, img);
  }
  return entry;
}

/**
 * Draw one element. Unknown types are skipped safely, never crash.
 */
export function drawElement(ctx, element) {
  if (!ctx || !element || typeof element !== 'object') return;
  try {
    switch (element.type) {
      case 'stroke':
        drawStroke(ctx, element.points, element.color, element.width);
        break;
      case 'shape':
        drawShape(ctx, element);
        break;
      case 'text':
        drawText(ctx, element);
        break;
      case 'image':
        drawImageEl(ctx, element);
        break;
      default:
        // Unknown type: skip safely for forward-compat.
        break;
    }
  } catch {
    // Never let one bad element break the whole board render.
  }
}

export function renderAll(ctx, elements) {
  if (!ctx || !Array.isArray(elements)) return;
  for (const el of elements) drawElement(ctx, el);
}

// --- strokes ---
// Smoothing: quadratic curves through segment midpoints. This turns the
// polyline into a smooth path instead of jagged straight segments.
function drawStroke(ctx, points, color = '#111111', width = 4) {
  if (!points || points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length === 1) {
    const p = points[0];
    const r = (width * pressureOf(p)) / 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(r, 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (points.length === 2) {
    ctx.lineWidth = Math.max(0.5, width * pressureOf(points[1]));
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 3+ points: draw segment-by-segment so per-point pressure can vary the
  // width, using midpoints as quadratic anchors for smoothness.
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = mid(points[i - 1], points[i]);
    const p1 = mid(points[i], points[i + 1]);
    const w = width * pressureOf(points[i]);
    ctx.lineWidth = Math.max(0.5, w);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(points[i].x, points[i].y, p1.x, p1.y);
    ctx.stroke();
  }
  // Final tail segment to the last point.
  const n = points.length;
  const tailW = width * pressureOf(points[n - 1]);
  ctx.lineWidth = Math.max(0.5, tailW);
  ctx.beginPath();
  const m = mid(points[n - 2], points[n - 1]);
  ctx.moveTo(m.x, m.y);
  ctx.lineTo(points[n - 1].x, points[n - 1].y);
  ctx.stroke();
  ctx.restore();
}

function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function pressureOf(p) {
  if (p && typeof p.pressure === 'number' && p.pressure > 0) {
    // Clamp pen pressure to a usable range so lines never vanish.
    return Math.min(1.5, Math.max(0.25, p.pressure));
  }
  return 1;
}

// --- shapes ---
function drawShape(ctx, el) {
  const { shape, x1, y1, x2, y2, color = '#111111', width = 4 } = el;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (shape) {
    case 'rect':
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        Math.abs(x2 - x1) / 2,
        Math.abs(y2 - y1) / 2,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      break;
    case 'line':
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;
    case 'arrow':
      drawArrow(ctx, x1, y1, x2, y2);
      break;
    default:
      break;
  }
  ctx.restore();
}

function drawArrow(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = Math.max(12, ctx.lineWidth * 3.5);
  const a1 = angle + Math.PI - Math.PI / 7;
  const a2 = angle + Math.PI + Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + headLen * Math.cos(a1), y2 + headLen * Math.sin(a1));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + headLen * Math.cos(a2), y2 + headLen * Math.sin(a2));
  ctx.stroke();
}

function drawText(ctx, el) {
  const size = el.fontSize || 24;
  ctx.save();
  ctx.fillStyle = el.color || '#111111';
  ctx.font = `${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'alphabetic';
  // Word-wrapped lines share layoutText() with getElementBounds, so the
  // selection box matches the drawn text. fillText is inherently crisp.
  const { lines, lineHeight } = layoutText(el.text, size);
  const x = el.x || 0;
  const y = el.y || 0;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * lineHeight);
  });
  ctx.restore();
}

function drawImageEl(ctx, el) {
  if (!el.src) return;
  const img = getCachedImage(el.src);
  if (!img || !img.complete || img.naturalWidth === 0) return; // drawn on next render after load
  try {
    ctx.drawImage(img, el.x, el.y, el.w, el.h);
  } catch {
    /* skip bad images */
  }
}
