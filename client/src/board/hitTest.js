// Hit-testing for the stroke eraser + select tool.
import { getElementBounds } from './elements.js';

// Point-to-segment distance: project p onto segment ab, clamp t to [0,1],
// then measure Euclidean distance. Standard closest-point-on-segment math.
export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function hitStroke(el, x, y, tolerance) {
  const pts = el.points || [];
  const tol = tolerance + (el.width || 4) / 2;
  for (let i = 0; i < pts.length; i++) {
    if (Math.hypot(x - pts[i].x, y - pts[i].y) <= tol) return true;
    if (i > 0) {
      const d = pointToSegmentDistance(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      if (d <= tol) return true;
    }
  }
  return false;
}

function nearRectEdge(el, x, y, tolerance) {
  const x1 = Math.min(el.x1, el.x2);
  const x2 = Math.max(el.x1, el.x2);
  const y1 = Math.min(el.y1, el.y2);
  const y2 = Math.max(el.y1, el.y2);
  const tol = tolerance + (el.width || 4) / 2;
  // Distance to each of the 4 edges.
  const edges = [
    [x1, y1, x2, y1],
    [x2, y1, x2, y2],
    [x2, y2, x1, y2],
    [x1, y2, x1, y1],
  ];
  return edges.some(([ax, ay, bx, by]) => pointToSegmentDistance(x, y, ax, ay, bx, by) <= tol);
}

function nearEllipseEdge(el, x, y, tolerance) {
  const cx = (el.x1 + el.x2) / 2;
  const cy = (el.y1 + el.y2) / 2;
  const rx = Math.abs(el.x2 - el.x1) / 2;
  const ry = Math.abs(el.y2 - el.y1) / 2;
  if (rx < 1 || ry < 1) {
    return Math.hypot(x - cx, y - cy) <= tolerance + 4;
  }
  // Normalized ellipse radius of the point: 1.0 == exactly on the edge.
  const norm = Math.hypot((x - cx) / rx, (y - cy) / ry);
  // Convert pixel tolerance to normalized units using the smaller radius.
  const tolNorm = (tolerance + (el.width || 4) / 2) / Math.min(rx, ry);
  return Math.abs(norm - 1) <= Math.max(tolNorm, 0.08);
}

/**
 * Does point (x, y) touch element geometry? Tolerance in CSS px.
 */
export function hitTestElement(el, x, y, tolerance = 8) {
  if (!el) return false;
  switch (el.type) {
    case 'stroke':
      return hitStroke(el, x, y, tolerance);
    case 'shape': {
      const w = el.width || 4;
      switch (el.shape) {
        case 'rect':
          return nearRectEdge(el, x, y, tolerance);
        case 'ellipse':
          return nearEllipseEdge(el, x, y, tolerance);
        case 'line':
        case 'arrow':
          return pointToSegmentDistance(x, y, el.x1, el.y1, el.x2, el.y2) <= tolerance + w / 2;
        default:
          return false;
      }
    }
    case 'text': {
      // Wrapped text box (same layout the renderer draws); small tolerance.
      const b = getElementBounds(el);
      if (!b) return false;
      const t = tolerance * 0.75;
      return x >= b.x - t && x <= b.x + b.w + t && y >= b.y - t && y <= b.y + b.h + t;
    }
    case 'image':
      return x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h;
    default:
      return false;
  }
}

/** Topmost element under the point (elements drawn later are on top). */
export function hitTestElements(elements, x, y, tolerance = 8) {
  if (!Array.isArray(elements)) return null;
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTestElement(elements[i], x, y, tolerance)) return elements[i];
  }
  return null;
}
