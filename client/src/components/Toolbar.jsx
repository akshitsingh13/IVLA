import { useEffect, useRef } from 'react';
import {
  MousePointer2,
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Shapes,
  CircleDashed,
  SlidersHorizontal,
  Undo2,
  Redo2,
  Trash2,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
} from 'lucide-react';

const COLORS = [
  { name: 'Black', value: '#111111' },
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
}) {
  const otherWrapRef = useRef(null);

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

  const pickTool = (t) => {
    setShowOther(false);
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
                {(tool === 'highlighter' ? HIGHLIGHTER_COLORS : COLORS).map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`ivla-swatch${color === c.value ? ' is-active' : ''}`}
                    style={{ background: c.value }}
                    aria-label={c.name}
                    aria-pressed={color === c.value}
                    onClick={() => setColor(c.value)}
                  />
                ))}
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
            onClick={() => setShowOther(!showOther)}
          />
        </div>

        <div className="ivla-divider" aria-hidden="true" />

        <ToolButton label="Undo" icon={Undo2} disabled={!canUndo} onClick={onUndo} />
        <ToolButton label="Redo" icon={Redo2} disabled={!canRedo} onClick={onRedo} />
        <ToolButton label="Clear" icon={Trash2} onClick={onClear} />
      </div>
    </div>
  );
}
