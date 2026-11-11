import { useState } from 'react';
import { FileDown, X, Loader2, CheckCircle2 } from 'lucide-react';
import { exportWhiteboardToPDF } from '../export/pdfExport.js';

export default function ExportPdfModal({
  isOpen,
  onClose,
  pages,
  currentPageIndex = 0,
  whiteboardTitle = 'IVLA Lesson',
  notify,
}) {
  const [scope, setScope] = useState('all');
  const [pageRange, setPageRange] = useState('');
  const [pageSize, setPageSize] = useState('a4');
  const [orientation, setOrientation] = useState('landscape');
  const [title, setTitle] = useState(whiteboardTitle);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(null); // { current, total, percent }

  if (!isOpen) return null;

  const totalPages = pages.length;

  const handleExport = async () => {
    setIsExporting(true);
    setProgress({ current: 0, total: totalPages, percent: 0 });

    try {
      const filename = await exportWhiteboardToPDF({
        pages,
        currentPageIndex,
        options: {
          scope,
          pageRange,
          pageSize,
          orientation,
          title: title.trim() || 'IVLA-Whiteboard',
        },
        onProgress: (p) => setProgress(p),
      });

      if (notify) notify(`PDF downloaded as ${filename}`);
      onClose();
    } catch (err) {
      console.error('PDF export failed:', err);
      if (notify) notify('PDF export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  return (
    <div
      className="ivla-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Export as PDF"
      onClick={onClose}
    >
      <div
        className="ivla-export-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ivla-export-header">
          <div className="ivla-export-title-wrap">
            <FileDown size={20} className="ivla-export-icon" />
            <h3>Export as PDF</h3>
          </div>
          <button
            type="button"
            className="ivla-modal-close-btn"
            onClick={onClose}
            aria-label="Close export dialog"
            disabled={isExporting}
          >
            <X size={18} />
          </button>
        </div>

        <div className="ivla-export-body">
          {/* Filename */}
          <div className="ivla-export-field">
            <label htmlFor="pdf-title">Document Title</label>
            <input
              id="pdf-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isExporting}
              placeholder="e.g. Science Lesson Week 3"
            />
          </div>

          {/* Page Scope */}
          <div className="ivla-export-field">
            <label>Pages to Export</label>
            <div className="ivla-export-radio-group">
              <label className="ivla-radio-option">
                <input
                  type="radio"
                  name="pdf-scope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  disabled={isExporting}
                />
                <span>All Pages ({totalPages})</span>
              </label>

              <label className="ivla-radio-option">
                <input
                  type="radio"
                  name="pdf-scope"
                  value="current"
                  checked={scope === 'current'}
                  onChange={() => setScope('current')}
                  disabled={isExporting}
                />
                <span>Current Page (Page {currentPageIndex + 1})</span>
              </label>

              <label className="ivla-radio-option">
                <input
                  type="radio"
                  name="pdf-scope"
                  value="range"
                  checked={scope === 'range'}
                  onChange={() => setScope('range')}
                  disabled={isExporting}
                />
                <span>Custom Range</span>
              </label>
            </div>

            {scope === 'range' && (
              <input
                type="text"
                className="ivla-range-input"
                placeholder="e.g. 1-2, 4"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                disabled={isExporting}
                aria-label="Custom page range"
              />
            )}
          </div>

          {/* Page Size & Orientation Row */}
          <div className="ivla-export-row">
            <div className="ivla-export-field">
              <label htmlFor="pdf-size">Page Size</label>
              <select
                id="pdf-size"
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value)}
                disabled={isExporting}
              >
                <option value="a4">A4 (210 × 297 mm)</option>
                <option value="a3">A3 (297 × 420 mm)</option>
              </select>
            </div>

            <div className="ivla-export-field">
              <label htmlFor="pdf-orient">Orientation</label>
              <select
                id="pdf-orient"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                disabled={isExporting}
              >
                <option value="landscape">Landscape (Recommended)</option>
                <option value="portrait">Portrait</option>
              </select>
            </div>
          </div>

          {/* Progress Indicator */}
          {isExporting && progress && (
            <div className="ivla-export-progress-wrap" role="status">
              <div className="ivla-export-progress-text">
                <Loader2 size={16} className="ivla-spinner" />
                <span>
                  Rendering PDF page {progress.current} of {progress.total}...
                </span>
              </div>
              <div className="ivla-progress-track">
                <div
                  className="ivla-progress-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="ivla-export-footer">
          <button
            type="button"
            className="ivla-btn-secondary"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ivla-btn-primary ivla-export-confirm-btn"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="ivla-spinner" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <FileDown size={16} />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
