import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from './components/Toolbar.jsx';
import WhiteboardCanvas from './components/WhiteboardCanvas.jsx';
import CapturePreview from './components/CapturePreview.jsx';
import { createHistory } from './board/history.js';
import { cloneElements, createText, createImage, layoutText, TEXT_MAX_WIDTH } from './board/elements.js';
import { captureRegion, isValidLasso } from './board/lasso.js';
import './App.css';

export default function App() {
  const [elements, setElements] = useState([]);
  const [tool, setToolState] = useState('pen');
  const [color, setColor] = useState('#111111');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [shapeKind, setShapeKind] = useState('rect');
  const [showOther, setShowOther] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [lassoPath, setLassoPath] = useState(null);
  const [capture, setCapture] = useState(null); // { dataUrl, bounds, path }
  const [typeOpen, setTypeOpen] = useState(false); // type-instead with NO capture
  const [toast, setToast] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0); // bump to refresh disabled states
  const [gradeLevel, setGradeLevel] = useState(() => {
    try {
      const saved = window.localStorage.getItem('ivla-grade');
      return ['auto', 'primary', 'middle', 'high', 'college'].includes(saved) ? saved : 'auto';
    } catch {
      return 'auto';
    }
  });

  const historyRef = useRef(null);
  if (!historyRef.current) historyRef.current = createHistory(100);
  const toastTimerRef = useRef(0);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  const refreshUndo = useCallback(() => {
    // Force re-render so Undo/Redo disabled states update.
    setUndoDepth((d) => d + 1);
  }, []);

  const canUndo = historyRef.current.canUndo();
  const canRedo = historyRef.current.canRedo();
  void undoDepth;

  const clearLasso = useCallback(() => {
    setLassoPath(null);
    setCapture(null);
    setTypeOpen(false);
  }, []);

  const setTool = useCallback(
    (t) => {
      // Switching tools clears the previous lasso + card.
      clearLasso();
      setSelectedId(null);
      setToolState(t);
    },
    [clearLasso]
  );

  // ---------- commit helpers ----------
  const commitElements = useCallback(
    (next) => {
      const cloned = cloneElements(next);
      setElements(cloned);
      elementsRef.current = cloned;
      historyRef.current.push(cloned);
      refreshUndo();
    },
    [refreshUndo]
  );

  const handleAddElement = useCallback(
    (el) => {
      commitElements([...elementsRef.current, el]);
    },
    [commitElements]
  );

  const handleLiveElements = useCallback((next) => {
    // Live update (eraser drag / select move) WITHOUT a history push.
    const cloned = cloneElements(next);
    setElements(cloned);
    elementsRef.current = cloned;
  }, []);

  const handleLiveCommit = useCallback(() => {
    // Push the current live state as ONE undo step.
    historyRef.current.push(cloneElements(elementsRef.current));
    refreshUndo();
  }, [refreshUndo]);

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.undo();
    if (prev !== null) {
      setElements(prev);
      elementsRef.current = prev;
      setSelectedId(null);
      refreshUndo();
    }
  }, [refreshUndo]);

  const handleRedo = useCallback(() => {
    const next = historyRef.current.redo();
    if (next !== null) {
      setElements(next);
      elementsRef.current = next;
      setSelectedId(null);
      refreshUndo();
    }
  }, [refreshUndo]);

  const handleClear = useCallback(() => {
    if (elementsRef.current.length === 0) {
      setShowClearConfirm(false);
      return;
    }
    setShowClearConfirm(true);
  }, []);

  const confirmClear = useCallback(() => {
    setShowClearConfirm(false);
    setSelectedId(null);
    clearLasso();
    commitElements([]);
  }, [clearLasso, commitElements]);

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        handleRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Don't hijack text input deletion (no text UI yet, but be safe).
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        const next = elementsRef.current.filter((el) => el.id !== selectedId);
        setSelectedId(null);
        commitElements(next);
      } else if (e.key === 'Escape') {
        setShowClearConfirm(false);
        setShowOther(false);
        clearLasso();
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo, selectedId, commitElements, clearLasso]);

  // ---------- lasso ----------
  const handleLassoStart = useCallback(() => {
    // Starting a new lasso clears the previous lasso + card.
    setLassoPath(null);
    setCapture(null);
  }, []);

  const handleLassoComplete = useCallback(
    (points) => {
      if (!isValidLasso(points)) {
        showToast('Circle a bigger area');
        setLassoPath(null);
        setCapture(null);
        return;
      }
      const closed = [...points, points[0]];
      setLassoPath(closed);
      const canvasSize = { w: window.innerWidth, h: window.innerHeight };
      const dpr = window.devicePixelRatio || 1;
      let result;
      try {
        result = captureRegion(elementsRef.current, closed, canvasSize, dpr);
      } catch {
        showToast('Could not capture that area');
        return;
      }
      if (result.isEmpty || !result.dataUrl) {
        showToast('Nothing inside that circle');
        setLassoPath(null);
        setCapture(null);
        return;
      }
      // Stored in App state so Phase 2 can send dataUrl to the backend.
      setCapture({ dataUrl: result.dataUrl, bounds: result.bounds, path: closed });
    },
    [showToast]
  );

  const placeholderAI = useCallback(() => {
    showToast('AI not connected yet (Phase 2)');
    return Promise.resolve();
  }, [showToast]);
  void placeholderAI;

  const handleGradeChange = useCallback((g) => {
    setGradeLevel(g);
    try {
      window.localStorage.setItem('ivla-grade', g);
    } catch {
      /* private mode: ignore */
    }
  }, []);

  // Place a box RIGHT of the lasso bounds, or below it if there isn't room.
  const placeBox = useCallback((bounds, w, h) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x;
    let y;
    if (bounds && bounds.x + bounds.w + 16 + w <= vw - 12) {
      x = bounds.x + bounds.w + 16;
      y = bounds.y;
    } else {
      x = bounds ? bounds.x : 100;
      y = bounds ? bounds.y + bounds.h + 16 : 100;
    }
    x = Math.max(12, Math.min(Math.max(12, vw - w - 12), x));
    y = Math.max(12, Math.min(Math.max(12, vh - h - 130), y)); // clear toolbar
    return { x, y };
  }, []);

  // Add to board (image): normal image element scaled to ~360px wide,
  // same placement rules. Select/erase/undo work like any other element.
  const handleAddImage = useCallback(
    (src, meta = null) => {
      if (!src) {
        showToast('No image to add yet.');
        return;
      }
      const img = new Image();
      img.onload = () => {
        const maxW = 380;
        const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
        const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
        const pos = placeBox(capture?.bounds, w, h);
        const el = createImage(pos.x, pos.y, w, h, src, meta);
        commitElements([...elementsRef.current, el]);
        showToast('Added to board');
      };
      img.onerror = () => showToast('That image could not be added to the board.');
      img.src = src;
    },
    [capture, commitElements, placeBox, showToast]
  );
  // Add to board (text): normal text element, one undo step. Select can move
  // it, Eraser removes it, undo/redo work like any other element.
  const handleAddText = useCallback(
    (text) => {
      const content = String(text || '').trim();
      if (!content) {
        showToast('Nothing to add yet.');
        return;
      }
      const fontSize = 26;
      const layout = layoutText(content, fontSize, TEXT_MAX_WIDTH);
      const pos = placeBox(capture?.bounds, layout.width + 12, layout.height + 12);
      const el = createText(pos.x + 6, pos.y + fontSize + 6, content, fontSize, '#111827');
      commitElements([...elementsRef.current, el]);
      showToast('Added to board');
    },
    [capture, commitElements, placeBox, showToast]
  );

  const canvasSizeNote = useMemo(() => null, []);
  void canvasSizeNote;

  return (
    <div className="ivla-root">
      <div className="ivla-top-line" aria-hidden="true" />
      <div className="ivla-wordmark" aria-label="IVLA">
        IVLA
      </div>

      <WhiteboardCanvas
        elements={elements}
        tool={tool}
        color={color}
        width={strokeWidth}
        shapeKind={shapeKind}
        selectedId={selectedId}
        lassoPath={lassoPath}
        onAddElement={handleAddElement}
        onLiveElements={handleLiveElements}
        onLiveCommit={handleLiveCommit}
        onSelect={setSelectedId}
        onLassoStart={handleLassoStart}
        onLassoComplete={handleLassoComplete}
      />

      {(capture || typeOpen) && (
        <CapturePreview
          key={capture ? 'capture' : 'type-only'}
          capture={capture}
          startInType={!capture && typeOpen}
          gradeLevel={gradeLevel}
          onGradeChange={handleGradeChange}
          onDismiss={clearLasso}
          notify={showToast}
          onAddText={handleAddText}
          onAddImage={handleAddImage}
        />
      )}

      {/* Type-instead entry when the AI tool is active but nothing is circled. */}
      {tool === 'ai' && !capture && !typeOpen && (
        <button
          type="button"
          className="ivla-type-fab"
          aria-label="Type the concept instead of circling"
          onClick={() => setTypeOpen(true)}
        >
          <span aria-hidden="true">T</span>
          Type instead
        </button>
      )}

      {showClearConfirm && (
        <div className="ivla-confirm" role="alertdialog" aria-label="Confirm clear">
          <p>Clear the whole board?</p>
          <div className="ivla-confirm-actions">
            <button type="button" className="ivla-btn-secondary" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </button>
            <button type="button" className="ivla-btn-danger" onClick={confirmClear}>
              Clear
            </button>
          </div>
        </div>
      )}

      <Toolbar
        tool={tool}
        setTool={setTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        color={color}
        setColor={setColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        shapeKind={shapeKind}
        setShapeKind={setShapeKind}
        showOther={showOther}
        setShowOther={setShowOther}
      />

      {toast && (
        <div className="ivla-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
