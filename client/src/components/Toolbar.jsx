import { useEffect, useRef, useState } from 'react';
import {
  MousePointer2,
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Shapes,
  CircleDashed,
  SlidersHorizontal,
  Palette,
  FileDown,
  Undo2,
  Redo2,
  Trash2,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
} from 'lucide-react';
import { BACKGROUNDS } from '../board/backgrounds.js';

const COLORS = [
  { name: 'Black', value: '#111111' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Red', value: '#e5484d' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Orange', value: '#f97316' },
];

const HIGHLIGHTER_COLORS = [
  { name: 'Yellow', value: '#facc15' },
  { name: 'Green', value: '#4ade80' },
  { name: 'Cyan', value: '#38bdf8' },
  { name: 'Pink', value: '#f472b6' },
  { name: 'Orange', value: '#fb923c' },
];

const SHAPES = [
  { kind: 'rect', label: 'Rect', icon: Square },
  { kind: 'ellipse', label: 'Ellipse', icon: Circle },
  { kind: 'line', label: 'Line', icon: Minus },
  { kind: 'arrow', label: 'Arrow', icon: ArrowUpRight },
];

function ToolButton({ label, icon: Icon, active, disabled, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      className={`ivla-tool${active ? ' is-active' : ''}`}
      aria-label={ariaLabel || label}
      aria-pressed={active || undefined}
      disabled={disabled || undefined}
      onClick={onClick}
    >
      <Icon size={22} strokeWidth={2} aria-hidden="true" />
      <span className="ivla-tool-label">{label}</span>
    </button>
  );
}

/**
 * Floating pill toolbar. Buttons left→right:
 * Select | Pen | Eraser | Shape | AI Circle | Other | divider | Undo | Redo | Clear
 */
export default function Toolbar({
  tool,
  setTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  shapeKind,
  setShapeKind,
  showOther,
  setShowOther,
  background = 'white',
  setBackground,
  onExportPdf,
}) {
  const otherWrapRef = useRef(null);
  const bgWrapRef = useRef(null);
  const [showBg, setShowBg] = useState(false);

  // Close the "Other" popover when tapping elsewhere.
  useEffect(() => {
    if (!showOther) return;
    const onDown = (e) => {
      if (otherWrapRef.current && !otherWrapRef.current.contains(e.target)) {
        setShowOther(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [showOther, setShowOther]);

  // Close the "Background" popover when tapping elsewhere.
  useEffect(() => {
    if (!showBg) return;
    const onDown = (e) => {
      if (bgWrapRef.current && !bgWrapRef.current.contains(e.target)) {
        setShowBg(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [showBg]);

  const pickTool = (t) => {
    setShowOther(false);
    setShowBg(false);
    setTool(t);
  };

  return (
    <div className="ivla-toolbar-zone">
      {tool === 'shape' && (
        <div className="ivla-shape-row" role="toolbar" aria-label="Choose shape">
          {SHAPES.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              className={`ivla-shape-btn${shapeKind === kind ? ' is-active' : ''}`}
              aria-label={label}
              aria-pressed={shapeKind === kind}
              onClick={() => setShapeKind(kind)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="ivla-toolbar" role="toolbar" aria-label="Whiteboard tools">
        <ToolButton label="Select" icon={MousePointer2} active={tool === 'select'} onClick={() => pickTool('select')} />
        <ToolButton label="Pen" icon={Pen} active={tool === 'pen'} onClick={() => pickTool('pen')} />
        <ToolButton label="Pencil" icon={Pencil} active={tool === 'pencil'} onClick={() => pickTool('pencil')} />
        <ToolButton label="Highlight" icon={Highlighter} active={tool === 'highlighter'} onClick={() => pickTool('highlighter')} />
        <ToolButton label="Eraser" icon={Eraser} active={tool === 'eraser'} onClick={() => pickTool('eraser')} />
        <ToolButton label="Shape" icon={Shapes} active={tool === 'shape'} onClick={() => pickTool('shape')} />
        <ToolButton label="AI Circle" icon={CircleDashed} active={tool === 'ai'} onClick={() => pickTool('ai')} />

        <div className="ivla-other-wrap" ref={otherWrapRef}>
          {showOther && (
            <div className="ivla-popover" role="dialog" aria-label="Tool settings">
              <div className="ivla-swatches">
                {(tool === 'highlighter' ? HIGHLIGHTER_COLORS : COLORS).map((c) => {
                  const isWhite = c.value.toUpperCase() === '#FFFFFF';
                  const isActive = (color || '').toLowerCase() === c.value.toLowerCase();
                  return (
                    <button
                      key={c.value}
                      type="button"
                      className={`ivla-swatch${isActive ? ' is-active' : ''}${isWhite ? ' ivla-swatch-white' : ''}`}
                      style={{ background: c.value }}
                      aria-label={c.name}
                      aria-pressed={isActive}
                      onClick={() => setColor(c.value)}
                    />
                  );
                })}
              </div>
              <label className="ivla-slider-row">
                <span>Width</span>
                <input
                  type="range"
                  min={tool === 'highlighter' ? 8 : 1}
                  max={tool === 'highlighter' ? 48 : 24}
                  step={1}
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  aria-label="Stroke width"
                />
                <span className="ivla-slider-val">{strokeWidth}px</span>
              </label>
            </div>
          )}
          <ToolButton
            label="Other"
            icon={SlidersHorizontal}
            active={showOther}
            onClick={() => {
              setShowBg(false);
              setShowOther(!showOther);
            }}
          />
        </div>

        <div className="ivla-other-wrap" ref={bgWrapRef}>
          {showBg && (
            <div className="ivla-popover ivla-bg-popover" role="dialog" aria-label="Whiteboard background options">
              <div className="ivla-bg-popover-title">Canvas Background</div>
              <div className="ivla-bg-options">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    className={`ivla-bg-option${background === bg.id ? ' is-active' : ''}`}
                    onClick={() => {
                      if (setBackground) setBackground(bg.id);
                      setShowBg(false);
                    }}
                    aria-label={`Set background to ${bg.label}`}
                    aria-pressed={background === bg.id}
                  >
                    <span
                      className={`ivla-bg-swatch ivla-bg-swatch-${bg.id}`}
                      style={{ background: bg.color }}
                    />
                    <span className="ivla-bg-label">{bg.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <ToolButton
            label="Backdrop"
            icon={Palette}
            active={showBg}
            onClick={() => {
              setShowOther(false);
              setShowBg(!showBg);
            }}
          />
        </div>

        <ToolButton label="PDF" icon={FileDown} onClick={onExportPdf} ariaLabel="Export as PDF" />

        <div className="ivla-divider" aria-hidden="true" />

        <ToolButton label="Undo" icon={Undo2} disabled={!canUndo} onClick={onUndo} />
        <ToolButton label="Redo" icon={Redo2} disabled={!canRedo} onClick={onRedo} />
        <ToolButton label="Clear" icon={Trash2} onClick={onClear} />
      </div>
    </div>
  );
}
