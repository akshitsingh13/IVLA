import { useState } from 'react';
import { ExternalLink, Plus, AlertCircle, RefreshCw } from 'lucide-react';

export default function VisualDiscoveryPanel({
  query,
  results = [],
  totalFound = 0,
  onInsert,
  onTryAgain,
  onGenerateCustom,
  onDismiss,
  isLoading = false,
}) {
  const [failedImages, setFailedImages] = useState(() => new Set());

  const handleImageError = (id) => {
    setFailedImages((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="ivla-discovery-container">
      <div className="ivla-capture-title">Visual Discovery</div>

      {query && (
        <div className="ivla-discovery-query" title={query}>
          <span className="ivla-discovery-query-label">Wikimedia Search:</span>
          <span className="ivla-discovery-query-text">{query}</span>
        </div>
      )}

      {results.length === 0 ? (
        <div className="ivla-discovery-empty">
          <AlertCircle size={24} className="ivla-discovery-empty-icon" />
          <p className="ivla-discovery-empty-text">
            No Commons visual diagrams found for this concept.
          </p>
          <div className="ivla-capture-actions">
            <button
              type="button"
              className="ivla-btn-primary"
              onClick={onGenerateCustom}
            >
              Generate custom image
            </button>
            <button
              type="button"
              className="ivla-btn-secondary"
              onClick={onTryAgain}
            >
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ivla-discovery-grid">
            {results.map((item) => {
              const isBroken = failedImages.has(item.id);
              return (
                <div key={item.id} className="ivla-discovery-card">
                  <div className="ivla-discovery-thumb-wrap">
                    {isBroken ? (
                      <div className="ivla-discovery-thumb-fallback">
                        <span>Image preview unavailable</span>
                      </div>
                    ) : (
                      <img
                        className="ivla-discovery-thumb"
                        src={item.thumbnailUrl}
                        alt={item.title}
                        loading="lazy"
                        onError={() => handleImageError(item.id)}
                      />
                    )}
                    <span className="ivla-discovery-badge">Commons</span>
                  </div>

                  <div className="ivla-discovery-info">
                    <h4 className="ivla-discovery-item-title" title={item.title}>
                      {item.title}
                    </h4>

                    <div className="ivla-discovery-meta">
                      <span className="ivla-discovery-creator" title={item.creator}>
                        {item.creator || 'Wikimedia contributor'}
                      </span>
                      <span className="ivla-discovery-license" title={item.license}>
                        {item.license || 'Public / CC'}
                      </span>
                    </div>

                    <div className="ivla-discovery-actions">
                      <a
                        href={item.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ivla-discovery-link"
                        title="View original on Wikimedia Commons"
                      >
                        <ExternalLink size={12} /> Page
                      </a>
                      <button
                        type="button"
                        className="ivla-discovery-insert-btn"
                        onClick={() => onInsert(item)}
                      >
                        <Plus size={14} /> Insert
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ivla-discovery-footer">
            <button
              type="button"
              className="ivla-link ivla-discovery-custom-link"
              onClick={onGenerateCustom}
            >
              Need a custom illustration instead? Generate with AI
            </button>
            <div className="ivla-capture-actions">
              <button
                type="button"
                className="ivla-btn-secondary"
                onClick={onDismiss}
              >
                Dismiss
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
