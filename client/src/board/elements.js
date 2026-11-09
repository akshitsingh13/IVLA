// Element model: board state is a LIST OF TYPED ELEMENTS, never raw pixels.
// New element types (text, shape, image) can be added without breaking old ones.

let _counter = 0;
export function uid(prefix = 'el') {
  _counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_counter}`;
}

/**
 * { id, type: 'stroke', points: [{x, y, pressure}], color, width }
 */
export function createStroke(points, color = '#111111', width = 4) {
  return { id: uid('stroke'), type: 'stroke', points: points.slice(), color, width };
}

/**
 * { id, type: 'shape', shape: 'rect'|'ellipse'|'line'|'arrow', x1, y1, x2, y2, color, width }
 */
export function createShape(shape, x1, y1, x2, y2, color = '#111111', width = 4) {
  return { id: uid('shape'), type: 'shape', shape, x1, y1, x2, y2, color, width };
}

/** { id, type: 'text', x, y, text, fontSize, color } */
export function createText(x, y, text, fontSize = 24, color = '#111111') {
  return { id: uid('text'), type: 'text', x, y, text, fontSize, color };
}

/** { id, type: 'image', x, y, w, h, src, meta } */
export function createImage(x, y, w, h, src, meta = null) {
  return { id: uid('img'), type: 'image', x, y, w, h, src, ...(meta ? { meta } : {}) };
}

/** Normalized bounding box { x, y, w, h } for any element. Used for select highlight. */
export function getElementBounds(el) {
  if (!el || typeof el !== 'object') return null;
  switch (el.type) {
    case 'stroke': {
      if (!el.points || el.points.length === 0) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of el.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const pad = (el.width || 4) / 2 + 4;
      return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
    }
    case 'shape': {
      const pad = (el.width || 4) / 2 + 4;
      const x = Math.min(el.x1, el.x2) - pad;
      const y = Math.min(el.y1, el.y2) - pad;
      const w = Math.abs(el.x2 - el.x1) + pad * 2;
      const h = Math.abs(el.y2 - el.y1) + pad * 2;
      // Lines/arrows are thin in one axis; guarantee a minimum hit box.
      return { x, y, w: Math.max(w, 12), h: Math.max(h, 12) };
    }
    case 'text': {
      // Wrapped layout shared with the renderer, so the box matches exactly.
      const layout = layoutText(el.text, el.fontSize || 24);
      return { x: el.x - 6, y: el.y - (el.fontSize || 24) - 6, w: layout.width + 12, h: layout.height + 12 };
    }
    case 'image': {
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    }
    default:
      return null;
  }
}

/** Immutable move: returns a NEW element translated by (dx, dy). */
export function moveElement(el, dx, dy) {
  if (!el) return el;
  switch (el.type) {
    case 'stroke':
      return {
        ...el,
        points: el.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
      };
    case 'shape':
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case 'text':
    case 'image':
      return { ...el, x: el.x + dx, y: el.y + dy };
    default:
      return el;
  }
}

/** Deep-clone an elements array (elements are treated as immutable snapshots). */
export function cloneElements(elements) {  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(elements);
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(elements));
}

/** Max wrapped text width in CSS px (classroom-readable column). */
export const TEXT_MAX_WIDTH = 360;

let _measureCtx = null;
function measureCtx() {
  if (!_measureCtx && typeof document !== 'undefined') {
    try {
      _measureCtx = document.createElement('canvas').getContext('2d');
    } catch {
      _measureCtx = null;
    }
  }
  return _measureCtx;
}

function measureWord(word, font) {
  const ctx = measureCtx();
  if (ctx) {
    ctx.font = font;
    try {
      return ctx.measureText(word).width;
    } catch {
      /* fall through to estimate */
    }
  }
  // No DOM (e.g. Node probes): estimate ~0.55em per character.
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1]) || 24;
  return word.length * size * 0.55;
}

/**
 * Word-wrap text into lines. Shared by the renderer and getElementBounds so
 * the selection box matches the drawn text exactly.
 * Returns { lines, width, height, lineHeight }.
 */
export function layoutText(text, fontSize = 24, maxWidth = TEXT_MAX_WIDTH) {
  const size = fontSize || 24;
  const font = `${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const spaceW = measureWord(' ', font) || size * 0.3;
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  let curW = 0;
  const push = () => {
    if (cur) lines.push(cur);
    cur = '';
    curW = 0;
  };
  for (let w of words) {
    // Break pathological single long words so they fit the column.
    while (measureWord(w, font) > maxWidth && w.length > 1) {
      let cut = 1;
      while (cut < w.length && measureWord(w.slice(0, cut + 1), font) <= maxWidth) cut += 1;
      if (curW > 0) push();
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const wW = measureWord(w, font);
    const addW = curW > 0 ? spaceW + wW : wW;
    if (curW > 0 && curW + addW > maxWidth) push();
    cur = cur ? `${cur} ${w}` : w;
    curW = curW > 0 ? curW + spaceW + wW : wW;
  }
  push();
  if (lines.length === 0) lines.push('');
  const lineHeight = size * 1.25;
  let width = 0;
  for (const line of lines) width = Math.max(width, measureWord(line, font));
  width = Math.min(maxWidth, width);
  // First baseline sits at y; ascent ~1em above, then one lineHeight per extra line.
  const height = size + lineHeight * (lines.length - 1) + 4;
  return { lines, width, height, lineHeight };
}
