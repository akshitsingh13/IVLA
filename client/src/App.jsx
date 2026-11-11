import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from './components/Toolbar.jsx';
import WhiteboardCanvas from './components/WhiteboardCanvas.jsx';
import CapturePreview from './components/CapturePreview.jsx';
import PageManager from './components/PageManager.jsx';
import { createHistory } from './board/history.js';
import { cloneElements, createText, createImage, layoutText, TEXT_MAX_WIDTH } from './board/elements.js';
import { captureRegion, isValidLasso } from './board/lasso.js';
import './App.css';

export default function App() {
  const [pages, setPages] = useState(() => [
    { id: 'page-1', elements: [] },
  ]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
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

  const pageHistoriesRef = useRef({});
  const getPageHistory = useCallback((pageId, initialElements = []) => {
    if (!pageHistoriesRef.current[pageId]) {
      const h = createHistory(100);
      h.push(cloneElements(initialElements));
      pageHistoriesRef.current[pageId] = h;
    }
    return pageHistoriesRef.current[pageId];
  }, []);

  const toastTimerRef = useRef(0);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const currentPageIndexRef = useRef(currentPageIndex);
  currentPageIndexRef.current = currentPageIndex;

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

  const currentPage = pages[currentPageIndex];
  const curHistory = currentPage ? getPageHistory(currentPage.id, currentPage.elements) : null;
  const canUndo = curHistory ? curHistory.canUndo() : false;
  const canRedo = curHistory ? curHistory.canRedo() : false;
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
      const curPage = pagesRef.current[currentPageIndexRef.current];
      if (curPage) {
        getPageHistory(curPage.id).push(cloned);
        setPages((prev) =>
          prev.map((p, idx) => (idx === currentPageIndexRef.current ? { ...p, elements: cloned } : p))
        );
      }
      refreshUndo();
    },
    [getPageHistory, refreshUndo]
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
    setPages((prev) =>
      prev.map((p, idx) => (idx === currentPageIndexRef.current ? { ...p, elements: cloned } : p))
    );
  }, []);

  const handleLiveCommit = useCallback(() => {
    // Push the current live state as ONE undo step.
    const curPage = pagesRef.current[currentPageIndexRef.current];
    if (curPage) {
      getPageHistory(curPage.id).push(cloneElements(elementsRef.current));
    }
    refreshUndo();
  }, [getPageHistory, refreshUndo]);

  const handleUndo = useCallback(() => {
    const curPage = pagesRef.current[currentPageIndexRef.current];
    if (!curPage) return;
    const h = getPageHistory(curPage.id);
    const prev = h.undo();
    if (prev !== null) {
      const cloned = cloneElements(prev);
      setElements(cloned);
      elementsRef.current = cloned;
      setPages((prevPages) =>
        prevPages.map((p, idx) => (idx === currentPageIndexRef.current ? { ...p, elements: cloned } : p))
      );
      setSelectedId(null);
      refreshUndo();
    }
  }, [getPageHistory, refreshUndo]);

  const handleRedo = useCallback(() => {
    const curPage = pagesRef.current[currentPageIndexRef.current];
    if (!curPage) return;
    const h = getPageHistory(curPage.id);
    const next = h.redo();
    if (next !== null) {
      const cloned = cloneElements(next);
      setElements(cloned);
      elementsRef.current = cloned;
      setPages((prevPages) =>
        prevPages.map((p, idx) => (idx === currentPageIndexRef.current ? { ...p, elements: cloned } : p))
      );
      setSelectedId(null);
      refreshUndo();
    }
  }, [getPageHistory, refreshUndo]);

  // ---------- Page Navigation & Management ----------
  const handleSelectPage = useCallback(
    (newIndex) => {
      if (
        newIndex < 0 ||
        newIndex >= pagesRef.current.length ||
        newIndex === currentPageIndexRef.current
      )
        return;
      clearLasso();
      setSelectedId(null);
      setCurrentPageIndex(newIndex);
      currentPageIndexRef.current = newIndex;
      const targetPage = pagesRef.current[newIndex];
      const cloned = cloneElements(targetPage.elements || []);
      setElements(cloned);
      elementsRef.current = cloned;
      getPageHistory(targetPage.id, cloned);
      refreshUndo();
    },
    [clearLasso, getPageHistory, refreshUndo]
  );

  const handleAddPage = useCallback(() => {
    clearLasso();
    setSelectedId(null);
    const newPage = {
      id: 'page-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      elements: [],
    };
    const newPages = [...pagesRef.current, newPage];
    const newIndex = newPages.length - 1;
    getPageHistory(newPage.id, []);
    setPages(newPages);
    setCurrentPageIndex(newIndex);
    currentPageIndexRef.current = newIndex;
    setElements([]);
    elementsRef.current = [];
    refreshUndo();
    showToast(`Page ${newIndex + 1} added`);
  }, [clearLasso, getPageHistory, refreshUndo, showToast]);

  const handleDuplicatePage = useCallback(
    (index) => {
      const source = pagesRef.current[index];
      if (!source) return;
      clearLasso();
      setSelectedId(null);
      const duplicatedElements = cloneElements(source.elements || []).map((el) => ({
        ...el,
        id: 'el-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      }));
      const newPage = {
        id: 'page-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        elements: duplicatedElements,
      };
      const newPages = [...pagesRef.current];
      const insertIndex = index + 1;
      newPages.splice(insertIndex, 0, newPage);
      getPageHistory(newPage.id, duplicatedElements);
      setPages(newPages);
      setCurrentPageIndex(insertIndex);
      currentPageIndexRef.current = insertIndex;
      setElements(duplicatedElements);
      elementsRef.current = duplicatedElements;
      refreshUndo();
      showToast(`Page ${insertIndex + 1} duplicated`);
    },
    [clearLasso, getPageHistory, refreshUndo, showToast]
  );

  const handleDeletePage = useCallback(
    (index) => {
      if (pagesRef.current.length <= 1) {
        showToast('Cannot delete the only page');
        return;
      }
      const deletedPage = pagesRef.current[index];
      if (deletedPage) {
        delete pageHistoriesRef.current[deletedPage.id];
      }
      const newPages = pagesRef.current.filter((_, idx) => idx !== index);
      const nextIndex = Math.min(index, newPages.length - 1);
      setPages(newPages);
      setCurrentPageIndex(nextIndex);
      currentPageIndexRef.current = nextIndex;
      const nextElements = cloneElements(newPages[nextIndex].elements || []);
      setElements(nextElements);
      elementsRef.current = nextElements;
      clearLasso();
      setSelectedId(null);
      refreshUndo();
      showToast(`Page ${index + 1} deleted`);
    },
    [clearLasso, refreshUndo, showToast]
  );

  const handleMovePage = useCallback((fromIndex, toIndex) => {
    if (
      toIndex < 0 ||
      toIndex >= pagesRef.current.length ||
      fromIndex === toIndex
    )
      return;
    const currentId = pagesRef.current[currentPageIndexRef.current]?.id;
    const nextPages = [...pagesRef.current];
    const [removed] = nextPages.splice(fromIndex, 1);
    nextPages.splice(toIndex, 0, removed);
    setPages(nextPages);
    const newCurIndex = nextPages.findIndex((p) => p.id === currentId);
    setCurrentPageIndex(newCurIndex);
    currentPageIndexRef.current = newCurIndex;
  }, []);

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

      <PageManager
        pages={pages}
        currentPageIndex={currentPageIndex}
        onSelectPage={handleSelectPage}
        onAddPage={handleAddPage}
        onDuplicatePage={handleDuplicatePage}
        onDeletePage={handleDeletePage}
        onMovePage={handleMovePage}
      />

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
