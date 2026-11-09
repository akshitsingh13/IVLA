import { useEffect, useRef, useState } from 'react';
import { X, Type, Search, Sparkles } from 'lucide-react';
import * as api from '../api/ivlaApi.js';
import VisualDiscoveryPanel from './VisualDiscoveryPanel.jsx';

const GRADES = [
  { value: 'auto', label: 'Auto' },
  { value: 'primary', label: 'Primary' },
  { value: 'middle', label: 'Middle' },
  { value: 'high', label: 'High' },
  { value: 'college', label: 'College' },
];

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
  const [mode, setMode] = useState('text'); // 'text' | 'discover' | 'generate'
  const [step, setStep] = useState('');
  const [result, setResult] = useState(null);
  const [discoveryData, setDiscoveryData] = useState(null);
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
      setView('preview');
      return;
    }
    setError(err);
    setView('error');
  };

  // ---- text flow: interpret then explain ----
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

  // ---- PRIMARY visual flow: Wikimedia Commons Visual Discovery ----
  const startDiscover = async (cachedInterp = null) => {
    if (!capture?.dataUrl && !cachedInterp) {
      setMode('discover');
      setView('type');
      return;
    }
    const signal = beginLoading('discover', 'Searching Wikimedia Commons visuals...');
    try {
      let interpretation = cachedInterp || result?.interpretation || null;
      if (!interpretation) {
        setStep('Reading your board...');
        const interpRes = await api.interpret(capture.dataUrl, gradeLevel, { signal });
        if (interpRes.lowConfidence) {
          finishLoading();
          setLowInterp(interpRes.interpretation);
          setLowText(interpRes.interpretation?.transcription || interpRes.interpretation?.concept || '');
          setView('low');
          return;
        }
        interpretation = interpRes.interpretation;
      }

      setStep('Finding educational diagrams on Commons...');
      const discovery = await api.discoverFromImage(
        capture?.dataUrl || '',
        gradeLevel,
        { signal },
        { interpretation }
      );

      finishLoading();
      setDiscoveryData(discovery);
      setResult((prev) => ({ ...prev, interpretation: discovery.interpretation || interpretation }));
      setView('result-discovery');
    } catch (err) {
      failOr(err, signal);
    }
  };

  // ---- SECONDARY image flow: AI custom illustration (Flux/Pollinations) ----
  const startCustomImage = async (fresh = false) => {
    if (!capture?.dataUrl && !result?.interpretation && !typeText) {
      setMode('generate');
      setView('type');
      return;
    }
    const signal = beginLoading('generate', 'Generating custom illustration...');
    try {
      let interpretation = result?.interpretation || null;
      if (!interpretation && capture?.dataUrl) {
        setStep('Reading your board...');
        const interpRes = await api.interpret(capture.dataUrl, gradeLevel, { signal });
        if (interpRes.lowConfidence) {
          finishLoading();
          setLowInterp(interpRes.interpretation);
          setLowText(interpRes.interpretation?.transcription || interpRes.interpretation?.concept || '');
          setView('low');
          return;
        }
        interpretation = interpRes.interpretation;
      }

      setStep('Drawing illustration with AI...');
      let out;
      if (capture?.dataUrl) {
        out = await api.imageFromImage(
          capture.dataUrl,
          gradeLevel,
          { signal },
          { interpretation, ...(fresh ? { fresh: true } : {}) }
        );
      } else if (typeText) {
        out = await api.imageFromText(typeText.trim(), gradeLevel, { signal });
      }

      finishLoading();
      setResult((prev) => ({ ...prev, interpretation, ...out }));
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

  const discoverTyped = async () => {
    const text = typeText.trim();
    if (!text) {
      notify?.('Type the concept first — a word or two is enough.');
      return;
    }
    const signal = beginLoading('discover', 'Searching Wikimedia Commons diagrams...');
    try {
      const discovery = await api.discoverFromText(text, gradeLevel, { signal });
      finishLoading();
      setDiscoveryData(discovery);
      setResult((prev) => ({ ...prev, interpretation: discovery.interpretation }));
      setView('result-discovery');
    } catch (err) {
      failOr(err, signal);
    }
  };

  const makeCustomImageTyped = async () => {
    const text = typeText.trim();
    if (!text) {
      notify?.('Type the concept first — a word or two is enough.');
      return;
    }
    const signal = beginLoading('generate', 'Drawing an illustration with AI...');
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
    setTypeText(text);

    if (mode === 'discover') {
      const signal = beginLoading('discover', 'Searching Wikimedia Commons diagrams...');
      try {
        const discovery = await api.discoverFromText(text, gradeLevel, { signal });
        finishLoading();
        setDiscoveryData(discovery);
        setResult((prev) => ({ ...prev, interpretation: discovery.interpretation }));
        setView('result-discovery');
      } catch (err) {
        failOr(err, signal);
      }
      return;
    }

    if (mode === 'generate') {
      const signal = beginLoading('generate', 'Drawing an illustration...');
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
    if (mode === 'discover') startDiscover();
    else if (mode === 'generate') startCustomImage(true);
    else startText();
  };

  const generateTextFromCached = async () => {
    const interp = result?.interpretation || discoveryData?.interpretation;
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

  const handleInsertCommonsImage = (item) => {
    const imgUrl = item.imageUrl || item.thumbnailUrl;
    onAddImage?.(imgUrl, {
      title: item.title,
      creator: item.creator,
      license: item.license,
      licenseUrl: item.licenseUrl,
      source: item.source,
      pageUrl: item.pageUrl,
    });
  };

  const cancel = () => {
    cancelInflight();
    setView('preview');
  };

  // Card dimensions & placement
  const isDiscoveryView = view === 'result-discovery';
  const CARD_W = isDiscoveryView ? 420 : 320;
  const CARD_H = isDiscoveryView ? 520 : 420;

  const bounds = capture?.bounds || null;
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
      className={`ivla-capture${isDiscoveryView ? ' ivla-capture--discovery' : ''}`}
      style={{ left, top, width: CARD_W }}
      role="dialog"
      aria-label="AI visual learning assistant"
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
            <button
              type="button"
              className="ivla-btn-primary"
              onClick={() => startDiscover()}
              title="Find educational diagrams on Wikimedia Commons"
            >
              <Search size={16} aria-hidden="true" />
              Find visual
            </button>
            <button
              type="button"
              className="ivla-btn-secondary"
              onClick={startText}
              title="Generate conceptual explanation"
            >
              <Type size={16} aria-hidden="true" />
              Explain
            </button>
          </div>
          <button
            type="button"
            className="ivla-link"
            onClick={() => {
              setMode('discover');
              setView('type');
            }}
          >
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
              <button
                type="button"
                className="ivla-link"
                onClick={() => {
                  cancelInflight();
                  setView('type');
                }}
              >
                Type it instead
              </button>
            </p>
          )}
          <button type="button" className="ivla-btn-secondary" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}

      {view === 'result-discovery' && discoveryData && (
        <VisualDiscoveryPanel
          query={discoveryData.query}
          results={discoveryData.results}
          totalFound={discoveryData.totalFound}
          onInsert={handleInsertCommonsImage}
          onTryAgain={() => startDiscover()}
          onGenerateCustom={() => startCustomImage()}
          onDismiss={onDismiss}
        />
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
            <button
              type="button"
              className="ivla-btn-secondary"
              onClick={() => startDiscover(result.interpretation)}
            >
              <Search size={14} /> Find visual
            </button>
          </div>
          <div className="ivla-capture-actions">
            <button type="button" className="ivla-btn-secondary" onClick={tryAgain}>
              Try again
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

      {view === 'result-image' && result && (
        <div className="ivla-result">
          <div className="ivla-capture-title">Custom AI Illustration</div>
          {result.imageDataUrl && (
            <img
              className="ivla-capture-img"
              src={result.imageDataUrl}
              alt="AI-generated illustration"
            />
          )}
          <p className="ivla-note">Custom AI illustration ({result.provider || 'AI'}). May not be exact.</p>
          <div className="ivla-capture-actions">
            <button
              type="button"
              className="ivla-btn-primary"
              onClick={() => onAddImage?.(result.imageDataUrl, { source: 'AI Generated', provider: result.provider })}
            >
              Add to board
            </button>
            <button type="button" className="ivla-btn-secondary" onClick={() => startCustomImage(true)}>
              Regenerate
            </button>
          </div>
          <div className="ivla-capture-actions">
            <button type="button" className="ivla-btn-secondary" onClick={() => startDiscover()}>
              <Search size={14} /> Find on Commons
            </button>
            <button type="button" className="ivla-btn-secondary" onClick={onDismiss}>
              Dismiss
            </button>
          </div>
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
          <div className="ivla-capture-title">What visual should I find?</div>
          {gradeSelect}
          <label className="ivla-type-label" htmlFor="ivla-type-input">
            Type the concept (e.g. human heart, water cycle):
          </label>
          <textarea
            id="ivla-type-input"
            className="ivla-textarea"
            value={typeText}
            maxLength={500}
            rows={3}
            onChange={(e) => setTypeText(e.target.value)}
            placeholder="e.g. binary search"
          />
          <div className="ivla-capture-actions">
            <button
              type="button"
              className="ivla-btn-primary"
              onClick={discoverTyped}
              title="Search Wikimedia Commons"
            >
              <Search size={16} aria-hidden="true" />
              Find visual
            </button>
            <button
              type="button"
              className="ivla-btn-secondary"
              onClick={explainTyped}
              title="Explain concept"
            >
              <Type size={16} aria-hidden="true" />
              Explain
            </button>
          </div>
          <button
            type="button"
            className="ivla-link"
            onClick={makeCustomImageTyped}
            style={{ fontSize: '12px', marginTop: '4px' }}
          >
            <Sparkles size={12} style={{ display: 'inline', marginRight: '4px' }} />
            Generate custom AI illustration instead
          </button>
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
