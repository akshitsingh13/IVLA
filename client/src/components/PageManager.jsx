import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  X,
} from 'lucide-react';
import { renderAll } from '../board/renderer.js';
import { drawBackground } from '../board/backgrounds.js';

function PageThumbCanvas({ elements, background = 'white' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    drawBackground(ctx, canvas.width, canvas.height, background);

    const vw = Math.max(window.innerWidth || 1200, 800);
    const vh = Math.max(window.innerHeight || 800, 600);
    const scale = Math.min(canvas.width / vw, canvas.height / vh);

    ctx.scale(scale, scale);
    renderAll(ctx, elements || []);
    ctx.restore();
  }, [elements, background]);

  return (
    <canvas
      ref={canvasRef}
      width={130}
      height={80}
      className="ivla-page-thumb-canvas"
      aria-hidden="true"
    />
  );
}

export default function PageManager({
  pages,
  currentPageIndex,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isOpen]);

  const totalPages = pages.length;
  const hasPrev = currentPageIndex > 0;
  const hasNext = currentPageIndex < totalPages - 1;

  const handlePrev = () => {
    if (hasPrev) onSelectPage(currentPageIndex - 1);
  };

  const handleNext = () => {
    if (hasNext) onSelectPage(currentPageIndex + 1);
  };

  return (
    <div className="ivla-page-manager-wrap" ref={panelRef}>
      {/* Top Center Page Navigation Bar */}
      <div className="ivla-page-bar" role="navigation" aria-label="Whiteboard pages">
        <button
          type="button"
          className="ivla-page-btn"
          disabled={!hasPrev}
          onClick={handlePrev}
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          type="button"
          className="ivla-page-indicator"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label={`Page ${currentPageIndex + 1} of ${totalPages}. Click to view all pages.`}
        >
          <Layers size={15} className="ivla-page-layers-icon" />
          <span>
            Page {currentPageIndex + 1} of {totalPages}
          </span>
        </button>

        <button
          type="button"
          className="ivla-page-btn"
          disabled={!hasNext}
          onClick={handleNext}
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight size={18} />
        </button>

        <div className="ivla-page-bar-divider" aria-hidden="true" />

        <button
          type="button"
          className="ivla-page-btn ivla-page-add-btn"
          onClick={onAddPage}
          aria-label="Add new page"
          title="Add new page"
        >
          <Plus size={18} />
          <span className="ivla-page-add-label">New Page</span>
        </button>
      </div>

      {/* Expandable Pages Drawer / Grid */}
      {isOpen && (
        <div
          className="ivla-page-drawer"
          role="dialog"
          aria-label="All Whiteboard Pages"
        >
          <div className="ivla-page-drawer-header">
            <h3>Pages ({totalPages})</h3>
            <button
              type="button"
              className="ivla-page-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close page manager"
            >
              <X size={18} />
            </button>
          </div>

          <div className="ivla-page-grid">
            {pages.map((page, index) => {
              const isActive = index === currentPageIndex;
              return (
                <div
                  key={page.id}
                  className={`ivla-page-card${isActive ? ' is-active' : ''}`}
                >
                  <div
                    className="ivla-page-thumb-wrap"
                    onClick={() => {
                      onSelectPage(index);
                      setIsOpen(false);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onSelectPage(index);
                        setIsOpen(false);
                      }
                    }}
                    aria-label={`Switch to page ${index + 1}`}
                  >
                    <PageThumbCanvas elements={page.elements} background={page.background} />
                    <span className="ivla-page-number-tag">
                      {index + 1}
                    </span>
                  </div>

                  <div className="ivla-page-card-actions">
                    <div className="ivla-page-reorder-btns">
                      <button
                        type="button"
                        className="ivla-page-action-btn"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMovePage(index, index - 1);
                        }}
                        title="Move page up"
                        aria-label={`Move page ${index + 1} up`}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="ivla-page-action-btn"
                        disabled={index === totalPages - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMovePage(index, index + 1);
                        }}
                        title="Move page down"
                        aria-label={`Move page ${index + 1} down`}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    <div className="ivla-page-crud-btns">
                      <button
                        type="button"
                        className="ivla-page-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicatePage(index);
                        }}
                        title="Duplicate page"
                        aria-label={`Duplicate page ${index + 1}`}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        className="ivla-page-action-btn ivla-page-delete-btn"
                        disabled={totalPages <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePage(index);
                        }}
                        title={
                          totalPages <= 1
                            ? 'Cannot delete the only page'
                            : 'Delete page'
                        }
                        aria-label={`Delete page ${index + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ivla-page-drawer-footer">
            <button
              type="button"
              className="ivla-btn-primary ivla-drawer-add-btn"
              onClick={() => {
                onAddPage();
              }}
            >
              <Plus size={16} />
              <span>Add New Page</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
