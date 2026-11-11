import { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Clock,
  Layout,
  Search,
  Check,
  X,
} from 'lucide-react';

function formatDate(timestamp) {
  if (!timestamp) return 'Recently';
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Recently';
  }
}

export default function Dashboard({
  whiteboards,
  onCreateBoard,
  onOpenBoard,
  onRenameBoard,
  onDeleteBoard,
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const filteredBoards = whiteboards.filter((b) =>
    (b.title || 'Untitled Whiteboard')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const startRename = (board, e) => {
    e.stopPropagation();
    setEditingId(board.id);
    setEditTitle(board.title || 'Untitled Whiteboard');
  };

  const saveRename = (id, e) => {
    if (e) e.stopPropagation();
    if (editTitle.trim()) {
      onRenameBoard(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e) => {
    if (e) e.stopPropagation();
    setEditingId(null);
  };

  const confirmDelete = (e) => {
    e.stopPropagation();
    if (deletingId) {
      onDeleteBoard(deletingId);
      setDeletingId(null);
    }
  };

  return (
    <div className="ivla-dashboard">
      <header className="ivla-dashboard-header">
        <div className="ivla-dashboard-brand">
          <div className="ivla-wordmark-static">IVLA</div>
          <span className="ivla-dashboard-subtitle">Visual Whiteboard</span>
        </div>

        <div className="ivla-dashboard-actions">
          <div className="ivla-dashboard-search">
            <Search size={16} className="ivla-search-icon" />
            <input
              type="text"
              placeholder="Search whiteboards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search whiteboards"
            />
          </div>

          <button
            type="button"
            className="ivla-btn-primary ivla-create-btn"
            onClick={onCreateBoard}
          >
            <Plus size={18} />
            <span>New Whiteboard</span>
          </button>
        </div>
      </header>

      <main className="ivla-dashboard-content">
        <div className="ivla-dashboard-title-row">
          <h2>Your Whiteboards ({filteredBoards.length})</h2>
        </div>

        {filteredBoards.length === 0 ? (
          <div className="ivla-dashboard-empty">
            <div className="ivla-dashboard-empty-icon">
              <Layout size={48} strokeWidth={1.5} />
            </div>
            <h3>No whiteboards found</h3>
            <p>
              {search
                ? `No whiteboards match "${search}".`
                : 'Create your first interactive whiteboard to get started.'}
            </p>
            <button
              type="button"
              className="ivla-btn-primary"
              onClick={onCreateBoard}
            >
              <Plus size={18} />
              <span>Create Whiteboard</span>
            </button>
          </div>
        ) : (
          <div className="ivla-board-grid">
            {filteredBoards.map((board) => {
              const isEditing = editingId === board.id;
              return (
                <div
                  key={board.id}
                  className="ivla-board-card"
                  onClick={() => onOpenBoard(board.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onOpenBoard(board.id);
                    }
                  }}
                  aria-label={`Open ${board.title || 'Untitled Whiteboard'}`}
                >
                  <div className="ivla-board-preview">
                    {board.thumbnail ? (
                      <img
                        src={board.thumbnail}
                        alt={`Preview of ${board.title}`}
                        className="ivla-board-thumbnail"
                      />
                    ) : (
                      <div className="ivla-board-preview-empty">
                        <Layout size={32} />
                      </div>
                    )}
                  </div>

                  <div className="ivla-board-card-body">
                    {isEditing ? (
                      <div
                        className="ivla-board-rename-form"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(board.id, e);
                            if (e.key === 'Escape') cancelRename(e);
                          }}
                          autoFocus
                          aria-label="Rename whiteboard"
                        />
                        <button
                          type="button"
                          className="ivla-rename-save"
                          onClick={(e) => saveRename(board.id, e)}
                          title="Save"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          className="ivla-rename-cancel"
                          onClick={cancelRename}
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="ivla-board-title-row">
                        <h3 className="ivla-board-title" title={board.title}>
                          {board.title || 'Untitled Whiteboard'}
                        </h3>
                        <button
                          type="button"
                          className="ivla-board-action-btn"
                          onClick={(e) => startRename(board, e)}
                          title="Rename whiteboard"
                          aria-label={`Rename ${board.title}`}
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}

                    <div className="ivla-board-meta">
                      <div className="ivla-board-date">
                        <Clock size={13} />
                        <span>{formatDate(board.updatedAt)}</span>
                      </div>

                      <button
                        type="button"
                        className="ivla-board-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(board.id);
                        }}
                        title="Delete whiteboard"
                        aria-label={`Delete ${board.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete confirmation dialog */}
      {deletingId && (
        <div
          className="ivla-confirm"
          role="alertdialog"
          aria-label="Confirm delete whiteboard"
        >
          <p>Permanently delete this whiteboard?</p>
          <div className="ivla-confirm-actions">
            <button
              type="button"
              className="ivla-btn-secondary"
              onClick={() => setDeletingId(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ivla-btn-danger"
              onClick={confirmDelete}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
