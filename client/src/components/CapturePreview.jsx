import { useEffect, useRef, useState } from 'react';
import { X, Type, Image as ImageIcon } from 'lucide-react';
import * as api from '../api/ivlaApi.js';

const GRADES = [
  { value: 'auto', label: 'Auto' },
  { value: 'primary', label: 'Primary' },
  { value: 'middle', label: 'Middle' },
  { value: 'high', label: 'High' },
  { value: 'college', label: 'College' },
];

// Views: preview -> loading -> result-text | error | low | type (+ result-image in step 8)
export default function CapturePreview({
  capture,
  gradeLevel,
  onGradeChange,
  onDismiss,
  notify,
  onAddText,
  onAddImage,
  startInType = false,
}) {
  const [view, setView] = useState(startInType ? 'type' : 'preview');
  const [mode, setMode] = useState('text'); // which flow produced the current view
  const [step, setStep] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lowInterp, setLowInterp] = useState(null);
  const [lowText, setLowText] = useState('');
  const [typeText, setTypeText] = useState('');
  const [showWhat, setShowWhat] = useState(false);
  const [slow, setSlow] = useState(false);
  const [usage, setUsage] = useState(null);
  const abortRef = useRef(null);
  const slowTimerRef = useRef(0);

  const cancelInflight = () => {
    try {
      abortRef.current?.abort();
    } catch {
      /* noop */
    }
    abortRef.current = null;
    window.clearTimeout(slowTimerRef.current);
  };

  useEffect(
    () => () => {
      cancelInflight();
    },
    []
  );

  const refreshUsage = async () => {
    const u = await api.getUsage();
    if (u) setUsage(u);
  };

  const beginLoading = (nextMode, firstStep) => {
    cancelInflight();
    const controller = new AbortController();
    abortRef.current = controller;
    setMode(nextMode);
    setView('loading');
    setStep(firstStep);
    setSlow(false);
    setError(null);
    window.clearTimeout(slowTimerRef.current);
    slowTimerRef.current = window.setTimeout(() => setSlow(true), 15000);
    return controller.signal;
  };

  const finishLoading = () => {
    window.clearTimeout(slowTimerRef.current);
    abortRef.current = null;
    refreshUsage();
  };

  const failOr = (err, signal) => {
    finishLoading();
    if (signal?.aborted || err?.code === 'ABORTED') {
      setView('preview'); // cancelled: back quietly, no error
      return;
    }
    setError(err);
    setView('error');
  };

  // ---- text flow: interpret (honest step 1) then explain (honest step 2) ----
  const startText = async () => {
    if (!capture?.dataUrl) {
      setMode('text');
      setView('type');
      return;
    }
    const signal = beginLoading('text', 'Reading your board...');
    try {
      const { interpretation, lowConfidence } = await api.interpret(
        capture.dataUrl,
        gradeLevel,
        { signal }
      );
      if (lowConfidence) {
        finishLoading();
        setLowInterp(interpretation);
        setLowText(interpretation?.transcription || interpretation?.concept || '');
        setView('low');
        return;
      }
      setStep('Writing the explanation...');
      const out = await api.explain(interpretation, gradeLevel, { signal });
      finishLoading();
      setResult({ interpretation, ...out });
      setShowWhat(false);
      setView('result-text');
    } catch (err) {
      failOr(err, signal);
    }
  };

  // ---- image flow: routes land in step 7; until then the error state applies ----
  const startImage = async (fresh = false) => {
    if (!capture?.dataUrl) {
      setMode('image');
      setView('type');
      return;
    }
    const signal = beginLoading('image', 'Reading your board...');
    try {
      const { interpretation, lowConfidence } = await api.interpret(
        capture.dataUrl,
        gradeLevel,
        { signal }
      );
      if (lowConfidence) {
        finishLoading();
        setLowInterp(interpretation);
        setLowText(interpretation?.transcription || interpretation?.concept || '');
        setView('low');
        return;
      }
      setStep('Drawing an illustration...');
      // Reuse the interpretation we just read: the server skips a second
      // vision call when it is provided. Regenerate passes fresh:true for a
      // genuinely new image instead of the cached one.
      const out = await api.imageFromImage(
        capture.dataUrl,
        gradeLevel,
        { signal },
        { interpretation, ...(fresh ? { fresh: true } : {}) }
      );
      finishLoading();
      setResult({ interpretation, ...out });
      setView('result-image');
    } catch (err) {
      failOr(err, signal);
    }
  };

  const explainTyped = async () => {
    const text = typeText.trim();
    if (!text) {
      notify?.('Type the concept first — a word or two is enough.');
      return;
    }
    const signal = beginLoading(mode, 'Writing the explanation...');
    try {
      const out = await api.textFromText(text, gradeLevel, { signal });
      finishLoading();
      setResult(out);
      setShowWhat(false);
      setView('result-text');
    } catch (err) {
      failOr(err, signal);
    }
  };

  const makeImageTyped = async () => {
    const text = typeText.trim();
    if (!text) {
      notify?.('Type the concept first — a word or two is enough.');
      return;
    }
    const signal = beginLoading('image', 'Drawing an illustration...');
    try {
      const out = await api.imageFromText(text, gradeLevel, { signal });
      finishLoading();
      setResult(out);
      setView('result-image');
    } catch (err) {
      failOr(err, signal);
    }
  };

  const useLowText = async () => {
    const text = lowText.trim();
    if (!text) {
      notify?.('Type what was on the board first.');
      return;
    }
    if (mode === 'image') {
      setTypeText(text);
      const signal = beginLoading('image', 'Drawing an illustration...');
      try {
        const out = await api.imageFromText(text, gradeLevel, { signal });
        finishLoading();
        setResult(out);
        setView('result-image');
      } catch (err) {
        failOr(err, signal);
      }
      return;
    }
    const signal = beginLoading('text', 'Writing the explanation...');
    try {
      const out = await api.textFromText(text, gradeLevel, { signal });
      finishLoading();
      setResult(out);
      setShowWhat(false);
      setView('result-text');
    } catch (err) {
      failOr(err, signal);
    }
  };

  const tryAgain = () => {
    if (mode === 'image') startImage();
    else startText();
  };

  // Generate text from the cached interpretation: no second board read.
  const generateTextFromCached = async () => {
    const interp = result?.interpretation;
    if (!interp) {
      startText();
      return;
    }
    const signal = beginLoading('text', 'Writing the explanation...');
    try {
      const out = await api.explain(interp, gradeLevel, { signal });
      finishLoading();
      setResult({ interpretation: interp, ...out });
      setShowWhat(false);
      setView('result-text');
    } catch (err) {
      failOr(err, signal);
    }
  };

  const cancel = () => {
    cancelInflight();
    setView('preview');
  };

  // ---- placement: below the lasso bounds, above if no room, kept on screen ----
  const bounds = capture?.bounds || null;
  const CARD_W = 300;
  const CARD_H = 420;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  let left = bounds ? bounds.x + bounds.w / 2 - CARD_W / 2 : vw / 2 - CARD_W / 2;
  left = Math.max(12, Math.min(vw - CARD_W - 12, left));
  let top = bounds ? bounds.y + bounds.h + 16 : Math.max(12, vh / 2 - CARD_H / 2);
  if (top + CARD_H > vh - 110) {
    top = Math.max(12, (bounds ? bounds.y : vh / 2) - CARD_H - 16);
  }

  const gradeSelect = (
    <label className="ivla-grade-row">
      <span>Level</span>
      <select
        value={gradeLevel}
        onChange={(e) => onGradeChange?.(e.target.value)}
        aria-label="Grade level"
      >
        {GRADES.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div
      className="ivla-capture"
      style={{ left, top, width: CARD_W }}
      role="dialog"
      aria-label="AI result card"
    >
      <button type="button" className="ivla-capture-x" aria-label="Dismiss" onClick={onDismiss}>
        <X size={16} aria-hidden="true" />
      </button>

      {view === 'preview' && (
        <>
          <div className="ivla-capture-title">Circled region</div>
          {capture?.dataUrl && (
            <img className="ivla-capture-img" src={capture.dataUrl} alt="Captured circled region" />
          )}
          {gradeSelect}
          <div className="ivla-capture-actions">
            <button type="button" className="ivla-btn-primary" onClick={startText}>
              <Type size={16} aria-hidden="true" />
              Generate text
            </button>
            <button type="button" className="ivla-btn-secondary" onClick={startImage}>
              <ImageIcon size={16} aria-hidden="true" />
              Generate image
            </button>
          </div>
          <button type="button" className="ivla-link" onClick={() => { setMode('text'); setView('type'); }}>
            Type it instead
          </button>
        </>
      )}

      {view === 'loading' && (
        <div className="ivla-loading">
          <div className="ivla-spinner" aria-hidden="true" />
          <p role="status">{step}</p>
          {slow && (
            <p className="ivla-slow">
              Taking longer than usual...{' '}
              <button type="button" className="ivla-link" onClick={() => { cancelInflight(); setView('type'); }}>
                Type it instead
              </button>
            </p>
          )}
          <button type="button" className="ivla-btn-secondary" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}

      {view === 'result-text' && result && (
        <div className="ivla-result">
          <div className="ivla-capture-title">Explanation</div>
          <p className="ivla-explanation">{result.explanation || '—'}</p>
          {result.example && (
            <div className="ivla-block">
              <strong>Example:</strong> {result.example}
            </div>
          )}
          {result.checkQuestion && (
            <div className="ivla-block">
              <strong>Check:</strong> {result.checkQuestion}
            </div>
          )}
          {result.interpretation && (
            <details className="ivla-what" open={showWhat} onToggle={(e) => setShowWhat(e.target.open)}>
              <summary>What I read</summary>
              {result.interpretation.transcription && (
                <p><strong>Read:</strong> {result.interpretation.transcription}</p>
              )}
              {result.interpretation.concept && (
                <p><strong>Topic:</strong> {result.interpretation.concept}</p>
              )}
            </details>
          )}
          <div className="ivla-capture-actions">
            <button
              type="button"
              className="ivla-btn-primary"
              onClick={() => onAddText?.(result.explanation)}
            >
              Add to board
            </button>
            <button type="button" className="ivla-btn-secondary" onClick={tryAgain}>
              Try again
            </button>
          </div>
          <div className="ivla-capture-actions">
            <button type="button" className="ivla-btn-secondary" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
          <button type="button" className="ivla-link" onClick={() => { setView('type'); }}>
            Type it instead
          </button>
        </div>
      )}

      {view === 'result-image' && result && (
        <div className="ivla-result">
          <div className="ivla-capture-title">Illustration</div>
          {result.imageDataUrl && (
            <img
              className="ivla-capture-img"
              src={result.imageDataUrl}
              alt="AI-generated illustration"
            />
          )}
          <p className="ivla-note">AI illustration. May not be exact.</p>
          <div className="ivla-capture-actions">
            <button
              type="button"
              className="ivla-btn-primary"
              onClick={() => onAddImage?.(result.imageDataUrl)}
            >
              Add to board
            </button>
            <button type="button" className="ivla-btn-secondary" onClick={() => startImage(true)}>
              Regenerate
            </button>
          </div>
          <div className="ivla-capture-actions">
            <button type="button" className="ivla-btn-secondary" onClick={generateTextFromCached}>
              Generate text
            </button>
            <button type="button" className="ivla-btn-secondary" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
          <button type="button" className="ivla-link" onClick={() => { setView('type'); }}>
            Type it instead
          </button>
        </div>
      )}

      {view === 'error' && (
        <div className="ivla-result">
          <div className="ivla-capture-title">Couldn&apos;t do that</div>
          <p className="ivla-error-msg">{error?.message || 'Something went wrong.'}</p>
          <div className="ivla-capture-actions">
            <button type="button" className="ivla-btn-primary" onClick={() => setView('type')}>
              Type it instead
            </button>
            <button type="button" className="ivla-btn-secondary" onClick={tryAgain}>
              Try again
            </button>
          </div>
        </div>
      )}

      {view === 'low' && (
        <div className="ivla-result">
          <div className="ivla-capture-title">I couldn&apos;t read this clearly.</div>
          {(lowInterp?.transcription || lowInterp?.concept) && (
            <p className="ivla-note">
              Best guess: {lowInterp.transcription || lowInterp.concept}
            </p>
          )}
          <label className="ivla-type-label" htmlFor="ivla-low-input">
            Fix it up and use your text:
          </label>
          <input
            id="ivla-low-input"
            className="ivla-input"
            value={lowText}
            maxLength={500}
            onChange={(e) => setLowText(e.target.value)}
            placeholder="What was on the board?"
            aria-label="Correct the transcription"
          />
          <div className="ivla-capture-actions">
            <button type="button" className="ivla-btn-primary" onClick={useLowText}>
              Use this text
            </button>
            <button type="button" className="ivla-btn-secondary" onClick={tryAgain}>
              Try again
            </button>
          </div>
        </div>
      )}

      {view === 'type' && (
        <div className="ivla-result">
          <div className="ivla-capture-title">What should I explain?</div>
          {gradeSelect}
          <label className="ivla-type-label" htmlFor="ivla-type-input">
            Type the concept (max 500 characters):
          </label>
          <textarea
            id="ivla-type-input"
            className="ivla-textarea"
            value={typeText}
            maxLength={500}
            rows={3}
            onChange={(e) => setTypeText(e.target.value)}
            placeholder="e.g. fractions"
          />
          <div className="ivla-capture-actions">
            <button type="button" className="ivla-btn-primary" onClick={explainTyped}>
              <Type size={16} aria-hidden="true" />
              Explain
            </button>
            <button type="button" className="ivla-btn-secondary" onClick={makeImageTyped}>
              <ImageIcon size={16} aria-hidden="true" />
              Make image
            </button>
          </div>
          {capture && (
            <button type="button" className="ivla-link" onClick={() => setView('preview')}>
              Back to preview
            </button>
          )}
        </div>
      )}

      {usage && (
        <div className="ivla-usage" aria-live="polite">
          AI calls this session: {usage.nvidiaCalls}
        </div>
      )}
    </div>
  );
}
