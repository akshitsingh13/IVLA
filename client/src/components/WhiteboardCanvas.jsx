import { useEffect, useRef } from 'react';
import { drawElement } from '../board/renderer.js';
import { drawBackground } from '../board/backgrounds.js';
import { createStroke, createShape, getElementBounds, moveElement } from '../board/elements.js';
import { hitTestElement, hitTestElements } from '../board/hitTest.js';

const ERASER_TOLERANCE = 10;
const ERASER_CURSOR_R = 12;
const ACCENT = '#4f46e5'; // lasso accent (indigo)

/**
 * WhiteboardCanvas — owns the <canvas>, DPR scaling, pointer handling and
 * all transient (in-progress) drawing. Committed state lives in App.
 *
 * Props:
 *  elements, tool, color, width, shapeKind, selectedId, lassoPath,
 *  onAddElement(el), onLiveElements(next), onLiveCommit(),
 *  onSelect(id|null), onLassoStart(), onLassoComplete(points),
 *  eraserHoverRef? (internal)
 */
export default function WhiteboardCanvas({
  elements,
  background = 'white',
  tool,
  color,
  width,
  shapeKind,
  selectedId,
  lassoPath,
  onAddElement,
  onLiveElements,
  onLiveCommit,
  onSelect,
  onLassoStart,
  onLassoComplete,
}) {
  const canvasRef = useRef(null);
  // Cached dual-snapshot of committed elements for 60fps in-progress rendering and layer ordering:
  // bgSnap: background + committed highlighters (underneath)
  // fgSnap: committed foreground elements (pens, pencils, shapes, text, images) on transparent canvas
  const bgSnapRef = useRef(null);
  const fgSnapRef = useRef(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const backgroundRef = useRef(background);
  backgroundRef.current = background;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const lassoPathRef = useRef(lassoPath);
  lassoPathRef.current = lassoPath;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const activePointerRef = useRef(null); // pointerId currently drawing
  const strokeRef = useRef(null); // in-progress pen/pencil/highlighter points
  const shapeStartRef = useRef(null); // { x, y }
  const shapeCurrentRef = useRef(null); // { x, y } live end
  const erasingRef = useRef(false);
  const erasedLiveRef = useRef(null); // elements array during eraser drag
  const lassoActiveRef = useRef(null); // in-progress lasso points
  const selectDragRef = useRef(null); // { id, startX, startY, orig, moved }
  const hoverRef = useRef(null); // eraser cursor pos {x,y} | null
  const dashOffsetRef = useRef(0);
  const rafRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const callbacksRef = useRef({});
  callbacksRef.current = {
    onAddElement,
    onLiveElements,
    onLiveCommit,
    onSelect,
    onLassoStart,
    onLassoComplete,
  };

  // ---------- sizing / DPR ----------
  const refreshSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = sizeRef.current;
    if (w <= 0 || h <= 0) return;
    const dpr = window.devicePixelRatio || 1;

    // 1. Snapshot background + committed highlighters
    const bgSnap = bgSnapRef.current;
    if (bgSnap) {
      const bgCtx = bgSnap.getContext('2d');
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackground(bgCtx, w, h, backgroundRef.current);
      for (const el of elementsRef.current) {
        if (el?.type === 'stroke' && el?.toolType === 'highlighter') {
          drawElement(bgCtx, el);
        }
      }
    }

    // 2. Snapshot foreground elements (pens, pencils, text, shapes, images)
    const fgSnap = fgSnapRef.current;
    if (fgSnap) {
      const fgCtx = fgSnap.getContext('2d');
      fgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fgCtx.clearRect(0, 0, w, h);
      for (const el of elementsRef.current) {
        if (!(el?.type === 'stroke' && el?.toolType === 'highlighter')) {
          drawElement(fgCtx, el);
        }
      }
    }
  };

  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w, h } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bgSnap = bgSnapRef.current;
    const fgSnap = fgSnapRef.current;

    // 1. Base: background + committed highlighters
    if (bgSnap && bgSnap.width > 0) {
      ctx.drawImage(bgSnap, 0, 0, w, h);
    } else {
      drawBackground(ctx, w, h, backgroundRef.current);
      for (const el of elementsRef.current) {
        if (el?.type === 'stroke' && el?.toolType === 'highlighter') {
          drawElement(ctx, el);
        }
      }
    }

    // 2. In-progress highlighter stroke: drawn UNDERNEATH foreground elements
    const activeStroke = strokeRef.current;
    if (activeStroke && activeStroke.length > 0 && activeStroke.toolType === 'highlighter') {
      drawElement(ctx, {
        type: 'stroke',
        toolType: 'highlighter',
        points: activeStroke,
        color: activeStroke.color || colorRef.current,
        width: activeStroke.width || widthRef.current,
      });
    }

    // 3. Foreground committed elements (pens, pencils, shapes, text, images)
    if (fgSnap && fgSnap.width > 0) {
      ctx.drawImage(fgSnap, 0, 0, w, h);
    } else {
      for (const el of elementsRef.current) {
        if (!(el?.type === 'stroke' && el?.toolType === 'highlighter')) {
          drawElement(ctx, el);
        }
      }
    }

    // 4. In-progress pen or pencil stroke: drawn ON TOP of foreground elements
    if (activeStroke && activeStroke.length > 0 && activeStroke.toolType !== 'highlighter') {
      drawElement(ctx, {
        type: 'stroke',
        toolType: activeStroke.toolType || 'pen',
        points: activeStroke,
        color: activeStroke.color || colorRef.current,
        width: activeStroke.width || widthRef.current,
      });
    }

    // 5. Live shape preview
    if (shapeStartRef.current && shapeCurrentRef.current) {
      const s = shapeStartRef.current;
      const c = shapeCurrentRef.current;
      drawElement(ctx, {
        type: 'shape',
        shape: shapeKindRef.current,
        x1: s.x,
        y1: s.y,
        x2: c.x,
        y2: c.y,
        color: colorRef.current,
        width: widthRef.current,
      });
    }
    // Selection highlight: dashed bounding box.
    const selId = selectedRef.current;
    if (selId) {
      const el = elementsRef.current.find((e) => e.id === selId);
      if (el) {
        const b = getElementBounds(el);
        if (b) {
          ctx.save();
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(b.x, b.y, b.w, b.h);
          ctx.restore();
        }
      }
    }
    // Committed lasso overlay: closed path, translucent fill + marching ants.
    const committed = lassoPathRef.current;
    if (committed && committed.length > 1) {
      drawLassoPath(ctx, committed, true);
    }
    // Active (in-progress) lasso path.
    if (lassoActiveRef.current && lassoActiveRef.current.length > 1) {
      drawLassoPath(ctx, lassoActiveRef.current, false);
    }
    // Eraser cursor outline.
    if (toolRef.current === 'eraser' && hoverRef.current) {
      ctx.save();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hoverRef.current.x, hoverRef.current.y, ERASER_CURSOR_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  };

  const drawLassoPath = (ctx, points, closed) => {
    ctx.save();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -dashOffsetRef.current;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    if (closed) ctx.closePath();
    ctx.stroke();
    if (closed) {
      ctx.fillStyle = 'rgba(79, 70, 229, 0.08)';
      ctx.fill();
    }
    ctx.restore();
  };

  const colorRef = useRef(color);
  colorRef.current = color;
  const widthRef = useRef(width);
  widthRef.current = width;
  const shapeKindRef = useRef(shapeKind);
  shapeKindRef.current = shapeKind;

  // Resize: scale backing store for hi-DPI, re-render from elements (no loss).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      sizeRef.current = { w, h };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (!bgSnapRef.current) bgSnapRef.current = document.createElement('canvas');
      bgSnapRef.current.width = canvas.width;
      bgSnapRef.current.height = canvas.height;
      if (!fgSnapRef.current) fgSnapRef.current = document.createElement('canvas');
      fgSnapRef.current.width = canvas.width;
      fgSnapRef.current.height = canvas.height;
      refreshSnapshot();
      drawFrame();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render snapshot whenever committed elements or background change.
  useEffect(() => {
    refreshSnapshot();
    drawFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, lassoPath, selectedId, background]);

  // Redraw when a board image finishes decoding (renderer caches Image
  // objects; without this a fresh image would wait for the next interaction).
  useEffect(() => {
    const onImg = () => {
      refreshSnapshot();
      drawFrame();
    };
    window.addEventListener('ivla-image-loaded', onImg);
    return () => window.removeEventListener('ivla-image-loaded', onImg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marching-ants animation: rAF loop only while a lasso is visible.
  useEffect(() => {
    const needLoop =
      (lassoPath && lassoPath.length > 1) || tool === 'ai';
    if (!needLoop) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      dashOffsetRef.current += 0.6;
      drawFrame();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lassoPath, tool]);

  const canvasPos = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const eachPointerPoint = (e, fn) => {
    // getCoalescedEvents keeps fast strokes smooth by exposing intermediate points.
    const native = e.nativeEvent;
    const coalesced =
      native && typeof native.getCoalescedEvents === 'function'
        ? native.getCoalescedEvents()
        : null;
    if (coalesced && coalesced.length > 0) {
      for (const ce of coalesced) {
        const p = canvasPos(ce.clientX, ce.clientY);
        fn(p, ce);
      }
    } else {
      fn(canvasPos(e.clientX, e.clientY), e);
    }
  };

  const pressureFor = (e) => {
    // Use pressure only for real pens; otherwise constant width.
    if (e.pointerType === 'pen' && typeof e.pressure === 'number' && e.pressure > 0) {
      return e.pressure;
    }
    return 1;
  };

  // ---------- pointer handlers ----------
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button > 0) return; // ignore secondary buttons
    if (activePointerRef.current !== null) return; // multi-touch: first pointer only
    const canvas = canvasRef.current;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    activePointerRef.current = e.pointerId;
    const cb = callbacksRef.current;
    const t = toolRef.current;
    const start = canvasPos(e.clientX, e.clientY);

    if (t === 'pen' || t === 'pencil' || t === 'highlighter') {
      strokeRef.current = [];
      strokeRef.current.toolType = t;
      strokeRef.current.color = colorRef.current;
      strokeRef.current.width = widthRef.current;
      eachPointerPoint(e, (p, ev) => {
        strokeRef.current.push({ x: p.x, y: p.y, pressure: pressureFor(ev) });
      });
      drawFrame();
    } else if (t === 'shape') {
      shapeStartRef.current = start;
      shapeCurrentRef.current = start;
      drawFrame();
    } else if (t === 'eraser') {
      erasingRef.current = true;
      erasedLiveRef.current = elementsRef.current;
      // Erase at the down point immediately (tap-erase works without moving).
      eraseAt(start.x, start.y);
    } else if (t === 'select') {
      const hit = hitTestElements(elementsRef.current, start.x, start.y, 8);
      if (hit) {
        cb.onSelect(hit.id);
        selectDragRef.current = {
          id: hit.id,
          startX: start.x,
          startY: start.y,
          lastX: start.x,
          lastY: start.y,
          moved: false,
          orig: elementsRef.current,
        };
      } else {
        cb.onSelect(null);
        selectDragRef.current = null;
      }
    } else if (t === 'ai') {
      cb.onLassoStart();
      lassoActiveRef.current = [start];
      dashOffsetRef.current = 0;
      drawFrame();
    }
  };

  const eraseAt = (x, y) => {
    const cb = callbacksRef.current;
    const current = erasedLiveRef.current || elementsRef.current;
    const next = current.filter((el) => !hitTestElement(el, x, y, ERASER_TOLERANCE));
    if (next.length !== current.length) {
      erasedLiveRef.current = next;
      cb.onLiveElements(next);
    }
  };

  const onPointerMove = (e) => {
    const t = toolRef.current;
    // Eraser hover cursor (no buttons pressed).
    if (t === 'eraser' && activePointerRef.current === null) {
      hoverRef.current = canvasPos(e.clientX, e.clientY);
      drawFrame();
      return;
    }
    if (e.pointerId !== activePointerRef.current) return;
    const cb = callbacksRef.current;

    if ((t === 'pen' || t === 'pencil' || t === 'highlighter') && strokeRef.current) {
      eachPointerPoint(e, (p, ev) => {
        strokeRef.current.push({ x: p.x, y: p.y, pressure: pressureFor(ev) });
      });
      drawFrame();
    } else if (t === 'shape' && shapeStartRef.current) {
      shapeCurrentRef.current = canvasPos(e.clientX, e.clientY);
      drawFrame();
    } else if (t === 'eraser' && erasingRef.current) {
      hoverRef.current = canvasPos(e.clientX, e.clientY);
      eachPointerPoint(e, (p) => eraseAt(p.x, p.y));
      drawFrame();
    } else if (t === 'select' && selectDragRef.current) {
      const d = selectDragRef.current;
      const p = canvasPos(e.clientX, e.clientY);
      const dx = p.x - d.lastX;
      const dy = p.y - d.lastY;
      if (dx !== 0 || dy !== 0) {
        d.moved = true;
        d.lastX = p.x;
        d.lastY = p.y;
        const cur = elementsRef.current;
        const updated = cur.map((el) => (el.id === d.id ? moveElement(el, dx, dy) : el));
        cb.onLiveElements(updated);
      }
    } else if (t === 'ai' && lassoActiveRef.current) {
      eachPointerPoint(e, (p) => {
        lassoActiveRef.current.push(p);
      });
      drawFrame();
    }
  };

  const endPointer = (e, cancelled) => {
    if (e.pointerId !== activePointerRef.current) return;
    activePointerRef.current = null;
    const cb = callbacksRef.current;
    const t = toolRef.current;

    if ((t === 'pen' || t === 'pencil' || t === 'highlighter') && strokeRef.current) {
      const pts = strokeRef.current;
      const toolType = pts.toolType || t;
      strokeRef.current = null;
      if (!cancelled && pts.length > 0) {
        const el = createStroke(pts, pts.color || colorRef.current, pts.width || widthRef.current, toolType);
        cb.onAddElement(el);
      } else {
        drawFrame();
      }
    } else if (t === 'shape') {
      const s = shapeStartRef.current;
      const c = shapeCurrentRef.current;
      shapeStartRef.current = null;
      shapeCurrentRef.current = null;
      if (!cancelled && s && c) {
        // Ignore zero-size shapes (accidental taps).
        if (Math.hypot(c.x - s.x, c.y - s.y) >= 4) {
          const el = createShape(
            shapeKindRef.current,
            s.x,
            s.y,
            c.x,
            c.y,
            colorRef.current,
            widthRef.current
          );
          cb.onAddElement(el);
        } else {
          drawFrame();
        }
      } else {
        drawFrame();
      }
    } else if (t === 'eraser') {
      erasingRef.current = false;
      hoverRef.current = null;
      if (!cancelled) cb.onLiveCommit(); // whole drag = ONE undo step
      erasedLiveRef.current = null;
      drawFrame();
    } else if (t === 'select') {
      const d = selectDragRef.current;
      selectDragRef.current = null;
      if (d && d.moved && !cancelled) cb.onLiveCommit(); // a move = one undo step
      drawFrame();
    } else if (t === 'ai') {
      const path = lassoActiveRef.current;
      lassoActiveRef.current = null;
      if (!cancelled && path && path.length > 0) {
        cb.onLassoComplete(path);
      } else {
        drawFrame();
      }
    }
  };

  const onPointerUp = (e) => endPointer(e, false);
  const onPointerCancel = (e) => endPointer(e, true);

  return (
    <canvas
      ref={canvasRef}
      className="ivla-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
