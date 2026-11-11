// Native IndexedDB storage layer for IVLA whiteboards.
// Safe, robust, zero-dependency.

const DB_NAME = 'ivla_db';
const DB_VERSION = 1;
const STORE_NAME = 'whiteboards';

let dbPromise = null;

export function getDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open database'));
  });

  return dbPromise;
}

export async function getAllWhiteboards() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? req.result : [];
        // Sort descending by last modified
        list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get whiteboards from IndexedDB:', err);
    return [];
  }
}

export async function getWhiteboard(id) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to load whiteboard ${id}:`, err);
    return null;
  }
}

export async function saveWhiteboard(board) {
  if (!board || !board.id) return null;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        ...board,
        updatedAt: Date.now(),
      });
      req.onsuccess = () => resolve(board);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save whiteboard to IndexedDB:', err);
    return null;
  }
}

export async function deleteWhiteboard(id) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Failed to delete whiteboard ${id}:`, err);
    return false;
  }
}

/**
 * Generate a lightweight thumbnail data URL for a board's elements.
 */
export function generateThumbnailDataUrl(elements) {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (elements && elements.length > 0) {
      const vw = Math.max(window.innerWidth || 1200, 800);
      const vh = Math.max(window.innerHeight || 800, 600);
      const scale = Math.min(canvas.width / vw, canvas.height / vh);
      ctx.scale(scale, scale);

      // Lazy import or simple draw
      for (const el of elements) {
        if (el.type === 'stroke' && el.points) {
          ctx.strokeStyle = el.color || '#111';
          ctx.lineWidth = Math.max(1, (el.width || 4) * 0.7);
          ctx.beginPath();
          el.points.forEach((p, idx) => {
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();
        } else if (el.type === 'shape') {
          ctx.strokeStyle = el.color || '#111';
          ctx.lineWidth = Math.max(1, (el.width || 4) * 0.7);
          if (el.shape === 'rect') {
            ctx.strokeRect(Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.abs(el.x2 - el.x1), Math.abs(el.y2 - el.y1));
          } else if (el.shape === 'ellipse') {
            ctx.beginPath();
            ctx.ellipse((el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2, Math.abs(el.x2 - el.x1) / 2, Math.abs(el.y2 - el.y1) / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(el.x1, el.y1);
            ctx.lineTo(el.x2, el.y2);
            ctx.stroke();
          }
        }
      }
    }
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch (err) {
    console.error('Thumbnail generation failed:', err);
    return null;
  }
}
