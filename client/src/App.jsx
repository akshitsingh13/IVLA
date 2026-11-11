import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Cloud, Edit2 } from 'lucide-react';
import Toolbar from './components/Toolbar.jsx';
import WhiteboardCanvas from './components/WhiteboardCanvas.jsx';
import CapturePreview from './components/CapturePreview.jsx';
import Dashboard from './components/Dashboard.jsx';
import { createHistory } from './board/history.js';
import { cloneElements, createText, createImage, layoutText, TEXT_MAX_WIDTH } from './board/elements.js';
import { captureRegion, isValidLasso } from './board/lasso.js';
import {
  getAllWhiteboards,
  getWhiteboard,
  saveWhiteboard,
  deleteWhiteboard,
  generateThumbnailDataUrl,
} from './storage/db.js';
import './App.css';

export default function App() {
  const [view, setView] = useState('loading'); // 'dashboard' | 'board' | 'loading'
  const [whiteboards, setWhiteboards] = useState([]);
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [currentBoardTitle, setCurrentBoardTitle] = useState('Untitled Whiteboard');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'idle'

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
  const saveTimerRef = useRef(0);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const currentBoardRef = useRef({ id: currentBoardId, title: currentBoardTitle });
  currentBoardRef.current = { id: currentBoardId, title: currentBoardTitle };

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(toastTimerRef.current);
    window.clearTimeout(saveTimerRef.current);
  }, []);

  // ---------- Load whiteboards on mount ----------
  useEffect(() => {
    let isMounted = true;
    getAllWhiteboards().then((boards) => {
      if (!isMounted) return;
      setWhiteboards(boards);
      try {
        const lastId = window.localStorage.getItem('ivla_last_board_id');
        if (lastId && boards.some((b) => b.id === lastId)) {
          const b = boards.find((x) => x.id === lastId);
          setCurrentBoardId(b.id);
          setCurrentBoardTitle(b.title || 'Untitled Whiteboard');
          const loadedElements = b.elements || [];
          setElements(cloneElements(loadedElements));
          historyRef.current = createHistory(100);
          historyRef.current.push(cloneElements(loadedElements));
          setView('board');
          return;
        }
      } catch {
        /* ignore */
      }
      setView('dashboard');
    });
    return () => {
      isMounted = false;
    };
  }, []);

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

  // ---------- Debounced Autosave ----------
  const scheduleAutosave = useCallback((nextElements) => {
    const cur = currentBoardRef.current;
    if (!cur.id) return;
    setSaveStatus('saving');
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const thumb = generateThumbnailDataUrl(nextElements);
        await saveWhiteboard({
          id: cur.id,
          title: cur.title,
          elements: cloneElements(nextElements),
          thumbnail: thumb,
        });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('idle');
      }
    }, 800);
  }, []);

  // ---------- commit helpers ----------
  const commitElements = useCallback(
    (next) => {
      const cloned = cloneElements(next);
      setElements(cloned);
      elementsRef.current = cloned;
      historyRef.current.push(cloned);
      refreshUndo();
      scheduleAutosave(cloned);
    },
    [refreshUndo, scheduleAutosave]
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
    const cloned = cloneElements(elementsRef.current);
    historyRef.current.push(cloned);
    refreshUndo();
    scheduleAutosave(cloned);
  }, [refreshUndo, scheduleAutosave]);

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.undo();
    if (prev !== null) {
      setElements(prev);
      elementsRef.current = prev;
      setSelectedId(null);
      refreshUndo();
      scheduleAutosave(prev);
    }
  }, [refreshUndo, scheduleAutosave]);

  const handleRedo = useCallback(() => {
    const next = historyRef.current.redo();
    if (next !== null) {
      setElements(next);
      elementsRef.current = next;
      setSelectedId(null);
      refreshUndo();
      scheduleAutosave(next);
    }
  }, [refreshUndo, scheduleAutosave]);

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

  // ---------- Dashboard Actions ----------
  const handleCreateBoard = useCallback(async () => {
    const newBoard = {
      id: 'wb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: 'Untitled Whiteboard',
      elements: [],
      thumbnail: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveWhiteboard(newBoard);
    try {
      window.localStorage.setItem('ivla_last_board_id', newBoard.id);
    } catch {
      /* ignore */
    }
    setCurrentBoardId(newBoard.id);
    setCurrentBoardTitle(newBoard.title);
    setElements([]);
    elementsRef.current = [];
    historyRef.current = createHistory(100);
    historyRef.current.push([]);
    refreshUndo();
    setSaveStatus('saved');
    setView('board');
  }, [refreshUndo]);

  const handleOpenBoard = useCallback(async (id) => {
    const b = await getWhiteboard(id);
    if (!b) {
      showToast('Could not load that whiteboard');
      return;
    }
    try {
      window.localStorage.setItem('ivla_last_board_id', b.id);
    } catch {
      /* ignore */
    }
    setCurrentBoardId(b.id);
    setCurrentBoardTitle(b.title || 'Untitled Whiteboard');
    const loadedElements = b.elements || [];
    setElements(cloneElements(loadedElements));
    elementsRef.current = cloneElements(loadedElements);
    historyRef.current = createHistory(100);
    historyRef.current.push(cloneElements(loadedElements));
    refreshUndo();
    setSaveStatus('saved');
    setView('board');
  }, [refreshUndo, showToast]);

  const handleRenameBoard = useCallback(async (id, newTitle) => {
    const b = await getWhiteboard(id);
    if (!b) return;
    const updated = { ...b, title: newTitle, updatedAt: Date.now() };
    await saveWhiteboard(updated);
    if (currentBoardRef.current.id === id) {
      setCurrentBoardTitle(newTitle);
    }
    const list = await getAllWhiteboards();
    setWhiteboards(list);
  }, []);

  const handleDeleteBoard = useCallback(async (id) => {
    await deleteWhiteboard(id);
    try {
      if (window.localStorage.getItem('ivla_last_board_id') === id) {
        window.localStorage.removeItem('ivla_last_board_id');
      }
    } catch {
      /* ignore */
    }
    const list = await getAllWhiteboards();
    setWhiteboards(list);
    showToast('Whiteboard deleted');
  }, [showToast]);

  const handleReturnToDashboard = useCallback(async () => {
    // Flush pending save
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    const cur = currentBoardRef.current;
    if (cur.id) {
      const thumb = generateThumbnailDataUrl(elementsRef.current);
      await saveWhiteboard({
        id: cur.id,
        title: cur.title,
        elements: cloneElements(elementsRef.current),
        thumbnail: thumb,
      });
    }
    clearLasso();
    setSelectedId(null);
    const list = await getAllWhiteboards();
    setWhiteboards(list);
    setView('dashboard');
  }, [clearLasso]);

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e) => {
      if (view !== 'board') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        handleRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
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
  }, [view, handleUndo, handleRedo, selectedId, commitElements, clearLasso]);

  // ---------- lasso ----------
  const handleLassoStart = useCallback(() => {
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
      setCapture({ dataUrl: result.dataUrl, bounds: result.bounds, path: closed });
    },
    [showToast]
  );

  const handleGradeChange = useCallback((g) => {
    setGradeLevel(g);
    try {
      window.localStorage.setItem('ivla-grade', g);
    } catch {
      /* private mode: ignore */
    }
  }, []);

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
    y = Math.max(12, Math.min(Math.max(12, vh - h - 130), y));
    return { x, y };
  }, []);

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

  if (view === 'loading') {
    return (
      <div className="ivla-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b', fontSize: '14px', fontWeight: '600' }}>Loading IVLA...</div>
      </div>
    );
  }

  if (view === 'dashboard') {
    return (
      <Dashboard
        whiteboards={whiteboards}
        onCreateBoard={handleCreateBoard}
        onOpenBoard={handleOpenBoard}
        onRenameBoard={handleRenameBoard}
        onDeleteBoard={handleDeleteBoard}
      />
    );
  }

  return (
    <div className="ivla-root">
      <div className="ivla-top-line" aria-hidden="true" />

      {/* Top Header with Return to Dashboard and Title */}
      <div className="ivla-board-top-nav">
        <button
          type="button"
          className="ivla-back-to-dashboard-btn"
          onClick={handleReturnToDashboard}
          aria-label="Return to Dashboard"
          title="Return to Dashboard"
        >
          <ArrowLeft size={16} />
          <span>Dashboard</span>
        </button>

        {isEditingTitle ? (
          <input
            type="text"
            className="ivla-board-title-input"
            value={currentBoardTitle}
            onChange={(e) => setCurrentBoardTitle(e.target.value)}
            onBlur={() => {
              setIsEditingTitle(false);
              handleRenameBoard(currentBoardId, currentBoardTitle.trim() || 'Untitled Whiteboard');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIsEditingTitle(false);
                handleRenameBoard(currentBoardId, currentBoardTitle.trim() || 'Untitled Whiteboard');
              }
            }}
            autoFocus
          />
        ) : (
          <div
            className="ivla-board-title-badge"
            onClick={() => setIsEditingTitle(true)}
            title="Click to rename whiteboard"
          >
            <span>{currentBoardTitle}</span>
            <Edit2 size={12} style={{ marginLeft: 6, opacity: 0.6 }} />
          </div>
        )}

        <div className={`ivla-save-status${saveStatus === 'saving' ? ' is-saving' : ''}`}>
          {saveStatus === 'saving' ? (
            <>
              <Cloud size={13} />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check size={13} />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      <div className="ivla-wordmark" style={{ top: 14, right: 20, left: 'auto' }} aria-label="IVLA">
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
